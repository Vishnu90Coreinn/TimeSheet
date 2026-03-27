namespace TimeSheet.Domain.Entities;

public class CompOffBalance
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public decimal Credits { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

