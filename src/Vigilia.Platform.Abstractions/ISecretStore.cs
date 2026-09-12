namespace Vigilia.Platform.Abstractions;

/// <summary>
/// Stores credentials for custom API sensors and weather providers.
/// </summary>
/// <remarks>
/// <para>
/// §101 and §151: credentials go through the platform secret adapter, are
/// redacted in requests and errors, and are <b>never</b> included in browser
/// responses or exported packages. §143 additionally forbids exporting
/// credentials, weather coordinates or device tokens.
/// </para>
/// <para>
/// Callers hold secret <i>references</i>, not values. A reference is safe to
/// store in configuration and safe to log; only this store resolves it, and only
/// on the PC.
/// </para>
/// </remarks>
public interface ISecretStore
{
    /// <summary>Stores or replaces a secret, returning its reference.</summary>
    ValueTask<string> SetAsync(string name, string secret, CancellationToken cancellationToken);

    /// <summary>
    /// Resolves a secret reference. Never call this on a path whose result can
    /// reach a browser response.
    /// </summary>
    ValueTask<string?> GetAsync(string reference, CancellationToken cancellationToken);

    /// <summary>Deletes a secret. Idempotent.</summary>
    ValueTask DeleteAsync(string reference, CancellationToken cancellationToken);

    /// <summary>
    /// Lists stored secret references and display names — never values. Safe for
    /// the settings UI.
    /// </summary>
    ValueTask<IReadOnlyList<SecretDescriptor>> ListAsync(CancellationToken cancellationToken);
}

/// <summary>Metadata about a stored secret. Deliberately carries no secret value.</summary>
public sealed record SecretDescriptor
{
    /// <summary>Gets the opaque reference used in configuration.</summary>
    public required string Reference { get; init; }

    /// <summary>Gets the display name shown in settings.</summary>
    public required string Name { get; init; }

    /// <summary>Gets when the secret was last written.</summary>
    public DateTimeOffset UpdatedAt { get; init; }
}
