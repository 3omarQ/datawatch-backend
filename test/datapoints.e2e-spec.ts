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

describe('Datapoints (e2e)', () => {
    let app: INestApplication;
    let cookieA: string;
    let cookieB: string;
    let targetUrlId: string;
    let datapointId: string;

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

        const targetRes = await request(app.getHttpServer())
            .post('/target-urls')
            .set('Cookie', cookieA)
            .send({ url: 'https://example.com' });

        targetUrlId = targetRes.body.id;
    });

    afterAll(async () => {
        await prisma.datapoint.deleteMany();
        await prisma.targetUrl.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
        await app.close();
    });

    describe('POST /datapoints', () => {
        it('creates a datapoint for the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .post('/datapoints')
                .set('Cookie', cookieA)
                .send({ name: 'Test Datapoint', path: 'h1', targetUrlId })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('name', 'Test Datapoint');
            datapointId = res.body.id;
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .post('/datapoints')
                .send({ name: 'Test', path: 'h1', targetUrlId })
                .expect(401);
        });

        it('rejects an invalid payload (missing name)', async () => {
            await request(app.getHttpServer())
                .post('/datapoints')
                .set('Cookie', cookieA)
                .send({ path: 'h1', targetUrlId })
                .expect(400);
        });

        it('denies creating a datapoint on a target URL owned by another user', async () => {
            await request(app.getHttpServer())
                .post('/datapoints')
                .set('Cookie', cookieB)
                .send({ name: 'Stolen', path: 'h1', targetUrlId })
                .expect(403);
        });
    });

    describe('GET /datapoints', () => {
        it('returns datapoints for the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .get('/datapoints')
                .set('Cookie', cookieA)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('does not return datapoints belonging to another user', async () => {
            const res = await request(app.getHttpServer())
                .get('/datapoints')
                .set('Cookie', cookieB)
                .expect(200);

            expect(res.body).toHaveLength(0);
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .get('/datapoints')
                .expect(401);
        });
    });

    describe('GET /datapoints/:id', () => {
        it('returns a datapoint by id for its owner', async () => {
            const res = await request(app.getHttpServer())
                .get(`/datapoints/${datapointId}`)
                .set('Cookie', cookieA)
                .expect(200);

            expect(res.body).toHaveProperty('id', datapointId);
        });

        it('denies access to a datapoint owned by another user', async () => {
            await request(app.getHttpServer())
                .get(`/datapoints/${datapointId}`)
                .set('Cookie', cookieB)
                .expect(403);
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .get(`/datapoints/${datapointId}`)
                .expect(401);
        });
    });

    describe('PATCH /datapoints/:id', () => {
        it('updates a datapoint for its owner', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/datapoints/${datapointId}`)
                .set('Cookie', cookieA)
                .send({ name: 'Updated Datapoint' })
                .expect(200);

            expect(res.body).toHaveProperty('name', 'Updated Datapoint');
        });

        it('denies update to a datapoint owned by another user', async () => {
            await request(app.getHttpServer())
                .patch(`/datapoints/${datapointId}`)
                .set('Cookie', cookieB)
                .send({ name: 'Hacked' })
                .expect(403);
        });
    });

    describe('DELETE /datapoints/:id', () => {
        it('denies deletion to a datapoint owned by another user', async () => {
            await request(app.getHttpServer())
                .delete(`/datapoints/${datapointId}`)
                .set('Cookie', cookieB)
                .expect(403);
        });

        it('deletes a datapoint for its owner', async () => {
            await request(app.getHttpServer())
                .delete(`/datapoints/${datapointId}`)
                .set('Cookie', cookieA)
                .expect(200);
        });

        it('returns 404 after deletion', async () => {
            await request(app.getHttpServer())
                .get(`/datapoints/${datapointId}`)
                .set('Cookie', cookieA)
                .expect(404);
        });
    });
});