-- AlterTable
ALTER TABLE "BarSettings" ADD COLUMN     "shoppingListEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ShoppingListItem" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingListItem_barId_createdAt_idx" ON "ShoppingListItem"("barId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
