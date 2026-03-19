using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Roles.Models;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Roles.Validators;

public interface IRoleListQueryValidator
{
    OperationError? Validate(RoleListQuery query);
}

public class RoleListQueryValidator : IRoleListQueryValidator
{
    public OperationError? Validate(RoleListQuery query)
    {
        if (query.PageNumber <= 0)
        {
            return new OperationError("VALIDATION_PAGE_NUMBER", ValidationMessages.PageNumberMustBePositive, StatusCodes.Status400BadRequest);
        }

        if (query.PageSize <= 0)
        {
            return new OperationError("VALIDATION_PAGE_SIZE", ValidationMessages.PageSizeMustBePositive, StatusCodes.Status400BadRequest);
        }

        return null;
    }
}

public interface IRoleCreateValidator
{
    OperationError? Validate(AssignRoleRequest request);
}

public class RoleCreateValidator : IRoleCreateValidator
{
    public OperationError? Validate(AssignRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoleName))
        {
            return new OperationError("ROLE_NAME_REQUIRED", ApiMessages.RoleNameRequired, StatusCodes.Status400BadRequest);
        }

        return null;
    }
}
