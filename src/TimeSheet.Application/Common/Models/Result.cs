namespace TimeSheet.Application.Common.Models;

public enum ResultStatus
{
    Success,
    NotFound,
    Forbidden,
    Validation,
    Conflict,
    Error
}

public class Result
{
    protected Result(bool isSuccess, ResultStatus status, string? error = null)
    {
        IsSuccess = isSuccess;
        Status = status;
        Error = error;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public ResultStatus Status { get; }
    public string? Error { get; }

    public static Result Success() => new(true, ResultStatus.Success);
    public static Result NotFound(string error) => new(false, ResultStatus.NotFound, error);
    public static Result Forbidden(string error) => new(false, ResultStatus.Forbidden, error);
    public static Result Conflict(string error) => new(false, ResultStatus.Conflict, error);
    public static Result Failure(string error) => new(false, ResultStatus.Error, error);
    public static Result ValidationFailure(string error) => new(false, ResultStatus.Validation, error);
}

public class Result<T> : Result
{
    private Result(bool isSuccess, ResultStatus status, T? value, string? error = null)
        : base(isSuccess, status, error)
    {
        Value = value;
    }

    public T? Value { get; }

    public static Result<T> Success(T value) => new(true, ResultStatus.Success, value);
    public new static Result<T> NotFound(string error) => new(false, ResultStatus.NotFound, default, error);
    public new static Result<T> Forbidden(string error) => new(false, ResultStatus.Forbidden, default, error);
    public new static Result<T> Conflict(string error) => new(false, ResultStatus.Conflict, default, error);
    public new static Result<T> Failure(string error) => new(false, ResultStatus.Error, default, error);
    public new static Result<T> ValidationFailure(string error) => new(false, ResultStatus.Validation, default, error);
}
