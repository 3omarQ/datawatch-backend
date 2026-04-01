/*
  Warnings:

  - You are about to drop the column `extractionScript` on the `datapoints` table. All the data in the column will be lost.
  - You are about to drop the column `end` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `start` on the `jobs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "datapoints" DROP COLUMN "extractionScript";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "end",
DROP COLUMN "start",
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);
