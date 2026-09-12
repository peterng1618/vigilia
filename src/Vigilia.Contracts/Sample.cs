namespace Vigilia.Contracts;

/// <summary>
/// One reading from one sensor — the §93 sample contract
/// (sensorId, timestamp, value, unit, status).
/// </summary>
/// <remarks>
/// <para>
/// <b>Always branch on <see cref="Status"/> before reading a value.</b> A sample
/// whose status is not <see cref="SensorStatus.Ok"/> carries no trustworthy
/// value, and §83 requires that such samples render as gaps rather than zeroes.
/// </para>
/// <para>
/// Values here are <b>raw</b>. Clamping a value into a gauge's display range is a
/// rendering concern and must not mutate what is stored or published (§83).
/// </para>
/// </remarks>
public sealed record Sample
{
    /// <summary>Gets the sensor this reading came from.</summary>
    public required SensorId SensorId { get; init; }

    /// <summary>Gets when the reading was taken, as reported by the host clock.</summary>
    public required DateTimeOffset Timestamp { get; init; }

    /// <summary>Gets the trustworthiness of this reading. Check this first.</summary>
    public SensorStatus Status { get; init; } = SensorStatus.Ok;

    /// <summary>
    /// Gets the raw numeric value, unclamped and unrounded.
    /// Null unless <see cref="Status"/> is <see cref="SensorStatus.Ok"/> and the
    /// sensor is <see cref="SensorValueType.Numeric"/>.
    /// </summary>
    public double? Value { get; init; }

    /// <summary>Gets the text value, for <see cref="SensorValueType.Text"/> sensors.</summary>
    public string? TextValue { get; init; }

    /// <summary>Gets the boolean value, for <see cref="SensorValueType.Boolean"/> sensors.</summary>
    public bool? BooleanValue { get; init; }

    /// <summary>
    /// Gets the unit as measured (for example <c>"°C"</c>, <c>"%"</c>, <c>"RPM"</c>).
    /// Unit <i>display</i> and locale conversion belong to the client (§115).
    /// </summary>
    public string? Unit { get; init; }

    /// <summary>
    /// Gets a human-readable explanation for a non-OK status.
    /// Must never contain secrets — §101 requires redaction before this is
    /// surfaced to a browser.
    /// </summary>
    public string? Message { get; init; }

    /// <summary>Creates a successful numeric reading.</summary>
    public static Sample Ok(SensorId sensorId, double value, string? unit, DateTimeOffset timestamp) => new()
    {
        SensorId = sensorId,
        Timestamp = timestamp,
        Status = SensorStatus.Ok,
        Value = value,
        Unit = unit,
    };

    /// <summary>Creates a successful text reading.</summary>
    public static Sample OkText(SensorId sensorId, string value, DateTimeOffset timestamp) => new()
    {
        SensorId = sensorId,
        Timestamp = timestamp,
        Status = SensorStatus.Ok,
        TextValue = value,
    };

    /// <summary>Creates a gap. Renders as a break in a series, not a zero.</summary>
    public static Sample Missing(SensorId sensorId, DateTimeOffset timestamp) => new()
    {
        SensorId = sensorId,
        Timestamp = timestamp,
        Status = SensorStatus.Missing,
    };

    /// <summary>
    /// Creates an "access tier unavailable" reading — e.g. a Tier 2 sensor with no
    /// kernel driver installed. Distinct from <see cref="Missing"/> so the UI can
    /// offer a remedy rather than just a gap (ADR-0004).
    /// </summary>
    public static Sample Unavailable(SensorId sensorId, DateTimeOffset timestamp, string reason) => new()
    {
        SensorId = sensorId,
        Timestamp = timestamp,
        Status = SensorStatus.Unavailable,
        Message = reason,
    };

    /// <summary>Creates a failed reading. <paramref name="message"/> must be pre-redacted.</summary>
    public static Sample Error(SensorId sensorId, DateTimeOffset timestamp, string message) => new()
    {
        SensorId = sensorId,
        Timestamp = timestamp,
        Status = SensorStatus.Error,
        Message = message,
    };
}

/// <summary>
/// Samples acquired together in one provider pass.
/// </summary>
/// <remarks>
/// §120 requires respecting providers that acquire sensor groups together — batch
/// acquisition is the normal case, not an optimisation, so the contract returns a
/// batch rather than a single sample.
/// </remarks>
public sealed record SampleBatch
{
    /// <summary>Gets the provider instance that produced this batch.</summary>
    public required ProviderInstanceId Provider { get; init; }

    /// <summary>Gets the samples in this batch.</summary>
    public required IReadOnlyList<Sample> Samples { get; init; }

    /// <summary>Gets how long acquisition took, for the §126 overhead budgets.</summary>
    public TimeSpan AcquisitionDuration { get; init; }

    /// <summary>An empty batch, for a provider that is stopped or has nothing to report.</summary>
    public static SampleBatch Empty(ProviderInstanceId provider) => new()
    {
        Provider = provider,
        Samples = [],
    };
}
