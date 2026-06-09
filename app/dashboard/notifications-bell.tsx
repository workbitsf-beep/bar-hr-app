"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ensureWorkbitPushRegistration } from "@/lib/push-client";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
  barId: string | null;
  bar: {
    id: string;
    name: string;
  } | null;
};

type NotificationResponse = {
  ok: boolean;
  unreadCount: number;
  notifications: NotificationItem[];
  message?: string;
};

function formatRelativeDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getNotificationEmoji(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.includes("shift")) return "⏱️";
  if (normalized.includes("task")) return "✅";
  if (normalized.includes("board")) return "📢";
  if (normalized.includes("course")) return "🎓";
  if (normalized.includes("request")) return "📝";
  if (normalized.includes("closure")) return "🚪";
  if (normalized.includes("availability")) return "📍";
  if (normalized.includes("billing")) return "💳";
  if (normalized.includes("reper")) return "📍";
  return "🔔";
}

export function NotificationsBell() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, startMarkingAllRead] = useTransition();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications?limit=25", {
        credentials: "same-origin",
      });
      const payload = (await response.json()) as NotificationResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Impossibile caricare le notifiche.");
      }

      setNotifications(payload.notifications ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossibile caricare le notifiche.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    void loadNotifications();
  }, [mounted, loadNotifications]);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    void loadNotifications();
  }, [mounted, open, loadNotifications]);

  async function markAsRead(notificationId: string) {
    if (!notificationId) {
      return;
    }

    setMarkingId(notificationId);

    try {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error("Impossibile aggiornare la notifica.");
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // Silenzioso: la notifica interna resta visibile anche se l'update fallisce.
    } finally {
      setMarkingId(null);
    }
  }

  function handleNotificationClick(notification: NotificationItem) {
    void markAsRead(notification.id).finally(() => {
      if (notification.actionUrl) {
        setOpen(false);
        router.push(notification.actionUrl);
      }
    });
  }

  function handleMarkAllRead() {
    startMarkingAllRead(async () => {
      try {
        const response = await fetch("/api/notifications/mark-all-read", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Impossibile aggiornare le notifiche.");
        }

        setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
        setUnreadCount(0);
      } catch {
        // Silenzioso per non interrompere l'esperienza.
      }
    });
  }

  async function handleEnablePush() {
    setPushLoading(true);
    setPushMessage(null);

    try {
      const result = await ensureWorkbitPushRegistration({ requestPermission: true });
      setPushMessage(result.message);

      if (result.ok && result.registered) {
        await loadNotifications();
      }
    } finally {
      setPushLoading(false);
    }
  }

  const canEnablePush =
    typeof Notification !== "undefined" && Notification.permission !== "granted";

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <button
          type="button"
          aria-label="Apri notifiche"
          title="Notifiche"
          onClick={() => setOpen((value) => !value)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            color: "#0f172a",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
            touchAction: "manipulation",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 17H9m10-4V11a7 7 0 1 0-14 0v2l-2 3h18l-2-3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 19a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: "#ef4444",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              paddingInline: 4,
              boxShadow: "0 8px 18px rgba(239, 68, 68, 0.28)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </div>

      {mounted && open
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 80,
                display: "grid",
                placeItems: "center",
                padding: 16,
                background: "rgba(15, 23, 42, 0.22)",
                backdropFilter: "blur(10px)",
              }}
              onClick={() => setOpen(false)}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 420,
                  maxHeight: "calc(100dvh - 32px)",
                  overflow: "hidden",
                  borderRadius: 28,
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid rgba(148,163,184,0.24)",
                  boxShadow: "0 28px 80px rgba(15,23,42,0.28)",
                  display: "grid",
                  gridTemplateRows: "auto auto 1fr",
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "18px 18px 12px",
                  }}
                >
                  <div style={{ display: "grid", gap: 3 }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Notifiche</strong>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      {unreadCount > 0 ? `${unreadCount} non lette` : "Tutto sotto controllo"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Chiudi notifiche"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: 22,
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    padding: "0 18px 12px",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead || unreadCount === 0}
                    style={{
                      border: "1px solid #e2e8f0",
                      background: unreadCount === 0 ? "#f8fafc" : "#0f172a",
                      color: unreadCount === 0 ? "#64748b" : "#fff",
                      padding: "10px 14px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: unreadCount === 0 ? "default" : "pointer",
                    }}
                  >
                    Segna tutte come lette
                  </button>

                  {canEnablePush ? (
                    <button
                      type="button"
                      onClick={() => void handleEnablePush()}
                      disabled={pushLoading}
                      style={{
                        border: "1px solid #dbe4ff",
                        background: "#ffffff",
                        color: "#1d4ed8",
                        padding: "10px 14px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: pushLoading ? "default" : "pointer",
                      }}
                    >
                      {pushLoading ? "Attivazione..." : "Attiva notifiche push"}
                    </button>
                  ) : null}

                  {pushMessage ? (
                    <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
                      {pushMessage}
                    </p>
                  ) : null}
                </div>

                <div
                  style={{
                    padding: "0 18px 18px",
                    overflowY: "auto",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        style={{
                          height: 96,
                          borderRadius: 20,
                          background:
                            "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
                          animation: "dashboard-shimmer 1.2s infinite linear",
                          backgroundSize: "200% 100%",
                        }}
                      />
                    ))
                  ) : error ? (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 18,
                        background: "#fef2f2",
                        color: "#991b1b",
                        border: "1px solid #fecaca",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      {error}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div
                      style={{
                        padding: 18,
                        borderRadius: 18,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        color: "#64748b",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      Nessuna notifica al momento.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        disabled={markingId === notification.id}
                        style={{
                          border: "1px solid " + (notification.read ? "#e2e8f0" : "#c4b5fd"),
                          background: notification.read ? "#ffffff" : "#f8f5ff",
                          borderRadius: 20,
                          padding: 16,
                          display: "grid",
                          gap: 10,
                          textAlign: "left",
                          cursor: "pointer",
                          boxShadow: notification.read
                            ? "0 8px 24px rgba(15,23,42,0.04)"
                            : "0 10px 28px rgba(124,58,237,0.08)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <span
                            aria-hidden="true"
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              background: notification.read ? "#eef2ff" : "#ede9fe",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            {getNotificationEmoji(notification.type)}
                          </span>

                          <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <strong
                                style={{
                                  color: "#0f172a",
                                  fontSize: 15,
                                  lineHeight: 1.4,
                                }}
                              >
                                {notification.title}
                              </strong>
                              {!notification.read ? (
                                <span
                                  aria-hidden="true"
                                  style={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: 999,
                                    background: "#7c3aed",
                                    flexShrink: 0,
                                  }}
                                />
                              ) : null}
                            </div>
                            <p
                              style={{
                                margin: 0,
                                color: "#475569",
                                fontSize: 13,
                                lineHeight: 1.5,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {notification.message}
                            </p>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                          <span>{formatRelativeDate(notification.createdAt)}</span>
                          {notification.bar?.name ? (
                            <span
                              style={{
                                padding: "5px 8px",
                                borderRadius: 999,
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                color: "#475569",
                              }}
                            >
                              {notification.bar.name}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <style jsx global>{`
        @keyframes dashboard-shimmer {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </>
  );
}
