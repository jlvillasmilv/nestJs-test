import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity'; // Asegúrate de que la ruta sea correcta
import { UsersController } from './users.controller';

@Module({
  // ESTO ES LO QUE FALTA: Registrar la entidad para que se cree el Repositorio
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
