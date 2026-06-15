-- CreateTable
CREATE TABLE "ItemNoteDoc" (
    "itemId" UUID NOT NULL,
    "state" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemNoteDoc_pkey" PRIMARY KEY ("itemId")
);

-- AddForeignKey
ALTER TABLE "ItemNoteDoc" ADD CONSTRAINT "ItemNoteDoc_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
