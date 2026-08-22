import 'dotenv/config';
import * as path from 'path';
import { DataSource } from 'typeorm';

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
 *
 * Las rutas de `entities`/`migrations` se construyen con `process.cwd()`
 * (el CLI se ejecuta siempre desde la raíz del proyecto) y NO con
 * `__dirname`: Node 22+ carga este archivo como módulo ESM (detección
 * automática de `import`/`export`), donde `__dirname` no existe.
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'my_frist_app',
  entities: [path.join(process.cwd(), 'src', '**', '*.entity{.ts,.js}')],
  migrations: [
    path.join(process.cwd(), 'src', 'database', 'migrations', '*{.ts,.js}'),
  ],
  synchronize: false,
  logging: false,
});
