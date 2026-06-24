ALTER TABLE "ListItem"
ADD COLUMN "boardOrderKey" TEXT;

CREATE INDEX "ListItem_boardOrderKey_idx"
ON "ListItem"("boardOrderKey");
