import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaLogLevels: Prisma.LogLevel[] =
  process.env.PRISMA_QUERY_LOGS === "true"
    ? ["query", "warn", "error"]
    : process.env.NODE_ENV !== "production"
      ? ["warn", "error"]
      : ["error"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogLevels,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
