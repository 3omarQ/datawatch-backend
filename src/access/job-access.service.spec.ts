import { NotFoundException } from '@nestjs/common';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { JobAccessService } from './job-access.service';

describe('JobAccessService', () => {
  const prisma = {
    job: { findUnique: jest.fn() },
    jobExecution: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  let service: JobAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobAccessService(prisma as any);
  });

  it('returns the job when it belongs to the current user', async () => {
    const job = {
      id: 'job-1',
      datapoint: { targetUrl: { userId: 'user-1' } },
    };
    prisma.job.findUnique.mockResolvedValue(job);

    await expect(service.verifyJobOwnership('job-1', 'user-1')).resolves.toBe(
      job,
    );
  });

  it('hides jobs owned by another user', async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      datapoint: { targetUrl: { userId: 'user-2' } },
    });

    await expect(
      service.verifyJobOwnership('job-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the owner id for an existing job', async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      datapoint: { targetUrl: { userId: 'user-1' } },
    });

    await expect(service.getJobOwnerId('job-1')).resolves.toBe('user-1');
  });
});
