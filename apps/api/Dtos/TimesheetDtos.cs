namespace TimeSheet.Api.Dtos;

public record SubmitTimesheetRequest(DateOnly WorkDate, string? Notes);

