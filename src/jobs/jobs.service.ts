import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatapointsService } from '../datapoints/datapoints.service';
import { JobSchedulerService } from './job-scheduler.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobAccessService } from '../access/job-access.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datapointsService: DatapointsService,
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly jobAccess: JobAccessService,
  ) { }

  async findAllByUser(userId: string) {
    return this.prisma.job.findMany({
      where: { datapoint: { targetUrl: { userId } } },
      include: {
        datapoint: { include: { targetUrl: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByDatapoint(datapointId: string, userId: string) {
    await this.datapointsService.findOneByUser(datapointId, userId); //verifies ownership, not really necessary
    return this.prisma.job.findMany({
      where: { datapointId },
      include: { _count: { select: { executions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(id: string, userId: string) {
    await this.jobAccess.verifyJobOwnership(id, userId);
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        datapoint: { include: { targetUrl: true } },
        _count: { select: { executions: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async create(userId: string, dto: CreateJobDto) {
    await this.datapointsService.findOneByUser(dto.datapointId, userId);
    const { datapointId, ...rest } = dto;

    const job = await this.prisma.job.create({
      data: {
        ...rest,
        definition: rest.definition ?? '',
        scheduleStart: rest.scheduleStart ? new Date(rest.scheduleStart) : undefined,
        datapoint: { connect: { id: datapointId } },
      },
      include: { datapoint: { include: { targetUrl: true } } },
    });

    await this.jobSchedulerService.scheduleOnCreate(job);
    return job;
  }

  async update(id: string, userId: string, dto: UpdateJobDto) {
    const job = await this.findOneByUser(id, userId);

    const updated = await this.prisma.job.update({
      where: { id },
      data: dto,
      include: { datapoint: { include: { targetUrl: true } } },
    });

    await this.jobSchedulerService.rescheduleAfterJobUpdate(job, updated);

    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOneByUser(id, userId);
    await this.jobSchedulerService.onJobDeleted(id);
    return this.prisma.job.delete({ where: { id } });
  }
}
