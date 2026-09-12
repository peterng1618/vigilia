using Vigilia.Contracts;
using Xunit;

namespace Vigilia.Contracts.Tests;

/// <summary>
/// Conformance suite that <b>every</b> <see cref="ISensorProvider"/> implementation
/// must pass.
/// </summary>
/// <remarks>
/// <para>
/// §95 requires a versioned provider interface and a fake provider for contract
/// tests; §160 requires proving provider replacement without theme edits. Both
/// depend on there being one definition of correct provider behaviour — this is
/// it. Derive a subclass per implementation rather than writing bespoke tests,
/// so a new provider cannot quietly implement different semantics.
/// </para>
/// <para>
/// Add a new case here only when it expresses an invariant that holds for all
/// providers. Implementation-specific behaviour belongs in the subclass.
/// </para>
/// </remarks>
public abstract class SensorProviderContractTests
{
    /// <summary>Creates a provider in its default configuration.</summary>
    protected abstract ISensorProvider CreateProvider();

    [Fact]
    public async Task Metadata_declares_an_understood_contract_version()
    {
        await using ISensorProvider provider = CreateProvider();

        // The registry refuses providers whose major version it cannot read, so a
        // mismatch here is a load-time failure rather than a runtime surprise.
        Assert.Equal(
            ProviderMetadata.ContractVersion.Major,
            provider.Metadata.ImplementedContractVersion.Major);
    }

    [Fact]
    public async Task Metadata_identifiers_are_populated()
    {
        await using ISensorProvider provider = CreateProvider();

        Assert.False(provider.Metadata.Id.IsEmpty);
        Assert.False(string.IsNullOrWhiteSpace(provider.Metadata.TypeKey));
        Assert.False(string.IsNullOrWhiteSpace(provider.Metadata.DisplayName));
    }

    [Fact]
    public async Task StartAsync_is_idempotent()
    {
        await using ISensorProvider provider = CreateProvider();

        // The registry may start an already-started provider while enabling or
        // replacing an instance (§95), so a second call must be harmless.
        await provider.StartAsync(TestContext.Current.CancellationToken);
        await provider.StartAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task StopAsync_does_not_throw_when_never_started()
    {
        await using ISensorProvider provider = CreateProvider();

        await provider.StopAsync(TestContext.Current.CancellationToken);
        await provider.StopAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Discovery_returns_stable_ids_across_calls()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> first =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);
        IReadOnlyList<SensorDescriptor> second =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        // §93: theme bindings reference these IDs, so instability breaks saved
        // themes. This is the single most important provider invariant.
        Assert.Equal(
            first.Select(d => d.Id.Value).OrderBy(v => v, StringComparer.Ordinal),
            second.Select(d => d.Id.Value).OrderBy(v => v, StringComparer.Ordinal));
    }

    [Fact]
    public async Task Discovered_sensor_ids_are_unique_and_non_empty()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> catalog =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        Assert.All(catalog, d => Assert.False(d.Id.IsEmpty));
        Assert.All(catalog, d => Assert.False(string.IsNullOrWhiteSpace(d.DisplayName)));

        int distinct = catalog.Select(d => d.Id.Value).Distinct(StringComparer.Ordinal).Count();
        Assert.Equal(catalog.Count, distinct);
    }

    [Fact]
    public async Task Discovered_sensors_belong_to_this_provider_instance()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> catalog =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        Assert.All(catalog, d => Assert.Equal(provider.Metadata.Id, d.Provider));
    }

    [Fact]
    public async Task Unavailable_sensors_explain_why()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> catalog =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        // ADR-0004: the editor warns at authoring time, which needs a reason it
        // can actually show the user.
        Assert.All(
            catalog.Where(d => !d.IsCurrentlyAvailable),
            d => Assert.False(string.IsNullOrWhiteSpace(d.UnavailableReason)));
    }

    [Fact]
    public async Task Sampling_returns_only_subscribed_sensors_or_a_superset_the_host_can_filter()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> catalog =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        SensorDescriptor target = catalog.First(d => d.Tier == SensorTier.Baseline);
        var subscription = new SensorSubscription
        {
            Sensors = new HashSet<SensorId> { target.Id },
        };

        SampleBatch batch =
            await provider.SampleAsync(subscription, TestContext.Current.CancellationToken);

        Assert.Equal(provider.Metadata.Id, batch.Provider);
        Assert.Contains(batch.Samples, s => s.SensorId == target.Id);

        // §120 permits returning a group acquired atomically, but every returned
        // sample must still be a sensor this provider actually declared.
        IReadOnlySet<string> known = catalog.Select(d => d.Id.Value).ToHashSet(StringComparer.Ordinal);
        Assert.All(batch.Samples, s => Assert.Contains(s.SensorId.Value, known));
    }

    [Fact]
    public async Task Samples_never_carry_a_value_when_status_is_not_ok()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        IReadOnlyList<SensorDescriptor> catalog =
            await provider.DiscoverAsync(TestContext.Current.CancellationToken);

        var subscription = new SensorSubscription
        {
            Sensors = catalog.Select(d => d.Id).ToHashSet(),
        };

        SampleBatch batch =
            await provider.SampleAsync(subscription, TestContext.Current.CancellationToken);

        // §83: missing samples create gaps, not zeroes. A non-OK sample carrying a
        // numeric value is exactly how a zero sneaks into a chart.
        Assert.All(
            batch.Samples.Where(s => s.Status != SensorStatus.Ok),
            s => Assert.Null(s.Value));
    }

    [Fact]
    public async Task Sampling_before_start_does_not_throw()
    {
        await using ISensorProvider provider = CreateProvider();

        // The host may race a stop against a scheduled tick; that must degrade to
        // an empty batch rather than an exception the scheduler has to special-case.
        SampleBatch batch = await provider.SampleAsync(
            SensorSubscription.Empty,
            TestContext.Current.CancellationToken);

        Assert.Empty(batch.Samples);
    }

    [Fact]
    public async Task Health_reports_stopped_before_start()
    {
        await using ISensorProvider provider = CreateProvider();

        ProviderHealth health = await provider.CheckHealthAsync(TestContext.Current.CancellationToken);

        Assert.Equal(ProviderHealthState.Stopped, health.State);
    }

    [Fact]
    public async Task Cancelled_operations_observe_the_token()
    {
        await using ISensorProvider provider = CreateProvider();
        await provider.StartAsync(TestContext.Current.CancellationToken);

        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        // §95: the host relies on prompt cancellation for its per-provider timeout,
        // otherwise one stalled provider delays hardware collection.
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            async () => await provider.DiscoverAsync(cts.Token));
    }
}
