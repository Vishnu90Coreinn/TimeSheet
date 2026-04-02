using System.Collections.Concurrent;
using System.Reflection;

namespace TimeSheet.Domain.Common;

public static class SensitiveFieldCache
{
    private static readonly ConcurrentDictionary<(Type EntityType, string PropertyName), bool> Cache = new();

    public static bool IsSensitive(Type entityType, string propertyName)
    {
        return Cache.GetOrAdd((entityType, propertyName), key =>
        {
            var propertyInfo = key.EntityType.GetProperty(
                key.PropertyName,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);

            return propertyInfo?.GetCustomAttribute<SensitiveAttribute>() is not null;
        });
    }
}
