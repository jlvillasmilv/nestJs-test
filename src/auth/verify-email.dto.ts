import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Payload for the "verify email" endpoint.
 * The token is extracted from the verification link sent by email.
 */
export class VerifyEmailDTO {
  /** Verification token received by email. */
  @IsString({ message: 'El token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;
}
