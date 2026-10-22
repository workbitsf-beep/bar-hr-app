"use client";

import { useEffect, useState } from "react";

/**
 * Temporary: shows, step by step, whether the page reaches the widgets
 * plugin and whether the snapshot is handed over. Opened by hand at
 * /dashboard/widget-check inside the app.
 */
export default function WidgetCheckPage() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const out: string[] = [];
    const say = (line: string) => {
      out.push(line);
      setLines([...out]);
    };

    void (async () => {
      const capacitor = (window as { Capacitor?: Record<string, unknown> }).Capacitor as
        | {
            isNativePlatform?: () => boolean;
            getPlatform?: () => string;
            isPluginAvailable?: (name: string) => boolean;
            PluginHeaders?: Array<{ name: string }>;
          }
        | undefined;
      say(`Capacitor: ${capacitor ? "sì" : "no"}`);
      say(`App nativa: ${capacitor?.isNativePlatform?.() ? "sì" : "no"} (${capacitor?.getPlatform?.() ?? "?"})`);
      say(`Plugin WorkbitWidgets: ${capacitor?.isPluginAvailable?.("WorkbitWidgets") ? "sì" : "no"}`);
      say(`Plugin presenti: ${(capacitor?.PluginHeaders ?? []).map((p) => p.name).join(", ") || "nessuno"}`);

      let snapshot = "";
      try {
        const response = await fetch("/api/widgets", { cache: "no-store" });
        snapshot = await response.text();
        say(`Dati dal sito: ${response.status}, ${snapshot.length} caratteri`);
        const parsed = JSON.parse(snapshot) as { shifts?: unknown[]; open?: unknown; monthHours?: number };
        say(`Turni: ${parsed.shifts?.length ?? 0} · in servizio: ${parsed.open ? "sì" : "no"} · ore mese: ${parsed.monthHours ?? "-"}`);
      } catch (error) {
        say(`Dati dal sito: errore ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const { registerPlugin } = await import("@capacitor/core");
        const widgets = registerPlugin<{ update(o: { snapshot: string }): Promise<unknown> }>("WorkbitWidgets");
        const result = await widgets.update({ snapshot });
        say(`Consegna al widget: ok ${JSON.stringify(result ?? {})}`);
      } catch (error) {
        say(`Consegna al widget: errore ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      }
    })();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 18 }}>Controllo widget</h1>
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </main>
  );
}
