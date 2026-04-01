/*
  Warnings:

  - The values [PENDING,STARTED,DONE,FAILED] on the enum `JobStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `finishedAt` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `jobId` on the `logs` table. All the data in the column will be lost.
  - You are about to drop the column `jobId` on the `results` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[url,userId]` on the table `target_urls` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `executionId` to the `logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `executionId` to the `results` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "JobStatus_new" AS ENUM ('ACTIVE', 'PAUSED');
ALTER TABLE "public"."jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "jobs" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "public"."JobStatus_old";
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "logs" DROP CONSTRAINT "logs_jobId_fkey";

-- DropForeignKey
ALTER TABLE "results" DROP CONSTRAINT "results_jobId_fkey";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "finishedAt",
DROP COLUMN "startedAt",
ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "definition" SET DEFAULT '';

-- AlterTable
ALTER TABLE "logs" DROP COLUMN "jobId",
ADD COLUMN     "executionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "results" DROP COLUMN "jobId",
ADD COLUMN     "executionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "job_executions" (
    "id" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "target_urls_url_userId_key" ON "target_urls"("url", "userId");

-- AddForeignKey
ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "job_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "job_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
