import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, QueryFailedError } from 'typeorm';
import { User, PublicUser } from './user.entity';
import * as bcrypt from 'bcrypt';
import { UserDTO } from './user.dto';
import { PaginateQuery, paginate, Paginated } from 'nestjs-paginate';

/** Número de rondas de sal para bcrypt. */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(query: PaginateQuery): Promise<Paginated<User>> {
    return paginate(query, this.usersRepository, {
      sortableColumns: ['id', 'username', 'createdAt'],
      searchableColumns: ['username'],
      defaultSortBy: [['username', 'ASC']],
      defaultLimit: 10,
    });
  }

  /**
   * Crea un usuario normal (estado inactivo por defecto).
   *
   * - Normaliza el email a minúsculas.
   * - Rechaza emails ya registrados con `ConflictException` (409).
   * - Hashea la contraseña con bcrypt antes de persistir.
   * - Devuelve el usuario sin el campo `password` (`PublicUser`).
   */
  async create(userDTO: UserDTO): Promise<PublicUser> {
    const email = userDTO.email.trim().toLowerCase();

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(userDTO.password, BCRYPT_ROUNDS);
    const user = this.usersRepository.create({
      email,
      username: userDTO.username,
      password: hashedPassword,
      status: false,
    });
    const savedUser = await this.usersRepository.save(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se extrae password para excluirla del resultado
    const { password: _excluded, ...publicUser } = savedUser;
    return publicUser;
  }

  /**
   * Busca un usuario por email (normalizado a minúsculas).
   *
   * Devuelve `null` si no existe; NO lanza `NotFoundException` a propósito,
   * para que el flujo de autenticación pueda responder 401 genérico sin
   * revelar qué emails están registrados.
   */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Crea el usuario administrador inicial (estado activo).
   * Usado por el seeder al arrancar la aplicación.
   * Devuelve el usuario sin el campo `password` (`PublicUser`).
   */
  async createAdminUser(email: string, password: string): Promise<PublicUser> {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = this.usersRepository.create({
      email: email.trim().toLowerCase(),
      username: 'admin',
      password: hashedPassword,
      status: true,
    });
    const savedUser = await this.usersRepository.save(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se extrae password para excluirla del resultado
    const { password: _excluded, ...publicUser } = savedUser;
    return publicUser;
  }

  /**
   * Busca un usuario por email (normalizado a minúsculas).
   *
   * Devuelve `null` si no existe; NO lanza `NotFoundException` a propósito,
   * para que el flujo de autenticación pueda responder 401 genérico sin
   * revelar qué emails están registrados.
   */
  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: parseInt(id) },
    });
  }

  async update(id: string, userDTO: UserDTO): Promise<User> {
    try {
      const user = await this.findOne(id);

      // Si no encuentra el usuario, lanzamos error explícito
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      const { email } = userDTO;

      // Validación de unicidad de email
      if (email) {
        const existingUser = await this.usersRepository.findOne({
          where: {
            email: email,
            id: Not(Number(id)), // Aseguramos que sea número
          },
        });

        if (existingUser) {
          throw new ConflictException(
            'El email ya está en uso por otro usuario',
          );
        }
      }

      // Actualización
      Object.assign(user, userDTO);
      return await this.usersRepository.save(user);
    } catch (error) {
      // Manejo de errores específicos de TypeORM (ej. restricciones de BD)
      if (error instanceof QueryFailedError) {
        // Ejemplo: Error de clave foránea o campo nulo no permitido
        throw new InternalServerErrorException(
          'Error en la base de datos al actualizar',
        );
      }

      // Re-lanzar errores HTTP conocidos (ConflictException, NotFoundException)
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Error genérico para cualquier fallo inesperado
      throw new InternalServerErrorException(
        'Ocurrió un error inesperado al actualizar el usuario',
      );
    }
  }

  async remove(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!user) {
      return null;
    }
    return await this.usersRepository.remove(user);
  }

  async updateValue(id: string, field: Partial<UserDTO>): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    Object.assign(user, field);
    return await this.usersRepository.save(user);
  }
}
