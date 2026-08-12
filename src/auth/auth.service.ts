import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

  /** Autentica a un usuario ya validado y devuelve el token JWT. */
  login(user: PublicUser): AuthResponse {
    return this.buildAuthResponse(user);
  }

  /**
   * Registra un usuario nuevo y devuelve el token JWT (login implícito).
   * La validación de duplicados la realiza `UsersService.create` (409).
   */
  async register(userDTO: UserDTO): Promise<AuthResponse> {
    const newUser = await this.usersService.create(userDTO);
    return this.buildAuthResponse(newUser);
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

  /** Construye la respuesta de autenticación firmando el JWT. */
  private buildAuthResponse(user: Pick<User, 'id' | 'email'>): AuthResponse {
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
}
