-- AlterEnum
BEGIN;
CREATE TYPE "LeadDeliveryMethod_new" AS ENUM ('WEBHOOK', 'DASHBOARD_NOTIFICATION');
ALTER TABLE "LeadDeliveryLog" ALTER COLUMN "method" TYPE "LeadDeliveryMethod_new" USING ("method"::text::"LeadDeliveryMethod_new");
ALTER TYPE "LeadDeliveryMethod" RENAME TO "LeadDeliveryMethod_old";
ALTER TYPE "LeadDeliveryMethod_new" RENAME TO "LeadDeliveryMethod";
DROP TYPE "LeadDeliveryMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "LeadDeliveryLog" ADD COLUMN     "crmConnectorName" TEXT;

-- AlterTable
ALTER TABLE "Microsite" DROP COLUMN "crmWebhookActive",
DROP COLUMN "crmWebhookSecret",
DROP COLUMN "crmWebhookUrl";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "channel",
DROP COLUMN "sentAt",
ADD COLUMN     "micrositeId" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "NotificationChannel";

-- CreateTable
CREATE TABLE "CrmConnector" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "headers" JSONB,
    "payloadTemplate" JSONB,
    "webhookSecret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CrmConnectorToMicrosite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "CrmConnector_brokerId_idx" ON "CrmConnector"("brokerId");

-- CreateIndex
CREATE UNIQUE INDEX "_CrmConnectorToMicrosite_AB_unique" ON "_CrmConnectorToMicrosite"("A", "B");

-- CreateIndex
CREATE INDEX "_CrmConnectorToMicrosite_B_index" ON "_CrmConnectorToMicrosite"("B");

-- CreateIndex
CREATE INDEX "Notification_brokerId_readAt_idx" ON "Notification"("brokerId", "readAt");

-- AddForeignKey
ALTER TABLE "CrmConnector" ADD CONSTRAINT "CrmConnector_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_micrositeId_fkey" FOREIGN KEY ("micrositeId") REFERENCES "Microsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CrmConnectorToMicrosite" ADD CONSTRAINT "_CrmConnectorToMicrosite_A_fkey" FOREIGN KEY ("A") REFERENCES "CrmConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CrmConnectorToMicrosite" ADD CONSTRAINT "_CrmConnectorToMicrosite_B_fkey" FOREIGN KEY ("B") REFERENCES "Microsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

