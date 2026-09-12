using Vigilia.Contracts;

namespace Vigilia.Providers.Fake;

/// <summary>
/// Availability of the extended (kernel-driver) sensor tier.
/// </summary>
/// <remarks>
/// ADR-0004 requires all four states to be testable. On real hardware these are
/// genuinely distinct and each needs its own UI treatment: "install the driver",
/// "restart elevated", and "your system policy forbids this" are three different
/// messages, and only the last is unfixable by the user.
/// </remarks>
public enum ExtendedTierState
{
    /// <summary>Driver present and readable — temperatures and fans work.</summary>
    Available = 0,

    /// <summary>Driver not installed. Remedy: install it.</summary>
    DriverNotInstalled = 1,

    /// <summary>Driver present but the device could not be opened. Remedy: elevate.</summary>
    InsufficientPrivileges = 2,

    /// <summary>
    /// Driver load prevented by system policy — HVCI, Smart App Control, or an
    /// App Control policy. Not user-fixable; the app must degrade permanently and
    /// say so plainly.
    /// </summary>
    BlockedByPolicy = 3,
}

/// <summary>Configuration for <see cref="FakeSensorProvider"/>.</summary>
public sealed record FakeProviderOptions
{
    /// <summary>Gets the instance ID to report.</summary>
    public ProviderInstanceId InstanceId { get; init; } = new("fake-1");

    /// <summary>Gets the simulated extended-tier availability.</summary>
    public ExtendedTierState ExtendedTierState { get; init; } = ExtendedTierState.Available;

    /// <summary>Gets the virtual time each tick represents.</summary>
    public TimeSpan TickInterval { get; init; } = TimeSpan.FromSeconds(1);

    /// <summary>
    /// Gets the triangle-wave half-period in ticks. Values ramp from nominal
    /// minimum to maximum over this many ticks, then back down.
    /// </summary>
    public int WavePeriodTicks { get; init; } = 30;

    /// <summary>
    /// Gets the cadence of injected missing samples, in ticks; zero disables
    /// them. Non-zero keeps §83's gap-rendering path permanently covered rather
    /// than only in a dedicated test.
    /// </summary>
    public int MissingSampleEvery { get; init; }

    /// <summary>Gets a value indicating whether validation should fail.</summary>
    public bool ConfigurationIsValid { get; init; } = true;

    /// <summary>
    /// Gets a value indicating whether every acquisition should throw, to exercise
    /// the host's per-provider timeout and backoff (§95).
    /// </summary>
    public bool FailEverySample { get; init; }

    /// <summary>Gets the acquisition duration to report, for overhead accounting.</summary>
    public TimeSpan SimulatedAcquisitionDuration { get; init; } = TimeSpan.FromMilliseconds(2);

    /// <summary>Options with the extended tier fully available.</summary>
    public static FakeProviderOptions AllTiersAvailable { get; } = new();

    /// <summary>Options simulating a machine with no kernel driver installed.</summary>
    public static FakeProviderOptions BaselineOnly { get; } = new()
    {
        ExtendedTierState = ExtendedTierState.DriverNotInstalled,
    };
}
