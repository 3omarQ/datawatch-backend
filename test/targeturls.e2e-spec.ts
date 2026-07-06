import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './app-factory';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Provider } from '../src/generated/prisma/enums';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

const USER_A = { name: 'User A', email: 'usera@example.com', password: 'Password123' };
const USER_B = { name: 'User B', email: 'userb@example.com', password: 'Password123' };

async function loginAs(app: INestApplication, email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
    return (res.headers['set-cookie'] as unknown as string[])[0];
}

describe('TargetUrls (e2e)', () => {
    let app: INestApplication;
    let cookieA: string;
    let cookieB: string;
    let targetUrlId: string;

    beforeAll(async () => {
        await prisma.$connect();

        const hashed = await bcrypt.hash('Password123', 12);
        await prisma.user.createMany({
            data: [
                { name: USER_A.name, email: USER_A.email, password: hashed, provider: Provider.LOCAL, emailVerified: true },
                { name: USER_B.name, email: USER_B.email, password: hashed, provider: Provider.LOCAL, emailVerified: true },
            ],
        });

        app = await createTestApp();
        cookieA = await loginAs(app, USER_A.email, USER_A.password);
        cookieB = await loginAs(app, USER_B.email, USER_B.password);
    });

    afterAll(async () => {
        await prisma.targetUrl.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
        await app.close();
    });

    describe('POST /target-urls', () => {
        it('creates a target URL for the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .post('/target-urls')
                .set('Cookie', cookieA)
                .send({ url: 'https://example.com' })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('url', 'https://example.com');
            targetUrlId = res.body.id;
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .post('/target-urls')
                .send({ url: 'https://example.com' })
                .expect(401);
        });

        it('rejects an invalid payload (missing url)', async () => {
            await request(app.getHttpServer())
                .post('/target-urls')
                .set('Cookie', cookieA)
                .send({})
                .expect(400);
        });

        it('rejects an invalid URL', async () => {
            await request(app.getHttpServer())
                .post('/target-urls')
                .set('Cookie', cookieA)
                .send({ url: 'not-a-url' })
                .expect(400);
        });
    });

    describe('GET /target-urls', () => {
        it('returns target URLs for the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .get('/target-urls')
                .set('Cookie', cookieA)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('does not return target URLs belonging to another user', async () => {
            const res = await request(app.getHttpServer())
                .get('/target-urls')
                .set('Cookie', cookieB)
                .expect(200);

            expect(res.body).toHaveLength(0);
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .get('/target-urls')
                .expect(401);
        });
    });

    describe('GET /target-urls/:id', () => {
        it('returns a target URL by id for its owner', async () => {
            const res = await request(app.getHttpServer())
                .get(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieA)
                .expect(200);

            expect(res.body).toHaveProperty('id', targetUrlId);
        });

        it('denies access to a target URL owned by another user', async () => {
            await request(app.getHttpServer())
                .get(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieB)
                .expect(403);
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .get(`/target-urls/${targetUrlId}`)
                .expect(401);
        });
    });

    describe('PATCH /target-urls/:id', () => {
        it('updates a target URL for its owner', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieA)
                .send({ url: 'https://updated-example.com' })
                .expect(200);

            expect(res.body).toHaveProperty('url', 'https://updated-example.com');
        });

        it('denies update to a target URL owned by another user', async () => {
            await request(app.getHttpServer())
                .patch(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieB)
                .send({ url: 'https://hacked.com' })
                .expect(403);
        });
    });

    describe('DELETE /target-urls/:id', () => {
        it('denies deletion to a target URL owned by another user', async () => {
            await request(app.getHttpServer())
                .delete(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieB)
                .expect(403);
        });

        it('deletes a target URL for its owner', async () => {
            await request(app.getHttpServer())
                .delete(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieA)
                .expect(200);
        });

        it('returns 404 after deletion', async () => {
            await request(app.getHttpServer())
                .get(`/target-urls/${targetUrlId}`)
                .set('Cookie', cookieA)
                .expect(404);
        });
    });
});