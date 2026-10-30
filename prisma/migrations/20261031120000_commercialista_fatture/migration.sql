-- CreateTable
CREATE TABLE "AccountantAccess" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "addedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountantAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantLoginCode" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountantLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantSession" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantNotice" (
    "email" TEXT NOT NULL,
    "notifiedMonth" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountantNotice_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountantAccess_barId_email_key" ON "AccountantAccess"("barId", "email");

-- CreateIndex
CREATE INDEX "AccountantAccess_email_idx" ON "AccountantAccess"("email");

-- CreateIndex
CREATE INDEX "AccountantLoginCode_email_createdAt_idx" ON "AccountantLoginCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountantSession_tokenHash_key" ON "AccountantSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountantSession_email_idx" ON "AccountantSession"("email");

-- AddForeignKey
ALTER TABLE "AccountantAccess" ADD CONSTRAINT "AccountantAccess_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
