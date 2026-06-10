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

describe('Jobs (e2e)', () => {
    let app: INestApplication;
    let cookieA: string;
    let cookieB: string;
    let datapointId: string;
    let jobId: string;

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

        // Create target URL and datapoint for User A via API
        const targetRes = await request(app.getHttpServer())
            .post('/target-urls')
            .set('Cookie', cookieA)
            .send({ url: 'https://example.com' });

        const datapointRes = await request(app.getHttpServer())
            .post('/datapoints')
            .set('Cookie', cookieA)
            .send({
                name: 'Test Datapoint',
                path: 'h1',
                targetUrlId: targetRes.body.id,
            });

        datapointId = datapointRes.body.id;
    });

    afterAll(async () => {
        await prisma.job.deleteMany();
        await prisma.datapoint.deleteMany();
        await prisma.targetUrl.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
        await app.close();
    });

    describe('POST /jobs', () => {
        it('creates a job for the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .post('/jobs')
                .set('Cookie', cookieA)
                .send({ datapointId })
            console.log('POST /jobs response:', res.status, JSON.stringify(res.body));


            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('datapointId', datapointId);
            jobId = res.body.id;
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .post('/jobs')
                .send({ datapointId })
                .expect(401);
        });

        it('rejects an invalid payload (missing datapointId)', async () => {
            await request(app.getHttpServer())
                .post('/jobs')
                .set('Cookie', cookieA)
                .send({})
                .expect(400);
        });
    });

    describe('GET /jobs', () => {
        it('returns jobs for the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .get('/jobs')
                .set('Cookie', cookieA)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0]).toHaveProperty('id');
        });

        it('does not return jobs belonging to another user', async () => {
            const res = await request(app.getHttpServer())
                .get('/jobs')
                .set('Cookie', cookieB)
                .expect(200);

            expect(res.body).toHaveLength(0);
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .get('/jobs')
                .expect(401);
        });
    });

    describe('GET /jobs/:id', () => {
        it('returns a job by id for its owner', async () => {
            const res = await request(app.getHttpServer())
                .get(`/jobs/${jobId}`)
                .set('Cookie', cookieA)
                .expect(200);

            expect(res.body).toHaveProperty('id', jobId);
        });

        it('denies access to a job owned by another user', async () => {
            await request(app.getHttpServer())
                .get(`/jobs/${jobId}`)
                .set('Cookie', cookieB)
                .expect(404);
        });
    });

    describe('PATCH /jobs/:id', () => {
        it('updates a job for its owner', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/jobs/${jobId}`)
                .set('Cookie', cookieA)
                .send({ cron: '0 * * * *' })
                .expect(200);

            expect(res.body).toHaveProperty('cron', '0 * * * *');
        });

        it('denies update to a job owned by another user', async () => {
            await request(app.getHttpServer())
                .patch(`/jobs/${jobId}`)
                .set('Cookie', cookieB)
                .send({ cron: '0 * * * *' })
                .expect(404);
        });
    });

    describe('DELETE /jobs/:id', () => {
        it('denies deletion to a job owned by another user', async () => {
            await request(app.getHttpServer())
                .delete(`/jobs/${jobId}`)
                .set('Cookie', cookieB)
                .expect(404);
        });

        it('deletes a job for its owner', async () => {
            await request(app.getHttpServer())
                .delete(`/jobs/${jobId}`)
                .set('Cookie', cookieA)
                .expect(200);
        });

        it('returns 404 after deletion', async () => {
            await request(app.getHttpServer())
                .get(`/jobs/${jobId}`)
                .set('Cookie', cookieA)
                .expect(404);
        });
    });
});