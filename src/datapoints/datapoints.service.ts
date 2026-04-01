import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TargetUrlsService } from '../target-urls/target-urls.service';
import { CreateDatapointDto } from './dto/create-datapoint.dto';
import { UpdateDatapointDto } from './dto/update-datapoint.dto';
import { JobSchedulerService } from 'src/jobs/job-scheduler.service';

@Injectable()
export class DatapointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targetUrlsService: TargetUrlsService,
    private readonly jobSchedulerService: JobSchedulerService,
    
  ) {}

  async findAllByTargetUrl(targetUrlId: string, userId: string) {
    // Verifies ownership
    await this.targetUrlsService.findOneByUser(targetUrlId, userId);
    return this.prisma.datapoint.findMany({
      where: { targetUrlId },
      include: { _count: { select: { jobs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async findAllByUser(userId: string) {
    // Verifies ownership
    return this.prisma.datapoint.findMany({
      where: {
        targetUrl: {
          userId: userId,
        },
      },
      include: {
        targetUrl: {
          select: {
            id: true,
            url: true,
            baseUrl:true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  async findOneByUser(id: string, userId: string) {
    const datapoint = await this.prisma.datapoint.findUnique({
      where: { id },
      include: { targetUrl: true },
    });
    if (!datapoint) throw new NotFoundException('Datapoint not found');
    if (datapoint.targetUrl.userId !== userId) throw new ForbiddenException();
    return datapoint;
  }

  async create(userId: string, dto: CreateDatapointDto) {
    // Verifies ownership of the target URL
    await this.targetUrlsService.findOneByUser(dto.targetUrlId, userId);
    return this.prisma.datapoint.create({ data: dto });
  }

  async update(id: string, userId: string, dto: UpdateDatapointDto) {
    await this.findOneByUser(id, userId);
    return this.prisma.datapoint.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOneByUser(id, userId);
    const jobs = await this.prisma.job.findMany({ where: { datapointId: id } });
    await Promise.all(jobs.map((j) => this.jobSchedulerService.onJobDeleted(j.id)));
    return this.prisma.datapoint.delete({ where: { id } });
  }
}
