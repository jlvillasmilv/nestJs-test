import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateTaskDto } from '../tasks/dto/update-task.dto';
import { Task } from '../tasks/entities/task.entity';
import { PaginateQuery, paginate, Paginated } from 'nestjs-paginate';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    userId: number,
  ): Promise<Project> {
    // Proyecto + tareas se guardan en la misma transacción: si una tarea
    // falla, el proyecto no queda a medio guardar.
    return this.dataSource.transaction(async (manager) => {
      const project = manager.create(Project, {
        ...createProjectDto,
        user: { id: userId },
      });
      const savedProject = await manager.save(project);
      if (createProjectDto.tasks && createProjectDto.tasks.length > 0) {
        for (const task of createProjectDto.tasks) {
          await manager.save(Task, {
            ...task,
            project: savedProject,
          });
        }
      }
      return savedProject;
    });
  }

  findAll(query: PaginateQuery, userId: number): Promise<Paginated<Project>> {
    return paginate(query, this.projectsRepository, {
      sortableColumns: ['id', 'title', 'createdAt'],
      searchableColumns: ['title'],
      // Filtro fijo de propiedad: el cliente no puede cambiarlo con ?filter.user.id=
      where: { user: { id: userId } },
      defaultSortBy: [['createdAt', 'DESC']],
      defaultLimit: 10,
    });
  }

  async findOne(id: number, userId: number): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!project) {
      throw new NotFoundException(`Proyecto ${id} no encontrado`);
    }
    return project;
  }

  async update(
    id: number,
    updateProjectDto: UpdateProjectDto,
    userId: number,
  ): Promise<Project> {
    const project = await this.findOne(id, userId);

    const { tasks, ...projectData } = updateProjectDto;
    Object.assign(project, projectData);

    return this.dataSource.transaction(async (manager) => {
      const updatedProject = await manager.save(project);
      if (tasks) {
        await this.replaceTasks(manager, id, tasks, updatedProject);
      }
      return updatedProject;
    });
  }

  /**
   * Reemplaza el conjunto de tareas del proyecto por el del DTO:
   * - las tareas con `id` se actualizan (solo si pertenecen al proyecto);
   * - las tareas sin `id` (o `null`) se crean nuevas;
   * - las tareas existentes que no vienen en el DTO se eliminan.
   */
  private async replaceTasks(
    manager: EntityManager,
    projectId: number,
    tasks: UpdateTaskDto[],
    project: Project,
  ): Promise<void> {
    const incomingIds = tasks
      .map((task) => task.id)
      .filter((id): id is number => id !== null && typeof id === 'number');

    if (incomingIds.length > 0) {
      await manager.delete(Task, {
        project: { id: projectId },
        id: Not(In(incomingIds)),
      });
    } else {
      await manager.delete(Task, { project: { id: projectId } });
    }

    for (const task of tasks) {
      if (typeof task.id === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- el id va en el criterio, no en el set
        const { id: _taskId, ...taskData } = task;
        await manager.update(
          Task,
          { id: task.id, project: { id: projectId } },
          taskData,
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id null/undefined no se persiste
        const { id: _taskId, ...taskData } = task;
        await manager.save(Task, { ...taskData, project });
      }
    }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    // softDelete con el criterio de propiedad evita que un usuario borre
    // proyectos ajenos (y respeta el soft delete de la entidad).
    const result = await this.projectsRepository.softDelete({
      id,
      user: { id: userId },
    });
    if (!result.affected) {
      throw new NotFoundException(`Proyecto ${id} no encontrado`);
    }
    return { message: `Proyecto ${id} eliminado correctamente` };
  }
}
