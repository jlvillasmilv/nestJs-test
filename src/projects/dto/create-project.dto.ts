import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreateTaskDto } from '../../tasks/dto/create-task.dto.js';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @IsString({ message: 'El Titulo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El Titulo es obligatorio' })
  @MinLength(3, { message: 'El Titulo debe tener al menos 3 caracteres' })
  @MaxLength(150, { message: 'El Titulo no puede superar los 150 caracteres' })
  title: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoriaq' })
  @MinLength(3, { message: 'La descripción debe tener al menos 3 caracteres' })
  @MaxLength(250, {
    message: 'La descripción no puede superar los 250 caracteres',
  })
  description: string;

  @IsArray({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoriaq' })
  @Type(() => CreateTaskDto)
  @ValidateNested({ each: true })
  tasks: Array<CreateTaskDto>;
}
