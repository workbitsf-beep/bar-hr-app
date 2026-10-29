import "server-only";
import { buildPayrollMonth } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth } from "@/lib/payroll/access";
import type { PayrollMonthData } from "@/lib/payroll/template";

/** The venue's real month, a few people of it: what the file previews show. */
export async function recipientSample(barId: string): Promise<PayrollMonthData> {
  const { year, month } = defaultPayrollMonth();
  const data = await buildPayrollMonth({ barId, month, year });
  return {
    month: data.month,
    year: data.year,
    venueName: data.venueName,
    legalName: data.legalName,
    vatNumber: data.vatNumber,
    people: data.people.slice(0, 4).map((person) => ({
      userId: person.userId,
      firstName: person.firstName,
      lastName: person.lastName,
      payrollCode: person.payrollCode,
      contractWeeklyHours: person.contractWeeklyHours,
      entries: person.entries,
    })),
  };
}
