import { readDownloadTicket } from "@/lib/download-tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands over a file that was already produced and authorised.
 *
 * No session is required and none is consulted: the ticket is the whole
 * permission, it was issued to someone who had passed every check, and it
 * stops working when it expires.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ticket = await readDownloadTicket(token);

  if (!ticket) {
    return new Response("Questo collegamento è scaduto. Torna su Workbit e genera di nuovo il report.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const bytes =
    ticket.content instanceof Uint8Array ? ticket.content : new Uint8Array(ticket.content);

  // Shown rather than offered as an attachment: asking for an attachment made
  // the browser hand the address to its download manager, which fetched it a
  // second time. The reader gets the report on screen in one request, and
  // saves it from there if they want it.
  return new Response(bytes, {
    headers: {
      "Content-Type": ticket.mimeType,
      "Content-Disposition": `inline; filename="${ticket.fileName.replaceAll('"', "'")}"`,
      "Cache-Control": "no-store",
    },
  });
}
