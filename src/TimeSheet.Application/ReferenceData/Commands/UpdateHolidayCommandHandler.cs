using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class UpdateHolidayCommandHandler(IHolidayRepository holidayRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateHolidayCommand, Result<HolidayMutationResult>>
{
    public async Task<Result<HolidayMutationResult>> Handle(UpdateHolidayCommand request, CancellationToken cancellationToken)
    {
        var holiday = await holidayRepository.GetByIdAsync(request.Id, cancellationToken);
        if (holiday is null) return Result<HolidayMutationResult>.NotFound("Holiday not found.");

        holiday.Name = request.Name.Trim();
        holiday.Date = request.Date;
        holiday.IsRecurring = request.IsRecurring;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<HolidayMutationResult>.Success(
            new HolidayMutationResult(holiday.Id, holiday.Name, holiday.Date, holiday.IsRecurring, holiday.CreatedAtUtc));
    }
}
