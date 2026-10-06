import { prisma } from "@/lib/prisma";
import { confirmedTaskArchived, inConfirmationArchive } from "@/lib/note-visibility";
import { formatDateInTimeZone } from "@/lib/time-zone";

type ArchiveEntry = {
  id: string;
  at: Date;
  author: string;
  text: string;
  confirmations: Array<{ name: string; at: Date }>;
};

/**
 * What asked to be confirmed, once it has left the page.
 *
 * The Note page and the calendar's board show the day's messages; one that
 * asked for confirmation is the proof that something was communicated - a
 * procedure, a change of hours. Here it can be found again for a year: what it
 * said, who confirmed it and when. Read only: the archive is a record, not a
 * second board.
 */
export async function ConfirmationArchive({ barId }: { barId: string }) {
  const [tasks, notes] = await Promise.all([
    prisma.task.findMany({
      where: { barId, ...confirmedTaskArchived() },
      orderBy: { completedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        createdBy: { select: { firstName: true, lastName: true } },
        completions: {
          orderBy: { completedAt: "asc" },
          select: { completedAt: true, user: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.note.findMany({
      where: { barId, ...inConfirmationArchive() },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true } },
        readReceipts: {
          orderBy: { readAt: "asc" },
          select: { readAt: true, user: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
  ]);

  const entries: ArchiveEntry[] = [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      at: task.dueDate,
      author: `${task.createdBy.firstName} ${task.createdBy.lastName}`,
      text: task.description ? `${task.title}\n${task.description}` : task.title,
      confirmations: task.completions.map((completion) => ({
        name: `${completion.user.firstName} ${completion.user.lastName}`,
        at: completion.completedAt,
      })),
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      at: note.createdAt,
      author: `${note.author.firstName} ${note.author.lastName}`,
      text: note.content,
      confirmations: note.readReceipts.map((receipt) => ({
        name: `${receipt.user.firstName} ${receipt.user.lastName}`,
        at: receipt.readAt,
      })),
    })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime());

  if (entries.length === 0) {
    return (
      <p style={{ margin: 0, color: "#6b6880", fontSize: 14, lineHeight: 1.6 }}>
        Nessuna nota confermata in archivio. Le note che chiedono una conferma arrivano qui un
        giorno dopo essere state confermate, e restano 12 mesi.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: 0, color: "#6b6880", fontSize: 13, lineHeight: 1.6 }}>
        Le note che chiedevano una conferma, con chi le ha confermate e quando. Restano 12 mesi.
      </p>
      {entries.map((entry) => (
        <article
          key={entry.id}
          style={{
            display: "grid",
            gap: 6,
            padding: "12px 14px",
            borderRadius: 16,
            background: "#ffffff",
            border: "1px solid #e9e6f5",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            {formatDateInTimeZone(entry.at)} · {entry.author}
          </span>
          <span style={{ fontSize: 14.5, color: "#17161f", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {entry.text}
          </span>
          <span style={{ fontSize: 13, color: "#6b6880", lineHeight: 1.5 }}>
            {entry.confirmations.length === 0
              ? "Nessuna conferma."
              : `Confermata da ${entry.confirmations
                  .map((item) => `${item.name} (${formatDateInTimeZone(item.at)})`)
                  .join(", ")}.`}
          </span>
        </article>
      ))}
    </div>
  );
}
