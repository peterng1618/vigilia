using System.Threading.Channels;

namespace Vigilia.Host.Realtime;

/// <summary>
/// A bounded per-client queue that drops obsolete items rather than blocking the
/// producer — the §122 requirement to "bound per-client queues and discard
/// obsolete pending snapshots for slow clients".
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this exists.</b> SignalR does not offer keep-latest semantics. Its
/// buffers apply backpressure: once a slow client's buffer fills, sends to that
/// client stall. For telemetry that is exactly the wrong behaviour — a phone on
/// poor Wi-Fi would either stall the publisher or accumulate a backlog of stale
/// snapshots it then renders in a burst. We want the opposite: always deliver the
/// <i>newest</i> snapshot and throw away anything it superseded.
/// </para>
/// <para>
/// <b>How.</b> A <see cref="Channel{T}"/> with capacity
/// <see cref="Capacity"/> and <see cref="BoundedChannelFullMode.DropOldest"/>.
/// With the default capacity of 1 the queue holds precisely the latest snapshot;
/// publishing never blocks and never fails.
/// </para>
/// <para>
/// <b>Not for history.</b> Reconnect is served a current snapshot plus bounded
/// history from the history store (§105), not from this queue. Do not raise the
/// capacity to emulate a backlog.
/// </para>
/// </remarks>
/// <typeparam name="T">The snapshot type. Treated as wholly superseding its predecessor.</typeparam>
public sealed class LatestSnapshotQueue<T>
{
    private readonly Channel<T> _channel;
    private long _dropped;

    /// <summary>Initializes a new queue.</summary>
    /// <param name="capacity">
    /// How many snapshots may be pending. Defaults to 1 ("latest only"). Raise it
    /// only for a stream whose items are genuinely additive rather than
    /// superseding.
    /// </param>
    public LatestSnapshotQueue(int capacity = 1)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(capacity, 1);

        Capacity = capacity;
        _channel = Channel.CreateBounded<T>(new BoundedChannelOptions(capacity)
        {
            // Discard the superseded snapshot instead of stalling the publisher.
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false,
        });
    }

    /// <summary>Gets the maximum number of pending snapshots.</summary>
    public int Capacity { get; }

    /// <summary>Gets the number of snapshots dropped because a newer one arrived.</summary>
    /// <remarks>
    /// Exposed so the §126 measurements can report per-client drop rates. A high
    /// rate is diagnostic, not an error — it means a client is slower than the
    /// sample cadence, which is precisely the case this design absorbs.
    /// Approximate under concurrent publishers: it is a metric, not a ledger.
    /// </remarks>
    public long DroppedCount => Interlocked.Read(ref _dropped);

    /// <summary>
    /// Publishes a snapshot, superseding any pending one. Never blocks; never
    /// throws for a full queue.
    /// </summary>
    /// <returns>
    /// True if accepted; false only once the queue has been completed.
    /// </returns>
    public bool Publish(T snapshot)
    {
        // DropOldest guarantees TryWrite succeeds while the channel is open, so a
        // false result means completion, not fullness.
        if (_channel.Reader.CanCount && _channel.Reader.Count >= Capacity)
        {
            Interlocked.Increment(ref _dropped);
        }

        return _channel.Writer.TryWrite(snapshot);
    }

    /// <summary>
    /// Reads snapshots until the queue is completed and drained. Intended for a
    /// single per-connection writer loop.
    /// </summary>
    public IAsyncEnumerable<T> ReadAllAsync(CancellationToken cancellationToken)
        => _channel.Reader.ReadAllAsync(cancellationToken);

    /// <summary>Waits for a snapshot to become available.</summary>
    public ValueTask<bool> WaitToReadAsync(CancellationToken cancellationToken)
        => _channel.Reader.WaitToReadAsync(cancellationToken);

    /// <summary>Attempts to take the pending snapshot without waiting.</summary>
    public bool TryRead(out T? snapshot) => _channel.Reader.TryRead(out snapshot);

    /// <summary>Signals that no further snapshots will be published.</summary>
    public void Complete() => _channel.Writer.TryComplete();
}
