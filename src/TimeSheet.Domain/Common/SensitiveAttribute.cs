namespace TimeSheet.Domain.Common;

[AttributeUsage(AttributeTargets.Property)]
public sealed class SensitiveAttribute(SensitiveDataReason reason = SensitiveDataReason.PII) : Attribute
{
    public SensitiveDataReason Reason { get; } = reason;
}

public enum SensitiveDataReason
{
    PII,
    Credential,
    Financial
}
