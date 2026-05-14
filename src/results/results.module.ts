import { Module } from '@nestjs/common';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
