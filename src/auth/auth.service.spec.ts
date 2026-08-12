import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  AuthService,
  JwtPayload,
  ResetTokenPayload,
  parseDurationToSeconds,
} from './auth.service';
import { UsersService } from '../users/users.service';
import { PublicUser, User } from '../users/user.entity';
import { UserDTO } from '../users/user.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findOneByEmail: jest.fn<Promise<User | null>, [email: string]>(),
    findOne: jest.fn<Promise<User | null>, [id: string]>(),
    updateValue: jest.fn<
      Promise<User>,
      [id: string, field: Partial<UserDTO>]
    >(),
    create: jest.fn<
      Promise<PublicUser>,
      [dto: { email: string; username: string; password: string }]
    >(),
  };
  const mockJwtService = {
    sign: jest.fn<string, [payload: JwtPayload, options?: JwtSignOptions]>(),
    verify: jest.fn<unknown, [token: string]>(),
  };
  const mockConfigService = {
    get: jest.fn<string | undefined, [key: string]>(
      (key: string): string | undefined =>
        ({
          JWT_EXPIRATION: '1h',
          FRONTEND_URL: 'http://localhost:3000',
          PASSWORD_RESET_SECRET: 'reset-secret',
        })[key],
    ),
  };
  const mockMailService = {
    sendResetPassword: jest.fn<
      Promise<void>,
      [email: string, name: string, url: string]
    >(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('jwt-token');
    mockMailService.sendResetPassword.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    const validUser = {
      id: 1,
      email: 'admin@example.com',
      username: 'admin',
      status: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('devuelve el usuario sin password si las credenciales son correctas', async () => {
      const hashed = await bcrypt.hash('12345678', 10);
      mockUsersService.findOneByEmail.mockResolvedValue({
        ...validUser,
        password: hashed,
      });

      const result = await service.validateUser(
        'admin@example.com',
        '12345678',
      );

      expect(result).toMatchObject({ id: 1, email: 'admin@example.com' });
      expect(result).not.toHaveProperty('password');
    });

    it('devuelve null si el usuario no existe', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('ghost@example.com', '12345678'),
      ).resolves.toBeNull();
    });

    it('devuelve null si la contraseña es incorrecta', async () => {
      const hashed = await bcrypt.hash('12345678', 10);
      mockUsersService.findOneByEmail.mockResolvedValue({
        ...validUser,
        password: hashed,
      });

      await expect(
        service.validateUser('admin@example.com', 'incorrecta'),
      ).resolves.toBeNull();
    });
  });

  describe('login', () => {
    it('firma un JWT con email y sub, y devuelve la respuesta completa', () => {
      mockJwtService.sign.mockReturnValue('signed-token');

      const user = {
        id: 1,
        email: 'admin@example.com',
        username: 'admin',
        status: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      const result = service.login(user);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: 'admin@example.com',
        sub: 1,
      });
      expect(result).toEqual({
        access_token: 'signed-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user,
      });
    });
  });

  describe('register', () => {
    it('crea el usuario y devuelve el token de acceso', async () => {
      mockUsersService.create.mockResolvedValue({
        id: 2,
        email: 'new@example.com',
        username: 'newuser',
        status: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });
      mockJwtService.sign.mockReturnValue('new-token');

      const result = await service.register({
        email: 'new@example.com',
        username: 'newuser',
        password: '12345678',
      });

      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        username: 'newuser',
        password: '12345678',
      });
      expect(result.access_token).toBe('new-token');
      expect(result.user.id).toBe(2);
    });
  });

  describe('logout', () => {
    it('devuelve un mensaje de éxito', () => {
      expect(service.logout('some-token')).toEqual({
        message: 'Sesión cerrada correctamente',
      });
    });
  });

  describe('forgotPassword', () => {
    const user = {
      id: 1,
      email: 'user@example.com',
      username: 'juan',
      password: 'hash',
      status: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('envía el enlace de recuperación si el usuario existe', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('reset-token');

      const result = await service.forgotPassword('user@example.com');

      // El token se firma con el secreto dedicado, vence en 15m y lleva el claim "type: reset"
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: 'user@example.com', type: 'reset' },
        { secret: 'reset-secret', expiresIn: '15m' },
      );
      expect(mockMailService.sendResetPassword).toHaveBeenCalledWith(
        'user@example.com',
        'juan',
        'http://localhost:3000/reset?token=reset-token',
      );
      expect(result).toEqual({ message: 'Enlace de recuperación enviado' });
    });

    it('devuelve un mensaje genérico y no envía correo si el usuario no existe', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('ghost@example.com');

      expect(mockMailService.sendResetPassword).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Si el correo existe, se ha enviado un enlace',
      });
    });
  });

  describe('resetPassword', () => {
    const user = {
      id: 1,
      email: 'user@example.com',
      username: 'juan',
      password: 'old-hash',
      status: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    const validPayload: ResetTokenPayload = {
      sub: 1,
      email: 'user@example.com',
      type: 'reset',
    };

    it('actualiza la contraseña con un token de reset válido', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUsersService.findOne.mockResolvedValue(user);
      mockUsersService.updateValue.mockResolvedValue(user);

      const result = await service.resetPassword('valid-token', 'Nueva12345');

      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
      const storedPassword =
        mockUsersService.updateValue.mock.calls[0][1].password;
      expect(storedPassword).toBeDefined();
      expect(await bcrypt.compare('Nueva12345', storedPassword!)).toBe(true);
      expect(result).toEqual({ message: 'Contraseña actualizada' });
    });

    it('rechaza tokens que no sean de tipo reset (p.ej. access tokens)', async () => {
      mockJwtService.verify.mockReturnValue({
        ...validPayload,
        type: 'access',
      });

      await expect(
        service.resetPassword('access-token', 'Nueva12345'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersService.updateValue).not.toHaveBeenCalled();
    });

    it('rechaza tokens inválidos o expirados', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.resetPassword('expired-token', 'Nueva12345'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersService.updateValue).not.toHaveBeenCalled();
    });

    it('rechaza la operación si el usuario del token ya no existe', async () => {
      mockJwtService.verify.mockReturnValue({ ...validPayload, sub: 999 });
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('valid-token', 'Nueva12345'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersService.updateValue).not.toHaveBeenCalled();
    });
  });

  describe('parseDurationToSeconds', () => {
    it.each([
      ['30s', 30],
      ['30m', 1800],
      ['1h', 3600],
      ['2h', 7200],
      ['7d', 604800],
      ['invalido', 3600],
    ])('convierte "%s" en %i segundos', (input, expected) => {
      expect(parseDurationToSeconds(input)).toBe(expected);
    });
  });
});
