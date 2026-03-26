using MediatR;
using TimeSheet.Application.Common.Models;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.ReferenceData.Commands;

public class CreateHolidayCommandHandler(
    IHolidayRepository holidayRepository,
    IUnitOfWork unitOfWork,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<CreateHolidayCommand, Result<HolidayMutationResult>>
{
    public async Task<Result<HolidayMutationResult>> Handle(CreateHolidayCommand request, CancellationToken cancellationToken)
    {
        var holiday = new Holiday
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Date = request.Date,
            IsRecurring = request.IsRecurring,
            CreatedAtUtc = dateTimeProvider.UtcNow
        };

        holidayRepository.Add(holiday);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<HolidayMutationResult>.Success(
            new HolidayMutationResult(holiday.Id, holiday.Name, holiday.Date, holiday.IsRecurring, holiday.CreatedAtUtc));
    }
}
