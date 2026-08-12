# DataWatch Backend

## Problem

Monitoring websites for changes at scale requires scheduling, scraping mechanisms (handling CAPTCHAs, dynamic rendering), data extraction formatting, and storage to compare historical versions of data without overloading target servers or internal resources.

## Solution

A NestJS-based backend that handles scheduling of scraping jobs via BullMQ, running background workers using Puppeteer/Cheerio, storing scraped data, detecting changes (diffing), and notifying users in real-time or via email.

## Key Features

- **Job Scheduling & Queueing**: BullMQ and Redis to handle concurrent scraping jobs reliably.
- **Scraping**: Uses Cheerio for fast static extraction and Puppeteer (with Stealth plugin) for dynamic JS-rendered sites.
- **Diff Detection**: Automatically compares the latest extraction with previous runs to emit change events.
- **WebSockets**: Pushes live execution logs, progress, and completion events to connected clients.
- **Notifications**: Integrates with Nodemailer for email alerts when data changes or jobs fail.
- **Authentication**: Supports Local (email/password).

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (v11)
- **Database / ORM**: PostgreSQL, [Prisma](https://www.prisma.io/)
- **Queues**: [BullMQ](https://docs.bullmq.io/) & Redis
- **Scraping**: [Puppeteer](https://pptr.dev/), [Cheerio](https://cheerio.js.org/)
- **Real-time**: Socket.IO
- **Auth**: Passport.js (JWT, Google, GitHub OAuth), bcrypt
- **Mailing**: Nodemailer

## For french speakers/readers
### Report
This was a graduation project (PFE), so here's a [link to the pdf report](https://omarkassar.me/reports/datawatch_report.pdf)

### Main design diagrams:

Database schema
<img align="center" width="600" alt="database schema" src="https://github.com/user-attachments/assets/ae5c6e8b-6fb1-4b2c-8890-c9f3d3f558d9" />

Class diagram
<img width="8192" height="6166" alt="class diagram" src="https://github.com/user-attachments/assets/7656341e-484f-46b5-b584-3dc5056b5dc3" />




## Quickstart

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Setup Infrastructure (Database & Redis):**
   _(Ensure you have PostgreSQL and Redis running locally or via Docker)_

3. **Apply Database Migrations:**

   ```bash
   npx prisma migrate dev
   ```

4. **Run the development server:**
   ```bash
   npm run start:dev
   ```

## Environment Variables

Create a `.env` file in the root of the backend directory, following the .env.example file

## Roadmap

- [ ] Implement proxy rotation for the scraping workers.
- [ ] Add GraphQL API support alongside REST.
- [ ] Add an admin dashboard for queue monitoring (e.g., BullMQ Board).
- [ ] Provide configurable scrape retry strategies and backoff.
