/**
 * Telling somebody why the app said no.
 *
 * Next.js hides whatever a server action throws. In production the client is
 * handed a stand-in - "Minified React error #441 ... the specific message is
 * omitted in production builds to avoid leaking sensitive details" - and the
 * real sentence stays in the server log. That is right for a stack trace and
 * wrong for a rule: somebody trying to put a person on a Sunday shift was
 * shown a React error code instead of "Marco è in ferie".
 *
 * So a rule does not travel by throwing. The action catches it and hands it
 * back as an ordinary value, which Next passes through untouched. Anything
 * that is not a rule - a database that went away, a bug - keeps its details
 * on the server and reaches the person as one plain sentence.
 */

/** A rule the person broke, in words they can act on. Safe to show. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

export const ACTION_FAILURE_FALLBACK =
  "Non è stato possibile completare l'operazione. Riprova.";

/** What an action hands back when it could not do the thing. */
export type ActionFailure = { ruleError: string };

export function isActionFailure(value: unknown): value is ActionFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ActionFailure).ruleError === "string"
  );
}

/**
 * Turns whatever went wrong into something the action can return. A rule keeps
 * its words; everything else is logged here, where the detail is still intact,
 * and leaves as the fallback sentence.
 */
export function ruleFailure(error: unknown): ActionFailure {
  // redirect() and notFound() work by throwing. Swallowing one of those would
  // turn a page change into a silent nothing, so they pass straight through.
  const digest = (error as { digest?: unknown } | null)?.digest;

  if (typeof digest === "string" && digest.startsWith("NEXT_")) {
    throw error;
  }

  if (error instanceof RuleError) {
    return { ruleError: error.message };
  }

  console.error("[workbit] action failed", error);

  // Not a rule, so it is a fault, and the person reading it is one of nine
  // people who can tell us about it directly. A short, cut-off line of the
  // real error is worth far more to them than a shrug - it is the difference
  // between "it does not work" and a fix. Cut short on purpose: enough to
  // recognise the fault, not enough to spill a query or a stack.
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const short = detail.replace(/\s+/g, " ").trim().slice(0, 140);

  return { ruleError: short ? `${ACTION_FAILURE_FALLBACK} (${short})` : ACTION_FAILURE_FALLBACK };
}

/**
 * The stand-in Next.js puts in place of an error thrown out of a server
 * action. Nobody should ever read this on screen.
 */
const MASKED_ERROR =
  /minified react error|omitted in production|server components render|digest/i;

/** The sentence to show for a caught error, wherever one is caught. */
export function describeActionError(error: unknown) {
  if (isActionFailure(error)) {
    return error.ruleError;
  }

  if (!(error instanceof Error) || !error.message.trim()) {
    return ACTION_FAILURE_FALLBACK;
  }

  return MASKED_ERROR.test(error.message) ? ACTION_FAILURE_FALLBACK : error.message;
}
