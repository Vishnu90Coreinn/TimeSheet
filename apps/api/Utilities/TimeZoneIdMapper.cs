namespace TimeSheet.Api.Utilities;

internal static class TimeZoneIdMapper
{
    private static readonly HashSet<string> SystemTimeZoneIds = TimeZoneInfo
        .GetSystemTimeZones()
        .Select(tz => tz.Id)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = "UTC";

        if (string.IsNullOrWhiteSpace(input))
            return false;

        var trimmed = input.Trim();
        if (string.Equals(trimmed, "UTC", StringComparison.OrdinalIgnoreCase))
        {
            normalized = "UTC";
            return true;
        }

        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(trimmed, out var ianaId) &&
            !string.IsNullOrWhiteSpace(ianaId))
        {
            normalized = ianaId;
            return true;
        }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(trimmed, out _) || SystemTimeZoneIds.Contains(trimmed))
        {
            normalized = trimmed;
            return true;
        }

        return false;
    }

    public static string NormalizeForClient(string? input)
    {
        return TryNormalize(input, out var normalized) ? normalized : "UTC";
    }
}
