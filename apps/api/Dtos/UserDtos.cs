namespace TimeSheet.Api.Dtos;

public record UpsertUserRequest(string Username, string Email, string EmployeeId, string Password, string Role, bool IsActive);

public record UserResponse(Guid Id, string Username, string Email, string EmployeeId, string Role, bool IsActive);
