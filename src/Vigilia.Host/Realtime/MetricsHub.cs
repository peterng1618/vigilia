using Microsoft.AspNetCore.SignalR;

namespace Vigilia.Host.Realtime;

/// <summary>
/// Publishes metric snapshots to display clients.
/// </summary>
/// <remarks>
/// <para>
/// SCAFFOLD STATUS: connection lifecycle and per-client queueing are real;
/// snapshot production is not wired to a provider registry yet (Gate 3).
/// </para>
/// <para>
/// <b>Direction of travel is one-way.</b> Clients receive snapshots; they do not
/// push sensor data. The only thing a client declares is which sensors its
/// assigned dashboard needs, so the host can subscribe to the union across
/// clients and poll once (§120).
/// </para>
/// </remarks>
public sealed class MetricsHub : Hub
{
    private readonly ILogger<MetricsHub> _logger;

    /// <summary>Initializes a new instance.</summary>
    public MetricsHub(ILogger<MetricsHub> logger) => _logger = logger;

    /// <inheritdoc />
    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("Display client {ConnectionId} connected.", Context.ConnectionId);

        // §105: reconnect must fetch a current snapshot and bounded history — not
        // an unlimited backlog. Wired in Gate 3 once the history store exists.
        return base.OnConnectedAsync();
    }

    /// <inheritdoc />
    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // §120: releasing this client's subscription may shrink the polled union,
        // and acquisition suspends after a grace period when nothing needs it.
        _logger.LogInformation(
            "Display client {ConnectionId} disconnected.", Context.ConnectionId);

        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Declares which sensors this client's assigned dashboard renders.
    /// </summary>
    /// <remarks>
    /// The host unions these across clients. Opening another phone must not
    /// multiply upstream polling (§120), which is asserted by
    /// <c>FakeSensorProvider.SampleCallCount</c> in the contract tests.
    /// </remarks>
    /// <param name="sensorIds">Fully-qualified sensor references.</param>
    public Task Subscribe(string[] sensorIds)
    {
        ArgumentNullException.ThrowIfNull(sensorIds);

        _logger.LogDebug(
            "Client {ConnectionId} requested {Count} sensors.",
            Context.ConnectionId,
            sensorIds.Length);

        throw new HubException("Sensor subscription is not implemented yet (Gate 3).");
    }
}
