"use server";

import { requestAccountantCode, signOutAccountant, verifyAccountantCode } from "@/lib/accountant/auth";
import { ruleFailure } from "@/lib/rule-error";

export async function requestCodeAction(email: string) {
  try {
    await requestAccountantCode(email);
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function verifyCodeAction(email: string, code: string) {
  try {
    await verifyAccountantCode(email, code);
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function signOutAction() {
  await signOutAccountant();
}
