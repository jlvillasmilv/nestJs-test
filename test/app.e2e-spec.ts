import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { MailService } from '../src/mail/mail.service';
import { LocalStrategy } from '../src/auth/strategies/local.strategy';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import * as bcrypt from 'bcrypt';

/** Cuerpo de respuesta de login/registro. */
interface AuthResponseBody {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: { id: number; email: string; username: string; status: boolean };
}

/** Cuerpo de respuesta del perfil (guard JWT). */
interface ProfileBody {
  userId: number;
  email: string;
}

/**
 * Tests e2e del flujo de autenticación.
 *
 * Se ejercitan el controlador, el servicio, las estrategias de Passport y el
 * JWT reales; solo se mockea `UsersService` (capa de base de datos) para que
 * los tests no requieran una instancia de MySQL.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const TEST_SECRET = 'e2e-test-secret';
  const RESET_SECRET = 'e2e-reset-secret';

  // URL capturada por el mock del servicio de correo en el flujo de recuperación
  let sentResetUrl = '';

  // "Base de datos" en memoria: email -> usuario (con password hasheado)
  const db = new Map<
    string,
    {
      id: number;
      email: string;
      username: string;
      password: string;
      status: boolean;
    }
  >();

  const mockUsersService = {
    create: jest.fn(
      async (dto: { email: string; username: string; password: string }) => {
        const email = dto.email.toLowerCase();
        const user = {
          id: db.size + 1,
          email,
          username: dto.username,
          status: false,
          password: await bcrypt.hash(dto.password, 10),
        };
        db.set(email, user);
        const { id, email: userEmail, username, status } = user;
        return { id, email: userEmail, username, status };
      },
    ),
    findOneByEmail: jest.fn((email: string) => {
      return db.get(email.toLowerCase()) ?? null;
    }),
    findOne: jest.fn((id: string) => {
      const user = [...db.values()].find((u) => String(u.id) === id);
      return Promise.resolve(user ?? null);
    }),
    updateValue: jest.fn((id: string, field: { password: string }) => {
      const user = [...db.values()].find((u) => String(u.id) === id);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      user.password = field.password;
      return user;
    }),
    createAdminUser: jest.fn(),
  };

  const mockMailService = {
    sendResetPassword: jest.fn((_email: string, _name: string, url: string) => {
      sentResetUrl = url;
    }),
  };

  beforeAll(async () => {
    // Fija las variables para que los tests no dependan de un .env externo
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.PASSWORD_RESET_SECRET = RESET_SECRET;
    process.env.JWT_EXPIRATION = '1h';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.registerAsync({
          useFactory: () => ({
            secret: TEST_SECRET,
            signOptions: { expiresIn: '1h' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: MailService, useValue: mockMailService },
        LocalStrategy,
        JwtStrategy,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    db.clear();
    sentResetUrl = '';
    mockMailService.sendResetPassword.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('registra un usuario y devuelve un access_token (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'User@Example.com',
          username: 'juan',
          password: 'Abc12345',
        })
        .expect(201);

      const body = res.body as AuthResponseBody;

      expect(body.access_token).toBeDefined();
      expect(body.token_type).toBe('Bearer');
      expect(body.expires_in).toBe(3600);
      expect(body.user.email).toBe('user@example.com');
      expect(body.user).not.toHaveProperty('password');
    });

    it('rechaza un email inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'no-es-un-email',
          username: 'juan',
          password: '12345678',
        })
        .expect(400);
    });

    it('rechaza una contraseña de menos de 8 caracteres (400)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'a@b.com', username: 'juan', password: 'corta1' })
        .expect(400);
    });

    it('rechaza una contraseña sin minúscula, mayúscula y número (400)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'a@b.com', username: 'juan', password: '12345678' })
        .expect(400);
    });

    it('rechaza propiedades desconocidas en el body (400, forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'a@b.com',
          username: 'juan',
          password: '12345678',
          status: true,
          id: 99,
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Crea el usuario admin en la "BD" con la contraseña por defecto
      db.set('admin@example.com', {
        id: 1,
        email: 'admin@example.com',
        username: 'admin',
        status: true,
        password: await bcrypt.hash('12345678', 10),
      });
    });

    it('inicia sesión con credenciales correctas (200)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: '12345678' })
        .expect(200);

      const body = res.body as AuthResponseBody;

      expect(body.access_token).toBeDefined();
      expect(body.user.email).toBe('admin@example.com');
      expect(body.user).not.toHaveProperty('password');
    });

    it('rechaza una contraseña incorrecta (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'incorrecta' })
        .expect(401);
    });

    it('rechaza un email no registrado con 401 (no revela qué emails existen)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: '12345678' })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    it('devuelve los datos del usuario con un token válido (200)', async () => {
      db.set('admin@example.com', {
        id: 1,
        email: 'admin@example.com',
        username: 'admin',
        status: true,
        password: await bcrypt.hash('12345678', 10),
      });

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: '12345678' })
        .expect(200);
      const loginBody = login.body as AuthResponseBody;

      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginBody.access_token}`)
        .expect(200);

      expect(res.body as ProfileBody).toEqual({
        userId: 1,
        email: 'admin@example.com',
      });
    });

    it('rechaza la petición sin token (401)', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('cierra la sesión con un token válido (200)', async () => {
      db.set('admin@example.com', {
        id: 1,
        email: 'admin@example.com',
        username: 'admin',
        status: true,
        password: await bcrypt.hash('12345678', 10),
      });

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: '12345678' })
        .expect(200);
      const loginBody = login.body as AuthResponseBody;

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginBody.access_token}`)
        .expect(200);

      expect(res.body as { message: string }).toEqual({
        message: 'Sesión cerrada correctamente',
      });
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('envía el enlace de recuperación si el usuario existe (201)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          username: 'juan',
          password: 'Abc12345',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(201);

      expect(res.body).toEqual({ message: 'Enlace de recuperación enviado' });
      expect(mockMailService.sendResetPassword).toHaveBeenCalledWith(
        'user@example.com',
        'juan',
        expect.stringContaining('/reset?token='),
      );
    });

    it('no revela si el email no existe: 201 genérico y sin envío', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'ghost@example.com' })
        .expect(201);

      expect(res.body).toEqual({
        message: 'Si el correo existe, se ha enviado un enlace',
      });
      expect(mockMailService.sendResetPassword).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('restablece la contraseña con un token válido y permite el nuevo login', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          username: 'juan',
          password: 'Abc12345',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(201);

      const token = new URL(sentResetUrl).searchParams.get('token');
      expect(token).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'Nueva12345' })
        .expect(201);
      expect(res.body).toEqual({ message: 'Contraseña actualizada' });

      // La contraseña antigua ya no funciona, la nueva sí
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'Abc12345' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'Nueva12345' })
        .expect(200);
    });

    it('rechaza tokens inválidos (400)', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'token-invalido', password: 'Nueva12345' })
        .expect(400);
    });

    it('rechaza una contraseña que no cumple las reglas (400)', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'algún-token', password: '12345678' })
        .expect(400);
    });

    it('un token de reset no sirve como access token (401 en /auth/profile)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          username: 'juan',
          password: 'Abc12345',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(201);

      const token = new URL(sentResetUrl).searchParams.get('token');
      expect(token).toBeDefined();

      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});
