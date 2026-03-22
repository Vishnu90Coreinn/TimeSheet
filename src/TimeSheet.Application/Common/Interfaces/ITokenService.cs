namespace TimeSheet.Application.Common.Interfaces;

public interface ITokenService
{
    string CreateAccessToken(Guid userId, string username, string role);
    string CreateRefreshToken();
}
