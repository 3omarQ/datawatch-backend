// datapoints.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DatapointsService } from './datapoints.service';
import { CreateDatapointDto } from './dto/create-datapoint.dto';
import { UpdateDatapointDto } from './dto/update-datapoint.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('datapoints')
export class DatapointsController {
  constructor(private readonly datapointsService: DatapointsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.datapointsService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.datapointsService.findOneByUser(id, userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDatapointDto) {
    return this.datapointsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDatapointDto,
  ) {
    return this.datapointsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.datapointsService.remove(id, userId);
  }
}
