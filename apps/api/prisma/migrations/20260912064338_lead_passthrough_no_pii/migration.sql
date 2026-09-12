/*
  Warnings:

  - You are about to drop the `Lead` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LeadActivity` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LeadDeliveryMethod" AS ENUM ('WEBHOOK', 'EMAIL_FALLBACK');

-- CreateEnum
CREATE TYPE "LeadDeliveryStatus" AS ENUM ('DELIVERED', 'FAILED');

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_assignedAgentId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_brokerId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_micrositeId_fkey";

-- DropForeignKey
ALTER TABLE "LeadActivity" DROP CONSTRAINT "LeadActivity_leadId_fkey";

-- DropForeignKey
ALTER TABLE "LeadActivity" DROP CONSTRAINT "LeadActivity_userId_fkey";

-- AlterTable
ALTER TABLE "Microsite" ADD COLUMN     "crmWebhookActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "crmWebhookSecret" TEXT,
ADD COLUMN     "crmWebhookUrl" TEXT;

-- DropTable
DROP TABLE "Lead";

-- DropTable
DROP TABLE "LeadActivity";

-- DropEnum
DROP TYPE "LeadStatus";

-- CreateTable
CREATE TABLE "LeadDeliveryLog" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "micrositeId" TEXT NOT NULL,
    "method" "LeadDeliveryMethod" NOT NULL,
    "status" "LeadDeliveryStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "sourceAction" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadDeliveryLog_brokerId_createdAt_idx" ON "LeadDeliveryLog"("brokerId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadDeliveryLog_micrositeId_createdAt_idx" ON "LeadDeliveryLog"("micrositeId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadDeliveryLog" ADD CONSTRAINT "LeadDeliveryLog_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDeliveryLog" ADD CONSTRAINT "LeadDeliveryLog_micrositeId_fkey" FOREIGN KEY ("micrositeId") REFERENCES "Microsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
