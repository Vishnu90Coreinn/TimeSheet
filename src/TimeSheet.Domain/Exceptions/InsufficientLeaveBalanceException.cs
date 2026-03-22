namespace TimeSheet.Domain.Exceptions;

public class InsufficientLeaveBalanceException : DomainException
{
    public InsufficientLeaveBalanceException(decimal requested, decimal available)
        : base($"Insufficient leave balance. Requested: {requested} days, Available: {available} days.") { }
}
