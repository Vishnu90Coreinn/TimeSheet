using TimeSheet.Api.Application.Common.Constants;
using TimeSheet.Api.Application.Leave.Models;

namespace TimeSheet.Api.Application.Leave.Validators;

public interface IMyLeaveListQueryValidator
{
    ServiceError? Validate(MyLeaveListQuery query);
}

public class MyLeaveListQueryValidator : IMyLeaveListQueryValidator
{
    private static readonly HashSet<string> AllowedStatuses = ["pending", "approved", "rejected"];

    public ServiceError? Validate(MyLeaveListQuery query)
    {
        if (query.PageNumber <= 0)
        {
            return new ServiceError("VALIDATION_PAGE_NUMBER", ValidationMessages.PageNumberMustBePositive, StatusCodes.Status400BadRequest);
        }

        if (query.PageSize <= 0)
        {
            return new ServiceError("VALIDATION_PAGE_SIZE", ValidationMessages.PageSizeMustBePositive, StatusCodes.Status400BadRequest);
        }

        if (!string.IsNullOrWhiteSpace(query.SortDirection) &&
            !string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(query.SortDirection, "desc", StringComparison.OrdinalIgnoreCase))
        {
            return new ServiceError("VALIDATION_SORT_DIRECTION", ValidationMessages.InvalidSortDirection, StatusCodes.Status400BadRequest);
        }

        if (!string.IsNullOrWhiteSpace(query.Status) && !AllowedStatuses.Contains(query.Status.Trim().ToLowerInvariant()))
        {
            return new ServiceError("VALIDATION_STATUS", ValidationMessages.InvalidStatusFilter, StatusCodes.Status400BadRequest);
        }

        if (query.FromDate.HasValue && query.ToDate.HasValue && query.FromDate > query.ToDate)
        {
            return new ServiceError("VALIDATION_DATE_RANGE", ValidationMessages.InvalidDateRange, StatusCodes.Status400BadRequest);
        }

        return null;
    }
}
