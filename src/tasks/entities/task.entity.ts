import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  // Defines the foreign key relationship
  @ManyToOne(() => User, (user) => user.tasks)
  @JoinColumn({ name: 'user_id' }) // Optional: specify custom column name
  user: User;

  @ManyToOne(() => Project, { nullable: true }) // nullable: true permite que sea opcional
  @JoinColumn({ name: 'project_id' }) // Nombre de la columna en la base de datos
  project: Project | null;

  @Column({ type: 'boolean', default: false })
  isDraft: boolean;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
