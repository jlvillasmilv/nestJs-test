import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

/**
 * Seeder del usuario administrador por defecto.
 *
 * Se ejecuta al arrancar la aplicación (después de que TypeORM sincroniza
 * el esquema en desarrollo), garantizando que la tabla `users` siempre
 * contenga el usuario `admin@example.com` con la contraseña configurada.
 *
 * Credenciales configurables vía variables de entorno:
 *   ADMIN_EMAIL    (default: admin@example.com)
 *   ADMIN_PASSWORD (default: 12345678)
 */
@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = (
      this.configService.get<string>('ADMIN_EMAIL') ?? 'admin@example.com'
    ).toLowerCase();
    const password =
      this.configService.get<string>('ADMIN_PASSWORD') ?? '12345678';

    const existing = await this.usersService.findOneByEmail(email);
    if (existing) {
      this.logger.log(
        `El usuario administrador "${email}" ya existe, se omite el seed.`,
      );
      return;
    }

    await this.usersService.createAdminUser(email, password);
    this.logger.log(`Usuario administrador por defecto creado: ${email}`);
  }
}
