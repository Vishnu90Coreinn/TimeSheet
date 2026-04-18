using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Profile.Commands;

public class SetSecurityQuestionCommandHandler(
    IUserRepository userRepo,
    IPasswordHasher passwordHasher,
    IUnitOfWork unitOfWork)
    : IRequestHandler<SetSecurityQuestionCommand, Result>
{
    public async Task<Result> Handle(SetSecurityQuestionCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
            return Result.ValidationFailure("Security question is required.");

        if (string.IsNullOrWhiteSpace(request.Answer))
            return Result.ValidationFailure("Security answer is required.");

        var user = await userRepo.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null)
            return Result.NotFound("User not found.");

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            return Result.ValidationFailure("Current password is incorrect.");

        user.SecurityQuestion = request.Question.Trim();
        user.SecurityAnswerHash = passwordHasher.Hash(request.Answer.Trim().ToLowerInvariant());

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
