import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTargetUrlDto } from './dto/create-target-url.dto';
import { UpdateTargetUrlDto } from './dto/update-target-url.dto';
import { UrlStatus } from 'src/generated/prisma/enums';
import { UrlInspectorService } from './url-inspector.service';

@Injectable()
export class TargetUrlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urlInspectorService: UrlInspectorService,
  ) {}

  private extractBaseUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

  async findAllByUser(userId: string) {
    return this.prisma.targetUrl.findMany({
      where: { userId },
      include: {
        _count: { select: { datapoints: true } },
        datapoints: {
          include: {
            _count: { select: { jobs: true } },
            jobs: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(id: string, userId: string) {
    const targetUrl = await this.prisma.targetUrl.findUnique({
      where: { id },
      include: { datapoints: true },
    });
    if (!targetUrl) throw new NotFoundException('Target URL not found');
    if (targetUrl.userId !== userId) throw new ForbiddenException();
    return targetUrl;
  }

  async create(userId: string, dto: CreateTargetUrlDto) {
    const { name, status } = await this.urlInspectorService.inspect(dto.url);
    return this.prisma.targetUrl.create({
      data: { url: dto.url,baseUrl: this.extractBaseUrl(dto.url), name, status, userId },
    });
  }

  async findOrCreate(userId: string, dto: CreateTargetUrlDto) {
    const existing = await this.prisma.targetUrl.findFirst({
      where: { url: dto.url, userId },
    });

    if (existing) return existing;

    const { name, status } = await this.urlInspectorService.inspect(dto.url);
    return this.prisma.targetUrl.create({
      data: { url: dto.url, name,baseUrl: this.extractBaseUrl(dto.url), status, userId },
    });
  }

  async update(id: string, userId: string, dto: UpdateTargetUrlDto) {
    await this.findOneByUser(id, userId);
    return this.prisma.targetUrl.update({
      where: { id },
      data: {
      ...dto,
      ...(dto.url ? { baseUrl: this.extractBaseUrl(dto.url) } : {}),
    },

    });
  }

  async remove(id: string, userId: string) {
    await this.findOneByUser(id, userId);
    return this.prisma.targetUrl.delete({ where: { id } });
  }
}
