using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class UpdateLeaveBalanceCommandHandler(
    ILeaveRepository leaveRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<UpdateLeaveBalanceCommand, Result>
{
    public async Task<Result> Handle(UpdateLeaveBalanceCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin)
            return Result.Forbidden("Admin only.");

        var year = dateTimeProvider.UtcNow.Year;
        var balance = await leaveRepo.GetBalanceAsync(request.UserId, request.LeaveTypeId, year, ct);

        if (balance is null)
        {
            balance = new LeaveBalance
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                LeaveTypeId = request.LeaveTypeId,
                Year = year
            };
            leaveRepo.AddBalance(balance);
        }

        balance.ManualAdjustmentDays += request.Adjustment;
        balance.Note = request.Note;
        balance.UpdatedAtUtc = dateTimeProvider.UtcNow;

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}
