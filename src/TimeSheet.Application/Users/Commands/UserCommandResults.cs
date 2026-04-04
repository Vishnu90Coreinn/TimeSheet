namespace TimeSheet.Application.Users.Commands;

public enum UserUpdateOutcome
{
    Success,
    NotFound,
    InvalidRole,
    Duplicate,
    InvalidManager,
    RoleAlreadyAssigned
}
