namespace Vigilia.Contracts;

/// <summary>
/// A catalog entry describing one discoverable sensor — the §93 catalog contract
/// (stable IDs, value type, display name, unit and capabilities).
/// </summary>
/// <remarks>
/// Descriptors are what the editor binds against and what the mapping layer
/// resolves semantic theme bindings to, so <see cref="Id"/> must be stable across
/// restarts and across provider upgrades. Changing a descriptor ID breaks saved
/// themes.
/// </remarks>
public sealed record SensorDescriptor
{
    /// <summary>Gets the stable, opaque sensor identifier.</summary>
    public required SensorId Id { get; init; }

    /// <summary>Gets the provider instance that owns this sensor.</summary>
    public required ProviderInstanceId Provider { get; init; }

    /// <summary>
    /// Gets the human-readable name for editor pickers. Display-only — never
    /// derive an identifier from this, and never bind a theme to it.
    /// </summary>
    public required string DisplayName { get; init; }

    /// <summary>Gets the value domain. Charts accept <see cref="SensorValueType.Numeric"/> only (§99).</summary>
    public SensorValueType ValueType { get; init; } = SensorValueType.Numeric;

    /// <summary>Gets the access tier required to read this sensor (ADR-0004).</summary>
    public SensorTier Tier { get; init; } = SensorTier.Baseline;

    /// <summary>Gets the unit as measured (for example <c>"°C"</c>, <c>"%"</c>, <c>"RPM"</c>).</summary>
    public string? Unit { get; init; }

    /// <summary>
    /// Gets a coarse semantic category (for example <c>"cpu.temperature"</c>,
    /// <c>"gpu.load"</c>) used by the mapping layer so that changing providers
    /// does not require editing the theme (§93).
    /// </summary>
    public string? SemanticKey { get; init; }

    /// <summary>
    /// Gets the expected minimum for display scaling, when the sensor has a
    /// natural floor. Advisory only — raw values are never clamped in transit.
    /// </summary>
    public double? NominalMinimum { get; init; }

    /// <summary>Gets the expected maximum for display scaling, when the sensor has a natural ceiling.</summary>
    public double? NominalMaximum { get; init; }

    /// <summary>
    /// Gets a value indicating whether this sensor is currently readable. A Tier 2
    /// sensor discovered while the driver is absent appears in the catalog with
    /// this false, so the editor can warn at authoring time (ADR-0004).
    /// </summary>
    public bool IsCurrentlyAvailable { get; init; } = true;

    /// <summary>
    /// Gets why the sensor is unavailable, when <see cref="IsCurrentlyAvailable"/>
    /// is false. Must be actionable — the UI shows this to the user.
    /// </summary>
    public string? UnavailableReason { get; init; }

    /// <summary>Gets the fully-qualified reference for this sensor.</summary>
    public SensorRef Ref => new(Provider, Id);
}
