using System.Text.Json;

namespace Vigilia.Contracts;

/// <summary>
/// The versioned provider interface required by §95: configuration validation,
/// sensor discovery, start/stop, health and cancellable asynchronous sampling.
/// </summary>
/// <remarks>
/// <para>
/// <b>Division of responsibility.</b> Providers own <i>acquisition only</i>. The
/// host owns scheduling, normalization, bounded history and publication. A
/// provider must therefore never start its own timer, cache history, or push
/// samples — it responds to <see cref="SampleAsync"/> when the host asks.
/// </para>
/// <para>
/// <b>Failure isolation.</b> The host applies a per-provider timeout and backoff
/// so that one failing provider cannot stall hardware collection (§95).
/// Implementations should still honour the cancellation token promptly, and
/// should report failure as an <see cref="SensorStatus.Error"/> sample or a
/// degraded <see cref="ProviderHealth"/> rather than by throwing where the
/// failure is expected and per-sensor.
/// </para>
/// <para>
/// <b>Platform neutrality.</b> This contract must stay free of Windows types
/// (§97). Providers for other platforms report the capabilities they actually
/// have rather than fabricating unsupported readings.
/// </para>
/// </remarks>
public interface ISensorProvider : IAsyncDisposable
{
    /// <summary>Gets static information about this provider instance.</summary>
    ProviderMetadata Metadata { get; }

    /// <summary>
    /// Validates a candidate configuration without applying it. Called by the
    /// settings UI before a configuration is saved, and by import validation.
    /// </summary>
    /// <param name="configuration">Provider-specific configuration to check.</param>
    /// <param name="cancellationToken">Cancels the validation.</param>
    /// <returns>The outcome, including redacted diagnostics on failure.</returns>
    ValueTask<ConfigurationValidationResult> ValidateConfigurationAsync(
        JsonElement configuration,
        CancellationToken cancellationToken);

    /// <summary>
    /// Acquires whatever resources sampling needs (device handles, HTTP clients).
    /// Must be idempotent — the registry may start an already-started provider
    /// during enable/replace.
    /// </summary>
    ValueTask StartAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Releases sampling resources while leaving the instance reusable. Must be
    /// idempotent and must not throw when already stopped.
    /// </summary>
    ValueTask StopAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Enumerates the sensors this instance can offer.
    /// </summary>
    /// <remarks>
    /// Discovery is expensive; the host caches the result and avoids repeated
    /// discovery (§120). Include sensors that exist but are not currently
    /// readable, flagged with <see cref="SensorDescriptor.IsCurrentlyAvailable"/>
    /// false, so the editor can warn at authoring time.
    /// </remarks>
    ValueTask<IReadOnlyList<SensorDescriptor>> DiscoverAsync(CancellationToken cancellationToken);

    /// <summary>Reports current health so the UI can show provider state (§95).</summary>
    ValueTask<ProviderHealth> CheckHealthAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Acquires one batch of readings for the requested sensors.
    /// </summary>
    /// <remarks>
    /// Called by the host on the host's cadence. Providers that read sensor groups
    /// atomically may return more sensors than requested; the host discards
    /// extras. Do not claim per-sensor savings without measurement (§120).
    /// </remarks>
    /// <param name="subscription">The sensors currently needed by active clients.</param>
    /// <param name="cancellationToken">Cancels acquisition; honour it promptly.</param>
    ValueTask<SampleBatch> SampleAsync(
        SensorSubscription subscription,
        CancellationToken cancellationToken);
}

/// <summary>Static description of a provider instance.</summary>
public sealed record ProviderMetadata
{
    /// <summary>
    /// Gets the contract version this provider implements. The registry refuses
    /// to load a provider whose major version it does not understand.
    /// </summary>
    public static Version ContractVersion { get; } = new(1, 0);

    /// <summary>Gets the instance identifier, unique within the registry.</summary>
    public required ProviderInstanceId Id { get; init; }

    /// <summary>
    /// Gets the stable provider type key (for example <c>"windows.lhm"</c>,
    /// <c>"http.json"</c>, <c>"fake"</c>). Themes never reference this — the
    /// mapping layer does.
    /// </summary>
    public required string TypeKey { get; init; }

    /// <summary>Gets the human-readable name shown in settings.</summary>
    public required string DisplayName { get; init; }

    /// <summary>Gets the contract version implemented by this instance.</summary>
    public Version ImplementedContractVersion { get; init; } = ContractVersion;

    /// <summary>
    /// Gets the highest tier this provider can offer <i>in principle</i>.
    /// What it can offer right now is reported per-sensor by discovery.
    /// </summary>
    public SensorTier MaximumTier { get; init; } = SensorTier.Baseline;
}

/// <summary>Health of a provider instance.</summary>
public sealed record ProviderHealth
{
    /// <summary>Gets the health state.</summary>
    public required ProviderHealthState State { get; init; }

    /// <summary>Gets a redacted, human-readable summary for the settings UI.</summary>
    public string? Message { get; init; }

    /// <summary>Gets when health was last evaluated.</summary>
    public DateTimeOffset CheckedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Gets the count of consecutive acquisition failures, for backoff.</summary>
    public int ConsecutiveFailures { get; init; }

    /// <summary>A healthy result.</summary>
    public static ProviderHealth Healthy(string? message = null) => new()
    {
        State = ProviderHealthState.Healthy,
        Message = message,
    };

    /// <summary>A degraded result — partially working, e.g. Tier 1 sensors only.</summary>
    public static ProviderHealth Degraded(string message) => new()
    {
        State = ProviderHealthState.Degraded,
        Message = message,
    };

    /// <summary>A faulted result. <paramref name="message"/> must be pre-redacted.</summary>
    public static ProviderHealth Faulted(string message, int consecutiveFailures = 1) => new()
    {
        State = ProviderHealthState.Faulted,
        Message = message,
        ConsecutiveFailures = consecutiveFailures,
    };

    /// <summary>A stopped result.</summary>
    public static ProviderHealth Stopped() => new() { State = ProviderHealthState.Stopped };
}

/// <summary>Outcome of validating a provider configuration.</summary>
public sealed record ConfigurationValidationResult
{
    /// <summary>Gets a value indicating whether the configuration is usable.</summary>
    public required bool IsValid { get; init; }

    /// <summary>
    /// Gets the validation errors, keyed by configuration path. Values must be
    /// redacted — §101 forbids leaking secrets into responses.
    /// </summary>
    public IReadOnlyList<string> Errors { get; init; } = [];

    /// <summary>Gets non-blocking warnings.</summary>
    public IReadOnlyList<string> Warnings { get; init; } = [];

    /// <summary>A successful validation.</summary>
    public static ConfigurationValidationResult Valid(params string[] warnings) => new()
    {
        IsValid = true,
        Warnings = warnings,
    };

    /// <summary>A failed validation. Messages must be pre-redacted.</summary>
    public static ConfigurationValidationResult Invalid(params string[] errors) => new()
    {
        IsValid = false,
        Errors = errors,
    };
}

/// <summary>
/// The set of sensors the host currently needs from one provider — the union
/// required by active clients (§120).
/// </summary>
/// <remarks>
/// The host subscribes to the union across clients and polls once at the required
/// cadence, so opening another phone does not multiply upstream polling.
/// </remarks>
public sealed record SensorSubscription
{
    /// <summary>Gets the sensors to acquire.</summary>
    public required IReadOnlySet<SensorId> Sensors { get; init; }

    /// <summary>
    /// Gets the interval the host is polling at, so a provider can align its own
    /// caching. Advisory: the provider must not schedule on it.
    /// </summary>
    public TimeSpan RequestedInterval { get; init; } = TimeSpan.FromSeconds(1);

    /// <summary>An empty subscription — nothing is currently needed.</summary>
    public static SensorSubscription Empty { get; } = new()
    {
        Sensors = new HashSet<SensorId>(),
    };
}
