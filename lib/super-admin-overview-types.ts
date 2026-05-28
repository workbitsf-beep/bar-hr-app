export type ActivityTypeValue = "RESTAURANT" | "COMPANY";
export type BillingIntervalValue = "MONTHLY" | "YEARLY" | null;
export type PlanTypeValue = "FREE" | "TRIAL" | "PAID" | "LIFETIME";
export type SubscriptionStatusValue =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INACTIVE";
export type RoleValue = "OWNER" | "MANAGER" | "EMPLOYEE";

export type ActivityItem = {
  id: string;
  name: string;
  activityType: ActivityTypeValue;
  city: string | null;
  email: string | null;
  createdAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  staffCounts: {
    owners: number;
    managers: number;
    employees: number;
    total: number;
  };
  operations: {
    shifts: number;
    timeLogs: number;
    requests: number;
    tasks: number;
  };
  subscription: {
    planType: PlanTypeValue;
    status: SubscriptionStatusValue;
    billingInterval: BillingIntervalValue;
    monthlyDiscountPercent: number;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  };
};

export type OwnerDirectoryItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  activityCount: number;
  restaurantCount: number;
  companyCount: number;
  estimatedMonthlyRevenue: number;
  searchText: string;
  activityPreview: string[];
};

export type StaffDirectoryItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: RoleValue[];
  activityCount: number;
  searchText: string;
  activityPreview: string[];
};

export type SuperAdminOverviewSummary = {
  totalActivities: number;
  restaurantCount: number;
  companyCount: number;
  ownerCount: number;
  staffCount: number;
  activeCount: number;
  trialCount: number;
  atRiskCount: number;
  inactiveCount: number;
  freeLifetimeCount: number;
  last30Timelogs: number;
  pendingRequests: number;
  openTasks: number;
};

export type SuperAdminOverviewPayload = {
  summary: SuperAdminOverviewSummary;
  activities: ActivityItem[];
  owners: OwnerDirectoryItem[];
  staff: StaffDirectoryItem[];
};
