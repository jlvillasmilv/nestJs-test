import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { DeepPartial, FindOneOptions } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepository = {
    findOne: jest.fn<Promise<User | null>, [FindOneOptions<User>]>(),
    create: jest.fn<User, [DeepPartial<User>]>(),
    save: jest.fn<Promise<User>, [User]>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      email: '  User@Example.com ',
      username: 'testuser',
      password: '12345678',
    };

    it('normaliza el email a minúsculas y hashea la contraseña', async () => {
      let stored: DeepPartial<User> | undefined;
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data) => {
        stored = data;
        return { id: 1, ...data } as User;
      });
      mockRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.create(dto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(stored?.email).toBe('user@example.com');
      expect(stored?.password).not.toBe('12345678');
      expect(stored?.status).toBe(false);
      expect(await bcrypt.compare('12345678', stored!.password!)).toBe(true);
      expect(result.email).toBe('user@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('lanza ConflictException si el email ya está registrado', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1 } as User);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOneByEmail', () => {
    it('devuelve el usuario si existe (normalizando el email)', async () => {
      const user = {
        id: 1,
        email: 'a@b.com',
        username: 'a',
        password: 'x',
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.findOne.mockResolvedValue(user);

      await expect(service.findOneByEmail('A@B.COM')).resolves.toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
    });

    it('devuelve null si el usuario no existe (no lanza 404)', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneByEmail('nobody@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('createAdminUser', () => {
    it('crea el admin con status activo y contraseña hasheada', async () => {
      let stored: DeepPartial<User> | undefined;
      mockRepository.create.mockImplementation((data) => {
        stored = data;
        return { id: 1, ...data } as User;
      });
      mockRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.createAdminUser(
        'ADMIN@Example.com',
        '12345678',
      );

      expect(stored?.email).toBe('admin@example.com');
      expect(stored?.username).toBe('admin');
      expect(stored?.status).toBe(true);
      expect(await bcrypt.compare('12345678', stored!.password!)).toBe(true);
      expect(result.email).toBe('admin@example.com');
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('findOne', () => {
    it('devuelve el usuario por id numérico', async () => {
      const user = {
        id: 5,
        email: 'a@b.com',
        username: 'a',
        password: 'x',
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepository.findOne.mockResolvedValue(user);

      await expect(service.findOne('5')).resolves.toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
      });
    });

    it('devuelve null si el usuario no existe', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).resolves.toBeNull();
    });
  });

  describe('updateValue', () => {
    it('actualiza los campos indicados del usuario', async () => {
      const existing = {
        id: 1,
        email: 'a@b.com',
        username: 'a',
        password: 'old',
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updated = { ...existing, password: 'new-hash' };
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.updateValue('1', { password: 'new-hash' });

      expect(result.password).toBe('new-hash');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateValue('999', { password: 'x' }),
      ).rejects.toThrow('Usuario no encontrado');
    });
  });
});
