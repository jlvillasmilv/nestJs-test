import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PublicUser, User } from '../users/user.entity';
import { UserDTO } from '../users/user.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

/** Contenido firmado dentro del JWT. */
export interface JwtPayload {
  /** Identificador del usuario (sub = subject). */
  sub: number;
  email: string;
}

/** Payload de los tokens de recuperación de contraseña. */
export interface ResetTokenPayload extends JwtPayload {
  /** Claim que distingue un token de reset de un access token. */
  type: 'reset';
}

/** Payload de los tokens de verificación de email. */
export interface VerifyEmailPayload extends JwtPayload {
  /** Claim que distingue un token de verificación de un access token. */
  type: 'verify-email';
}

/** Respuesta estándar de login/registro. */
export interface AuthResponse {
  access_token: string;
  /** Tipo de token; siempre "Bearer". */
  token_type: 'Bearer';
  /** Vida útil del token en segundos. */
  expires_in: number;
  /** Datos públicos del usuario autenticado. */
  user: PublicUser;
}

const DEFAULT_EXPIRATION = '1h';
/** Número de rondas de sal para bcrypt. */
const BCRYPT_ROUNDS = 10;
/** Validez del enlace de recuperación de contraseña. */
const RESET_TOKEN_TTL = '15m';
/** Tipo de token usado únicamente en el flujo de recuperación. */
const RESET_TOKEN_TYPE = 'reset' as const;
/** Validez del enlace de verificación de email. */
const EMAIL_VERIFICATION_TTL = '24h';
/** Tipo de token usado únicamente en el flujo de verificación de email. */
const EMAIL_VERIFICATION_TYPE = 'verify-email' as const;

/**
 * Convierte una duración tipo "30m", "1h", "7d" a segundos.
 * Útil para informar `expires_in` sin duplicar la lógica del JwtModule.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 3600;
  const value = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return value * (multipliers[match[2]] ?? 1);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Valida credenciales de usuario para la estrategia local (login).
   *
   * Devuelve los datos públicos del usuario (sin `password`) si las
   * credenciales son correctas, o `null` en caso contrario. Nunca lanza
   * excepciones: la estrategia local es la que traduce `null` en 401,
   * evitando así revelar si un email existe o no.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<PublicUser | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.logger.warn(`Intento de login fallido para el email: ${email}`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se extrae password para excluirla del resultado
    const { password: _excluded, ...publicUser } = user;
    return publicUser;
  }

  /**
   * Autentica a un usuario ya validado y devuelve el token JWT.
   * El login queda bloqueado hasta que el email esté verificado.
   */
  login(user: PublicUser): AuthResponse {
    return this.buildAuthResponse(user);
  }

  /**
   * Registers a new user and sends a verification email.
   *
   * The account is created without an `email_verified_at` timestamp, so
   * login stays blocked until the user verifies their email via the link
   * sent here. No token is issued at registration time.
   */
  async register(userDTO: UserDTO): Promise<{ message: string }> {
    const newUser = await this.usersService.create(userDTO);
    await this.sendVerificationEmail(newUser);
    this.logger.log(`Correo de verificación enviado a: ${newUser.email}`);

    return {
      message:
        'Usuario registrado exitosamente. Se ha enviado un correo de verificación.',
    };
  }

  /**
   * Cierre de sesión.
   *
   * Con JWT sin estado (stateless) el servidor no guarda sesión: el cliente
   * debe descartar el token. Si se necesita invalidación en el servidor,
   * habría que mantener una lista negra (Redis/BD) hasta la expiración.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- con JWT stateless el token no se persiste
  logout(_token: string): { message: string } {
    return { message: 'Sesión cerrada correctamente' };
  }

  /**
   * Sends a password recovery email to the given account.
   *
   * The response is intentionally the same whether the email exists or not,
   * so this endpoint cannot be used to enumerate registered accounts.
   * The reset link embeds a short-lived JWT signed with a dedicated secret.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return { message: 'Si el correo existe, se ha enviado un enlace' };
    }

    const token = this.jwtService.sign(
      { sub: user.id, email: user.email, type: RESET_TOKEN_TYPE },
      { secret: this.resetSecret, expiresIn: RESET_TOKEN_TTL },
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset?token=${token}`;

    await this.mailService.sendResetPassword(
      user.email,
      user.username,
      resetUrl,
    );
    this.logger.log(`Enlace de recuperación enviado a: ${user.email}`);

    return { message: 'Enlace de recuperación enviado' };
  }

  /**
   * Resets the user password using a valid recovery token.
   *
   * Any failure (invalid/expired token, wrong token type, unknown user) is
   * reported as a generic 400 so the endpoint does not reveal whether an
   * account exists. Only tokens signed with the reset secret AND carrying the
   * `type: "reset"` claim are accepted; access tokens never work here.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(token, {
        secret: this.resetSecret,
      });
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (payload.type !== RESET_TOKEN_TYPE) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const user = await this.usersService.findOne(String(payload.sub));
    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updateValue(String(user.id), {
      password: hashedPassword,
    });
    this.logger.log(`Contraseña restablecida para el usuario: ${user.email}`);

    return { message: 'Contraseña actualizada' };
  }

  /**
   * Marks the user's email as verified using the token from the email link.
   *
   * The token must be signed with the email verification secret AND carry the
   * `type: "verify-email"` claim; access and password-reset tokens never work
   * here. All failures are reported as a generic 400, except when the email
   * is already verified, which is a client error the frontend can show.
   */
  async verifyEmail(
    token: string,
  ): Promise<{ message: string; user: PublicUser }> {
    let payload: VerifyEmailPayload;
    try {
      payload = this.jwtService.verify<VerifyEmailPayload>(token, {
        secret: this.emailVerificationSecret,
      });
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (payload.type !== EMAIL_VERIFICATION_TYPE) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const user = await this.usersService.findOne(String(payload.sub));
    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (user.email_verified_at) {
      throw new BadRequestException('El email ya está verificado');
    }

    const updatedUser = await this.usersService.updateValue(String(user.id), {
      email_verified_at: new Date(),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se extrae password para excluirla del resultado
    const { password: _excluded, ...publicUser } = updatedUser;
    this.logger.log(`Email verificado para el usuario: ${user.email}`);

    return { message: 'Email verificado correctamente', user: publicUser };
  }

  /**
   * Resends the verification email when the account exists and is not
   * verified yet.
   *
   * The response is generic so this endpoint cannot be used to enumerate
   * accounts or detect already-verified emails.
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user || user.email_verified_at) {
      return {
        message:
          'Si el correo existe y no está verificado, se ha enviado un nuevo enlace',
      };
    }

    await this.sendVerificationEmail(user);
    this.logger.log(`Nuevo enlace de verificación enviado a: ${user.email}`);

    return { message: 'Se ha enviado un nuevo enlace de verificación' };
  }

  /** Construye la respuesta de autenticación firmando el JWT. */
  private buildAuthResponse(
    user: Pick<User, 'id' | 'email' | 'email_verified_at'>,
  ): AuthResponse {
    // Block login until the email is verified. The structured error lets the
    // frontend distinguish this case and offer to resend the verification link.
    if (!user.email_verified_at) {
      throw new ForbiddenException({
        message:
          'Debes verificar tu correo electrónico antes de iniciar sesión',
        error: 'EMAIL_NOT_VERIFIED',
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const expiresIn =
      this.configService.get<string>('JWT_EXPIRATION') ?? DEFAULT_EXPIRATION;

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      expires_in: parseDurationToSeconds(expiresIn),
      user: user as PublicUser,
    };
  }

  /** Signs a verification token and sends the confirmation email. */
  private async sendVerificationEmail(user: PublicUser): Promise<void> {
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email, type: EMAIL_VERIFICATION_TYPE },
      {
        secret: this.emailVerificationSecret,
        expiresIn: EMAIL_VERIFICATION_TTL,
      },
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    await this.mailService.sendUserConfirmation(
      user.email,
      user.username,
      verifyUrl,
    );
  }

  /**
   * Secret used to sign/verify password recovery tokens.
   * Falls back to the access token secret when not configured.
   */
  private get resetSecret(): string {
    return (
      this.configService.get<string>('PASSWORD_RESET_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      '123456'
    );
  }

  /**
   * Secret used to sign/verify email verification tokens.
   * Falls back to the access token secret when not configured.
   */
  private get emailVerificationSecret(): string {
    return (
      this.configService.get<string>('EMAIL_VERIFICATION_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      '123456'
    );
  }
}
