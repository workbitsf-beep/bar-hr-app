-- CreateTable
CREATE TABLE "HomeLayout" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "blocks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeLayout_userId_barId_key" ON "HomeLayout"("userId", "barId");

-- CreateIndex
CREATE INDEX "HomeLayout_barId_idx" ON "HomeLayout"("barId");

-- AddForeignKey
ALTER TABLE "HomeLayout" ADD CONSTRAINT "HomeLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeLayout" ADD CONSTRAINT "HomeLayout_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
