import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { UrlInspectorService } from '../src/target-urls/url-inspector.service';
import { UrlStatus } from '../src/generated/prisma/enums';
import nocache from 'nocache';

export async function createTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    })
        .overrideProvider(UrlInspectorService)
        .useValue({
            inspect: jest.fn().mockResolvedValue({ name: 'Mock Site', status: UrlStatus.ACTIVE }),
        })
        .compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.use(nocache());
    await app.init();
    return app;
}