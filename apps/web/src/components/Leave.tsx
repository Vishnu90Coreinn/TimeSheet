/**
 * Leave.tsx — Design system applied (Step 3).
 * All business logic and API calls are unchanged.
 */
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { LeaveRequest, LeaveType } from "../types";

interface LeaveProps {
  isManager: boolean;
  isAdmin: boolean;
}

function statusBadge(status: string) {
  if (status === "approved") return <span className="badge badge-success">{status}</span>;
  if (status === "rejected") return <span className="badge badge-error">{status}</span>;
  if (status === "pending")  return <span className="badge badge-warning">{status}</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

export function Leave({ isManager, isAdmin }: LeaveProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState({ leaveDate: new Date().toISOString().slice(0, 10), leaveTypeId: "", isHalfDay: false, comment: "" });
  const [leaveTypeForm, setLeaveTypeForm] = useState({ name: "", isActive: true });
  const [rejectComments, setRejectComments] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/leave/types").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setLeaveTypes(d);
        if (d.length > 0) setLeaveForm((p) => ({ ...p, leaveTypeId: p.leaveTypeId || d[0].id }));
      }
    });
    apiFetch("/leave/requests/my").then(async (r) => { if (r.ok) setMyLeaves(await r.json()); });
    if (isManager) {
      apiFetch("/leave/requests/pending").then(async (r) => { if (r.ok) setPendingLeaves(await r.json()); });
    }
  }, [isManager]);

  async function applyLeave(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch("/leave/requests", { method: "POST", body: JSON.stringify(leaveForm) });
    if (r.ok) {
      apiFetch("/leave/requests/my").then(async (r2) => { if (r2.ok) setMyLeaves(await r2.json()); });
    }
  }

  async function reviewLeave(id: string, approve: boolean) {
    const comment = approve ? "" : (rejectComments[id] ?? "");
    if (!approve && !comment.trim()) { alert("Rejection comment is required."); return; }
    const r = await apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: JSON.stringify({ approve, comment }) });
    if (r.ok) {
      apiFetch("/leave/requests/pending").then(async (r2) => { if (r2.ok) setPendingLeaves(await r2.json()); });
      setShowRejectForm(null);
    }
  }

  async function createLeaveType(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch("/leave/types", { method: "POST", body: JSON.stringify(leaveTypeForm) });
    if (r.ok) {
      setLeaveTypeForm({ name: "", isActive: true });
      apiFetch("/leave/types").then(async (r2) => { if (r2.ok) setLeaveTypes(await r2.json()); });
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h1 className="page-title">Leave</h1>

      {/* Admin: create leave type */}
      {isAdmin && (
        <div className="card">
          <h2 className="section-title">Create Leave Type</h2>
          <form onSubmit={createLeaveType} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
              <label className="form-label" htmlFor="lt-name">Leave Type Name <span className="required">*</span></label>
              <input
                id="lt-name"
                className="input-field"
                placeholder="e.g. Maternity Leave"
                value={leaveTypeForm.name}
                onChange={(e) => setLeaveTypeForm((p) => ({ ...p, name: e.target.value }))}
                required maxLength={120}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", paddingBottom: "2px" }}>
              <input type="checkbox" checked={leaveTypeForm.isActive} onChange={(e) => setLeaveTypeForm((p) => ({ ...p, isActive: e.target.checked }))} style={{ accentColor: "var(--color-primary)" }} />
              Active
            </label>
            <button type="submit" className="btn-primary">Save Leave Type</button>
          </form>
        </div>
      )}

      {/* Apply leave */}
      <div className="card">
        <h2 className="section-title">Apply for Leave</h2>
        <form onSubmit={applyLeave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="form-field">
              <label className="form-label" htmlFor="l-date">Leave Date <span className="required">*</span></label>
              <input id="l-date" type="date" className="input-field" value={leaveForm.leaveDate} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveDate: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="l-type">Leave Type <span className="required">*</span></label>
              <select id="l-type" className="input-field" value={leaveForm.leaveTypeId} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveTypeId: e.target.value }))}>
                {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="l-comment">Comment</label>
              <input id="l-comment" className="input-field" placeholder="Optional" maxLength={1000} value={leaveForm.comment} onChange={(e) => setLeaveForm((p) => ({ ...p, comment: e.target.value }))} />
            </div>
            <div className="form-field" style={{ justifyContent: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginTop: "auto", paddingBottom: "10px" }}>
                <input type="checkbox" checked={leaveForm.isHalfDay} onChange={(e) => setLeaveForm((p) => ({ ...p, isHalfDay: e.target.checked }))} style={{ accentColor: "var(--color-primary)" }} />
                Half day
              </label>
            </div>
          </div>
          <button type="submit" className="btn-primary">Apply Leave</button>
        </form>
      </div>

      {/* My leave history */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "var(--space-6) var(--space-6) 0" }}>
          <h2 className="section-title">My Leave History</h2>
        </div>
        <table className="table-base">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Duration</th><th>Status</th></tr>
          </thead>
          <tbody>
            {myLeaves.map((l) => (
              <tr key={l.id}>
                <td>{l.leaveDate}</td>
                <td>{l.leaveTypeName}</td>
                <td>{l.isHalfDay ? "Half Day" : "Full Day"}</td>
                <td>{statusBadge(l.status)}</td>
              </tr>
            ))}
            {myLeaves.length === 0 && <tr className="empty-row"><td colSpan={4}>No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Manager: pending approvals */}
      {isManager && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "var(--space-6) var(--space-6) 0" }}>
            <h2 className="section-title">Pending Leave Approvals</h2>
          </div>
          <table className="table-base">
            <thead>
              <tr><th>Employee</th><th>Date</th><th>Type</th><th>Duration</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pendingLeaves.map((l) => (
                <>
                  <tr key={l.id}>
                    <td style={{ fontWeight: "var(--font-semibold)" }}>{l.username}</td>
                    <td>{l.leaveDate}</td>
                    <td>{l.leaveTypeName}</td>
                    <td>{l.isHalfDay ? "Half Day" : "Full Day"}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-primary" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }} onClick={() => void reviewLeave(l.id, true)}>Approve</button>
                        <button className="btn-secondary" style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)" }} onClick={() => setShowRejectForm(showRejectForm === l.id ? null : l.id)}>Reject</button>
                      </div>
                    </td>
                  </tr>
                  {showRejectForm === l.id && (
                    <tr key={`${l.id}-rej`}>
                      <td colSpan={5} style={{ background: "var(--color-surface-raised)", padding: "var(--space-4)" }}>
                        <div className="flex gap-3 items-center">
                          <input
                            className="input-field"
                            style={{ maxWidth: "360px" }}
                            placeholder="Rejection comment (required)"
                            value={rejectComments[l.id] ?? ""}
                            onChange={(e) => setRejectComments((p) => ({ ...p, [l.id]: e.target.value }))}
                            required maxLength={1000}
                          />
                          <button className="btn-danger" onClick={() => void reviewLeave(l.id, false)}>Confirm Reject</button>
                          <button className="btn-ghost" onClick={() => setShowRejectForm(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {pendingLeaves.length === 0 && <tr className="empty-row"><td colSpan={5}>No pending leave requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
