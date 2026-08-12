import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthResponse } from './auth.service';
import { PublicUser } from '../users/user.entity';
import { UserDTO } from '../users/user.dto';
import { ForgotPasswordDTO } from './forgot-password.dto';
import { ResetPasswordDTO } from './reset-password.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn<Promise<AuthResponse>, [dto: UserDTO]>(),
    login: jest.fn<AuthResponse, [user: PublicUser]>(),
    logout: jest.fn<{ message: string }, [token: string]>(),
    forgotPassword: jest.fn<Promise<{ message: string }>, [email: string]>(),
    resetPassword: jest.fn<
      Promise<{ message: string }>,
      [token: string, password: string]
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
        access_token: 'tok',
      } as AuthResponse);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ access_token: 'tok' });
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
});
