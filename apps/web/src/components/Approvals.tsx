/**
 * Approvals.tsx — Pulse SaaS design v2.0
 */
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { ApprovalAction, ApprovalItem } from "../types";

function statusBadge(status: string) {
  if (status === "approved")    return <span className="badge badge-success">{status}</span>;
  if (status === "rejected")    return <span className="badge badge-error">{status}</span>;
  if (status === "pushed_back") return <span className="badge badge-warning">pushed back</span>;
  return <span className="badge badge-brand">{status}</span>;
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
    if (needsComment && !comment.trim()) { alert("Comment is required for this action."); return; }
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
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Timesheet Approvals</div>
          <div className="page-subtitle">Review and act on submitted timesheets</div>
        </div>
        <div className="page-actions">
          <span className="badge badge-brand">{pendingApprovals.length} pending</span>
        </div>
      </div>

      {/* Pending list */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-header">
          <div>
            <div className="card-title">Pending Approvals</div>
            <div className="card-subtitle">Timesheets awaiting your decision</div>
          </div>
        </div>
        {pendingApprovals.length === 0 ? (
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state__icon">✓</div>
              <p className="empty-state__title">All clear</p>
              <p className="empty-state__sub">No pending approvals at this time.</p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
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
                      <td><strong>{a.username}</strong></td>
                      <td>{a.workDate}</td>
                      <td>{Math.floor(a.enteredMinutes / 60)}h {a.enteredMinutes % 60}m</td>
                      <td>
                        {a.mismatchReason
                          ? <span className="badge badge-warning">mismatch</span>
                          : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                      </td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button className="btn btn-subtle-success btn-sm" onClick={() => void takeAction(a.timesheetId, "approve")}>
                            Approve
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setShowCommentFor(
                              showCommentFor?.id === a.timesheetId && showCommentFor.action === "reject"
                                ? null : { id: a.timesheetId, action: "reject" }
                            )}
                          >
                            Reject
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowCommentFor(
                              showCommentFor?.id === a.timesheetId && showCommentFor.action === "push-back"
                                ? null : { id: a.timesheetId, action: "push-back" }
                            )}
                          >
                            Push Back
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => void loadHistory(a.timesheetId)}>
                            History
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline comment row */}
                    {showCommentFor?.id === a.timesheetId && (
                      <tr key={`${a.timesheetId}-comment`}>
                        <td colSpan={5} style={{ background: "var(--n-50)", padding: "var(--space-4)" }}>
                          <div className="flex gap-3 items-center flex-wrap">
                            <input
                              className="input-field"
                              style={{ maxWidth: "420px" }}
                              placeholder={`${showCommentFor.action === "reject" ? "Rejection" : "Push-back"} comment (required)`}
                              value={actionComments[`${a.timesheetId}-${showCommentFor.action}`] ?? ""}
                              onChange={(e) => setActionComments((p) => ({ ...p, [`${a.timesheetId}-${showCommentFor.action}`]: e.target.value }))}
                              maxLength={1000}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => void takeAction(a.timesheetId, showCommentFor.action)}>
                              Confirm
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCommentFor(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History panel */}
      {selectedTimesheetId && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header">
            <div>
              <div className="card-title">Approval History</div>
              <div className="card-subtitle">Decision log for selected timesheet</div>
            </div>
          </div>
          <div className="table-wrap">
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
                    <td><strong>{h.managerUsername}</strong></td>
                    <td>{statusBadge(h.action)}</td>
                    <td className="td-muted">{h.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
