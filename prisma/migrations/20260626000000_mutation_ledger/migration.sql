CREATE TABLE "MutationLedgerEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "clientGroupId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "mutationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "affectedListIds" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MutationLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MutationLedgerEntry_clientId_mutationId_key" ON "MutationLedgerEntry"("clientId", "mutationId");

CREATE INDEX "MutationLedgerEntry_userId_createdAt_idx" ON "MutationLedgerEntry"("userId", "createdAt");
