import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';

/** Usuario inyectado por el guard JWT en `req.user` de los handlers protegidos. */
export interface JwtUser {
  userId: number;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || '123456',
    });
  }

  /**
   * Se ejecuta tras validar la firma y expiración del token.
   * El objeto devuelto se inyecta en `req.user` de los handlers protegidos.
   */
  validate(payload: JwtPayload): JwtUser {
    return { userId: payload.sub, email: payload.email };
  }
}
