using System.Text.Json;
using Vigilia.Contracts;

namespace Vigilia.Providers.Fake;

/// <summary>
/// Deterministic in-memory sensor provider.
/// </summary>
/// <remarks>
/// <para>
/// Two jobs. First, it is the contract-test double required by §95 — including
/// the failure modes real providers exhibit, which are otherwise hard to
/// reproduce on demand. Second, it makes the §158 screenshot tests deterministic:
/// values are a pure function of a tick counter, never of wall-clock time or
/// randomness, so the same tick always renders the same pixels.
/// </para>
/// <para>
/// Advance time explicitly with <see cref="Advance"/>. Nothing here reads the
/// system clock.
/// </para>
/// </remarks>
public sealed class FakeSensorProvider : ISensorProvider
{
    private static readonly DateTimeOffset Epoch = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private readonly FakeProviderOptions _options;
    private readonly List<SensorDescriptor> _catalog;
    private long _tick;
    private bool _started;
    private int _consecutiveFailures;

    /// <summary>Initializes a new instance with the given options.</summary>
    public FakeSensorProvider(FakeProviderOptions? options = null)
    {
        _options = options ?? new FakeProviderOptions();
        Metadata = new ProviderMetadata
        {
            Id = _options.InstanceId,
            TypeKey = "fake",
            DisplayName = "Fake provider",
            MaximumTier = SensorTier.Extended,
        };
        _catalog = BuildCatalog();
    }

    /// <inheritdoc />
    public ProviderMetadata Metadata { get; }

    /// <summary>Gets the number of times <see cref="SampleAsync"/> has been called.</summary>
    /// <remarks>
    /// Lets tests assert §120's subscription sharing: opening a second client must
    /// not increase this count.
    /// </remarks>
    public int SampleCallCount { get; private set; }

    /// <summary>Gets the most recent subscription passed to <see cref="SampleAsync"/>.</summary>
    public SensorSubscription? LastSubscription { get; private set; }

    /// <summary>Advances the virtual clock by whole ticks.</summary>
    public void Advance(long ticks = 1) => _tick += ticks;

    /// <summary>Gets the current virtual timestamp.</summary>
    public DateTimeOffset Now => Epoch + _options.TickInterval * _tick;

    /// <inheritdoc />
    public ValueTask<ConfigurationValidationResult> ValidateConfigurationAsync(
        JsonElement configuration,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        return ValueTask.FromResult(
            _options.ConfigurationIsValid
                ? ConfigurationValidationResult.Valid()
                : ConfigurationValidationResult.Invalid("Fake provider configured to fail validation."));
    }

    /// <inheritdoc />
    public ValueTask StartAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _started = true;   // idempotent by design (§95)
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc />
    public ValueTask StopAsync(CancellationToken cancellationToken)
    {
        _started = false;  // must not throw when already stopped
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc />
    public ValueTask<IReadOnlyList<SensorDescriptor>> DiscoverAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult<IReadOnlyList<SensorDescriptor>>(_catalog);
    }

    /// <inheritdoc />
    public ValueTask<ProviderHealth> CheckHealthAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!_started)
        {
            return ValueTask.FromResult(ProviderHealth.Stopped());
        }

        return ValueTask.FromResult(_options.ExtendedTierState switch
        {
            ExtendedTierState.Available => ProviderHealth.Healthy(),
            ExtendedTierState.DriverNotInstalled =>
                ProviderHealth.Degraded("Baseline sensors only — kernel driver is not installed."),
            ExtendedTierState.InsufficientPrivileges =>
                ProviderHealth.Degraded("Baseline sensors only — elevation required for extended sensors."),
            ExtendedTierState.BlockedByPolicy =>
                ProviderHealth.Degraded("Baseline sensors only — driver load blocked by system policy."),
            _ => ProviderHealth.Faulted("Unknown tier state.", _consecutiveFailures),
        });
    }

    /// <inheritdoc />
    public ValueTask<SampleBatch> SampleAsync(
        SensorSubscription subscription,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(subscription);
        cancellationToken.ThrowIfCancellationRequested();

        SampleCallCount++;
        LastSubscription = subscription;

        if (!_started)
        {
            return ValueTask.FromResult(SampleBatch.Empty(Metadata.Id));
        }

        if (_options.FailEverySample)
        {
            _consecutiveFailures++;
            throw new InvalidOperationException("Fake provider configured to fail acquisition.");
        }

        _consecutiveFailures = 0;
        DateTimeOffset timestamp = Now;
        var samples = new List<Sample>(subscription.Sensors.Count);

        foreach (SensorDescriptor descriptor in _catalog)
        {
            // §120: a provider may acquire a group atomically. This fake honours the
            // subscription exactly so tests can assert the host's filtering.
            if (!subscription.Sensors.Contains(descriptor.Id))
            {
                continue;
            }

            samples.Add(CreateSample(descriptor, timestamp));
        }

        return ValueTask.FromResult(new SampleBatch
        {
            Provider = Metadata.Id,
            Samples = samples,
            AcquisitionDuration = _options.SimulatedAcquisitionDuration,
        });
    }

    /// <inheritdoc />
    public ValueTask DisposeAsync()
    {
        _started = false;
        return ValueTask.CompletedTask;
    }

    private Sample CreateSample(SensorDescriptor descriptor, DateTimeOffset timestamp)
    {
        // Extended-tier sensors report Unavailable rather than a fabricated value,
        // so ADR-0004's degraded states are exercised end to end.
        if (descriptor.Tier == SensorTier.Extended && _options.ExtendedTierState != ExtendedTierState.Available)
        {
            return Sample.Unavailable(descriptor.Id, timestamp, DescribeTierState(_options.ExtendedTierState));
        }

        // §83: missing samples must create gaps, not zeroes. Inject them on a
        // fixed cadence so the gap-rendering path is always covered.
        if (_options.MissingSampleEvery > 0 && _tick % _options.MissingSampleEvery == 0)
        {
            return Sample.Missing(descriptor.Id, timestamp);
        }

        return Sample.Ok(descriptor.Id, DeterministicValue(descriptor), descriptor.Unit, timestamp);
    }

    /// <summary>
    /// Pure function of sensor and tick — no randomness, no wall clock. A
    /// triangle wave is used rather than a sine so expected values stay exact in
    /// assertions.
    /// </summary>
    private double DeterministicValue(SensorDescriptor descriptor)
    {
        double min = descriptor.NominalMinimum ?? 0d;
        double max = descriptor.NominalMaximum ?? 100d;
        int period = _options.WavePeriodTicks;

        // Distinct phase per sensor so series are visually distinguishable.
        long phase = StableHash(descriptor.Id.Value) % period;
        long position = (_tick + phase) % (period * 2);
        double ramp = position < period
            ? (double)position / period
            : 2d - ((double)position / period);

        return min + ((max - min) * ramp);
    }

    /// <summary>
    /// FNV-1a over the UTF-16 code units.
    /// </summary>
    /// <remarks>
    /// <b>Do not replace this with <see cref="string.GetHashCode()"/>.</b> .NET
    /// randomizes string hashing per process, so using it here would make values
    /// differ between runs and silently break the §158 deterministic screenshot
    /// tests — which is precisely the guarantee this provider exists to give.
    /// </remarks>
    private static long StableHash(string value)
    {
        const uint OffsetBasis = 2166136261;
        const uint Prime = 16777619;

        uint hash = OffsetBasis;

        foreach (char c in value)
        {
            hash = (hash ^ (byte)(c & 0xFF)) * Prime;
            hash = (hash ^ (byte)(c >> 8)) * Prime;
        }

        return hash & 0x7FFF_FFFF;   // keep it non-negative
    }

    private static string DescribeTierState(ExtendedTierState state) => state switch
    {
        ExtendedTierState.DriverNotInstalled => "Kernel driver is not installed.",
        ExtendedTierState.InsufficientPrivileges => "Elevation is required to read this sensor.",
        ExtendedTierState.BlockedByPolicy => "Driver load is blocked by system policy.",
        _ => "Sensor is unavailable.",
    };

    private List<SensorDescriptor> BuildCatalog()
    {
        bool extendedAvailable = _options.ExtendedTierState == ExtendedTierState.Available;
        string? unavailableReason = extendedAvailable ? null : DescribeTierState(_options.ExtendedTierState);

        SensorDescriptor Baseline(string id, string name, string unit, string semantic, double max) => new()
        {
            Id = new SensorId(id),
            Provider = Metadata.Id,
            DisplayName = name,
            Unit = unit,
            SemanticKey = semantic,
            Tier = SensorTier.Baseline,
            NominalMinimum = 0,
            NominalMaximum = max,
        };

        SensorDescriptor Extended(string id, string name, string unit, string semantic, double min, double max) => new()
        {
            Id = new SensorId(id),
            Provider = Metadata.Id,
            DisplayName = name,
            Unit = unit,
            SemanticKey = semantic,
            Tier = SensorTier.Extended,
            NominalMinimum = min,
            NominalMaximum = max,
            IsCurrentlyAvailable = extendedAvailable,
            UnavailableReason = unavailableReason,
        };

        return
        [
            // Tier 1 — always available.
            Baseline("cpu.load.total", "CPU total load", "%", "cpu.load", 100),
            Baseline("gpu.load.core", "GPU core load", "%", "gpu.load", 100),
            Baseline("memory.used.percent", "Memory used", "%", "memory.load", 100),
            Baseline("memory.used.bytes", "Memory used", "GB", "memory.used", 64),
            Baseline("disk.read.rate", "Disk read rate", "MB/s", "disk.read", 2000),
            Baseline("net.down.rate", "Network download", "Mbps", "network.down", 1000),

            // Tier 2 — needs the kernel driver.
            Extended("cpu.temp.package", "CPU package temperature", "°C", "cpu.temperature", 25, 95),
            Extended("gpu.temp.core", "GPU core temperature", "°C", "gpu.temperature", 25, 85),
            Extended("fan.cpu.rpm", "CPU fan speed", "RPM", "fan.speed", 400, 2200),

            // Non-numeric sensors — charts must reject these (§99).
            new SensorDescriptor
            {
                Id = new SensorId("system.hostname"),
                Provider = Metadata.Id,
                DisplayName = "Host name",
                ValueType = SensorValueType.Text,
                SemanticKey = "system.hostname",
            },
        ];
    }
}
