namespace TimeSheet.Api.Models;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string EmployeeId { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "employee";
    public bool IsActive { get; set; } = true;

    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    public Guid? WorkPolicyId { get; set; }
    public WorkPolicy? WorkPolicy { get; set; }

    public Guid? ManagerId { get; set; }
    public User? Manager { get; set; }
    public ICollection<User> DirectReports { get; set; } = new List<User>();

    public ICollection<ProjectMember> ProjectMemberships { get; set; } = new List<ProjectMember>();
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
