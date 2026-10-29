import { payrollAccess } from "@/lib/payroll/access";
import { templateFromSample } from "@/lib/payroll/template-ai";
import { describeActionError } from "@/lib/rule-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A file the consultant already uses, read into a template for the owner to check. */
export async function POST(request: Request) {
  try {
    await payrollAccess({ ownerOnly: true });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return Response.json({ ok: false, message: "Scegli un file." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return Response.json({ ok: false, message: "Il file è troppo grande: al massimo 5 MB." }, { status: 400 });
    const guess = await templateFromSample(file.name, Buffer.from(await file.arrayBuffer()));
    return Response.json({ ok: true, ...guess });
  } catch (error) {
    console.error("[payroll] sample not read", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, message: describeActionError(error) }, { status: 400 });
  }
}
