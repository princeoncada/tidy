ALTER TABLE "Workspace"
ADD COLUMN "orderKey" TEXT;

CREATE INDEX "Workspace_ownerId_orderKey_idx"
ON "Workspace"("ownerId", "orderKey");
