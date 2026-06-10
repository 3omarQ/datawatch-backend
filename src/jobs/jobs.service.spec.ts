jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { JobsService } from './jobs.service';
import { JobStatus, OutputFormat, ExtractorType } from '../generated/prisma/enums';

describe('JobsService', () => {
  const prisma = {
    job: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const datapointsService = { findOneByUser: jest.fn() };
  const jobSchedulerService = {
    scheduleOnCreate: jest.fn(),
    rescheduleAfterJobUpdate: jest.fn(),
    onJobDeleted: jest.fn(),
  };
  const jobAccess = { verifyJobOwnership: jest.fn() };

  let service: JobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobsService(
      prisma as any,
      datapointsService as any,
      jobSchedulerService as any,
      jobAccess as any,
    );
  });

  it('creates a job after validating datapoint ownership and schedules it', async () => {
    const createdJob = {
      id: 'job-1',
      status: JobStatus.ACTIVE,
      datapointId: 'datapoint-1',
      cron: null,
      scheduleStart: null,
    };
    prisma.job.create.mockResolvedValue(createdJob);

    await expect(
      service.create('user-1', {
        datapointId: 'datapoint-1',
        extractorType: ExtractorType.BASIC,
        outputFormat: OutputFormat.JSON,
      }),
    ).resolves.toBe(createdJob);

    expect(datapointsService.findOneByUser).toHaveBeenCalledWith(
      'datapoint-1',
      'user-1',
    );
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          definition: '',
          datapoint: { connect: { id: 'datapoint-1' } },
        }),
      }),
    );
    expect(jobSchedulerService.scheduleOnCreate).toHaveBeenCalledWith(
      createdJob,
    );
  });

  it('reschedules a job after update', async () => {
    const previousJob = {
      id: 'job-1',
      status: JobStatus.ACTIVE,
      cron: null,
      scheduleStart: null,
    };
    const updatedJob = {
      ...previousJob,
      cron: '0 * * * *',
    };
    jest.spyOn(service, 'findOneByUser').mockResolvedValue(previousJob as any);
    prisma.job.update.mockResolvedValue(updatedJob);

    await expect(
      service.update('job-1', 'user-1', { cron: '0 * * * *' }),
    ).resolves.toBe(updatedJob);

    expect(jobSchedulerService.rescheduleAfterJobUpdate).toHaveBeenCalledWith(
      previousJob,
      updatedJob,
    );
  });

  it('clears the schedule before deleting a job', async () => {
    const deletedJob = { id: 'job-1' };
    jest.spyOn(service, 'findOneByUser').mockResolvedValue(deletedJob as any);
    prisma.job.delete.mockResolvedValue(deletedJob);

    await expect(service.remove('job-1', 'user-1')).resolves.toBe(deletedJob);

    expect(jobSchedulerService.onJobDeleted).toHaveBeenCalledWith('job-1');
    expect(prisma.job.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } });
  });
});
