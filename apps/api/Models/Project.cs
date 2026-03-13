namespace TimeSheet.Api.Models;

public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsArchived { get; set; }

    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
}
