import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

/** Tipo de usuario sin el campo sensible `password`. */
export type PublicUser = Omit<User, 'password'>;

/**
 * Entidad de usuarios.
 *
 * Las reglas de validación de entrada viven en los DTOs
 * (ver `user.dto.ts`); esta entidad define únicamente el esquema.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** Correo único; se normaliza a minúsculas al crear/consultar. */
  @Column({ unique: true })
  email: string;

  /** Nombre público de usuario. */
  @Column()
  username: string;

  /** Hash de bcrypt de la contraseña. Nunca debe exponerse en respuestas. */
  @Column()
  @Exclude()
  password: string;

  /** `true` = activo, `false` = inactivo. El admin inicial se crea activo. */
  @Column({ type: 'boolean', default: false })
  status: boolean;

  /** `null` = email aún no verificado; timestamp = fecha de verificación. */
  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  email_verified_at: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
