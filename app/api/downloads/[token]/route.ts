import { consumeDownloadTicket } from "@/lib/download-tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands over a file that was already produced and authorised.
 *
 * No session is required and none is consulted: the ticket is the whole
 * permission, it was issued to someone who had passed every check, and it is
 * spent on the first fetch.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ticket = await consumeDownloadTicket(token);

  if (!ticket) {
    return new Response("Questo collegamento è scaduto o è già stato usato.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const bytes =
    ticket.content instanceof Uint8Array ? ticket.content : new Uint8Array(ticket.content);

  return new Response(bytes, {
    headers: {
      "Content-Type": ticket.mimeType,
      "Content-Disposition": `attachment; filename="${ticket.fileName.replaceAll('"', "'")}"`,
      "Cache-Control": "no-store",
    },
  });
}
