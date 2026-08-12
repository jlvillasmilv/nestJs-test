import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * DataSource de TypeORM usado por la CLI de migraciones.
 *
 * Uso (ver scripts en package.json):
 *   npm run migration:generate -- src/database/migrations/Nombre
 *   npm run migration:run
 *   npm run migration:revert
 *
 * Nota: `synchronize` está desactivado aquí a propósito; las migraciones
 * deben ser explícitas. La app usa `synchronize` solo en desarrollo.
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'my_frist_app',
  entities: [User],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});
