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

const TEST_USER = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123',
};

describe('Auth (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        await prisma.$connect();
        // Insérer un utilisateur vérifié directement en base
        const hashed = await bcrypt.hash(TEST_USER.password, 12);
        await prisma.user.create({
            data: {
                name: TEST_USER.name,
                email: TEST_USER.email,
                password: hashed,
                provider: Provider.LOCAL,
                emailVerified: true,
            },
        });
        app = await createTestApp();
    });

    afterAll(async () => {
        await prisma.user.deleteMany();
        await prisma.$disconnect();
        await app.close();
    });

    describe('POST /auth/register', () => {
        it('inscrit un nouvel utilisateur', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    name: 'New User',
                    email: 'new@example.com',
                    password: 'Password123',
                    confirmPassword: 'Password123',
                })
                .expect(201);

            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('email', 'new@example.com');
        });

        it('rejette un email déjà utilisé', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    name: TEST_USER.name,
                    email: TEST_USER.email,
                    password: 'Password123',
                    confirmPassword: 'Password123',
                })
                .expect(409);
        });

        it('rejette un payload invalide (email manquant)', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ name: 'X', password: 'Password123', confirmPassword: 'Password123' })
                .expect(400);
        });

        it('rejette un mot de passe trop faible', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    name: 'X',
                    email: 'weak@example.com',
                    password: 'weak',
                    confirmPassword: 'weak',
                })
                .expect(400);
        });
    });

    describe('POST /auth/login', () => {
        it('connecte un utilisateur vérifié et pose un cookie', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: TEST_USER.email, password: TEST_USER.password })
                .expect(200);

            expect(res.body).toHaveProperty('user');
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('rejette un mauvais mot de passe', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: TEST_USER.email, password: 'WrongPass1' })
                .expect(401);
        });

        it('rejette un email inexistant', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'nobody@example.com', password: 'Password123' })
                .expect(401);
        });
    });

    describe('GET /auth/me', () => {
        let authCookie: string;

        beforeAll(async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: TEST_USER.email, password: TEST_USER.password });
            authCookie = (res.headers['set-cookie'] as unknown as string[])[0];
        });

        it('retourne le profil avec un cookie valide', async () => {
            const res = await request(app.getHttpServer())
                .get('/auth/me')
                .set('Cookie', authCookie)
                .expect(200);

            expect(res.body).toHaveProperty('email', TEST_USER.email);
            expect(res.body).not.toHaveProperty('password');
        });

        it('rejette une requête sans cookie', async () => {
            await request(app.getHttpServer())
                .get('/auth/me')
                .expect(401);
        });
    });
});