"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { isActionFailure } from "@/lib/rule-error";
import {
  addShoppingOnTerminalAction,
  clockOnTerminalAction,
  completeTaskOnTerminalAction,
  pairTerminalAction,
  unpairTerminalAction,
  type TerminalResult,
} from "./actions";
import styles from "./terminale.module.css";

export type TerminalNote = {
  id: string;
  title: string;
  description: string | null;
  urgent: boolean;
  completable: boolean;
  upcoming: boolean;
  late: boolean;
  day: string;
  who: string;
};

type Tab = "note" | "spesa" | "timbra";
type PinAsk = { title: string; run: (pin: string) => Promise<unknown> };
type Banner = { tone: "good" | "bad"; text: string };

/** The pairing screen: the code from the owner's settings, typed once. */
export function PairingScreen({ blocked }: { blocked?: string }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <main className={styles.shell}>
      <section className={styles.pairCard}>
        <span className={styles.logo}>WB</span>
        <h1>Terminale del locale</h1>
        {blocked ? (
          <p>{blocked}</p>
        ) : (
          <>
            <p>
              Il titolare trova il codice in <b>Impostazioni › Terminale</b>. Scrivilo qui: questo dispositivo mostrerà le note e la lista della spesa a tutti, e
              si potrà timbrare con il PIN.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                start(async () => {
                  const result = await pairTerminalAction(data);
                  if (isActionFailure(result)) setError(result.ruleError);
                });
              }}
            >
              <input name="code" className={styles.codeInput} placeholder="CODICE" autoComplete="off" autoCapitalize="characters" maxLength={12} required />
              <button className={styles.primary} disabled={pending}>
                {pending ? "Collego…" : "Collega"}
              </button>
            </form>
            {error ? <p className={styles.errorText}>{error}</p> : null}
          </>
        )}
      </section>
    </main>
  );
}

export function TerminalScreen(props: {
  barName: string;
  terminalName: string;
  pinForTasks: boolean;
  features: { tasks: boolean; shopping: boolean; clock: boolean };
  notes: TerminalNote[];
  done: Array<{ id: string; title: string; by: string | null; at: string }>;
  board: Array<{ id: string; content: string; author: string }>;
  shopping: Array<{ id: string; name: string; quantity: string | null; by: string | null }>;
}) {
  const router = useRouter();
  const tabs = (
    [
      props.features.tasks ? (["note", "Da fare"] as const) : null,
      props.features.shopping ? (["spesa", "Spesa"] as const) : null,
      props.features.clock ? (["timbra", "Timbra"] as const) : null,
    ].filter(Boolean) as Array<readonly [Tab, string]>
  );
  const firstTab: Tab = tabs[0]?.[0] ?? "note";
  const [tab, setTab] = useState<Tab>(firstTab);
  const [ask, setAsk] = useState<PinAsk | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const idle = useRef(0);

  // New notes from the phones show up by themselves; after a minute alone the
  // screen goes back to the list.
  useEffect(() => {
    setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 15_000);
    const refresh = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [router]);

  useEffect(() => {
    const reset = () => {
      window.clearTimeout(idle.current);
      idle.current = window.setTimeout(() => {
        setAsk(null);
        setTab(firstTab);
      }, 60_000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    return () => {
      window.removeEventListener("pointerdown", reset);
      window.clearTimeout(idle.current);
    };
  }, [firstTab]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), banner.tone === "good" ? 3500 : 5000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  /** Runs an action and says how it went, big enough to read from a step away. */
  async function report(promise: Promise<TerminalResult | unknown>) {
    const result = (await promise) as TerminalResult;
    if (isActionFailure(result)) {
      setBanner({ tone: "bad", text: result.ruleError });
      return false;
    }
    setBanner({ tone: "good", text: result.message });
    router.refresh();
    return true;
  }

  function withPin(title: string, build: (pin: string) => FormData, action: (data: FormData) => Promise<TerminalResult>, needsPin: boolean) {
    if (!needsPin) return report(action(build("")));
    setAsk({ title, run: (pin) => report(action(build(pin))) });
  }

  const today = props.notes.filter((note) => !note.upcoming && note.completable);
  const upcoming = props.notes.filter((note) => note.upcoming && note.completable);
  const notices = props.notes.filter((note) => !note.completable);

  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <div>
          <span className={styles.venue}>{props.barName}</span>
          <span className={styles.sub}>{props.terminalName}</span>
        </div>
        <span className={styles.clock}>
          {now ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(now) : ""}
        </span>
      </header>

      {tabs.length > 1 ? (
        <nav className={styles.tabs}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? styles.tabOn : styles.tab} onClick={() => setTab(id)}>
              {label}
              {id === "note" && today.length ? <span className={styles.count}>{today.length}</span> : null}
              {id === "spesa" && props.shopping.length ? <span className={styles.count}>{props.shopping.length}</span> : null}
            </button>
          ))}
        </nav>
      ) : null}

      <div className={styles.body}>
        {tab === "note" ? (
          <>
            {props.board.length || notices.length ? (
              <section className={styles.card}>
                <h2>Avvisi</h2>
                {props.board.map((note) => (
                  <p key={note.id} className={styles.notice}>
                    {note.content}
                    <span> — {note.author}</span>
                  </p>
                ))}
                {notices.map((note) => (
                  <p key={note.id} className={styles.notice}>
                    <b>{note.title}</b>
                    {note.description ? ` · ${note.description}` : ""}
                  </p>
                ))}
              </section>
            ) : null}

            <section className={styles.card}>
              <h2>Da fare oggi</h2>
              {today.length ? (
                today.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    onDone={() =>
                      withPin(
                        note.title,
                        (pin) => form({ taskId: note.id, pin }),
                        completeTaskOnTerminalAction,
                        props.pinForTasks
                      )
                    }
                  />
                ))
              ) : (
                <p className={styles.empty}>Niente da fare adesso. 👌</p>
              )}
            </section>

            {upcoming.length ? (
              <section className={styles.card}>
                <h2>Prossimi giorni</h2>
                {upcoming.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    onDone={() => withPin(note.title, (pin) => form({ taskId: note.id, pin }), completeTaskOnTerminalAction, props.pinForTasks)}
                  />
                ))}
              </section>
            ) : null}

            {props.done.length ? (
              <section className={styles.card}>
                <h2>Fatte oggi</h2>
                {props.done.map((task) => (
                  <div key={task.id} className={styles.doneRow}>
                    <span className={styles.tick}>✓</span>
                    <span className={styles.grow}>{task.title}</span>
                    <span className={styles.meta}>
                      {task.by ? `${task.by} · ` : ""}
                      {task.at}
                    </span>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : null}

        {tab === "spesa" ? (
          <section className={styles.card}>
            <h2>Lista della spesa</h2>
            <form
              className={styles.addRow}
              onSubmit={(event) => {
                event.preventDefault();
                const target = event.currentTarget;
                const name = String(new FormData(target).get("name") ?? "").trim();
                const quantity = String(new FormData(target).get("quantity") ?? "").trim();
                if (!name) return;
                void withPin(
                  `Aggiungi ${name}`,
                  (pin) => form({ name, quantity, pin }),
                  async (data) => {
                    const result = await addShoppingOnTerminalAction(data);
                    if (!isActionFailure(result)) target.reset();
                    return result;
                  },
                  props.pinForTasks
                );
              }}
            >
              <input name="name" placeholder="Cosa manca?" maxLength={120} autoComplete="off" />
              <input name="quantity" placeholder="Quanto" maxLength={40} autoComplete="off" className={styles.qty} />
              <button className={styles.primary}>Aggiungi</button>
            </form>
            {props.shopping.length ? (
              props.shopping.map((item) => (
                <div key={item.id} className={styles.shopRow}>
                  <span className={styles.grow}>
                    <b>{item.name}</b>
                    {item.quantity ? ` · ${item.quantity}` : ""}
                  </span>
                  <span className={styles.meta}>{item.by ?? "terminale"}</span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>La lista è vuota.</p>
            )}
          </section>
        ) : null}

        {tab === "timbra" ? (
          <section className={`${styles.card} ${styles.clockCard}`}>
            <h2>Timbra entrata o uscita</h2>
            <p className={styles.meta}>Scrivi il tuo PIN: Workbit capisce da solo se entri o esci.</p>
            <PinPad onSubmit={(pin) => report(clockOnTerminalAction(form({ pin })))} />
          </section>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <span>Workbit · terminale</span>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            if (window.confirm("Scollegare questo dispositivo dal locale? Per ricollegarlo servirà un nuovo codice del titolare.")) void unpairTerminalAction();
          }}
        >
          Scollega
        </button>
      </footer>

      {ask ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setAsk(null)}>
          <div className={styles.pinSheet} onClick={(event) => event.stopPropagation()}>
            <p className={styles.pinTitle}>{ask.title}</p>
            <p className={styles.meta}>Scrivi il tuo PIN</p>
            <PinPad
              onSubmit={async (pin) => {
                const ok = await ask.run(pin);
                if (ok) setAsk(null);
                return ok;
              }}
            />
            <button type="button" className={styles.linkButton} onClick={() => setAsk(null)}>
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      {banner ? <div className={banner.tone === "good" ? styles.bannerGood : styles.bannerBad}>{banner.text}</div> : null}
    </main>
  );
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function NoteRow({ note, onDone }: { note: TerminalNote; onDone: () => void }) {
  return (
    <div className={note.urgent || note.late ? `${styles.noteRow} ${styles.urgent}` : styles.noteRow}>
      <span className={styles.grow}>
        <b>{note.title}</b>
        {note.description ? <span className={styles.desc}>{note.description}</span> : null}
        <span className={styles.meta}>
          {note.who}
          {note.upcoming ? ` · ${note.day}` : note.late ? " · in ritardo" : note.urgent ? " · urgente" : ""}
        </span>
      </span>
      <button type="button" className={styles.doneButton} onClick={onDone}>
        Completa
      </button>
    </div>
  );
}

/** Big keys, the digits hidden as dots. */
function PinPad({ onSubmit }: { onSubmit: (pin: string) => Promise<unknown> }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const press = (key: string) => setPin((current) => (current.length >= 6 ? current : current + key));

  return (
    <div className={styles.pad}>
      <div className={styles.dots} aria-label={`${pin.length} cifre`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, index) => (
          <span key={index} className={index < pin.length ? styles.dotOn : styles.dot} />
        ))}
      </div>
      <div className={styles.keys}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
          <button key={key} type="button" onClick={() => press(key)} disabled={busy}>
            {key}
          </button>
        ))}
        <button type="button" onClick={() => setPin((current) => current.slice(0, -1))} disabled={busy} aria-label="Cancella">
          ⌫
        </button>
        <button type="button" onClick={() => press("0")} disabled={busy}>
          0
        </button>
        <button
          type="button"
          className={styles.okKey}
          disabled={busy || pin.length < 4}
          onClick={async () => {
            setBusy(true);
            await onSubmit(pin);
            setPin("");
            setBusy(false);
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
