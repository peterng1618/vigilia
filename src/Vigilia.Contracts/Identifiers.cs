using System.Text.Json;
using System.Text.Json.Serialization;

namespace Vigilia.Contracts;

/// <summary>
/// Stable identifier for a single sensor, unique within its provider instance.
/// </summary>
/// <remarks>
/// §93 requires stable provider-instance and sensor IDs so that theme bindings
/// survive provider replacement. Treat these as opaque: never parse them, and
/// never derive one from a display name.
/// </remarks>
[JsonConverter(typeof(SensorIdJsonConverter))]
public readonly record struct SensorId(string Value)
{
    /// <summary>Gets a value indicating whether this identifier is unset.</summary>
    public bool IsEmpty => string.IsNullOrEmpty(Value);

    /// <inheritdoc />
    public override string ToString() => Value;
}

/// <summary>
/// Stable identifier for one configured provider instance. The registry supports
/// several instances of the same provider type (§95), so this is what
/// distinguishes them.
/// </summary>
[JsonConverter(typeof(ProviderInstanceIdJsonConverter))]
public readonly record struct ProviderInstanceId(string Value)
{
    /// <summary>Gets a value indicating whether this identifier is unset.</summary>
    public bool IsEmpty => string.IsNullOrEmpty(Value);

    /// <inheritdoc />
    public override string ToString() => Value;
}

/// <summary>
/// Fully-qualified sensor reference: which provider instance, and which sensor
/// within it. This is the key the host schedules and publishes against.
/// </summary>
public readonly record struct SensorRef(ProviderInstanceId Provider, SensorId Sensor)
{
    /// <inheritdoc />
    public override string ToString() => $"{Provider}/{Sensor}";
}

/// <summary>Serializes <see cref="SensorId"/> as a bare JSON string.</summary>
public sealed class SensorIdJsonConverter : JsonConverter<SensorId>
{
    /// <inheritdoc />
    public override SensorId Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString() ?? string.Empty);

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, SensorId value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}

/// <summary>Serializes <see cref="ProviderInstanceId"/> as a bare JSON string.</summary>
public sealed class ProviderInstanceIdJsonConverter : JsonConverter<ProviderInstanceId>
{
    /// <inheritdoc />
    public override ProviderInstanceId Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => new(reader.GetString() ?? string.Empty);

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, ProviderInstanceId value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.Value);
}
