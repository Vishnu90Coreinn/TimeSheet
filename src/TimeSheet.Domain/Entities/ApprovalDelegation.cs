namespace TimeSheet.Domain.Entities;

public class ApprovalDelegation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FromUserId { get; set; }
    public User FromUser { get; set; } = null!;
    public Guid ToUserId { get; set; }
    public User ToUser { get; set; } = null!;
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}
