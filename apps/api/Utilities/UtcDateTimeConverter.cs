using System.Text.Json;
using System.Text.Json.Serialization;

namespace TimeSheet.Api.Utilities;

/// <summary>
/// Ensures DateTime values returned from EF Core (which are DateTimeKind.Unspecified
/// for datetime2 SQL Server columns) are serialised with a trailing Z so the frontend
/// always receives unambiguous UTC ISO-8601 strings.
/// </summary>
public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetDateTime();
        return value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

        writer.WriteStringValue(utc.ToString("O"));
    }
}
