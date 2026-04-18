using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Privacy.Queries;

public class RequestDataExportQueryHandler(IPrivacyService service, ICurrentUserService currentUserService)
    : IRequestHandler<RequestDataExportQuery, Result<ExportRequestResult>>
{
    public async Task<Result<ExportRequestResult>> Handle(RequestDataExportQuery request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<ExportRequestResult>.Forbidden("Unauthorized.")
            : Result<ExportRequestResult>.Success(await service.RequestExportAsync(currentUserService.UserId, cancellationToken));
}

public class GetDataExportRequestsQueryHandler(IPrivacyService service, ICurrentUserService currentUserService)
    : IRequestHandler<GetDataExportRequestsQuery, Result<IReadOnlyList<ExportRequestResult>>>
{
    public async Task<Result<IReadOnlyList<ExportRequestResult>>> Handle(GetDataExportRequestsQuery request, CancellationToken cancellationToken)
        => currentUserService.UserId == Guid.Empty
            ? Result<IReadOnlyList<ExportRequestResult>>.Forbidden("Unauthorized.")
            : Result<IReadOnlyList<ExportRequestResult>>.Success(await service.GetExportRequestsAsync(currentUserService.UserId, cancellationToken));
}

public class DeleteMyAccountCommandHandler(IPrivacyService service, ICurrentUserService currentUserService)
    : IRequestHandler<DeleteMyAccountCommand, Result>
{
    public async Task<Result> Handle(DeleteMyAccountCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result.Forbidden("Unauthorized.");

        return await service.DeleteAccountAsync(currentUserService.UserId, cancellationToken)
            ? Result.Success()
            : Result.NotFound("User not found.");
    }
}

public class LogConsentCommandHandler(IPrivacyService service, ICurrentUserService currentUserService)
    : IRequestHandler<LogConsentCommand, Result>
{
    public async Task<Result> Handle(LogConsentCommand request, CancellationToken cancellationToken)
    {
        if (currentUserService.UserId == Guid.Empty)
            return Result.Forbidden("Unauthorized.");

        await service.LogConsentAsync(currentUserService.UserId, request.ConsentType, request.Granted, request.IpAddress, cancellationToken);
        return Result.Success();
    }
}
