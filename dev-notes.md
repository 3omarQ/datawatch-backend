## structure

- App boot: `src/main.ts`, `src/app.module.ts`
- Prisma schema + migrations: `prisma/schema.prisma`, `prisma/migrations/**`
- Auth (JWT, password reset, email): `src/auth/**`
- Targets + datapoints: `src/target-urls/**`, `src/datapoints/**`
- Jobs + executions + logs + results: `src/jobs/**`, `src/job-executions/**`, `src/job-logs/**`, `src/results/**`
- Queue + worker: `src/queue/**`, worker in `src/queue/scrape.processor.ts`
- Scrapers: `src/scraper/strategies/basic.scraper.ts`, `src/scraper/strategies/smart.scraper.ts`
- Output formatting: `src/scraper/formatter-factory.service.ts`, `src/scraper/formatters/**`
- Preview / element picker: `src/preview/preview.controller.ts`, `src/preview/preview.service.ts`
- Notifications: `src/notifications/**` (gateway: `src/notifications/gateways/notifications.gateway.ts`)

## What happens when a job runs?

- API: receive `POST /jobs/:id/run` in `src/job-executions/job-executions.controller.ts`.
- Enqueue: `JobSchedulerService.enqueueRun()` in `src/jobs/job-scheduler.service.ts` adds a BullMQ job named `scrape`.
- Worker: `src/queue/scrape.processor.ts` loads job target, picks scraper + formatter, scrapes, then saves results.
- Execution lifecycle in `src/job-executions/job-executions.service.ts`:
  - `initExecution()` -> `completeExecution()` or `failExecution()`
  - emits `execution.done`, `execution.failed`, `execution.diff`
- Notifications fan out in `src/notifications/notifications.service.ts` (websocket, webhook, email).

## How do I run the system locally?

You need Postgres + Redis running locally.

- Env: copy `.env.example` to `.env` and fill in secrets
- Install: `npm install`
- Prisma: `npx prisma generate` then `npx prisma migrate dev`
- Start: `npm run start:dev`
- Defaults: backend on `http://localhost:3001`, CORS origin `FRONTEND_URL` or `http://localhost:3000` (see `src/main.ts`)

## Where are env vars set?

- `.env` (ignored) and `.env.example` (template)
- Config module: `ConfigModule.forRoot({ isGlobal: true })` in `src/app.module.ts`
- Accessed via `ConfigService` or `process.env` (ex: `src/main.ts`, `src/app.module.ts`)
