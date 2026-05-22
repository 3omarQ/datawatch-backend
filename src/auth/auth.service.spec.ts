import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import type { User } from '../generated/prisma/client';
import { Provider, Role } from '../generated/prisma/enums';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    jwtService = { sign: jest.fn(() => 'access-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: EmailService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a safe user shape on login', async () => {
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
      notifyByEmail: true,
    } satisfies User;

    const result = await service.login(user);

    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'omar@example.com',
        name: 'Omar',
        emailVerified: true,
        role: Role.USER,
        provider: Provider.LOCAL,
        image: null,
        notifyByEmail: true,
        createdAt: user.createdAt,
      },
      accessToken: 'access-token',
    });
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('updatedAt');
  });
});
