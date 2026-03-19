namespace TimeSheet.Api.Application.Common.Models;

public record OperationError(string Code, string Message, int StatusCode);
