using TimeSheet.Api.Models;

namespace TimeSheet.Api.Services;

public interface ITokenService
{
    string CreateToken(User user);
}
