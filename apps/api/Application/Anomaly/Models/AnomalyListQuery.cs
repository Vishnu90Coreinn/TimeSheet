using TimeSheet.Api.Application.Common.Models;

namespace TimeSheet.Api.Application.Anomaly.Models;

public class AnomalyListQuery : ListQuery
{
    public string? Severity { get; init; }
}
