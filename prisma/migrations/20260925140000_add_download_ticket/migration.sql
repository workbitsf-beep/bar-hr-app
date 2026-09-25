-- CreateTable
CREATE TABLE "DownloadTicket" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DownloadTicket_token_key" ON "DownloadTicket"("token");

-- CreateIndex
CREATE INDEX "DownloadTicket_expiresAt_idx" ON "DownloadTicket"("expiresAt");

-- CreateIndex
CREATE INDEX "DownloadTicket_userId_idx" ON "DownloadTicket"("userId");

-- AddForeignKey
ALTER TABLE "DownloadTicket" ADD CONSTRAINT "DownloadTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
