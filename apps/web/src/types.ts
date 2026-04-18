export type Session = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  username: string;
  role: string;
  onboardingCompletedAt?: string | null;
  leaveWorkflowVisitedAt?: string | null;
};
export type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sortBy?: string | null;
  sortDir?: string | null;
};
export type Project = { id: string; name: string; code: string; isActive: boolean; isArchived: boolean; budgetedHours: number };
export type TaskCategory = { id: string; name: string; isActive: boolean; isBillable: boolean };
export type LeaveType = { id: string; name: string; isActive: boolean };
export type LeaveRequest = { id: string; userId: string; username: string; leaveDate: string; leaveTypeName: string; isHalfDay: boolean; status: string; comment: string | null; reviewerComment: string | null };
export type LeaveBalance = { leaveTypeId: string; leaveTypeName: string; totalDays: number; usedDays: number; remainingDays: number };
export type LeavePolicyAlloc = { leaveTypeId: string; leaveTypeName: string; daysPerYear: number };
export type LeavePolicy = { id: string; name: string; isActive: boolean; allocations: LeavePolicyAlloc[] };
export type LeaveRequestGroup = { id: string; fromDate: string; toDate: string; days: number; leaveTypeName: string; appliedOnDate: string; approvedByUsername: string | null; status: string; comment: string | null };
export type TeamLeaveEntry = { userId: string; username: string; fromDate: string; toDate: string; leaveTypeName: string; status: string };
export type ApprovalItem = {
  timesheetId: string;
  userId?: string;
  username: string;
  displayName?: string;
  workDate: string;
  enteredMinutes: number;
  status: string;
  submittedAtUtc?: string | null;
  hasMismatch?: boolean;
  mismatchReason: string | null;
};
export type ApprovalAction = { id: string; managerUsername: string; action: string; comment: string; actionedAtUtc: string };
export type TimesheetDay = { timesheetId: string; workDate: string; status: string; attendanceNetMinutes: number; expectedMinutes: number; enteredMinutes: number; remainingMinutes: number; hasMismatch: boolean; mismatchReason?: string | null; managerComment?: string | null; entries: TimesheetEntry[] };
export type WeekDayMeta = { workDate: string; status: string; enteredMinutes: number; expectedMinutes: number; attendanceNetMinutes: number; hasMismatch: boolean };
export type WeekSummary = { weekStartDate: string; weekEndDate: string; weekEnteredMinutes: number; weekExpectedMinutes: number; weekAttendanceNetMinutes: number; days: WeekDayMeta[] };
export type TimesheetEntry = { id: string; projectId: string; taskCategoryId: string; projectName: string; taskCategoryName: string; minutes: number; notes: string | null };
export type Notification = {
  id: string;
  title: string;
  message: string;
  type: string | number;
  isRead: boolean;
  createdAtUtc: string;
  actionUrl?: string | null;
  groupKey?: string | null;
};
export type NotificationListResponse = { items: Notification[]; totalUnread: number; hasMore: boolean };
export type User = { id: string; username: string; email: string; employeeId: string; role: string; isActive: boolean; departmentId: string | null; departmentName: string | null; workPolicyId: string | null; workPolicyName: string | null; leavePolicyId: string | null; leavePolicyName: string | null; managerId: string | null; managerUsername: string | null };
export type Holiday = { id: string; name: string; date: string; isRecurring: boolean; createdAtUtc: string };
export type Department = { id: string; name: string; isActive: boolean };
export type WorkPolicy = {
  id: string;
  name: string;
  dailyExpectedMinutes: number;
  workDaysPerWeek: number;
  isActive: boolean;
  dailyOvertimeAfterHours?: number | null;
  weeklyOvertimeAfterHours?: number | null;
  overtimeMultiplier?: number | null;
  compOffEnabled?: boolean | null;
  compOffExpiryDays?: number | null;
};
export type WorkPolicyOvertimeRules = {
  dailyOvertimeAfterHours: number;
  weeklyOvertimeAfterHours: number;
  overtimeMultiplier: number;
  compOffEnabled: boolean;
  compOffExpiryDays: number;
};
export type OvertimeSummary = {
  weekStartDate?: string;
  weekEndDate?: string;
  overtimeMinutes?: number;
  overtimeHours?: number;
  teamOvertimeMinutes?: number;
  teamOvertimeHours?: number;
  thresholdMinutes?: number;
  thresholdHours?: number;
  overtimeMultiplier?: number;
  compOffMinutes?: number;
  compOffHours?: number;
  compOffCredits?: number;
};
export type TeamOvertimeSummary = {
  weekStartDate?: string;
  weekEndDate?: string;
  overtimeMinutes?: number;
  overtimeHours?: number;
  teamOvertimeMinutes?: number;
  teamOvertimeHours?: number;
};
export type CompOffBalance = {
  availableCredits?: number;
  availableHours?: number;
  availableMinutes?: number;
  balanceCredits?: number;
  balanceHours?: number;
  balanceMinutes?: number;
  remainingCredits?: number;
  remainingHours?: number;
  remainingMinutes?: number;
  expiresInDays?: number;
  expiryDays?: number;
};
export type View = "dashboard" | "reports" | "timesheets" | "leave" | "approvals" | "team" | "capacity" | "projects" | "categories" | "users" | "holidays" | "leave-policies" | "work-policies" | "profile" | "branding" | "retention-policy" | "audit-logs" | "admin" | "password-policy";

export type TeamMemberStatus = {
  userId: string;
  username: string;
  displayName: string;
  avatarDataUrl: string | null;
  attendance: "checkedIn" | "checkedOut" | "onLeave" | "absent";
  checkInAtUtc: string | null;
  checkOutAtUtc: string | null;
  weekLoggedMinutes: number;
  weekExpectedMinutes: number;
  todayTimesheetStatus: "draft" | "submitted" | "approved" | "rejected" | "missing";
  pendingApprovalCount: number;
};
export type ReportKey = "attendance-summary" | "timesheet-summary" | "project-effort" | "leave-utilization" | "leave-balance" | "timesheet-approval-status" | "overtime-deficit";

export type MyProfile = {
  id: string; username: string; displayName: string; email: string; employeeId: string; role: string;
  departmentName: string | null; workPolicyName: string | null; leavePolicyName: string | null; managerUsername: string | null;
  avatarDataUrl: string | null; timeZoneId: string;
};
export type NotificationPreferences = {
  onApproval: boolean; onRejection: boolean; onLeaveStatus: boolean; onReminder: boolean;
  inAppEnabled: boolean; emailEnabled: boolean;
};

export interface ApprovalDelegation {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  fromDate: string;
  toDate: string;
  isActive: boolean;
  createdAtUtc: string;
}

export interface SavedReport {
  id: string;
  name: string;
  reportKey: string;
  filtersJson: string;
  scheduleType: 'None' | 'Weekly' | 'Monthly';
  scheduleDayOfWeek: number | null;
  scheduleHour: number;
  recipientEmails: string[];
  lastRunAt: string | null;
  createdAt: string;
}

export interface SavedReportPayload {
  name: string;
  reportKey: string;
  filtersJson: string;
  scheduleType: 'None' | 'Weekly' | 'Monthly';
  scheduleDayOfWeek: number | null;
  scheduleHour: number;
  recipientEmails: string[];
}
