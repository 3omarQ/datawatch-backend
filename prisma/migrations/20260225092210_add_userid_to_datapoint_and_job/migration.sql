/*
  Warnings:

  - You are about to drop the column `description` on the `target_urls` table. All the data in the column will be lost.
  - Added the required column `userId` to the `datapoints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `jobs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "datapoints" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "target_urls" DROP COLUMN "description";
