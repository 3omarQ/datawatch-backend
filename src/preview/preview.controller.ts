import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PreviewService } from './preview.service';

@UseGuards(JwtAuthGuard)
@Controller('preview')
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}
    @Get()
    async preview(
      @Query('url') url: string,
      @Query('selector') selector: string,
      @Res() res: Response,
      ) {
      console.log('Preview hit:', { url, selector });
      const html = await this.previewService.getProxiedHtml(url, selector);
      console.log('HTML length:', html.length);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
}