import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { JobExecutionsService } from './job-executions.service';
import { ExecutionStatus } from '../generated/prisma/enums';
import { EXECUTION_DONE, EXECUTION_FAILED } from '../events/event-names';

describe('JobExecutionsService', () => {
  const prisma = {
    jobExecution: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    result: { create: jest.fn() },
    log: { create: jest.fn() },
  };
  const eventEmitter = { emit: jest.fn() };
  const notificationsGateway = { pushLogToUser: jest.fn() };
  const jobAccess = {
    getJobOwnerId: jest.fn(),
    getExecutionOwnerId: jest.fn(),
  };

  let service: JobExecutionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jobAccess.getJobOwnerId.mockResolvedValue('user-1');
    jobAccess.getExecutionOwnerId.mockResolvedValue('user-1');
    prisma.jobExecution.findMany.mockResolvedValue([]);
    prisma.log.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'log-1', ...data }),
    );
    service = new JobExecutionsService(
      prisma as any,
      eventEmitter as unknown as EventEmitter2,
      notificationsGateway as any,
      jobAccess as any,
    );
  });

  it('creates a running execution when no execution id is provided', async () => {
    const execution = { id: 'execution-1', status: ExecutionStatus.RUNNING };
    prisma.jobExecution.create.mockResolvedValue(execution);

    await expect(service.initExecution('job-1')).resolves.toBe(execution);

    expect(prisma.jobExecution.create).toHaveBeenCalledWith({
      data: {
        jobId: 'job-1',
        status: ExecutionStatus.RUNNING,
        startedAt: expect.any(Date),
      },
    });
  });

  it('marks an execution as done, saves result and emits a done event', async () => {
    prisma.result.create.mockResolvedValue({ id: 'result-1' });
    prisma.jobExecution.update.mockResolvedValue({
      id: 'execution-1',
      status: ExecutionStatus.DONE,
    });

    await service.completeExecution('execution-1', 'job-1', 'extracted text');

    expect(prisma.result.create).toHaveBeenCalledWith({
      data: { executionId: 'execution-1', definition: { text: 'extracted text' } },
    });
    expect(prisma.jobExecution.update).toHaveBeenCalledWith({
      where: { id: 'execution-1' },
      data: { status: ExecutionStatus.DONE, finishedAt: expect.any(Date) },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EXECUTION_DONE,
      expect.objectContaining({ jobId: 'job-1', executionId: 'execution-1' }),
    );
  });

  it('marks an execution as failed and emits a failure event', async () => {
    prisma.jobExecution.update.mockResolvedValue({
      id: 'execution-1',
      status: ExecutionStatus.FAILED,
    });

    await service.failExecution('execution-1', 'job-1', 'selector missing');

    expect(prisma.log.create).toHaveBeenCalledWith({
      data: {
        executionId: 'execution-1',
        level: 'ERROR',
        message: 'selector missing',
      },
    });
    expect(prisma.jobExecution.update).toHaveBeenCalledWith({
      where: { id: 'execution-1' },
      data: { status: ExecutionStatus.FAILED, finishedAt: expect.any(Date) },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EXECUTION_FAILED,
      expect.objectContaining({ reason: 'selector missing' }),
    );
  });
});
