using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

namespace Vigilia.Providers.Windows;

/// <summary>
/// Which extended-tier (kernel-driver) sensors are reachable on this machine.
/// </summary>
public enum DriverAvailability
{
    /// <summary>Driver installed and the device opened — extended sensors should work.</summary>
    Available = 0,

    /// <summary>No driver installed. Remedy: install it.</summary>
    NotInstalled = 1,

    /// <summary>Installed, but the device could not be opened. Remedy: elevate.</summary>
    AccessDenied = 2,

    /// <summary>
    /// Registered as installed but the device is absent — the service did not
    /// start. The usual cause is a code-integrity policy refusing to load it
    /// (HVCI, Smart App Control, App Control). Not user-fixable.
    /// </summary>
    InstalledButNotLoaded = 3,

    /// <summary>Probe failed for an unexpected reason; see the result message.</summary>
    ProbeFailed = 4,
}

/// <summary>Outcome of a driver probe.</summary>
public sealed record DriverProbeResult
{
    /// <summary>Gets the availability verdict.</summary>
    public required DriverAvailability Availability { get; init; }

    /// <summary>Gets the installed driver version, when the registry reports one.</summary>
    public Version? InstalledVersion { get; init; }

    /// <summary>Gets the Win32 error from the device-open attempt, if any.</summary>
    public int? Win32Error { get; init; }

    /// <summary>Gets a diagnostic message suitable for logs and Gate 0 evidence.</summary>
    public required string Message { get; init; }

    /// <summary>
    /// Gets a value indicating whether the app should offer the user a remedy.
    /// False for <see cref="DriverAvailability.InstalledButNotLoaded"/>, which the
    /// user cannot fix.
    /// </summary>
    public bool IsUserActionable => Availability is DriverAvailability.NotInstalled
                                                 or DriverAvailability.AccessDenied;
}

/// <summary>
/// Read-only probe for the PawnIO kernel driver that LibreHardwareMonitor uses for
/// temperatures, fan speeds and voltages.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why this exists.</b> ADR-0004 makes the kernel driver optional, and Gate 0
/// probe <c>G0-P1</c> has to establish empirically which sensors are reachable
/// without it. The per-sensor elevation breakdown is explicitly
/// <b>unverified</b> — it must be measured on real hardware, not reasoned about.
/// This probe produces that measurement.
/// </para>
/// <para>
/// <b>Detection mirrors LibreHardwareMonitor's own approach</b> (registry
/// <c>Uninstall\PawnIO</c> → <c>DisplayVersion</c>, with a Wow64 fallback), then
/// additionally attempts to open the device, because "installed" and "loadable"
/// are different things on a machine with HVCI enabled.
/// </para>
/// <para>
/// <b>This probe only reads.</b> It opens a handle and closes it; it loads no
/// module and executes no function. Safe to run at startup and from diagnostics.
/// </para>
/// </remarks>
[SupportedOSPlatform("windows")]
public static partial class DriverAvailabilityProbe
{
    private const string DevicePath = @"\\?\GLOBALROOT\Device\PawnIO";
    private const string UninstallSubKey =
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO";

    private const uint GenericRead = 0x8000_0000;
    private const uint GenericWrite = 0x4000_0000;
    private const uint FileShareRead = 0x0000_0001;
    private const uint FileShareWrite = 0x0000_0002;
    private const uint OpenExisting = 3;

    private const int ErrorFileNotFound = 2;
    private const int ErrorPathNotFound = 3;
    private const int ErrorAccessDenied = 5;

    /// <summary>Probes the driver and reports what is reachable.</summary>
    public static DriverProbeResult Probe()
    {
        try
        {
            Version? installed = ReadInstalledVersion();

            if (installed is null)
            {
                return new DriverProbeResult
                {
                    Availability = DriverAvailability.NotInstalled,
                    Message = "PawnIO is not installed. Extended sensors "
                            + "(temperatures, fan speeds, voltages) are unavailable.",
                };
            }

            using SafeFileHandle handle = CreateFile(
                DevicePath,
                GenericRead | GenericWrite,
                FileShareRead | FileShareWrite,
                IntPtr.Zero,
                OpenExisting,
                dwFlagsAndAttributes: 0,
                IntPtr.Zero);

            if (!handle.IsInvalid)
            {
                return new DriverProbeResult
                {
                    Availability = DriverAvailability.Available,
                    InstalledVersion = installed,
                    Message = $"PawnIO {installed} is installed and the device opened successfully.",
                };
            }

            int error = Marshal.GetLastWin32Error();

            return error switch
            {
                ErrorAccessDenied => new DriverProbeResult
                {
                    Availability = DriverAvailability.AccessDenied,
                    InstalledVersion = installed,
                    Win32Error = error,
                    Message = $"PawnIO {installed} is installed but the device could not be "
                            + "opened (access denied). Elevation is likely required.",
                },

                ErrorFileNotFound or ErrorPathNotFound => new DriverProbeResult
                {
                    Availability = DriverAvailability.InstalledButNotLoaded,
                    InstalledVersion = installed,
                    Win32Error = error,
                    Message = $"PawnIO {installed} is registered as installed but its device is "
                            + "absent, so the driver did not load. This is usually a code-integrity "
                            + "policy (memory integrity / HVCI, Smart App Control, or App Control). "
                            + "Extended sensors will stay unavailable on this machine.",
                },

                _ => new DriverProbeResult
                {
                    Availability = DriverAvailability.ProbeFailed,
                    InstalledVersion = installed,
                    Win32Error = error,
                    Message = $"PawnIO {installed} is installed but the device open failed "
                            + $"with Win32 error {error}.",
                },
            };
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            // A diagnostic must never take the app down.
            return new DriverProbeResult
            {
                Availability = DriverAvailability.ProbeFailed,
                Message = $"Driver probe failed: {ex.GetType().Name}: {ex.Message}",
            };
        }
    }

    /// <summary>
    /// Reads the installed version from the uninstall key, checking the 64-bit
    /// view as a fallback for a 32-bit process.
    /// </summary>
    private static Version? ReadInstalledVersion()
    {
        using RegistryKey? key = Registry.LocalMachine.OpenSubKey(UninstallSubKey);

        if (Version.TryParse(key?.GetValue("DisplayVersion") as string, out Version? version))
        {
            return version;
        }

        using RegistryKey baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
        using RegistryKey? key64 = baseKey.OpenSubKey(UninstallSubKey);

        return Version.TryParse(key64?.GetValue("DisplayVersion") as string, out Version? version64)
            ? version64
            : null;
    }

    [LibraryImport("kernel32.dll", EntryPoint = "CreateFileW",
        StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
    private static partial SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);
}
