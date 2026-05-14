import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
