using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.ReferenceData.Queries;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class ReferenceDataQueryService(
    ITaskCategoryRepository taskCategoryRepository,
    IHolidayRepository holidayRepository,
    IWorkPolicyRepository workPolicyRepository,
    IOvertimePolicyRepository overtimePolicyRepository) : IReferenceDataQueryService
{
    public async Task<PagedResult<TimeSheet.Application.ReferenceData.Queries.TaskCategoryResult>> GetTaskCategoriesPageAsync(
        string? search,
        bool? isActive,
        bool? isBillable,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (items, totalCount, effectivePage) = await taskCategoryRepository.GetPagedAsync(
            search,
            isActive,
            isBillable,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<TimeSheet.Application.ReferenceData.Queries.TaskCategoryResult>(
            items.Select(c => new TimeSheet.Application.ReferenceData.Queries.TaskCategoryResult(c.Id, c.Name, c.IsActive, c.IsBillable)).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }

    public async Task<PagedResult<TimeSheet.Application.ReferenceData.Queries.HolidayResult>> GetHolidaysPageAsync(
        int year,
        string? search,
        bool? isRecurring,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (items, totalCount, effectivePage) = await holidayRepository.GetPagedByYearAsync(
            year,
            search,
            isRecurring,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<TimeSheet.Application.ReferenceData.Queries.HolidayResult>(
            items.Select(h => new TimeSheet.Application.ReferenceData.Queries.HolidayResult(h.Id, h.Name, h.Date, h.IsRecurring, h.CreatedAtUtc)).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }

    public async Task<PagedResult<TimeSheet.Application.ReferenceData.Queries.WorkPolicyResult>> GetWorkPoliciesPageAsync(
        string? search,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (policies, totalCount, effectivePage) = await workPolicyRepository.GetPagedAsync(
            search,
            isActive,
            sortBy,
            descending,
            page,
            pageSize,
            ct);

        var overtimeByPolicy = await overtimePolicyRepository.GetByWorkPolicyIdsAsync(
            policies.Select(p => p.Id),
            ct);

        var items = policies.Select(w =>
        {
            overtimeByPolicy.TryGetValue(w.Id, out var overtime);
            return new WorkPolicyResult(
                w.Id,
                w.Name,
                w.DailyExpectedMinutes,
                w.WorkDaysPerWeek,
                w.IsActive,
                overtime?.DailyOvertimeAfterHours ?? 8m,
                overtime?.WeeklyOvertimeAfterHours ?? 40m,
                overtime?.OvertimeMultiplier ?? 1.5m,
                overtime?.CompOffEnabled ?? false,
                overtime?.CompOffExpiryDays ?? 90);
        }).ToList();

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<TimeSheet.Application.ReferenceData.Queries.WorkPolicyResult>(
            items,
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }
}
