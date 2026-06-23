-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "status" "ItemStatus" NOT NULL DEFAULT 'TODO',
ADD COLUMN     "assigneeId" UUID;

-- CreateIndex
CREATE INDEX "ListItem_assigneeId_idx" ON "ListItem"("assigneeId");
