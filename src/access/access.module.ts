import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobAccessService } from './job-access.service';

@Module({
  imports: [PrismaModule],
  providers: [JobAccessService],
  exports: [JobAccessService],
})
export class AccessModule {}
