import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  getSessionExpiresAt,
  getSessionMaxAge,
  getSessionPersistenceCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_PERSIST_COOKIE_NAME,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language";
import { getAccessibleBarsForUser, getPostLoginDestination } from "@/lib/permissions";
import { createAttemptThrottle } from "@/lib/attempt-throttle";

// Ten wrong passwords for the same address in fifteen minutes, then a pause.
// There was no limit at all: a script could try passwords without end.
const failedLogins = createAttemptThrottle(15 * 60 * 1000, 10);

// Compared against when the address does not exist, so a wrong address takes
// as long to refuse as a wrong password and the timing gives nothing away.
const UNKNOWN_USER_HASH = bcrypt.hashSync("workbit-unknown-user", 10);

type LoginBody = {
  email?: string;
  password?: string;
  rememberMe?: boolean;
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as LoginBody;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const rememberMe = body.rememberMe === true;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Credenziali non valide" },
      { status: 401 }
    );
  }

  if (!failedLogins.isAllowed(email)) {
    return NextResponse.json(
      { ok: false, message: "Troppi tentativi. Riprova tra qualche minuto." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      firstName: true,
      passwordHash: true,
      tempPasswordHash: true,
      tempPasswordExpiresAt: true,
      role: true,
      language: true,
      mustChangePwd: true,
      retiredAt: true,
    },
  });

  const matchesPassword = await bcrypt.compare(password, user?.passwordHash ?? UNKNOWN_USER_HASH);
  // The temporary password from "forgot password", while it is still valid.
  const temporaryHash =
    user?.tempPasswordHash &&
    user.tempPasswordExpiresAt &&
    user.tempPasswordExpiresAt.getTime() > Date.now()
      ? user.tempPasswordHash
      : null;
  const matchesTemporary =
    !matchesPassword && temporaryHash !== null && (await bcrypt.compare(password, temporaryHash));

  // A closed account keeps a placeholder no password can match, but the check
  // is explicit so the refusal never depends on that alone.
  if (!user || user.retiredAt || (!matchesPassword && !matchesTemporary)) {
    failedLogins.record(email);
    return NextResponse.json(
      { ok: false, message: "Credenziali non valide" },
      { status: 401 }
    );
  }

  failedLogins.reset(email);
  let mustChangePwd = user.mustChangePwd;

  if (matchesTemporary && temporaryHash) {
    // Used: it becomes the password, to be changed straight away, and any
    // session still open elsewhere ends - someone recovering access may be
    // recovering it from someone else.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: temporaryHash,
          mustChangePwd: true,
          tempPasswordHash: null,
          tempPasswordExpiresAt: null,
        },
      }),
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    mustChangePwd = true;
  } else if (user.tempPasswordHash) {
    // They remembered the real one: the temporary password is no longer needed.
    await prisma.user.update({
      where: { id: user.id },
      data: { tempPasswordHash: null, tempPasswordExpiresAt: null },
    });
  }

  const accessibleBars = await getAccessibleBarsForUser(user.id);
  const activeBarId = String(user.role) === "SUPER_ADMIN" ? null : accessibleBars[0]?.id ?? null;
  const passkeyCount = await prisma.webAuthnCredential.count({
    where: { userId: user.id },
  });
  const sessionToken = crypto.randomUUID();
  const sessionMaxAge = getSessionMaxAge(rememberMe);

  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: user.id,
      activeBarId,
      expiresAt: getSessionExpiresAt(rememberMe),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions(sessionMaxAge));
  cookieStore.set(
    SESSION_PERSIST_COOKIE_NAME,
    rememberMe ? "1" : "0",
    getSessionPersistenceCookieOptions(sessionMaxAge)
  );
  cookieStore.set(LANGUAGE_COOKIE_NAME, user.language, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({
    ok: true,
    // The name is what the login screen greets with the next time round.
    firstName: user.firstName,
    promptPasskeySetup: passkeyCount === 0,
    redirectTo: await getPostLoginDestination({
      userId: user.id,
      role: user.role,
      mustChangePwd,
      activeBarId,
    }),
  });
}
