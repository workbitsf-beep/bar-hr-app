import { CourseKind, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canAccessBar } from "@/lib/billing";
import { defaultExpiry } from "@/lib/course-certificates";
import { getCourseKind } from "@/lib/course-kinds";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { canManageTraining, getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

function refuse(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}

function dayOf(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  // UTC midnight: the day stays the day it reads.
  return new Date(`${text}T00:00:00.000Z`);
}

/**
 * A course done: by whoever runs the courses for anyone, or by a person for
 * themselves (the owner is told). With the certificate's photo or PDF, or
 * the file added later to a certificate that has none.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return refuse(401, "Accedi di nuovo.");
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) return refuse(409, "Scegli prima il locale.");
  if (!(await canAccessBar(activeBar.id))) return refuse(402, "Abbonamento non attivo.");
  const barId = activeBar.id;
  const manager = canManageTraining(role as Role);

  const form = await request.formData();
  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (upload && upload.size > MAX_BYTES) return refuse(413, "Il file è troppo grande: al massimo 15 MB.");
  if (upload && !/^(image\/|application\/pdf)/.test(upload.type || "") && !/\.(pdf|jpe?g|png|heic|webp)$/i.test(upload.name)) {
    return refuse(415, "Carica una foto o un PDF dell'attestato.");
  }
  const fileData = upload
    ? { fileName: upload.name.slice(0, 200), mimeType: upload.type || "application/octet-stream", fileSize: upload.size, content: Buffer.from(await upload.arrayBuffer()) }
    : {};

  // A file for a certificate already there.
  const existingId = String(form.get("certificateId") ?? "").trim();
  if (existingId) {
    if (!upload) return refuse(400, "Scegli il file dell'attestato.");
    const existing = await prisma.courseCertificate.findFirst({ where: { id: existingId, barId }, select: { id: true, userId: true } });
    if (!existing || (!manager && existing.userId !== session.user.id)) return refuse(404, "Attestato non trovato.");
    await prisma.courseCertificate.update({ where: { id: existing.id }, data: fileData });
    revalidatePath("/dashboard/courses");
    return Response.json({ ok: true });
  }

  const userId = String(form.get("userId") ?? "").trim() || session.user.id;
  if (!manager && userId !== session.user.id) return refuse(403, "Puoi caricare solo i tuoi attestati.");
  const member = await prisma.employeeBar.findFirst({ where: { barId, userId }, select: { userId: true, user: { select: { firstName: true, lastName: true } } } });
  if (!member) return refuse(404, "Persona non trovata nel locale.");

  const kindValue = String(form.get("kind") ?? "").toUpperCase();
  const kind = Object.values(CourseKind).includes(kindValue as CourseKind) ? (kindValue as CourseKind) : CourseKind.OTHER;
  const title = (String(form.get("title") ?? "").trim() || getCourseKind(kind).label).slice(0, 120);
  if (kind === CourseKind.OTHER && !String(form.get("title") ?? "").trim()) return refuse(400, "Scrivi il nome del corso.");
  const completedAt = dayOf(form.get("completedAt"));
  if (!completedAt) return refuse(400, "Scegli il giorno del corso.");
  if (completedAt.getTime() > Date.now() + 86_400_000) return refuse(400, "Il corso deve essere già fatto: il giorno non può essere nel futuro.");
  const expiresText = String(form.get("expiresAt") ?? "").trim();
  const expiresAt = expiresText ? dayOf(expiresText) : defaultExpiry(kind, completedAt);
  if (expiresAt && expiresAt <= completedAt) return refuse(400, "La scadenza deve essere dopo il giorno del corso.");

  const courseId = String(form.get("courseId") ?? "").trim() || null;
  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, barId }, select: { id: true } });
    if (!course) return refuse(404, "Corso non trovato.");
  }

  await prisma.courseCertificate.create({
    data: { barId, userId, kind, title, courseId, completedAt, expiresAt, addedById: session.user.id, ...fileData },
  });

  // Added by the person: the owner should know, and may want to look at it.
  if (!manager) {
    const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { ownerId: true } });
    if (bar?.ownerId) {
      await notifyUsers([bar.ownerId], {
        barId,
        title: `${member.user.firstName} ha caricato un attestato`,
        message: title,
        type: INTERNAL_NOTIFICATION_TYPES.COURSE_CERTIFICATE_ADDED,
        actionUrl: "/dashboard/courses",
      }).catch(() => undefined);
    }
  }

  revalidatePath("/dashboard/courses");
  return Response.json({ ok: true });
}
