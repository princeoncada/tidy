ALTER TABLE "View"
ADD COLUMN "orderKey" TEXT;

ALTER TABLE "ViewList"
ADD COLUMN "orderKey" TEXT;

ALTER TABLE "ListItem"
ADD COLUMN "orderKey" TEXT;

CREATE INDEX "View_userId_orderKey_idx"
ON "View"("userId", "orderKey");

CREATE INDEX "ViewList_viewId_orderKey_idx"
ON "ViewList"("viewId", "orderKey");

CREATE INDEX "ListItem_listId_orderKey_idx"
ON "ListItem"("listId", "orderKey");
