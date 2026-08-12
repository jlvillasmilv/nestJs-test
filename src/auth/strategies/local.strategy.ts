import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PublicUser } from '../../users/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      // El login usa `email` en lugar del `username` por defecto de passport-local.
      usernameField: 'email',
    });
  }

  /**
   * Valida las credenciales del body de login.
   * Lanza 401 si el usuario no existe o la contraseña no coincide.
   */
  async validate(email: string, password: string): Promise<PublicUser> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
}
