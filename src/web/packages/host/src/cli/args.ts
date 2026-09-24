import os from "node:os";
import path from "node:path";
import { DEFAULT_LHM_URL } from "../providers/lhm.js";

/** Pure command-line parsing. */

export interface HostOptions {
  readonly port: number;
  readonly host: string;
  readonly openBrowser: boolean;
  readonly themesDir: string;
  /** Endpoint of a LibreHardwareMonitor web server, if the owner runs one. */
  readonly lhmUrl: string;
  /** Path to `LibreHardwareMonitor.exe`; set to launch it with the host. */
  readonly lhmExecutable?: string;
}

export const DEFAULT_PORT = 5227;

/** Loopback by default; LAN exposure must be explicit. */
export const DEFAULT_HOST = "127.0.0.1";

/** Stable Vigilia data location for theme packages across platforms. */
export const DEFAULT_THEMES_DIR = path.join(os.homedir(), ".vigilia", "themes");

/** Bounded upward port fallback. */
export const MAX_PORT_ATTEMPTS = 10;

export type ArgsResult =
  | { readonly kind: "run"; readonly options: HostOptions }
  | { readonly kind: "message"; readonly text: string }
  | { readonly kind: "error"; readonly message: string };

export const HELP_TEXT = `Usage: vigilia-dashboard [options]

Options:
  -p, --port <port>       Port to listen on (default: ${DEFAULT_PORT})
  -H, --host <addr>       Address to bind (default: ${DEFAULT_HOST}, loopback only)
  -n, --no-browser        Do not open a browser
      --themes-dir <dir>  Directory for saved theme packages
      --lhm-url <url>     LibreHardwareMonitor web server (default ${DEFAULT_LHM_URL})
      --lhm-exe <path>    Launch LibreHardwareMonitor.exe with the host
  -v, --version           Print the version
  -h, --help              Print this help

Extended sensors (temperatures, fans, power) come from LibreHardwareMonitor
when it is running; Vigilia reads its web server and never controls its
hardware support. Everything else is read through systeminformation.

LAN access is off by default. Passing --host 0.0.0.0 serves your hardware
telemetry to every device on the network; plain LAN HTTP has no
confidentiality, so use it on trusted networks only, never the internet.`;

/** True only for addresses restricted to this machine. */
export function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  );
}

/** Strictly parses usable TCP ports; rejects partial numeric strings. */
function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return undefined;
  }

  const value = Number(raw);

  return value >= 1 && value <= 65_535 ? value : undefined;
}

/** Parses argv without `node` and the script path. */
export function parseArgs(
  argv: readonly string[],
  version: string,
): ArgsResult {
  let port = DEFAULT_PORT;
  let host = DEFAULT_HOST;
  let openBrowser = true;
  let themesDir = DEFAULT_THEMES_DIR;
  let lhmUrl = DEFAULT_LHM_URL;
  let lhmExecutable: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--help":
      case "-h":
        return { kind: "message", text: HELP_TEXT };

      case "--version":
      case "-v":
        return { kind: "message", text: version };

      case "--no-browser":
      case "-n":
        openBrowser = false;
        break;

      case "--port":
      case "-p": {
        const parsed = parsePort(argv[index + 1]);

        if (parsed === undefined) {
          return {
            kind: "error",
            message: `${arg} needs a port between 1 and 65535, not ${argv[index + 1] ?? "(nothing)"}.`,
          };
        }

        port = parsed;
        index += 1;
        break;
      }

      case "--host":
      case "-H": {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith("-")) {
          return {
            kind: "error",
            message: `${arg} needs an address, such as 0.0.0.0.`,
          };
        }

        host = value;
        index += 1;
        break;
      }

      case "--lhm-url": {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith("-")) {
          return { kind: "error", message: `${arg} needs a URL.` };
        }

        lhmUrl = value.replace(/\/$/, "");
        index += 1;
        break;
      }

      case "--lhm-exe": {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith("-")) {
          return {
            kind: "error",
            message: `${arg} needs a path to LibreHardwareMonitor.exe.`,
          };
        }

        lhmExecutable = path.resolve(value);
        index += 1;
        break;
      }

      case "--themes-dir": {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith("-")) {
          return { kind: "error", message: `${arg} needs a directory path.` };
        }

        themesDir = path.resolve(value);
        index += 1;
        break;
      }

      default:
        return {
          kind: "error",
          message: `Unknown option ${arg ?? ""}. Try --help.`,
        };
    }
  }

  return {
    kind: "run",
    options: {
      port,
      host,
      openBrowser,
      themesDir,
      lhmUrl,
      ...(lhmExecutable === undefined ? {} : { lhmExecutable }),
    },
  };
}
