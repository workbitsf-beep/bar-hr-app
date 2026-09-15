export type PlanTypeValue = "FREE" | "TRIAL" | "PAID" | "LIFETIME";
export type BillingIntervalValue = "MONTHLY" | "YEARLY";
export type BillingStatusValue =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INACTIVE";

export function getDefaultStatus(planType: PlanTypeValue): BillingStatusValue {
  if (planType === "TRIAL") {
    return "TRIALING";
  }

  if (planType === "FREE" || planType === "LIFETIME") {
    return "ACTIVE";
  }

  return "INACTIVE";
}
