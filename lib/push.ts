import "server-only";

import { getMessagingService } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

export type PushNotificationInput = {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

export type PushNotificationResult = {
  ok: boolean;
  sentCount: number;
  skipped?: boolean;
  error?: string;
};

function dedupeIds(userIds: string[]) {
  return Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean)));
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function toStringData(input: Record<string, string | number | boolean | null | undefined> | undefined) {
  return Object.fromEntries(
    Object.entries(input ?? {}).map(([key, value]) => [key, String(value ?? "")])
  );
}

export async function sendPushNotification(
  input: PushNotificationInput
): Promise<PushNotificationResult> {
  const messaging = getMessagingService();

  if (!messaging) {
    return {
      ok: true,
      sentCount: 0,
      skipped: true,
    };
  }

  const userIds = dedupeIds(input.userIds);

  if (userIds.length === 0) {
    return {
      ok: true,
      sentCount: 0,
      skipped: true,
    };
  }

  const tokens = await prisma.pushToken.findMany({
    where: {
      userId: {
        in: userIds,
      },
    },
    select: {
      id: true,
      token: true,
      userId: true,
    },
  });

  if (tokens.length === 0) {
    return {
      ok: true,
      sentCount: 0,
      skipped: true,
    };
  }

  const data = toStringData(input.data);
  const successfulTokenIds = new Set<string>();
  let sentCount = 0;

  try {
    for (const batch of chunk(tokens, 500)) {
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((entry) => entry.token),
        notification: {
          title: input.title,
          body: input.body,
        },
        data,
      });

      response.responses.forEach((result, index) => {
        if (result.success) {
          successfulTokenIds.add(batch[index].id);
          sentCount += 1;
          return;
        }

        const error = result.error;
        console.error("[push] Push send failed for a token.", {
          userId: batch[index].userId,
          tokenId: batch[index].id,
          error: error?.message ?? "Unknown push error",
          code: (error as { code?: string } | undefined)?.code,
        });
      });
    }

    if (successfulTokenIds.size > 0) {
      await prisma.pushToken.updateMany({
        where: {
          id: {
            in: Array.from(successfulTokenIds),
          },
        },
        data: {
          lastUsedAt: new Date(),
        },
      });
    }

    return {
      ok: true,
      sentCount,
    };
  } catch (error) {
    console.error("[push] Failed to send push notifications.", {
      userIds,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      ok: false,
      sentCount,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
