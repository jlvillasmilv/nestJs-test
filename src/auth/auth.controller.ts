import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { PublicUser } from '../users/user.entity';
import { UserDTO } from '../users/user.dto';
import { ForgotPasswordDTO } from './forgot-password.dto';
import { ResetPasswordDTO } from './reset-password.dto';

/** Usuario inyectado por el guard JWT en `req.user`. */
interface JwtRequestUser {
  userId: number;
  email: string;
}

/**
 * Controlador de autenticación.
 *
 * Endpoints:
 * - `POST /auth/register`        — registro de usuario (público)
 * - `POST /auth/login`           — inicio de sesión con email + contraseña (público)
 * - `POST /auth/forgot-password` — solicitud de recuperación de contraseña (público)
 * - `POST /auth/reset-password`  — restablecimiento de contraseña (público)
 * - `POST /auth/logout`          — cierre de sesión (requiere JWT)
 * - `GET  /auth/profile`         — datos del usuario autenticado (requiere JWT)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registra un usuario nuevo.
   *
   * @returns `201` con `{ access_token, token_type, expires_in, user }`.
   * @throws `400` si el payload no cumple las validaciones de `UserDTO`.
   * @throws `409` si el email ya está registrado.
   */
  @Post('register')
  register(@Body() userDTO: UserDTO) {
    return this.authService.register(userDTO);
  }

  /**
   * Inicia sesión con email y contraseña (estrategia local).
   *
   * @body `{ email: string, password: string }`
   * @returns `200` con `{ access_token, token_type, expires_in, user }`.
   * @throws `401` si las credenciales son inválidas.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  login(@Req() req: Request & { user: PublicUser }) {
    return this.authService.login(req.user);
  }

  /**
   * Cierra la sesión. Con JWT stateless el token se descarta en el cliente.
   *
   * @returns `200` con mensaje de confirmación.
   * @throws `401` si no se envía un token válido.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  logout(@Req() req: Request) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    return this.authService.logout(token);
  }

  /**
   * Devuelve los datos del usuario autenticado.
   *
   * @returns `200` con `{ userId, email }` derivados del token JWT.
   * @throws `401` si no se envía un token válido.
   */
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Req() req: Request & { user: JwtRequestUser }) {
    return req.user;
  }

  /**
   * Solicita el enlace de recuperación de contraseña.
   *
   * La respuesta es la misma exista o no la cuenta (no permite enumerar
   * emails registrados).
   *
   * @body `{ email: string }`
   * @returns `201` con mensaje genérico de confirmación.
   */
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDTO) {
    return this.authService.forgotPassword(body.email);
  }

  /**
   * Restablece la contraseña con el token recibido por email.
   *
   * @body `{ token: string, password: string }`
   * @returns `201` con mensaje de confirmación.
   * @throws `400` si el token es inválido/expirado o la contraseña no cumple las reglas.
   */
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDTO) {
    return this.authService.resetPassword(body.token, body.password);
  }
}
