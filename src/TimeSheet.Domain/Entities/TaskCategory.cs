namespace TimeSheet.Domain.Entities;

public class TaskCategory
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsBillable { get; set; }
}
