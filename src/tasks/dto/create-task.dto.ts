import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class CreateTaskDto {
  @IsString({ message: 'El Titulo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El Titulo es obligatorio' })
  @MinLength(3, { message: 'El Titulo debe tener al menos 3 caracteres' })
  @MaxLength(150, { message: 'El Titulo no puede superar los 150 caracteres' })
  title: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MinLength(3, { message: 'La descripción debe tener al menos 3 caracteres' })
  @MaxLength(250, {
    message: 'La descripción no puede superar los 250 caracteres',
  })
  description: string;

  @IsBoolean({ message: 'El estado de la tarea debe ser un valor booleano' })
  is_completed: boolean | undefined;
}
