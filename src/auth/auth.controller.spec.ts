import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthResponse } from './auth.service';
import { PublicUser } from '../users/user.entity';
import { UserDTO } from '../users/user.dto';
import { ForgotPasswordDTO } from './forgot-password.dto';
import { ResetPasswordDTO } from './reset-password.dto';
import { VerifyEmailDTO } from './verify-email.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn<Promise<{ message: string }>, [dto: UserDTO]>(),
    login: jest.fn<AuthResponse, [user: PublicUser]>(),
    logout: jest.fn<{ message: string }, [token: string]>(),
    forgotPassword: jest.fn<Promise<{ message: string }>, [email: string]>(),
    resetPassword: jest.fn<
      Promise<{ message: string }>,
      [token: string, password: string]
    >(),
    verifyEmail: jest.fn<
      Promise<{ message: string; user: PublicUser }>,
      [token: string]
    >(),
    resendVerificationEmail: jest.fn<
      Promise<{ message: string }>,
      [email: string]
    >(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('delega en AuthService.register con el DTO recibido', async () => {
      const dto: UserDTO = {
        email: 'a@b.com',
        username: 'user',
        password: '12345678',
      };
      mockAuthService.register.mockResolvedValue({
        message:
          'Usuario registrado exitosamente. Se ha enviado un correo de verificación.',
      });

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message:
          'Usuario registrado exitosamente. Se ha enviado un correo de verificación.',
      });
    });
  });

  describe('login', () => {
    it('delega en AuthService.login con el usuario del request', () => {
      const req = {
        user: {
          id: 1,
          email: 'a@b.com',
          username: 'user',
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PublicUser,
      };
      mockAuthService.login.mockReturnValue({
        access_token: 'tok',
      } as AuthResponse);

      const result = controller.login(req as never);

      expect(mockAuthService.login).toHaveBeenCalledWith(req.user);
      expect(result).toEqual({ access_token: 'tok' });
    });
  });

  describe('logout', () => {
    it('extrae el token Bearer del header y lo pasa al servicio', () => {
      const req = { headers: { authorization: 'Bearer mi-token' } };
      mockAuthService.logout.mockReturnValue({
        message: 'Sesión cerrada correctamente',
      });

      const result = controller.logout(req as never);

      expect(mockAuthService.logout).toHaveBeenCalledWith('mi-token');
      expect(result).toEqual({ message: 'Sesión cerrada correctamente' });
    });

    it('envía cadena vacía si no hay header de autorización', () => {
      const req = { headers: {} };

      controller.logout(req as never);

      expect(mockAuthService.logout).toHaveBeenCalledWith('');
    });
  });

  describe('getProfile', () => {
    it('devuelve el usuario inyectado por el guard JWT', () => {
      const req = { user: { userId: 1, email: 'a@b.com' } };

      expect(controller.getProfile(req as never)).toEqual(req.user);
    });
  });

  describe('forgotPassword', () => {
    it('delega en AuthService.forgotPassword con el email del DTO', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'Enlace de recuperación enviado',
      });
      const body: ForgotPasswordDTO = { email: 'user@example.com' };

      const result = await controller.forgotPassword(body);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        'user@example.com',
      );
      expect(result).toEqual({ message: 'Enlace de recuperación enviado' });
    });
  });

  describe('resetPassword', () => {
    it('delega en AuthService.resetPassword con token y contraseña', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Contraseña actualizada',
      });
      const body: ResetPasswordDTO = {
        token: 'reset-token',
        password: 'Nueva12345',
      };

      const result = await controller.resetPassword(body);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'Nueva12345',
      );
      expect(result).toEqual({ message: 'Contraseña actualizada' });
    });
  });

  describe('verifyEmail', () => {
    it('delega en AuthService.verifyEmail con el token del DTO', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({
        message: 'Email verificado correctamente',
        user: {
          id: 1,
          email: 'a@b.com',
          username: 'user',
          status: true,
          email_verified_at: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const body: VerifyEmailDTO = { token: 'verify-token' };

      const result = await controller.verifyEmail(body);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('verify-token');
      expect(result.message).toBe('Email verificado correctamente');
      expect(result.user.email).toBe('a@b.com');
    });
  });

  describe('resendVerificationEmail', () => {
    it('delega en AuthService.resendVerificationEmail con el email del DTO', async () => {
      mockAuthService.resendVerificationEmail.mockResolvedValue({
        message: 'Se ha enviado un nuevo enlace de verificación',
      });
      const body: ForgotPasswordDTO = { email: 'a@b.com' };

      const result = await controller.resendVerificationEmail(body);

      expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith(
        'a@b.com',
      );
      expect(result).toEqual({
        message: 'Se ha enviado un nuevo enlace de verificación',
      });
    });
  });
});
