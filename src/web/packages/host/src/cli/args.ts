/**
 * Command-line parsing. Pure: argv in, a decision out (§0010).
 *
 * Nothing here touches a socket, a file or `process`. The launcher in
 * `main.ts` performs whatever this returns — the same plan/mount split the
 * renderer uses, for the same reason: every rule about what a flag means is
 * testable in Node without starting a server.
 */

/** Where the host listens, and whether to open a browser at it. */
export interface HostOptions {
  readonly port: number;
  readonly host: string;
  readonly openBrowser: boolean;
}

/**
 * The default port.
 *
 * 5227 is what the design document and the old C# host both named, so
 * documentation, firewall notes and muscle memory all already point at it.
 */
export const DEFAULT_PORT = 5227;

/**
 * The default bind address — **loopback, not every interface**.
 *
 * §7 requires LAN serving to start disabled with explicit interface selection.
 * This is the one place Vigilia deliberately diverges from the launcher it was
 * modelled on (ADR-0007): a default that listens on `0.0.0.0` publishes
 * hardware telemetry to whatever network the laptop is on, which is a
 * different decision from "make it easy to reach from a phone" and must be
 * made by a human, once, on purpose.
 */
export const DEFAULT_HOST = '127.0.0.1';

/**
 * How many ports to try before giving up.
 *
 * Bounded on purpose. Scanning upward forever turns "the port is busy" into a
 * host that eventually binds somewhere nobody was told about — and the URL is
 * read aloud to someone holding a phone, so landing silently elsewhere is
 * worse than refusing.
 */
export const MAX_PORT_ATTEMPTS = 10;

/** What the launcher should do. */
export type ArgsResult =
  | { readonly kind: 'run'; readonly options: HostOptions }
  /** Print and exit zero — `--help`, `--version`. */
  | { readonly kind: 'message'; readonly text: string }
  /** Print to stderr and exit non-zero. */
  | { readonly kind: 'error'; readonly message: string };

export const HELP_TEXT = `Usage: vigilia [options]

Options:
  -p, --port <port>   Port to listen on (default: ${DEFAULT_PORT})
  -H, --host <addr>   Address to bind (default: ${DEFAULT_HOST}, loopback only)
  -n, --no-browser    Do not open a browser
  -v, --version       Print the version
  -h, --help          Print this help

LAN access is off by default. Passing --host 0.0.0.0 serves your hardware
telemetry to every device on the network; plain LAN HTTP has no
confidentiality, so use it on trusted networks only, never the internet.`;

/**
 * True for addresses that only this machine can reach.
 *
 * Used to decide whether the launcher prints the "the network can reach this"
 * warning. `::` and `0.0.0.0` are wildcards — they are emphatically *not*
 * loopback, and getting that backwards would suppress the one warning that
 * matters.
 */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, '');

  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

/**
 * Parses a port, rejecting anything that is not a usable TCP port.
 *
 * `parseInt` would accept `"8080abc"` and `"0"`; both are mistakes worth
 * naming rather than silently coercing to a default, because a typo'd port
 * that falls back to 5227 looks like the flag was ignored.
 */
function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return undefined;
  }

  const value = Number(raw);

  return value >= 1 && value <= 65_535 ? value : undefined;
}

/**
 * Parses argv (without `node` and the script path).
 *
 * @param argv Arguments only — pass `process.argv.slice(2)`.
 * @param version Printed for `--version`. Injected rather than read from
 *   `package.json` here, because that read is I/O and this function is pure.
 */
export function parseArgs(argv: readonly string[], version: string): ArgsResult {
  let port = DEFAULT_PORT;
  let host = DEFAULT_HOST;
  let openBrowser = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--help':
      case '-h':
        return { kind: 'message', text: HELP_TEXT };

      case '--version':
      case '-v':
        return { kind: 'message', text: version };

      case '--no-browser':
      case '-n':
        openBrowser = false;
        break;

      case '--port':
      case '-p': {
        const parsed = parsePort(argv[index + 1]);

        if (parsed === undefined) {
          return {
            kind: 'error',
            message: `${arg} needs a port between 1 and 65535, not ${argv[index + 1] ?? '(nothing)'}.`,
          };
        }

        port = parsed;
        index += 1;
        break;
      }

      case '--host':
      case '-H': {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith('-')) {
          return { kind: 'error', message: `${arg} needs an address, such as 0.0.0.0.` };
        }

        host = value;
        index += 1;
        break;
      }

      default:
        return { kind: 'error', message: `Unknown option ${arg ?? ''}. Try --help.` };
    }
  }

  return { kind: 'run', options: { port, host, openBrowser } };
}
