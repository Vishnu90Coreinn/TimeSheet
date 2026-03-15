namespace TimeSheet.Api.Models;

public class LeavePolicyAllocation
{
    public Guid Id { get; set; }
    public Guid LeavePolicyId { get; set; }
    public LeavePolicy LeavePolicy { get; set; } = null!;
    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
    public int DaysPerYear { get; set; }
}
