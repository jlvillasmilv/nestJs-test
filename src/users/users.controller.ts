import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  UseGuards,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { UserDTO } from './user.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Paginate() query: PaginateQuery) {
    return this.usersService.findAll(query);
  }

  /**
   * Registra un usuario nuevo.
   *
   * @returns `201` con `{ access_token, token_type, expires_in, user }`.
   * @throws `400` si el payload no cumple las validaciones de `UserDTO`.
   * @throws `409` si el email ya está registrado.
   */
  @Post()
  register(@Body() userDTO: UserDTO) {
    return this.usersService.create(userDTO);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() userDTO: UserDTO) {
    return this.usersService.update(id, userDTO);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
