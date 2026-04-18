import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { CreditCard, Users, FileText, HardDrive, TrendingUp, Download, AlertTriangle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  tenantId: string;
  plan: "Free" | "Starter" | "Pro" | "Enterprise";
  status: "Active" | "Cancelled" | "PastDue";
  userLimit: number;
  currentUserCount: number;
  billingCycleEnd: string;
}

interface Usage {
  activeUsers: number;
  userLimit: number;
  timesheetCount: number;
  storageUsedMb: number;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: "Paid" | "Pending" | "Failed";
  downloadUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Free:       { bg: "var(--surface-muted, #f3f4f6)",    text: "var(--text-secondary, #6b7280)", border: "var(--border, #e5e7eb)" },
  Starter:    { bg: "rgba(99,102,241,0.08)",             text: "var(--brand-600, #4f46e5)",     border: "rgba(99,102,241,0.25)" },
  Pro:        { bg: "rgba(16,185,129,0.08)",             text: "#059669",                        border: "rgba(16,185,129,0.25)" },
  Enterprise: { bg: "rgba(245,158,11,0.08)",             text: "#d97706",                        border: "rgba(245,158,11,0.25)" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:    { bg: "rgba(16,185,129,0.1)",  text: "#059669" },
  Cancelled: { bg: "rgba(239,68,68,0.1)",   text: "#dc2626" },
  PastDue:   { bg: "rgba(245,158,11,0.1)",  text: "#d97706" },
};

const PLAN_LIMITS: Record<string, number> = { Free: 5, Starter: 20, Pro: 50, Enterprise: 500 };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w?: string; h?: string }) {
  return (
    <div style={{
      width: w ?? "100%", height: h ?? "16px", borderRadius: 6,
      background: "var(--surface-muted, #f0f0f0)",
      animation: "skeleton-pulse 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Usage Meter ───────────────────────────────────────────────────────────────

interface MeterProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  unit: string;
  formatValue?: (v: number) => string;
}

function UsageMeter({ label, icon, value, max, unit, formatValue }: MeterProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const isWarning = pct >= 80;
  const barColor = pct >= 100 ? "#dc2626" : pct >= 80 ? "#d97706" : "var(--brand-500, #6366f1)";
  const display = formatValue ? formatValue(value) : String(Math.round(value));
  const maxDisplay = formatValue ? formatValue(max) : String(Math.round(max));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary, #6b7280)", fontSize: "0.82rem" }}>
          {icon}
          <span>{label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
          {isWarning && <AlertTriangle size={13} color="#d97706" />}
          <span style={{ fontWeight: 600, color: isWarning ? "#d97706" : "var(--text-primary, #111)" }}>
            {display}
          </span>
          <span style={{ color: "var(--text-secondary, #6b7280)" }}>/ {maxDisplay} {unit}</span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--surface-muted, #f0f0f0)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 4, width: `${pct}%`,
          background: barColor,
          transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #6b7280)" }}>
        {pct.toFixed(0)}% used
      </div>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({ sub, loading }: { sub: Subscription | null; loading: boolean }) {
  const planColor = sub ? PLAN_COLORS[sub.plan] : PLAN_COLORS.Free;
  const statusColor = sub ? STATUS_COLORS[sub.status] : STATUS_COLORS.Active;
  const userPct = sub ? Math.round((sub.currentUserCount / sub.userLimit) * 100) : 0;

  return (
    <div style={{
      background: "var(--surface-card, #fff)",
      borderRadius: 12,
      border: "1px solid var(--border, #e5e7eb)",
      padding: "24px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center",
            justifyContent: "center", background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <CreditCard size={20} color="var(--brand-500, #6366f1)" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary, #111)" }}>Current Plan</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
              {loading ? <Skeleton w="120px" h="12px" /> : `Renews ${sub ? fmtDate(sub.billingCycleEnd) : "—"}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {loading ? (
            <Skeleton w="60px" h="24px" />
          ) : (
            <>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                background: planColor.bg, color: planColor.text, border: `1px solid ${planColor.border}`,
              }}>
                {sub?.plan ?? "Free"}
              </span>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                background: statusColor.bg, color: statusColor.text,
              }}>
                {sub?.status ?? "Active"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* User count progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
          <span style={{ color: "var(--text-secondary, #6b7280)" }}>Seats used</span>
          {loading ? <Skeleton w="80px" h="13px" /> : (
            <span style={{ fontWeight: 600, color: userPct >= 80 ? "#d97706" : "var(--text-primary, #111)" }}>
              {sub?.currentUserCount ?? 0} / {sub?.userLimit ?? 0} users
            </span>
          )}
        </div>
        {loading ? <Skeleton h="8px" /> : (
          <div style={{ height: 8, borderRadius: 4, background: "var(--surface-muted, #f0f0f0)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${userPct}%`,
              background: userPct >= 100 ? "#dc2626" : userPct >= 80 ? "#d97706" : "var(--brand-500, #6366f1)",
              transition: "width 0.6s ease",
            }} />
          </div>
        )}
      </div>

      {/* Plan features */}
      {!loading && sub && (
        <div style={{
          background: "var(--surface-muted, #f9fafb)", borderRadius: 8, padding: "12px 16px",
          marginBottom: 20, fontSize: "0.8rem", color: "var(--text-secondary, #6b7280)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px",
        }}>
          <span>✓ Up to {sub.userLimit} users</span>
          <span>✓ Timesheets & Leave</span>
          <span>✓ Reports & Exports</span>
          {sub.plan !== "Free" && <span>✓ API Access</span>}
          {(sub.plan === "Pro" || sub.plan === "Enterprise") && <span>✓ Capacity Planning</span>}
          {sub.plan === "Enterprise" && <span>✓ SSO / SAML</span>}
        </div>
      )}

      <button
        type="button"
        style={{
          width: "100%", padding: "10px 0", borderRadius: 8, cursor: "pointer",
          background: "var(--brand-500, #6366f1)", color: "#fff",
          border: "none", fontWeight: 600, fontSize: "0.875rem",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
        onClick={() => alert("Upgrade flow coming soon — contact sales@timesheetapp.com")}
      >
        <TrendingUp size={15} strokeWidth={2} />
        Upgrade Plan
      </button>
    </div>
  );
}

// ── Usage Section ─────────────────────────────────────────────────────────────

function UsageSection({ usage, sub, loading }: { usage: Usage | null; sub: Subscription | null; loading: boolean }) {
  const maxStorage = sub ? PLAN_LIMITS[sub.plan] * 10 : 50;
  const maxTimesheets = sub ? PLAN_LIMITS[sub.plan] * 100 : 500;

  return (
    <div style={{
      background: "var(--surface-card, #fff)",
      borderRadius: 12,
      border: "1px solid var(--border, #e5e7eb)",
      padding: "24px",
    }}>
      <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary, #111)", marginBottom: 20 }}>
        Resource Usage
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} h="48px" />)}
        </div>
      ) : usage ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <UsageMeter
            label="Active Users"
            icon={<Users size={14} />}
            value={usage.activeUsers}
            max={usage.userLimit}
            unit="seats"
          />
          <UsageMeter
            label="Timesheet Records"
            icon={<FileText size={14} />}
            value={usage.timesheetCount}
            max={maxTimesheets}
            unit="records"
          />
          <UsageMeter
            label="Storage"
            icon={<HardDrive size={14} />}
            value={usage.storageUsedMb}
            max={maxStorage}
            unit="MB"
            formatValue={v => `${v.toFixed(1)} MB`}
          />
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary, #6b7280)", fontSize: "0.85rem" }}>Failed to load usage data.</p>
      )}
    </div>
  );
}

// ── Invoice Table ─────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  Paid:    { bg: "rgba(16,185,129,0.1)",  color: "#059669" },
  Pending: { bg: "rgba(245,158,11,0.1)",  color: "#d97706" },
  Failed:  { bg: "rgba(239,68,68,0.1)",   color: "#dc2626" },
};

function InvoiceTable({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  return (
    <div style={{
      background: "var(--surface-card, #fff)",
      borderRadius: 12,
      border: "1px solid var(--border, #e5e7eb)",
      padding: "24px",
    }}>
      <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary, #111)", marginBottom: 20 }}>
        Invoice History
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} h="40px" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary, #6b7280)" }}>
          <FileText size={36} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: "0.9rem" }}>No invoices yet</p>
          <p style={{ fontSize: "0.78rem", marginTop: 4 }}>Invoices will appear here after your first billing cycle.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                {["Invoice", "Date", "Amount", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary, #6b7280)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const pill = STATUS_PILL[inv.status] ?? STATUS_PILL.Pending;
                return (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                    <td style={{ padding: "12px", fontWeight: 500, color: "var(--text-primary, #111)" }}>{inv.id}</td>
                    <td style={{ padding: "12px", color: "var(--text-secondary, #6b7280)" }}>{fmtDate(inv.date)}</td>
                    <td style={{ padding: "12px", fontWeight: 600 }}>{fmtAmount(inv.amount, inv.currency)}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 20, fontSize: "0.73rem", fontWeight: 600,
                        background: pill.bg, color: pill.color,
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <button
                        type="button"
                        disabled={!inv.downloadUrl}
                        title={inv.downloadUrl ? "Download invoice" : "Not available"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 500,
                          border: "1px solid var(--border, #e5e7eb)",
                          background: "transparent", cursor: inv.downloadUrl ? "pointer" : "default",
                          color: inv.downloadUrl ? "var(--text-primary, #111)" : "var(--text-secondary, #6b7280)",
                          opacity: inv.downloadUrl ? 1 : 0.5,
                        }}
                      >
                        <Download size={12} strokeWidth={2} />
                        PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function Billing() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch("/billing/subscription").then(r => r.ok ? r.json() : null),
      apiFetch("/billing/usage").then(r => r.ok ? r.json() : null),
      apiFetch("/billing/invoices").then(r => r.ok ? r.json() : []),
    ]).then(([s, u, inv]) => {
      if (cancelled) return;
      setSub(s);
      setUsage(u);
      setInvoices(inv ?? []);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setError("Failed to load billing data."); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary, #6b7280)" }}>
        <AlertTriangle size={36} strokeWidth={1} style={{ marginBottom: 12, color: "#d97706" }} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #111)", margin: 0 }}>
          Billing & Subscription
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #6b7280)", marginTop: 4 }}>
          Manage your plan, monitor usage, and view invoices.
        </p>
      </div>

      {/* Top row: plan card + usage */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}>
        <PlanCard sub={sub} loading={loading} />
        <UsageSection usage={usage} sub={sub} loading={loading} />
      </div>

      {/* Invoice table */}
      <InvoiceTable invoices={invoices} loading={loading} />
    </div>
  );
}
