# my-frist-app

API REST con [NestJS](https://nestjs.com), TypeORM y MySQL que incluye autenticación JWT
(registro, login, logout, perfil y recuperación de contraseña por email) y un usuario
administrador creado automáticamente.

## Requisitos

- Node.js 20+
- MySQL 8+

## Configuración

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea tu archivo de entorno a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

   Variables disponibles:

   | Variable            | Default                         | Descripción                                              |
   | ------------------- | ------------------------------- | -------------------------------------------------------- |
   | `PORT`              | `3000`                          | Puerto del servidor                                      |
   | `NODE_ENV`          | `development`                   | `development` activa `synchronize` (esquema automático)  |
   | `DB_HOST`           | `localhost`                     | Host de MySQL                                            |
   | `DB_PORT`           | `3306`                          | Puerto de MySQL                                          |
   | `DB_USER`           | `root`                          | Usuario de MySQL                                         |
   | `DB_PASSWORD`       | *(vacío)*                       | Contraseña de MySQL                                      |
   | `DB_NAME`           | `my_frist_app`                  | Nombre de la base de datos                               |
   | `JWT_SECRET`        | `cambia-este-secreto...`        | **Cambiar en producción**                                |
   | `JWT_EXPIRATION`    | `1h`                            | Vigencia del token (`30m`, `1h`, `7d`, …)                |
   | `ADMIN_EMAIL`       | `admin@example.com`             | Email del admin inicial                                  |
   | `ADMIN_PASSWORD`    | `12345678`                      | Contraseña del admin inicial                             |
   | `FRONTEND_URL`      | `http://localhost:3000`         | Base URL del frontend (enlace de recuperación)           |
   | `PASSWORD_RESET_SECRET` | *(usa `JWT_SECRET`)*        | Secreto dedicado para tokens de recuperación (recomendado) |
   | `MAIL_HOST`         | *(vacío)*                       | Host SMTP                                                |
   | `MAIL_PORT`         | *(vacío)*                       | Puerto SMTP                                              |
   | `MAIL_USER`         | *(vacío)*                       | Usuario SMTP                                             |
   | `MAIL_PASSWORD`     | *(vacío)*                       | Contraseña SMTP                                          |

3. Arranca el servidor:

   ```bash
   npm run start:dev
   ```

## Usuario administrador por defecto

Al arrancar la aplicación (después de que TypeORM crea/actualiza el esquema en
desarrollo), el seeder `src/database/seeders/admin.seeder.ts` garantiza la existencia
de un usuario administrador en la tabla `users`:

```
email:    admin@example.com
password: 12345678
```

El usuario se crea con estado **activo** (`status = true`) y su contraseña se almacena
hasheada con bcrypt. Si ya existe, el seeder lo omite. Las credenciales pueden
cambiarse con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

> ⚠️ Cambia la contraseña del admin antes de exponer el servicio a producción.

## Endpoints de autenticación

| Método | Ruta               | Público | Descripción                                        |
| ------ | ------------------ | ------- | -------------------------------------------------- |
| POST   | `/auth/register`   | ✅      | Registro de usuario (201)                          |
| POST   | `/auth/login`      | ✅      | Login con email + contraseña (200)                 |
| POST   | `/auth/forgot-password` | ✅  | Solicita enlace de recuperación por email (201)    |
| POST   | `/auth/reset-password`  | ✅  | Restablece la contraseña con el token (201)        |
| POST   | `/auth/logout`     | ❌ JWT   | Cierre de sesión (200)                             |
| GET    | `/auth/profile`    | ❌ JWT   | Datos del usuario autenticado (200)                |

### Ejemplos

**Registro**

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com","username":"juan","password":"12345678"}'
```

**Login**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"12345678"}'
```

**Respuesta de registro/login**

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": { "id": 1, "email": "admin@example.com", "username": "admin", "status": true }
}
```

**Perfil (requiere token)**

```bash
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer <token>"
```

**Solicitar recuperación de contraseña**

```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

> La respuesta es idéntica exista o no el email (no permite enumerar cuentas).
> Si el usuario existe, se envía un correo con un enlace de 15 minutos usando la
> plantilla Handlebars `src/templates/reset-password.hbs`.

**Restablecer contraseña**

```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<token-del-email>","password":"Nueva12345"}'
```

> El token es un JWT firmado con `PASSWORD_RESET_SECRET` (o `JWT_SECRET` como
> respaldo) con un claim `type: "reset"`; los access tokens no sirven para
> restablecer contraseñas.

### Validaciones del registro

| Campo      | Reglas                                                              |
| ---------- | ------------------------------------------------------------------- |
| `email`    | formato válido, obligatorio, máx. 100 caracteres; se normaliza a minúsculas |
| `username` | obligatorio, 3–35 caracteres                                        |
| `password` | obligatoria, 8–72 caracteres (72 = límite de bcrypt)                |

El `ValidationPipe` global está configurado con `whitelist` + `forbidNonWhitelisted`
(se rechazan con 400 propiedades desconocidas como `id` o `status`). El login de un
email inexistente responde **401** (no 404) para no revelar qué emails están registrados.

## Envío de correos (recuperación de contraseña)

El módulo `MailModule` (`src/mail`) usa `@nestjs-modules/mailer` con el adaptador
Handlebars. Las plantillas viven en `src/templates/` y se copian a `dist/templates/`
al compilar (ver `assets` en `nest-cli.json`).

- `reset-password.hbs` — correo de recuperación de contraseña (`{{name}}`, `{{url}}`)
- `verification.hbs` — verificación de cuenta (`{{name}}`, `{{url}}`)

Configura las variables `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER` y `MAIL_PASSWORD` en tu
`.env` para habilitar el envío SMTP.

## Tests

```bash
# Tests unitarios
npm test

# Tests e2e (flujo de auth completo; no requiere MySQL)
npm run test:e2e

# Cobertura
npm run test:cov
```

Los tests e2e (`test/app.e2e-spec.ts`) ejercitan controlador, servicio, estrategias de
Passport y JWT reales; solo se mockea la capa de repositorio, por lo que no requieren
una instancia de MySQL.

## Migraciones de base de datos

En desarrollo el esquema se sincroniza automáticamente (`synchronize`). En producción
usa migraciones explícitas:

```bash
npm run migration:generate -- src/database/migrations/NombreDeLaMigracion
npm run migration:run
npm run migration:revert
```

> La CLI usa `src/database/data-source.ts`. Con migraciones, el admin por defecto debe
> crearse con un seed explícito o un INSERT en la propia migración.

## Estructura del proyecto

```
src/
├── app.module.ts            # Módulo raíz (Config, TypeORM, Seed, Mail)
├── main.ts                  # Bootstrap + ValidationPipe global
├── auth/                    # Autenticación (controller, service, DTOs, estrategias)
│   └── strategies/          # local.strategy (login) y jwt.strategy (protección)
├── users/                   # Entidad User, DTO y servicio de usuarios
├── mail/                    # MailModule (SMTP + plantillas Handlebars)
├── templates/               # Plantillas .hbs de correo
├── projects/                # Módulo de ejemplo
├── tasks/                   # Módulo de ejemplo
└── database/                # data-source de migraciones + seeders
```

## Comandos útiles

```bash
npm run start        # arranca la app
npm run start:dev    # arranca con watch
npm run build        # compila a dist/
npm run lint         # ESLint + Prettier (--fix)
npm run format       # Prettier
```
