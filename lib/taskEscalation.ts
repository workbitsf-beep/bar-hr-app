import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getTomorrow(startOfToday: Date): Date {
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

export async function runTaskEscalation() {
  const startOfToday = getStartOfToday();
  const tomorrow = getTomorrow(startOfToday);

  return prisma.task.updateMany({
    where: {
      status: {
        not: TaskStatus.DONE,
      },
      dueDate: {
        lt: startOfToday,
      },
    },
    data: {
      dueDate: tomorrow,
      isUrgent: true,
    },
  });
}
