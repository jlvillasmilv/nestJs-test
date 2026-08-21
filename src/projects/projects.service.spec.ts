import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { PaginateQuery } from 'nestjs-paginate';

jest.mock('nestjs-paginate', () => ({
  paginate: jest.fn(),
}));

import { paginate } from 'nestjs-paginate';

/** Opciones de paginate que el test necesita inspeccionar. */
type PaginateOptions = { filterableColumns?: unknown; where?: unknown };

const mockPaginate = paginate as jest.Mock<
  Promise<{ data: unknown[]; meta: unknown; links: unknown }>,
  [query: PaginateQuery, repo: unknown, options: PaginateOptions]
>;

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockProjectRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
  };
  const mockTaskRepository = {
    save: jest.fn(),
  };
  const mockManager = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation(
      (callback: (manager: typeof mockManager) => unknown) =>
        callback(mockManager),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 42;
    const createProjectDto = {
      title: 'Proyecto de prueba',
      description: 'Descripción del proyecto',
      tasks: [
        {
          title: 'Tarea 1',
          description: 'Descripción de la tarea',
          isCompleted: false,
        },
      ],
    };
    const savedProject = {
      id: 1,
      ...createProjectDto,
      user: { id: userId },
    };

    it('almacena el usuario autenticado en el proyecto creado (dentro de una transacción)', async () => {
      mockManager.create.mockReturnValue(savedProject);
      mockManager.save.mockResolvedValue(savedProject);

      const result = await service.create(createProjectDto, userId);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.create).toHaveBeenCalledWith(Project, {
        ...createProjectDto,
        user: { id: userId },
      });
      expect(result.user).toEqual({ id: userId });
    });

    it('guarda las tareas vinculadas al proyecto en la misma transacción', async () => {
      mockManager.create.mockReturnValue(savedProject);
      mockManager.save.mockResolvedValue(savedProject);

      await service.create(createProjectDto, userId);

      expect(mockManager.save).toHaveBeenCalledWith(Task, {
        ...createProjectDto.tasks[0],
        project: savedProject,
      });
    });

    it('no guarda tareas si el DTO no las incluye', async () => {
      const dtoSinTasks = {
        title: 'Proyecto sin tareas',
        description: 'Descripción',
      };
      const savedSinTasks = { id: 2, ...dtoSinTasks, user: { id: userId } };
      mockManager.create.mockReturnValue(savedSinTasks);
      mockManager.save.mockResolvedValue(savedSinTasks);

      const result = await service.create(
        dtoSinTasks as CreateProjectDto,
        userId,
      );

      expect(mockManager.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(2);
    });
  });

  describe('findAll', () => {
    it('filtra por el usuario autenticado con un where fijo', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });
      const query = { page: 1, limit: 10 } as PaginateQuery;

      await service.findAll(query, 42);

      expect(mockPaginate).toHaveBeenCalledWith(
        query,
        expect.anything(),
        expect.objectContaining({
          where: { user: { id: 42 } },
        }),
      );
    });

    it('no expone el filtro por user.id al cliente (previene IDOR)', async () => {
      mockPaginate.mockResolvedValue({ data: [], meta: {}, links: {} });

      await service.findAll({ page: 1, limit: 10 } as PaginateQuery, 42);

      const options = mockPaginate.mock.calls[0][2];
      expect(options.filterableColumns).toBeUndefined();
      expect(options.where).toEqual({ user: { id: 42 } });
    });
  });

  describe('findOne', () => {
    const project = {
      id: 1,
      title: 'Proyecto',
      description: 'Descripción',
      user: { id: 42 },
    };

    it('devuelve el proyecto solo si pertenece al usuario autenticado', async () => {
      mockProjectRepository.findOne.mockResolvedValue(project);

      const result = await service.findOne(1, 42);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, user: { id: 42 } },
      });
      expect(result).toEqual(project);
    });

    it('lanza NotFoundException si el proyecto es de otro usuario', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 42)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const existing = {
      id: 1,
      title: 'Título viejo',
      description: 'Descripción',
      user: { id: 42 },
    };

    it('actualiza el proyecto del usuario autenticado (dentro de una transacción)', async () => {
      const dto: UpdateProjectDto = {
        title: 'Título nuevo',
        description: 'Descripción nueva',
      };
      mockProjectRepository.findOne.mockResolvedValue(existing);
      mockManager.save.mockResolvedValue({ ...existing, ...dto });

      const result = await service.update(1, dto, 42);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledWith({ ...existing, ...dto });
      expect(mockManager.delete).not.toHaveBeenCalled();
      expect(result.title).toBe('Título nuevo');
    });

    it('actualiza las tareas con id, crea las nuevas y borra las ausentes del DTO', async () => {
      const dto: UpdateProjectDto = {
        title: 'Nuevo',
        description: 'Nueva',
        tasks: [
          {
            id: 10,
            title: 'Tarea actualizada',
            description: 'Desc',
            isCompleted: true,
          },
          {
            id: null,
            title: 'Tarea nueva',
            description: 'Desc 2',
            isCompleted: false,
          },
        ],
      };
      const updatedProject = {
        ...existing,
        title: 'Nuevo',
        description: 'Nueva',
      };
      mockProjectRepository.findOne.mockResolvedValue(existing);
      mockManager.save.mockResolvedValue(updatedProject);

      await service.update(1, dto, 42);

      // Borra las tareas del proyecto que no vienen en el DTO
      expect(mockManager.delete).toHaveBeenCalledWith(Task, {
        project: { id: 1 },
        id: Not(In([10])),
      });
      // Actualiza la tarea existente solo si pertenece al proyecto
      expect(mockManager.update).toHaveBeenCalledWith(
        Task,
        { id: 10, project: { id: 1 } },
        { title: 'Tarea actualizada', description: 'Desc', isCompleted: true },
      );
      // Crea la tarea nueva vinculada al proyecto actualizado
      expect(mockManager.save).toHaveBeenCalledWith(Task, {
        title: 'Tarea nueva',
        description: 'Desc 2',
        isCompleted: false,
        project: updatedProject,
      });
    });

    it('borra todas las tareas si el DTO solo trae tareas nuevas', async () => {
      const dto: UpdateProjectDto = {
        title: 'Nuevo',
        description: 'Nueva',
        tasks: [
          {
            id: null,
            title: 'Tarea nueva',
            description: 'Desc',
            isCompleted: false,
          },
        ],
      };
      const updatedProject = {
        ...existing,
        title: 'Nuevo',
        description: 'Nueva',
      };
      mockProjectRepository.findOne.mockResolvedValue(existing);
      mockManager.save.mockResolvedValue(updatedProject);

      await service.update(1, dto, 42);

      expect(mockManager.delete).toHaveBeenCalledWith(Task, {
        project: { id: 1 },
      });
    });

    it('lanza NotFoundException si el proyecto es de otro usuario', async () => {
      const dto: UpdateProjectDto = {
        title: 'Título',
        description: 'Descripción',
      };
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, dto, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina (soft delete) el proyecto del usuario autenticado', async () => {
      mockProjectRepository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1, 42);

      expect(mockProjectRepository.softDelete).toHaveBeenCalledWith({
        id: 1,
        user: { id: 42 },
      });
      expect(result).toEqual({ message: 'Proyecto 1 eliminado correctamente' });
    });

    it('lanza NotFoundException si el proyecto no pertenece al usuario', async () => {
      mockProjectRepository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(1, 42)).rejects.toThrow(NotFoundException);
    });
  });
});
