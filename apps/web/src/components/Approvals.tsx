/**
 * Approvals.tsx — Design system applied (Step 3).
 * All business logic and API calls are unchanged.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { ApprovalAction, ApprovalItem } from "../types";

function statusBadge(status: string) {
  if (status === "approved") return <span className="badge badge-success">{status}</span>;
  if (status === "rejected") return <span className="badge badge-error">{status}</span>;
  if (status === "pushed_back") return <span className="badge badge-warning">pushed back</span>;
  return <span className="badge badge-blue">{status}</span>;
}

export function Approvals() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalAction[]>([]);
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [actionComments, setActionComments] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<{ id: string; action: "reject" | "push-back" } | null>(null);

  useEffect(() => {
    apiFetch("/approvals/pending-timesheets").then(async (r) => {
      if (r.ok) setPendingApprovals(await r.json());
    });
  }, []);

  async function loadHistory(timesheetId: string) {
    const r = await apiFetch(`/approvals/history/${timesheetId}`);
    if (r.ok) {
      setApprovalHistory(await r.json());
      setSelectedTimesheetId(timesheetId);
    }
  }

  async function takeAction(timesheetId: string, action: "approve" | "reject" | "push-back") {
    const needsComment = action !== "approve";
    const comment = needsComment ? (actionComments[`${timesheetId}-${action}`] ?? "") : "";
    if (needsComment && !comment.trim()) {
      alert("Comment is required for this action.");
      return;
    }
    const r = await apiFetch(`/approvals/timesheets/${timesheetId}/${action}`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
    if (r.ok) {
      apiFetch("/approvals/pending-timesheets").then(async (r2) => {
        if (r2.ok) setPendingApprovals(await r2.json());
      });
      if (selectedTimesheetId === timesheetId) await loadHistory(timesheetId);
      setShowCommentFor(null);
    }
  }

  return (
    <section>
      <h1 className="page-title">Timesheet Approvals</h1>

      {/* Pending list */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "var(--space-6)" }}>
        {pendingApprovals.length === 0 ? (
          <p style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}>
            No pending approvals.
          </p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Work Date</th>
                <th>Hours</th>
                <th>Mismatch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovals.map((a) => (
                <>
                  <tr key={a.timesheetId}>
                    <td style={{ fontWeight: "var(--font-semibold)" }}>{a.username}</td>
                    <td>{a.workDate}</td>
                    <td>{Math.floor(a.enteredMinutes / 60)}h {a.enteredMinutes % 60}m</td>
                    <td>
                      {a.mismatchReason
                        ? <span className="badge badge-warning">mismatch</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button className="btn-primary" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }} onClick={() => void takeAction(a.timesheetId, "approve")}>
                          Approve
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }}
                          onClick={() => setShowCommentFor(
                            showCommentFor?.id === a.timesheetId && showCommentFor.action === "reject"
                              ? null : { id: a.timesheetId, action: "reject" }
                          )}
                        >
                          Reject
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: "var(--text-xs)" }}
                          onClick={() => setShowCommentFor(
                            showCommentFor?.id === a.timesheetId && showCommentFor.action === "push-back"
                              ? null : { id: a.timesheetId, action: "push-back" }
                          )}
                        >
                          Push Back
                        </button>
                        <button className="btn-ghost" style={{ fontSize: "var(--text-xs)" }} onClick={() => void loadHistory(a.timesheetId)}>
                          History
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline comment row */}
                  {showCommentFor?.id === a.timesheetId && (
                    <tr key={`${a.timesheetId}-comment`}>
                      <td colSpan={5} style={{ background: "var(--color-surface-raised)", padding: "var(--space-4)" }}>
                        <div className="flex gap-3 items-center">
                          <input
                            className="input-field"
                            style={{ maxWidth: "420px" }}
                            placeholder={`${showCommentFor.action === "reject" ? "Rejection" : "Push-back"} comment (required)`}
                            value={actionComments[`${a.timesheetId}-${showCommentFor.action}`] ?? ""}
                            onChange={(e) => setActionComments((p) => ({ ...p, [`${a.timesheetId}-${showCommentFor.action}`]: e.target.value }))}
                            maxLength={1000}
                          />
                          <button className="btn-primary" style={{ padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-xs)" }} onClick={() => void takeAction(a.timesheetId, showCommentFor.action)}>
                            Confirm
                          </button>
                          <button className="btn-ghost" onClick={() => setShowCommentFor(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* History panel */}
      {selectedTimesheetId && (
        <div className="card">
          <h2 className="section-title">Approval History</h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Manager</th>
                <th>Action</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {approvalHistory.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.actionedAtUtc).toLocaleString()}</td>
                  <td>{h.managerUsername}</td>
                  <td>{statusBadge(h.action)}</td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{h.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
