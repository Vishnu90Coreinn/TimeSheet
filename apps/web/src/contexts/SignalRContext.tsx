import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as signalR from "@microsoft/signalr";
import { getAccessToken } from "../api/client";

// ── Hub event name constants (must match TimeSheetHub.cs) ─────────────────────
export const HUB_EVENTS = {
  TimesheetStatusChanged: "TimesheetStatusChanged",
  TimesheetSubmitted:     "TimesheetSubmitted",
  LeaveStatusChanged:     "LeaveStatusChanged",
  TeamClockIn:            "TeamClockIn",
  NewNotification:        "NewNotification",
  DashboardUpdated:       "DashboardUpdated",
} as const;

export type HubEventName = (typeof HUB_EVENTS)[keyof typeof HUB_EVENTS];

// ── Context ───────────────────────────────────────────────────────────────────
export type SignalRState = "connected" | "connecting" | "reconnecting" | "disconnected";

export interface SignalRContextValue {
  connection: signalR.HubConnection | null;
  state: SignalRState;
}

export const SignalRContext = createContext<SignalRContextValue>({
  connection: null,
  state: "disconnected",
});

export function useSignalR() {
  return useContext(SignalRContext);
}

// ── Subscription hook ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSignalREvent(event: HubEventName, handler: (...args: any[]) => void) {
  const { connection } = useSignalR();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!connection) return;
    const stable = (...args: unknown[]) => handlerRef.current(...args);
    connection.on(event, stable);
    return () => { connection.off(event, stable); };
  }, [connection, event]);
}

// ── Provider ──────────────────────────────────────────────────────────────────
const HUB_URL = "/hubs/timesheet";

interface SignalRProviderProps {
  userId: string | null;
  managerId?: string | null;
  children: ReactNode;
}

export function SignalRProvider({ userId, managerId, children }: SignalRProviderProps) {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [state, setState] = useState<SignalRState>("disconnected");
  const connRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!userId) {
      setState("disconnected");
      return;
    }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getAccessToken(),
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        skipNegotiation: false,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connRef.current = conn;

    conn.onreconnecting(() => setState("reconnecting"));
    conn.onreconnected(async () => {
      setState("connected");
      if (managerId) {
        try { await conn.invoke("JoinManagerGroup", managerId); } catch { /* ignore */ }
      }
    });
    conn.onclose(() => {
      setState("disconnected");
      setConnection(null);
    });

    setState("connecting");
    conn.start()
      .then(async () => {
        setState("connected");
        setConnection(conn);
        if (managerId) {
          try { await conn.invoke("JoinManagerGroup", managerId); } catch { /* ignore */ }
        }
      })
      .catch(() => {
        setState("disconnected");
        setConnection(null);
      });

    return () => {
      conn.stop().catch(() => {});
      connRef.current = null;
      setConnection(null);
      setState("disconnected");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Rejoin manager group when managerId changes after connection is live
  useEffect(() => {
    if (!connection || state !== "connected" || !managerId) return;
    connection.invoke("JoinManagerGroup", managerId).catch(() => {});
  }, [connection, state, managerId]);

  return (
    <SignalRContext.Provider value={{ connection, state }}>
      {children}
    </SignalRContext.Provider>
  );
}
