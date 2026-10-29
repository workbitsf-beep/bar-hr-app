import Link from "next/link";

export const ROLE_LABELS: Record<string, string> = {
  consulente: "Consulente del lavoro",
  commercialista: "Commercialista",
  altro: "Altro",
};

export const inputStyle = {
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  padding: "0 10px",
  fontSize: 15,
  width: "100%",
  minWidth: 0,
  background: "#ffffff",
} as const;

export const fieldLabel = { display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" } as const;

export function hoursText(value: number) {
  return value ? value.toLocaleString("it-IT", { maximumFractionDigits: 2 }) : "–";
}

/** The last twelve months, the chosen one dark. */
export function MonthChips({ base, year, month }: { base: string; year: number; month: number }) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - index, 1));
  return (
    <nav aria-label="Mese" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 2px 2px", scrollbarWidth: "none" }}>
      {months.map((date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const active = date.getFullYear() === year && date.getMonth() + 1 === month;
        return (
          <Link
            key={key}
            href={`${base}?mese=${key}`}
            aria-current={active ? "page" : undefined}
            style={{
              flex: "0 0 auto",
              padding: "7px 13px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 720,
              textDecoration: "none",
              background: active ? "#4c1d95" : "#ffffff",
              color: active ? "#ffffff" : "#4b4763",
              border: active ? "1px solid #4c1d95" : "1px solid #e9e6f5",
            }}
          >
            {new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date)} {String(date.getFullYear()).slice(2)}
          </Link>
        );
      })}
    </nav>
  );
}
