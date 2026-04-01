import { Module } from '@nestjs/common';
import { TargetUrlsController } from './target-urls.controller';
import { TargetUrlsService } from './target-urls.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UrlInspectorService } from './url-inspector.service';

@Module({
  imports: [PrismaModule],
  controllers: [TargetUrlsController],
  providers: [TargetUrlsService, UrlInspectorService],
  exports: [TargetUrlsService],
})
export class TargetUrlsModule {}
