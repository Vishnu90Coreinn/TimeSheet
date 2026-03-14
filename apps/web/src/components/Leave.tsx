import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { LeaveRequest, LeaveType } from "../types";

interface LeaveProps {
  isManager: boolean;
  isAdmin: boolean;
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
    if (!approve && !comment.trim()) {
      alert("Rejection comment is required.");
      return;
    }
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
    <section>
      <h2>Leave</h2>

      {isAdmin && (
        <form className="card actions" onSubmit={createLeaveType}>
          <input
            placeholder="Leave type name"
            value={leaveTypeForm.name}
            onChange={(e) => setLeaveTypeForm((p) => ({ ...p, name: e.target.value }))}
            required
            maxLength={120}
          />
          <label>
            <input type="checkbox" checked={leaveTypeForm.isActive} onChange={(e) => setLeaveTypeForm((p) => ({ ...p, isActive: e.target.checked }))} />
            Active
          </label>
          <button type="submit">Save Leave Type</button>
        </form>
      )}

      <form className="card" onSubmit={applyLeave}>
        <div className="actions wrap">
          <input type="date" value={leaveForm.leaveDate} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveDate: e.target.value }))} required />
          <select value={leaveForm.leaveTypeId} onChange={(e) => setLeaveForm((p) => ({ ...p, leaveTypeId: e.target.value }))}>
            {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
          </select>
          <label>
            <input type="checkbox" checked={leaveForm.isHalfDay} onChange={(e) => setLeaveForm((p) => ({ ...p, isHalfDay: e.target.checked }))} />
            Half day
          </label>
          <input placeholder="Comment (optional)" maxLength={1000} value={leaveForm.comment} onChange={(e) => setLeaveForm((p) => ({ ...p, comment: e.target.value }))} />
          <button type="submit">Apply Leave</button>
        </div>
      </form>

      <h3>My Leave History</h3>
      <ul>
        {myLeaves.map((l) => (
          <li key={l.id}>{l.leaveDate} \u2014 {l.leaveTypeName} ({l.isHalfDay ? "Half" : "Full"}) [{l.status}]</li>
        ))}
      </ul>

      {isManager && (
        <>
          <h3>Pending Leave Approvals</h3>
          <ul>
            {pendingLeaves.map((l) => (
              <li key={l.id}>
                <span>{l.username} \u2014 {l.leaveDate} \u2014 {l.leaveTypeName} ({l.isHalfDay ? "Half" : "Full"})</span>
                <button onClick={() => void reviewLeave(l.id, true)} style={{ marginLeft: 8 }}>Approve</button>
                <button onClick={() => setShowRejectForm(showRejectForm === l.id ? null : l.id)} style={{ marginLeft: 4 }}>Reject</button>
                {showRejectForm === l.id && (
                  <div style={{ marginTop: 4 }}>
                    <input
                      placeholder="Rejection comment (required)"
                      value={rejectComments[l.id] ?? ""}
                      onChange={(e) => setRejectComments((p) => ({ ...p, [l.id]: e.target.value }))}
                      required
                      maxLength={1000}
                    />
                    <button onClick={() => void reviewLeave(l.id, false)}>Confirm Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
