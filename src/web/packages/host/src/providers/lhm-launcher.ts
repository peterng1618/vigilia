import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Runs a local LibreHardwareMonitor so its web server can be read (§97). LHM is
 * an external program: Vigilia launches it and stops only the process it
 * started itself, never one the machine owner is already running.
 */

export interface LhmLaunchOptions {
  /** Path to `LibreHardwareMonitor.exe`. */
  readonly executable: string;
  /** Endpoint to poll until the server answers. */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetcher?: (url: string) => Promise<{ readonly ok: boolean }>;
  readonly spawnProcess?: (
    executable: string,
  ) => Pick<ChildProcess, "kill" | "once" | "killed">;
}

export interface LhmLaunchResult {
  readonly started: boolean;
  /** Why it did not start, for the status line. */
  readonly reason?: string;
  readonly stop: () => void;
}

/** The endpoint LHM answers once its web server is up. */
async function reachable(
  baseUrl: string,
  fetcher: (url: string) => Promise<{ readonly ok: boolean }>,
): Promise<boolean> {
  try {
    return (await fetcher(`${baseUrl}/data.json`)).ok;
  } catch {
    return false;
  }
}

/**
 * Starts LHM if it is not already answering, then waits for its server.
 *
 * LHM's web server is off until the machine owner enables it in LHM's own menu
 * (its `listenerPort` and `runWebServer` live in LHM's settings, not on the
 * command line), so a freshly launched LHM may answer nothing. That failure is
 * reported, never worked around by pretending a reading exists.
 */
export async function launchLhm(
  options: LhmLaunchOptions,
): Promise<LhmLaunchResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchOnce = options.fetcher ?? ((url: string) => fetch(url));

  // An LHM the owner already runs keeps ownership of itself.
  if (await reachable(options.baseUrl, fetchOnce)) {
    return { started: false, stop: () => undefined };
  }

  if (!existsSync(options.executable)) {
    return {
      started: false,
      reason: `LibreHardwareMonitor was not found at ${options.executable}`,
      stop: () => undefined,
    };
  }

  let child: Pick<ChildProcess, "kill" | "once" | "killed"> | undefined;

  // `spawn` reports failure asynchronously through an `error` event, so a
  // try/catch around it catches nothing and an unhandled event crashes the
  // host. The event is what must be handled.
  let spawnError: string | undefined;

  try {
    child =
      options.spawnProcess !== undefined
        ? options.spawnProcess(options.executable)
        : spawn(options.executable, [], {
            detached: false,
            stdio: "ignore",
          });

    child.once("error", (error: Error) => {
      spawnError = error.message;
    });
  } catch (error) {
    return {
      started: false,
      reason: `could not start LibreHardwareMonitor: ${
        error instanceof Error ? error.message : String(error)
      }`,
      stop: () => undefined,
    };
  }

  const stop = (): void => {
    // Only ever stops the process this call started.
    if (child !== undefined && !child.killed) {
      child.kill();
    }
  };

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // A process that failed to start never will; report why rather than
    // waiting out the full timeout.
    if (spawnError !== undefined) {
      return {
        started: false,
        reason: `could not start LibreHardwareMonitor: ${spawnError}`,
        stop,
      };
    }

    if (await reachable(options.baseUrl, fetchOnce)) {
      return { started: true, stop };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    started: false,
    reason:
      `LibreHardwareMonitor started but its web server did not answer at ` +
      `${options.baseUrl}. Enable "Run web server" in LHM's Options menu.`,
    stop,
  };
}
