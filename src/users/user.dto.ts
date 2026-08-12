import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO de creación de usuario (registro público).
 *
 * Nota: `id` y `status` NO se aceptan desde el cliente; se generan en el
 * servidor (auto-increment y valor por defecto `false`, respectivamente).
 */
export class UserDTO {
  /**
   * Correo electrónico del usuario. Se normaliza a minúsculas y sin
   * espacios al inicio/final antes de almacenarlo.
   */
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @MaxLength(100, { message: 'El email no puede superar los 100 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  /** Nombre público de usuario. */
  @IsString({ message: 'El username debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El username es obligatorio' })
  @MinLength(3, { message: 'El username debe tener al menos 3 caracteres' })
  @MaxLength(35, { message: 'El username no puede superar los 35 caracteres' })
  username: string;

  /**
   * Contraseña en texto plano. Se almacena hasheada con bcrypt.
   * El máximo de 72 caracteres coincide con el límite interno de bcrypt.
   */
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, {
    message:
      'La contraseña no puede superar los 72 caracteres (límite de bcrypt)',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'La contraseña debe contener al menos una minúscula, una mayúscula y un número',
  })
  password: string;
}
