CREATE TABLE Roles (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Departments (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL UNIQUE,
  IsActive BIT NOT NULL
);

CREATE TABLE WorkPolicies (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL UNIQUE,
  DailyExpectedMinutes INT NOT NULL,
  FixedLunchDeductionMinutes INT NOT NULL DEFAULT 45,
  LowGrossThresholdMinutes INT NOT NULL DEFAULT 300,
  SkipLunchDeductionForLowGross BIT NOT NULL DEFAULT 1,
  AllowManualBreakEdits BIT NOT NULL DEFAULT 0,
  TimesheetBackdateWindowDays INT NOT NULL DEFAULT 7,
  RequireMismatchReason BIT NOT NULL DEFAULT 1,
  IsActive BIT NOT NULL
);

CREATE TABLE Users (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Username NVARCHAR(100) NOT NULL UNIQUE,
  Email NVARCHAR(200) NOT NULL UNIQUE,
  EmployeeId NVARCHAR(50) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(500) NOT NULL,
  Role NVARCHAR(30) NOT NULL,
  IsActive BIT NOT NULL,
  DepartmentId UNIQUEIDENTIFIER NULL REFERENCES Departments(Id),
  WorkPolicyId UNIQUEIDENTIFIER NULL REFERENCES WorkPolicies(Id),
  ManagerId UNIQUEIDENTIFIER NULL REFERENCES Users(Id)
);

CREATE TABLE UserRoles (
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
  RoleId UNIQUEIDENTIFIER NOT NULL REFERENCES Roles(Id),
  PRIMARY KEY (UserId, RoleId)
);

CREATE TABLE Projects (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(200) NOT NULL,
  Code NVARCHAR(50) NOT NULL UNIQUE,
  IsActive BIT NOT NULL,
  IsArchived BIT NOT NULL,
  BudgetedHours INT NOT NULL DEFAULT 0
);

CREATE TABLE ProjectMembers (
  ProjectId UNIQUEIDENTIFIER NOT NULL REFERENCES Projects(Id),
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
  PRIMARY KEY (ProjectId, UserId)
);

CREATE TABLE TaskCategories (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL UNIQUE,
  IsActive BIT NOT NULL
);

CREATE TABLE WorkSessions (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
  WorkDate DATE NOT NULL,
  CheckInAtUtc DATETIME2 NOT NULL,
  CheckOutAtUtc DATETIME2 NULL,
  Status INT NOT NULL,
  HasAttendanceException BIT NOT NULL
);
CREATE INDEX IX_WorkSessions_UserDate ON WorkSessions(UserId, WorkDate);

CREATE TABLE BreakEntries (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  WorkSessionId UNIQUEIDENTIFIER NOT NULL REFERENCES WorkSessions(Id),
  StartAtUtc DATETIME2 NOT NULL,
  EndAtUtc DATETIME2 NULL,
  DurationMinutes INT NOT NULL,
  IsManualEdit BIT NOT NULL
);
CREATE INDEX IX_BreakEntries_WorkSessionId ON BreakEntries(WorkSessionId);


CREATE TABLE Timesheets (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
  WorkDate DATE NOT NULL,
  Status INT NOT NULL,
  SubmissionNotes NVARCHAR(2000) NULL,
  MismatchReason NVARCHAR(1000) NULL,
  ApprovedByUserId UNIQUEIDENTIFIER NULL REFERENCES Users(Id),
  SubmittedAtUtc DATETIME2 NULL,
  ApprovedAtUtc DATETIME2 NULL,
  RejectedAtUtc DATETIME2 NULL,
  ManagerComment NVARCHAR(1000) NULL,
  CONSTRAINT UQ_Timesheets_UserDate UNIQUE (UserId, WorkDate)
);

CREATE TABLE TimesheetEntries (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  TimesheetId UNIQUEIDENTIFIER NOT NULL REFERENCES Timesheets(Id),
  ProjectId UNIQUEIDENTIFIER NOT NULL REFERENCES Projects(Id),
  TaskCategoryId UNIQUEIDENTIFIER NOT NULL REFERENCES TaskCategories(Id),
  Minutes INT NOT NULL,
  Notes NVARCHAR(1000) NULL
);
CREATE INDEX IX_TimesheetEntries_TimesheetId ON TimesheetEntries(TimesheetId);

CREATE TABLE LeaveTypes (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL UNIQUE,
  IsActive BIT NOT NULL
);

CREATE TABLE LeaveRequests (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
  LeaveTypeId UNIQUEIDENTIFIER NOT NULL REFERENCES LeaveTypes(Id),
  LeaveDate DATE NOT NULL,
  IsHalfDay BIT NOT NULL,
  Status INT NOT NULL,
  Comment NVARCHAR(1000) NULL,
  ReviewedByUserId UNIQUEIDENTIFIER NULL REFERENCES Users(Id),
  ReviewerComment NVARCHAR(1000) NULL,
  CreatedAtUtc DATETIME2 NOT NULL,
  ReviewedAtUtc DATETIME2 NULL,
  CONSTRAINT UQ_LeaveRequests_UserDate UNIQUE (UserId, LeaveDate)
);
CREATE INDEX IX_LeaveRequests_StatusDate ON LeaveRequests(Status, LeaveDate);

-- LeaveGroupId column on LeaveRequests (if using ALTER)
ALTER TABLE LeaveRequests ADD LeaveGroupId UNIQUEIDENTIFIER NULL;
CREATE INDEX IX_LeaveRequests_LeaveGroupId ON LeaveRequests(LeaveGroupId) WHERE LeaveGroupId IS NOT NULL;

CREATE TABLE LeavePolicies (
    Id              UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    Name            NVARCHAR(120)    NOT NULL,
    IsActive        BIT              NOT NULL DEFAULT 1,
    CreatedAtUtc    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE LeavePolicyAllocations (
    Id              UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    LeavePolicyId   UNIQUEIDENTIFIER NOT NULL REFERENCES LeavePolicies(Id) ON DELETE CASCADE,
    LeaveTypeId     UNIQUEIDENTIFIER NOT NULL REFERENCES LeaveTypes(Id) ON DELETE NO ACTION,
    DaysPerYear     INT              NOT NULL DEFAULT 0,
    CONSTRAINT UQ_LeavePolicyAllocation UNIQUE (LeavePolicyId, LeaveTypeId)
);

CREATE TABLE LeaveBalances (
    Id                    UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    UserId                UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
    LeaveTypeId           UNIQUEIDENTIFIER NOT NULL REFERENCES LeaveTypes(Id) ON DELETE NO ACTION,
    Year                  INT              NOT NULL,
    AllocatedDays         INT              NOT NULL DEFAULT 0,
    ManualAdjustmentDays  INT              NOT NULL DEFAULT 0,
    Note                  NVARCHAR(500)    NULL,
    UpdatedAtUtc          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_LeaveBalance UNIQUE (UserId, LeaveTypeId, Year)
);

-- Add LeavePolicyId to Users
ALTER TABLE Users ADD LeavePolicyId UNIQUEIDENTIFIER NULL REFERENCES LeavePolicies(Id) ON DELETE SET NULL;
CREATE INDEX IX_Users_LeavePolicyId ON Users(LeavePolicyId) WHERE LeavePolicyId IS NOT NULL;

CREATE TABLE RefreshTokens (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
  Token NVARCHAR(500) NOT NULL,
  ExpiresAtUtc DATETIME2 NOT NULL,
  IsRevoked BIT NOT NULL DEFAULT 0,
  CreatedAtUtc DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
CREATE INDEX IX_RefreshTokens_UserId ON RefreshTokens(UserId);
CREATE INDEX IX_RefreshTokens_Token ON RefreshTokens(Token);

CREATE TABLE ApprovalActions (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  TimesheetId UNIQUEIDENTIFIER NOT NULL REFERENCES Timesheets(Id),
  ManagerUserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
  Action INT NOT NULL,
  Comment NVARCHAR(1000) NOT NULL,
  ActionedAtUtc DATETIME2 NOT NULL
);
CREATE INDEX IX_ApprovalActions_Timesheet_ActionedAt ON ApprovalActions(TimesheetId, ActionedAtUtc DESC);

-- New indexes for report-heavy queries
CREATE INDEX IX_Timesheets_UserId ON Timesheets(UserId);
CREATE INDEX IX_Timesheets_WorkDate ON Timesheets(WorkDate);
CREATE INDEX IX_TimesheetEntries_ProjectId ON TimesheetEntries(ProjectId);
CREATE INDEX IX_WorkSessions_UserId ON WorkSessions(UserId);
CREATE INDEX IX_WorkSessions_Status ON WorkSessions(Status);
CREATE INDEX IX_LeaveRequests_UserId ON LeaveRequests(UserId);

-- IsBillable column for TaskCategories
ALTER TABLE TaskCategories ADD IsBillable BIT NOT NULL DEFAULT 0;

-- Notifications table
CREATE TABLE Notifications (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
  Title NVARCHAR(200) NOT NULL,
  Message NVARCHAR(1000) NOT NULL,
  IsRead BIT NOT NULL DEFAULT 0,
  Type INT NOT NULL,
  CreatedAtUtc DATETIME2 NOT NULL
);
CREATE INDEX IX_Notifications_UserId_IsRead ON Notifications(UserId, IsRead);

-- Holidays table
CREATE TABLE Holidays (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  Name NVARCHAR(200) NOT NULL,
  Date DATE NOT NULL,
  IsRecurring BIT NOT NULL DEFAULT 0,
  CreatedAtUtc DATETIME2 NOT NULL
);
CREATE INDEX IX_Holidays_Date ON Holidays(Date);

-- AuditLogs table
CREATE TABLE AuditLogs (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  ActorUserId UNIQUEIDENTIFIER NULL REFERENCES Users(Id) ON DELETE SET NULL,
  Action NVARCHAR(120) NOT NULL,
  EntityType NVARCHAR(120) NOT NULL,
  EntityId NVARCHAR(80) NOT NULL,
  Details NVARCHAR(2000) NULL,
  CreatedAtUtc DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
CREATE INDEX IX_AuditLogs_ActorUserId ON AuditLogs(ActorUserId);
CREATE INDEX IX_AuditLogs_EntityType_EntityId ON AuditLogs(EntityType, EntityId);
CREATE INDEX IX_AuditLogs_CreatedAtUtc ON AuditLogs(CreatedAtUtc DESC);
