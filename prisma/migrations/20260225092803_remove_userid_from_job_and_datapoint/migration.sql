/*
  Warnings:

  - You are about to drop the column `userId` on the `datapoints` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `jobs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "datapoints" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "userId";
