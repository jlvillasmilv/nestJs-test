import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AdminSeeder } from './seeders/admin.seeder';

/**
 * Módulo de datos de arranque (seeds).
 * Garantiza la existencia del usuario administrador por defecto.
 */
@Module({
  imports: [ConfigModule, UsersModule],
  providers: [AdminSeeder],
})
export class SeedModule {}
