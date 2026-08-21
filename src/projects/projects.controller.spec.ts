import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { PaginateQuery } from 'nestjs-paginate';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  const mockProjectsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const req = {
    user: { userId: 42, email: 'admin@example.com' },
  } as unknown as Request & { user: JwtUser };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: mockProjectsService }],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('extrae el userId de req.user (inyectado por el guard JWT) y lo pasa al servicio', async () => {
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

      mockProjectsService.create.mockResolvedValue({ id: 1 });

      await controller.create(createProjectDto, req);

      expect(mockProjectsService.create).toHaveBeenCalledWith(
        createProjectDto,
        42,
      );
    });
  });

  describe('findAll', () => {
    it('pasa el userId del usuario autenticado al servicio', async () => {
      const query = { page: 1, limit: 10 } as PaginateQuery;
      mockProjectsService.findAll.mockResolvedValue({
        data: [],
        meta: {},
        links: {},
      });

      await controller.findAll(query, req);

      expect(mockProjectsService.findAll).toHaveBeenCalledWith(query, 42);
    });
  });

  describe('findOne', () => {
    it('pasa el id y el userId del usuario autenticado al servicio', async () => {
      mockProjectsService.findOne.mockResolvedValue({ id: 1 });

      await controller.findOne('1', req);

      expect(mockProjectsService.findOne).toHaveBeenCalledWith(1, 42);
    });
  });

  describe('update', () => {
    it('pasa el id, el DTO y el userId del usuario autenticado al servicio', async () => {
      const dto: UpdateProjectDto = {
        title: 'Título nuevo',
        description: 'Descripción nueva',
      };
      mockProjectsService.update.mockResolvedValue({ id: 1 });

      await controller.update('1', dto, req);

      expect(mockProjectsService.update).toHaveBeenCalledWith(1, dto, 42);
    });
  });

  describe('remove', () => {
    it('pasa el id y el userId del usuario autenticado al servicio', async () => {
      mockProjectsService.remove.mockResolvedValue({
        message: 'Proyecto 1 eliminado correctamente',
      });

      await controller.remove('1', req);

      expect(mockProjectsService.remove).toHaveBeenCalledWith(1, 42);
    });
  });
});
