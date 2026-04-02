namespace TimeSheet.Application.Common.Interfaces;

public interface ICorrelationIdAccessor
{
    string? Current { get; }
}
