namespace Vigilia.Contracts;

/// <summary>
/// Per-sample status. §83/§93 require that missing samples create gaps rather
/// than zeroes, so consumers must branch on this before reading
/// <see cref="Sample.Value"/>.
/// </summary>
public enum SensorStatus
{
    /// <summary>Value is current and trustworthy.</summary>
    Ok = 0,

    /// <summary>No value available — render a gap, never a zero.</summary>
    Missing = 1,

    /// <summary>Last known value, older than its freshness window.</summary>
    Stale = 2,

    /// <summary>Acquisition failed; see <see cref="Sample.Message"/>.</summary>
    Error = 3,

    /// <summary>
    /// The sensor exists but its access tier is unavailable — e.g. a Tier 2
    /// sensor with no kernel driver installed (ADR-0004). Distinct from
    /// <see cref="Missing"/> because the UI can offer a remedy.
    /// </summary>
    Unavailable = 4,
}

/// <summary>
/// Value domain of a sensor. Charts accept numeric sensors only (§99).
/// </summary>
public enum SensorValueType
{
    /// <summary>Floating-point measurement. The only type charts accept.</summary>
    Numeric = 0,

    /// <summary>Text value — usable by typography elements, not charts.</summary>
    Text = 1,

    /// <summary>Boolean value — usable for visibility and thresholds.</summary>
    Boolean = 2,
}

/// <summary>
/// Access tier required to read a sensor (ADR-0004). Reported by providers rather
/// than hardcoded, so the editor can warn at authoring time instead of failing at
/// display time.
/// </summary>
public enum SensorTier
{
    /// <summary>
    /// Always available: no kernel driver, no elevation. Load, memory, disk and
    /// network throughput, GPU utilisation.
    /// </summary>
    Baseline = 0,

    /// <summary>
    /// Needs ring-0 access via the PawnIO driver: temperatures, fan RPM,
    /// voltages, clocks. Opt-in and may legitimately be unavailable.
    /// </summary>
    Extended = 1,
}

/// <summary>Overall health of a provider instance (§95).</summary>
public enum ProviderHealthState
{
    /// <summary>Operating normally.</summary>
    Healthy = 0,

    /// <summary>Partially working — e.g. Tier 1 sensors only.</summary>
    Degraded = 1,

    /// <summary>Not producing samples.</summary>
    Faulted = 2,

    /// <summary>Deliberately stopped or disabled.</summary>
    Stopped = 3,
}
