import type { Instrumentation } from "next";

/**
 * Every error a request runs into on the server is counted and, when new,
 * told to the super admins (lib/security/errors.ts) - before a client
 * notices and writes to support.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordServerError } = await import("./lib/security/errors");
  const err = error as { message?: string; digest?: string };
  await recordServerError({ message: err?.message ?? String(error), path: request.path, digest: err?.digest ?? null });
};
