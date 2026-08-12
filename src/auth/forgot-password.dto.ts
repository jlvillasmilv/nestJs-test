import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Payload for the "forgot password" endpoint.
 *
 * Only the email is required; the recovery token is generated server-side
 * and the account is never disclosed (the response is the same whether the
 * email exists or not).
 */
export class ForgotPasswordDTO {
  /**
   * Account email. Normalized to lowercase and trimmed before processing.
   */
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @MaxLength(100, { message: 'El email no puede superar los 100 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;
}
