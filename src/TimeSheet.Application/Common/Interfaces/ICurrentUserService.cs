namespace TimeSheet.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid UserId { get; }
    string Username { get; }
    string Role { get; }
    bool IsAdmin { get; }
    bool IsManager { get; }
    /// <summary>Returns true if the current user is the direct manager of the given userId.</summary>
    bool IsManagerOf(Guid userId);
}
