-- CreateTable
CREATE TABLE "DocumentAccessToken" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAccessToken_token_key" ON "DocumentAccessToken"("token");

-- CreateIndex
CREATE INDEX "DocumentAccessToken_expiresAt_idx" ON "DocumentAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "DocumentAccessToken_documentId_idx" ON "DocumentAccessToken"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessToken_userId_idx" ON "DocumentAccessToken"("userId");

-- AddForeignKey
ALTER TABLE "DocumentAccessToken" ADD CONSTRAINT "DocumentAccessToken_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessToken" ADD CONSTRAINT "DocumentAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
