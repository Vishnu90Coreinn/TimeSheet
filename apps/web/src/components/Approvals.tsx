import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { ApprovalAction, ApprovalItem } from "../types";

export function Approvals() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalAction[]>([]);
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [actionComments, setActionComments] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<{ id: string; action: "reject" | "push-back" } | null>(null);

  useEffect(() => {
    apiFetch("/approvals/pending-timesheets").then(async (r) => { if (r.ok) setPendingApprovals(await r.json()); });
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
      apiFetch("/approvals/pending-timesheets").then(async (r2) => { if (r2.ok) setPendingApprovals(await r2.json()); });
      if (selectedTimesheetId === timesheetId) await loadHistory(timesheetId);
      setShowCommentFor(null);
    }
  }

  return (
    <section>
      <h2>Timesheet Approvals</h2>
      <ul>
        {pendingApprovals.map((a) => (
          <li key={a.timesheetId} style={{ marginBottom: "12px" }}>
            <strong>{a.username}</strong> \u2014 {a.workDate} ({a.enteredMinutes}m)
            {a.mismatchReason && <span style={{ color: "orange" }}> mismatch: {a.mismatchReason}</span>}
            <div style={{ marginTop: 4 }}>
              <button onClick={() => void takeAction(a.timesheetId, "approve")}>Approve</button>
              <button onClick={() => setShowCommentFor(showCommentFor?.id === a.timesheetId && showCommentFor.action === "reject" ? null : { id: a.timesheetId, action: "reject" })} style={{ marginLeft: 4 }}>Reject</button>
              <button onClick={() => setShowCommentFor(showCommentFor?.id === a.timesheetId && showCommentFor.action === "push-back" ? null : { id: a.timesheetId, action: "push-back" })} style={{ marginLeft: 4 }}>Push Back</button>
              <button onClick={() => void loadHistory(a.timesheetId)} style={{ marginLeft: 4 }}>History</button>
            </div>
            {showCommentFor?.id === a.timesheetId && (
              <div style={{ marginTop: 4 }}>
                <input
                  placeholder={`${showCommentFor.action === "reject" ? "Rejection" : "Push-back"} comment (required)`}
                  value={actionComments[`${a.timesheetId}-${showCommentFor.action}`] ?? ""}
                  onChange={(e) => setActionComments((p) => ({ ...p, [`${a.timesheetId}-${showCommentFor.action}`]: e.target.value }))}
                  maxLength={1000}
                />
                <button onClick={() => void takeAction(a.timesheetId, showCommentFor.action)}>Confirm</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {selectedTimesheetId && (
        <>
          <h3>Approval History</h3>
          <ul>
            {approvalHistory.map((h) => (
              <li key={h.id}>
                {new Date(h.actionedAtUtc).toLocaleString()} \u2014 {h.managerUsername} {h.action}
                {h.comment && <span style={{ color: "#555" }}> ({h.comment})</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
