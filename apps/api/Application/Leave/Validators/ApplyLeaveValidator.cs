using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Dtos;

namespace TimeSheet.Api.Application.Leave.Validators;

public interface IApplyLeaveValidator
{
    ServiceError? Validate(ApplyLeaveRequest request);
}

public class ApplyLeaveValidator : IApplyLeaveValidator
{
    public ServiceError? Validate(ApplyLeaveRequest request)
    {
        if (request.ToDate < request.FromDate)
        {
            return new ServiceError(ErrorCodes.InvalidDateRange, ApiMessages.LeaveDateRangeInvalid, StatusCodes.Status400BadRequest);
        }

        return null;
    }
}
