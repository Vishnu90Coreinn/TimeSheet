import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

interface OnboardingChecklistProps {
  role: string;
  onboardingCompletedAt: string | null;
}

interface OnboardingChecklistResponse {
  hasSubmittedTimesheet: boolean;
  hasAppliedLeave: boolean;
  hasVisitedLeaveWorkflow: boolean;
  hasSetTimezone: boolean;
  hasSetNotificationPrefs: boolean;
  adminHasProject: boolean;
  adminHasLeavePolicy: boolean;
  adminHasHoliday: boolean;
  adminHasUser: boolean;
}

const LEAVE_WORKFLOW_VISITED_KEY = "leaveWorkflowVisited";

interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  path: string;
  actionLabel: string;
}

function buildChecklist(role: string, state: OnboardingChecklistResponse): ChecklistItem[] {
  const common: ChecklistItem[] = [
    {
      id: "timezone",
      label: "Confirm your timezone",
      detail: "Keep attendance, dashboards, and reminders aligned to your local day.",
      done: state.hasSetTimezone,
      path: "/profile",
      actionLabel: "Open profile",
    },
    {
      id: "notifications",
      label: "Choose notification defaults",
      detail: "Stay in sync with approvals, reminders, and leave updates.",
      done: state.hasSetNotificationPrefs,
      path: "/profile",
      actionLabel: "Edit notifications",
    },
  ];

  if (role === "admin") {
    return [
      ...common,
      {
        id: "project",
        label: "Create your first project",
        detail: "Give the workspace a live project so teams can start logging time.",
        done: state.adminHasProject,
        path: "/projects",
        actionLabel: "Open projects",
      },
      {
        id: "leave-policy",
        label: "Set up leave policies",
        detail: "Define balances and accrual rules before employees start applying.",
        done: state.adminHasLeavePolicy,
        path: "/leave-policies",
        actionLabel: "Open leave policies",
      },
      {
        id: "holiday",
        label: "Add company holidays",
        detail: "Keep schedules and expected hours accurate across the org.",
        done: state.adminHasHoliday,
        path: "/holidays",
        actionLabel: "Open holidays",
      },
      {
        id: "users",
        label: "Invite your team",
        detail: "Add at least one more user so approvals and reporting become meaningful.",
        done: state.adminHasUser,
        path: "/users",
        actionLabel: "Open users",
      },
    ];
  }

  return [
    ...common,
    {
      id: "timesheet",
      label: "Submit your first timesheet",
      detail: "Log work once so your dashboard and approvals start reflecting real activity.",
      done: state.hasSubmittedTimesheet,
      path: "/timesheets",
      actionLabel: "Open timesheets",
    },
    {
      id: "leave",
      label: "Explore the leave workflow",
      detail: "Open leave once to review balances and request options. Submitting a request is optional for onboarding.",
      done: state.hasAppliedLeave || state.hasVisitedLeaveWorkflow,
      path: "/leave",
      actionLabel: "Open leave",
    },
  ];
}

function ChecklistIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="var(--success)" strokeWidth="2" />
      <path d="M7 12.5 10.2 15.7 17 8.8" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="var(--border-subtle)" strokeWidth="2" />
    </svg>
  );
}

export function OnboardingChecklist({ role, onboardingCompletedAt }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingChecklistResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasVisitedLeaveWorkflow, setHasVisitedLeaveWorkflow] = useState(() => localStorage.getItem(LEAVE_WORKFLOW_VISITED_KEY) === "true");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const response = await apiFetch("/onboarding/checklist").catch(() => null);
      if (!active) {
        return;
      }

      if (!response?.ok) {
        setState(null);
        setLoading(false);
        return;
      }

      const data = await response.json() as OnboardingChecklistResponse;
      if (!active) {
        return;
      }

      setState(data);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [onboardingCompletedAt]);

  const items = useMemo(() => {
    if (!state) {
      return [];
    }

    return buildChecklist(role, {
      ...state,
      hasVisitedLeaveWorkflow: state.hasVisitedLeaveWorkflow || hasVisitedLeaveWorkflow,
    });
  }, [hasVisitedLeaveWorkflow, role, state]);
  const completedCount = items.filter((item) => item.done).length;
  const totalCount = items.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  useEffect(() => {
    if (loading) {
      return;
    }

    setExpanded((current) => current || !allDone);
  }, [allDone, loading]);

  if (loading || !state || allDone) {
    return null;
  }

  return (
    <section className="mb-4 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />
            <h2 className="text-[0.98rem] font-semibold text-[var(--text-primary)]">Getting started</h2>
            {onboardingCompletedAt && (
              <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--text-secondary)]">
                Wizard completed
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {completedCount}/{totalCount} setup steps complete.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? "Hide checklist" : "Review setup"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-5 py-4">
          <div className="grid gap-2 lg:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 ${
                  item.done
                    ? "border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.04)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <ChecklistIcon done={item.done} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[0.88rem] font-semibold text-[var(--text-primary)]">{item.label}</div>
                    <div className="mt-1 text-[0.76rem] leading-5 text-[var(--text-secondary)]">{item.detail}</div>
                  </div>
                </div>

                {!item.done && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm shrink-0"
                    onClick={() => {
                      if (item.id === "leave") {
                        localStorage.setItem(LEAVE_WORKFLOW_VISITED_KEY, "true");
                        setHasVisitedLeaveWorkflow(true);
                      }
                      navigate(item.path);
                    }}
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
