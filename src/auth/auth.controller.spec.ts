import { Test, TestingModule } from '@nestjs/testing';

jest.mock('./auth.service', () => ({
  AuthService: class AuthService {},
}));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { User } from '../generated/prisma/client';
import { Provider, Role } from '../generated/prisma/enums';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns a safe current user from auth/me', () => {
    const user = {
      id: 'user-1',
      email: 'omar@example.com',
      name: 'Omar',
      password: 'hashed-password',
      emailVerified: true,
      provider: Provider.LOCAL,
      providerAccountId: null,
      image: null,
      role: Role.USER,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      notifyByEmail: false,
    } satisfies User;

    expect(controller.getMe(user)).toEqual({
      id: 'user-1',
      email: 'omar@example.com',
      name: 'Omar',
      emailVerified: true,
      role: Role.USER,
      provider: Provider.LOCAL,
      image: null,
      notifyByEmail: false,
      createdAt: user.createdAt,
    });
    expect(controller.getMe(user)).not.toHaveProperty('password');
    expect(controller.getMe(user)).not.toHaveProperty('updatedAt');
  });
});
