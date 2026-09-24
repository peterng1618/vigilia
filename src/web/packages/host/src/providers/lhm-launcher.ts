import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Runs a local LibreHardwareMonitor so its web server can be read (§97). LHM is
 * an external program: Vigilia launches it and stops only the process it
 * started itself, never one the machine owner is already running.
 *
 * LHM's executable is manifested `requireAdministrator`, because reading most
 * sensors needs its kernel driver. A non-elevated host therefore **cannot**
 * start it — Windows refuses — so this reports that rather than a bare failure
 * code, and launching is opt-in rather than automatic.
 */

/**
 * Detects the elevation requirement so the failure can be explained.
 *
 * The manifest string is scanned for rather than parsed out of the resource
 * directory, but only in a real PE image: scanning any file's text would read
 * a source file that merely mentions `requireAdministrator` as needing
 * elevation.
 */
export function requiresElevation(executable: string): boolean {
  try {
    const image = readFileSync(executable, "latin1");

    // "MZ" is the DOS stub every PE begins with.
    if (!image.startsWith("MZ")) {
      return false;
    }

    return image.includes("requireAdministrator");
  } catch {
    return false;
  }
}

/** The task LHM registers for "Start on Windows startup". */
export const LHM_TASK_NAME = "LibreHardwareMonitor";

/**
 * Whether LHM's own startup task is registered. Such a task runs with
 * `TaskRunLevel.Highest`, so Windows starts it elevated and never prompts
 * again: once the owner has approved that task, an elevated session is no
 * longer needed to run LHM, and the launcher's advice must say so.
 *
 * Reads the task store directly rather than shelling out, and treats any
 * failure as "not registered" so this can only ever make the message more
 * conservative.
 */
export function hasLhmStartupTask(
  taskDirectory = path.join(
    process.env["SystemRoot"] ?? "C:\\Windows",
    "System32",
    "Tasks",
  ),
): boolean {
  try {
    return existsSync(path.join(taskDirectory, LHM_TASK_NAME));
  } catch {
    return false;
  }
}

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
 * Starts the executable, requesting elevation when it needs it.
 *
 * `spawn` cannot elevate: a non-elevated process spawning a
 * `requireAdministrator` binary simply fails. Windows' own `runas` verb is
 * the supported way to ask, and it shows the normal UAC prompt once — after
 * which LHM's own startup task keeps it elevated without prompting.
 */
export function launchChild(
  executable: string,
): Pick<ChildProcess, "kill" | "once" | "killed"> {
  if (process.platform !== "win32" || !requiresElevation(executable)) {
    return spawn(executable, [], { detached: false, stdio: "ignore" });
  }

  // A registered task already holds the owner's approval and runs elevated, so
  // starting the task prompts for nothing. This is the "approve once" path.
  if (hasLhmStartupTask()) {
    return spawn("schtasks", ["/Run", "/TN", LHM_TASK_NAME], {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
    });
  }

  // No task yet: request elevation, which raises the one consent dialog. A
  // process started this way is owned by the owner, not by us, so `stop` may
  // not reach it — reported the same way as an LHM the owner started.
  return spawn(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Start-Process -FilePath '${executable.replace(/'/g, "''")}' -Verb RunAs`,
    ],
    { detached: false, stdio: "ignore", windowsHide: true },
  );
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

  try {
    child = options.spawnProcess
      ? options.spawnProcess(options.executable)
      : launchChild(options.executable);
  } catch (error) {
    return {
      started: false,
      reason: `could not start LibreHardwareMonitor: ${
        error instanceof Error ? error.message : String(error)
      }`,
      stop: () => undefined,
    };
  }

  // `spawn` reports failure asynchronously through an `error` event, so a
  // try/catch around it catches nothing and an unhandled event ends the
  // process. The event is what must be handled.
  let spawnError: string | undefined;

  child.once("error", (error: Error) => {
    spawnError = error.message;
  });

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

  // The process may be waiting on a consent dialog this session cannot show,
  // so say what is known rather than claiming it started.
  const elevated = requiresElevation(options.executable);

  return {
    started: false,
    reason: elevated
      ? `LibreHardwareMonitor was asked to start, but nothing is answering at ` +
        `${options.baseUrl}. If a permission prompt is waiting, approve it; LHM's ` +
        `web server also has to be enabled once in its Options menu.`
      : `LibreHardwareMonitor was started but its web server did not answer at ` +
        `${options.baseUrl}. Enable "Run web server" in LHM's Options menu.`,
    stop,
  };
}
