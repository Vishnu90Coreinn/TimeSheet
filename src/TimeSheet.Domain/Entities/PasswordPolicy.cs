namespace TimeSheet.Domain.Entities;

public class PasswordPolicy
{
    public Guid Id { get; set; }
    public int MinLength { get; set; } = 8;
    public bool RequireUppercase { get; set; } = true;
    public bool RequireLowercase { get; set; } = true;
    public bool RequireNumber { get; set; } = true;
    public bool RequireSpecialChar { get; set; } = false;
    public int MaxAgeDays { get; set; } = 0; // 0 = never expires
}
