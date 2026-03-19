namespace TimeSheet.Domain.Exceptions;

/// <summary>Thrown when an entity operation is invalid for its current state (e.g., approving a draft timesheet).</summary>
public class InvalidStateTransitionException : DomainException
{
    public InvalidStateTransitionException(string entity, string currentState, string attemptedOperation)
        : base($"Cannot perform '{attemptedOperation}' on {entity} in state '{currentState}'.") { }
}
