CREATE TABLE "ReplicacheClientGroup" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplicacheClientGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReplicacheClient" (
    "id" TEXT NOT NULL,
    "clientGroupId" TEXT NOT NULL,
    "lastMutationID" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReplicacheClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReplicacheClientViewRecord" (
    "id" TEXT NOT NULL,
    "clientGroupId" TEXT NOT NULL,
    "entities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplicacheClientViewRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReplicacheClientGroup_userId_idx"
ON "ReplicacheClientGroup"("userId");

CREATE INDEX "ReplicacheClient_clientGroupId_idx"
ON "ReplicacheClient"("clientGroupId");

CREATE INDEX "ReplicacheClientViewRecord_clientGroupId_createdAt_idx"
ON "ReplicacheClientViewRecord"("clientGroupId", "createdAt");

ALTER TABLE "ReplicacheClient"
ADD CONSTRAINT "ReplicacheClient_clientGroupId_fkey"
FOREIGN KEY ("clientGroupId")
REFERENCES "ReplicacheClientGroup"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ReplicacheClientViewRecord"
ADD CONSTRAINT "ReplicacheClientViewRecord_clientGroupId_fkey"
FOREIGN KEY ("clientGroupId")
REFERENCES "ReplicacheClientGroup"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
