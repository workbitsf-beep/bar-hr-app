import { createAppIconResponse } from "@/lib/app-icon-response";

export const dynamic = "force-static";

export async function GET() {
  return createAppIconResponse(192);
}
