using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class UpsertLeaveTypeCommandHandler(
    ILeaveTypeRepository leaveTypeRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser)
    : IRequestHandler<UpsertLeaveTypeCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(UpsertLeaveTypeCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAdmin)
            return Result<Guid>.Forbidden("Admin only.");

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
            return Result<Guid>.ValidationFailure("Name is required.");

        LeaveType entity;

        if (request.Id is null)
        {
            var existing = await leaveTypeRepo.GetByNameAsync(name, ct);
            if (existing is not null)
            {
                existing.IsActive = request.IsActive;
                entity = existing;
            }
            else
            {
                entity = new LeaveType { Id = Guid.NewGuid(), Name = name, IsActive = request.IsActive };
                leaveTypeRepo.Add(entity);
            }
        }
        else
        {
            var found = await leaveTypeRepo.GetByIdAsync(request.Id.Value, ct);
            if (found is null)
                return Result<Guid>.NotFound($"LeaveType '{request.Id}' not found.");

            found.Name = name;
            found.IsActive = request.IsActive;
            entity = found;
        }

        await unitOfWork.SaveChangesAsync(ct);
        return Result<Guid>.Success(entity.Id);
    }
}
