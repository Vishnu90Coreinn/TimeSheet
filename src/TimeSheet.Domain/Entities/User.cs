namespace TimeSheet.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string EmployeeId { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "employee";
    public bool IsActive { get; set; } = true;
    public string? AvatarDataUrl { get; set; }
    public string TimeZoneId { get; set; } = "UTC";

    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    public Guid? WorkPolicyId { get; set; }
    public WorkPolicy? WorkPolicy { get; set; }

    public Guid? LeavePolicyId { get; set; }
    public LeavePolicy? LeavePolicy { get; set; }

    public Guid? ManagerId { get; set; }
    public User? Manager { get; set; }
    public ICollection<User> DirectReports { get; set; } = new List<User>();

    public ICollection<ProjectMember> ProjectMemberships { get; set; } = new List<ProjectMember>();
    public ICollection<WorkSession> WorkSessions { get; set; } = new List<WorkSession>();
    public ICollection<Timesheet> Timesheets { get; set; } = new List<Timesheet>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
