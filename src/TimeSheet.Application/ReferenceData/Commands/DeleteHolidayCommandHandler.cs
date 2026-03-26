using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class DeleteHolidayCommandHandler(IHolidayRepository holidayRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteHolidayCommand, Result>
{
    public async Task<Result> Handle(DeleteHolidayCommand request, CancellationToken cancellationToken)
    {
        var holiday = await holidayRepository.GetByIdAsync(request.Id, cancellationToken);
        if (holiday is null) return Result.NotFound("Holiday not found.");

        holidayRepository.Remove(holiday);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
