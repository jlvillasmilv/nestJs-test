import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Payload for the "reset password" endpoint.
 *
 * The token comes from the recovery email and the new password must satisfy
 * the same strength rules used at registration.
 */
export class ResetPasswordDTO {
  /** Recovery token received by email. */
  @IsString({ message: 'El token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;

  /** New password (plain text; hashed with bcrypt server-side). */
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
