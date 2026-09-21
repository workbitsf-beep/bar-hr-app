"use client";

import { useRouter } from "next/navigation";

export function BarPicker({
  bars,
  activeBarId,
}: {
  bars: Array<{ id: string; name: string }>;
  activeBarId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={activeBarId}
      onChange={(event) => router.push(`/dashboard/super-admin/people?barId=${event.target.value}`)}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255, 255, 255, 0.16)",
        padding: "13px 14px",
        fontSize: 15,
        background: "rgba(255, 255, 255, 0.05)",
        color: "#f5f3ff",
        colorScheme: "dark",
        width: "100%",
      }}
    >
      <option value="">Scegli un locale</option>
      {bars.map((bar) => (
        <option key={bar.id} value={bar.id}>
          {bar.name}
        </option>
      ))}
    </select>
  );
}
