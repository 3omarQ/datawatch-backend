import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TargetUrlsService } from './target-urls.service';
import { CreateTargetUrlDto } from './dto/create-target-url.dto';
import { UpdateTargetUrlDto } from './dto/update-target-url.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('target-urls')
export class TargetUrlsController {
  constructor(private readonly targetUrlsService: TargetUrlsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.targetUrlsService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.targetUrlsService.findOneByUser(id, userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTargetUrlDto) {
    return this.targetUrlsService.create(userId, dto);
  }
  @Post('find-or-create')
  findOrCreate(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTargetUrlDto,
  ) {
    return this.targetUrlsService.findOrCreate(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTargetUrlDto,
  ) {
    return this.targetUrlsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.targetUrlsService.remove(id, userId);
  }
}
