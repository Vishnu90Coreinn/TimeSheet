namespace TimeSheet.Application.Common.Exceptions;

public class ValidationException : Exception
{
    public ValidationException(IEnumerable<string> errors)
        : base("One or more validation failures occurred.")
    {
        Errors = errors.ToList();
    }

    public IReadOnlyList<string> Errors { get; }
}
