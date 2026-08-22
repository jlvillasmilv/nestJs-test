import { UpdateTaskDto } from '../../tasks/dto/update-task.dto';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProjectDto {
  @IsString({ message: 'El Titulo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El Titulo es obligatorio' })
  @MinLength(3, { message: 'El Titulo debe tener al menos 3 caracteres' })
  @MaxLength(150, { message: 'El Titulo no puede superar los 150 caracteres' })
  title: string;

  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MinLength(3, { message: 'La descripción debe tener al menos 3 caracteres' })
  @MaxLength(250, {
    message: 'La descripción no puede superar los 250 caracteres',
  })
  description: string;

  // Propiedad anidada: Usa explícitamente UpdateTaskDto
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTaskDto)
  tasks?: UpdateTaskDto[];
}
