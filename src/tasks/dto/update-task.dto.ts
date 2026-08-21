import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { IsNumber, ValidateIf } from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ValidateIf((obj, value) => value !== null)
  @IsNumber({}, { message: 'El ID debe ser un número' })
  id: number | null;
}
