using Vigilia.Contracts;
using Vigilia.Providers.Fake;
using Xunit;

namespace Vigilia.Contracts.Tests;

/// <summary>
/// Runs the shared conformance suite against <see cref="FakeSensorProvider"/>.
/// </summary>
/// <remarks>
/// When the Windows and HTTP providers land, add sibling subclasses rather than
/// new bespoke test files — that is what keeps §160's "replacement without theme
/// edits" honest.
/// </remarks>
public sealed class FakeProviderContractTests : SensorProviderContractTests
{
    /// <inheritdoc />
    protected override ISensorProvider CreateProvider() => new FakeSensorProvider();
}

/// <summary>
/// Behaviour specific to the fake provider: determinism, the ADR-0004 tier states
/// and the §120 subscription-sharing assertions.
/// </summary>
public sealed class FakeProviderBehaviourTests
{
    [Fact]
    public async Task Values_are_deterministic_for_a_given_tick()
    {
        double a = await ReadCpuLoadAtTickAsync(7);
        double b = await ReadCpuLoadAtTickAsync(7);

        // §158 requires deterministic screenshot tests, which is only possible if
        // the data feeding them is a pure function of the tick — no wall clock,
        // no randomness. Two fresh providers at the same tick must agree exactly.
        Assert.Equal(a, b);
    }

    private static async Task<double> ReadCpuLoadAtTickAsync(long tick)
    {
        await using var provider = new FakeSensorProvider();
        provider.Advance(tick);
        await provider.StartAsync(TestContext.Current.CancellationToken);

        SampleBatch batch = await provider.SampleAsync(
            new SensorSubscription { Sensors = new HashSet<SensorId> { new("cpu.load.total") } },
            TestContext.Current.CancellationToken);

        return batch.Samples.Single().Value!.Value;
    }

    [Fact]
    public async Task Values_change_as_the_virtual_clock_advances()
    {
        await using var provider = new FakeSensorProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        var subscription = new SensorSubscription
        {
            Sensors = new HashSet<SensorId> { new("cpu.load.total") },
        };

        SampleBatch first = await provider.SampleAsync(subscription, TestContext.Current.CancellationToken);
        provider.Advance(5);
        SampleBatch later = await provider.SampleAsync(subscription, TestContext.Current.CancellationToken);

        Assert.NotEqual(first.Samples.Single().Value, later.Samples.Single().Value);
    }

    [Theory]
    [InlineData(ExtendedTierState.DriverNotInstalled)]
    [InlineData(ExtendedTierState.InsufficientPrivileges)]
    [InlineData(ExtendedTierState.BlockedByPolicy)]
    public async Task Extended_sensors_report_unavailable_rather_than_a_fabricated_value(
        ExtendedTierState state)
    {
        await using var provider = new FakeSensorProvider(new FakeProviderOptions
        {
            ExtendedTierState = state,
        });

        await provider.StartAsync(TestContext.Current.CancellationToken);

        SampleBatch batch = await provider.SampleAsync(
            new SensorSubscription { Sensors = new HashSet<SensorId> { new("cpu.temp.package") } },
            TestContext.Current.CancellationToken);

        Sample sample = batch.Samples.Single();

        // ADR-0004 and §97: report the capability you have; never invent a reading.
        Assert.Equal(SensorStatus.Unavailable, sample.Status);
        Assert.Null(sample.Value);
        Assert.False(string.IsNullOrWhiteSpace(sample.Message));
    }

    [Fact]
    public async Task Baseline_sensors_keep_working_when_the_driver_is_absent()
    {
        await using var provider = new FakeSensorProvider(FakeProviderOptions.BaselineOnly);
        await provider.StartAsync(TestContext.Current.CancellationToken);

        SampleBatch batch = await provider.SampleAsync(
            new SensorSubscription { Sensors = new HashSet<SensorId> { new("cpu.load.total") } },
            TestContext.Current.CancellationToken);

        // The whole point of the tiered design: no driver must not mean no app.
        Assert.Equal(SensorStatus.Ok, batch.Samples.Single().Status);
        Assert.NotNull(batch.Samples.Single().Value);
    }

    [Fact]
    public async Task Health_is_degraded_not_faulted_when_only_the_extended_tier_is_missing()
    {
        await using var provider = new FakeSensorProvider(FakeProviderOptions.BaselineOnly);
        await provider.StartAsync(TestContext.Current.CancellationToken);

        ProviderHealth health = await provider.CheckHealthAsync(TestContext.Current.CancellationToken);

        // A missing optional driver is a reduced capability, not a failure — the
        // distinction drives whether the UI nags the user.
        Assert.Equal(ProviderHealthState.Degraded, health.State);
    }

    [Fact]
    public async Task Missing_samples_are_gaps_not_zeroes()
    {
        await using var provider = new FakeSensorProvider(new FakeProviderOptions
        {
            MissingSampleEvery = 1,   // every tick
        });

        await provider.StartAsync(TestContext.Current.CancellationToken);

        SampleBatch batch = await provider.SampleAsync(
            new SensorSubscription { Sensors = new HashSet<SensorId> { new("cpu.load.total") } },
            TestContext.Current.CancellationToken);

        Sample sample = batch.Samples.Single();

        Assert.Equal(SensorStatus.Missing, sample.Status);
        Assert.Null(sample.Value);   // §83: never 0
    }

    [Fact]
    public async Task One_poll_serves_repeated_requests_for_the_same_union()
    {
        await using var provider = new FakeSensorProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        var union = new SensorSubscription
        {
            Sensors = new HashSet<SensorId> { new("cpu.load.total"), new("gpu.load.core") },
        };

        await provider.SampleAsync(union, TestContext.Current.CancellationToken);

        // §120: the host polls the union once. This asserts the provider side of
        // that bargain — one call in, one acquisition out. The host-side assertion
        // (a second client not increasing this count) lands with the registry.
        Assert.Equal(1, provider.SampleCallCount);
        Assert.Equal(union.Sensors, provider.LastSubscription!.Sensors);
    }

    [Fact]
    public async Task Acquisition_failure_surfaces_for_host_backoff()
    {
        await using var provider = new FakeSensorProvider(new FakeProviderOptions
        {
            FailEverySample = true,
        });

        await provider.StartAsync(TestContext.Current.CancellationToken);

        await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await provider.SampleAsync(
                SensorSubscription.Empty,
                TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Text_sensors_are_discoverable_and_typed_for_chart_rejection()
    {
        await using var provider = new FakeSensorProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> catalog =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        SensorDescriptor text = catalog.Single(d => d.Id == new SensorId("system.hostname"));

        // §99: charts accept numeric sensors only, so the type must be explicit in
        // the catalog for the editor to enforce it.
        Assert.Equal(SensorValueType.Text, text.ValueType);
    }
}
