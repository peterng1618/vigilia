import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLoopbackHost, parseArgs } from "./cli/args.js";
import {
  lanAddress,
  listenWithFallback,
  openBrowser,
  waitUntilReachable,
} from "./cli/net.js";
import { LhmSensorProvider } from "./providers/lhm.js";
import { launchLhm } from "./providers/lhm-launcher.js";
import { LibrarySensorProvider } from "./providers/library.js";
import { ProviderRegistry } from "./providers/registry.js";
import { createHostServer } from "./server.js";
import { createSessionStore } from "./session/pairing.js";
import { createThemeStore } from "./themes/store.js";

/** Launcher: bind, verify reachability, then print/open URLs. */

/** ANSI styling only for TTY output. */
function style(code: string, text: string): string {
  return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
}

/**
 * Where a packaged LibreHardwareMonitor lives: `vendor/lhm/` beside the host
 * package. Absent until LHM is actually redistributed, which needs its licence
 * obligations settled first (`.agents/dependency-licences.md`).
 */
function bundledLhmPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "vendor", "lhm", "LibreHardwareMonitor.exe");
}

const VERSION = "0.1.0";

export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv, VERSION);

  if (parsed.kind === "message") {
    console.log(parsed.text);
    return 0;
  }

  if (parsed.kind === "error") {
    console.error(`${parsed.message}`);
    return 1;
  }

  const {
    port: wanted,
    host,
    openBrowser: shouldOpen,
    themesDir,
    lhmUrl,
    lhmExecutable,
  } = parsed.options;

  // Starting LHM is opt-in via `--lhm-exe`; the provider reads whichever server
  // answers, whether Vigilia launched it or the owner already runs it.
  const lhm = await launchLhm({
    executable: lhmExecutable ?? bundledLhmPath(),
    baseUrl: lhmUrl,
    ...(lhmExecutable === undefined ? {} : { timeoutMs: 20_000 }),
  });

  // Provider order defines ownership priority. LibreHardwareMonitor answers the
  // extended sensors (CPU temperature, fans, GPU detail) when the machine owner
  // runs it; the systeminformation-backed provider answers everything else, and
  // covers any key LHM could not read. Both are optional sources, never a
  // collector Vigilia maintains (§97).
  const registry = new ProviderRegistry([
    new LhmSensorProvider({ baseUrl: lhmUrl }),
    new LibrarySensorProvider(),
  ]);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const packagesDir = path.resolve(here, "..", "..");
  const servingLan = !isLoopbackHost(host);

  // Sessions exist only when the server is LAN-reachable; a loopback-only host
  // refuses non-loopback reads outright rather than trusting them.
  const sessions = servingLan ? createSessionStore() : undefined;

  const hosted = createHostServer({
    registry,
    bundles: {
      player: path.join(packagesDir, "player", "dist"),
      editor: path.join(packagesDir, "editor", "dist"),
    },
    themeStore: createThemeStore(themesDir),
    ...(sessions === undefined ? {} : { sessions }),
  });

  let bound: number;

  try {
    bound = await listenWithFallback(hosted.server, wanted, host);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const reachable = await waitUntilReachable(bound, host);

  if (!reachable) {
    console.error(
      `The server bound port ${bound} but never answered. Giving up.`,
    );
    await hosted.close();
    return 1;
  }

  const displayHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const url = `http://${displayHost}:${bound}`;

  console.log(`\nVigilia v${VERSION}`);

  if (bound !== wanted) {
    console.log(
      style("33", `Port ${wanted} was busy, so this is on ${bound}.`),
    );
  }

  console.log(`  Dashboard  ${url}`);
  console.log(`  Editor     ${url}/editor`);

  // Say what the extended sensors will do, rather than leaving the display to
  // show gaps without explanation.
  if (lhm.started) {
    console.log(style("2", `  LibreHardwareMonitor started for ${lhmUrl}`));
  } else if (lhm.reason !== undefined) {
    console.log(
      style(
        "33",
        `  Extended sensors unavailable: ${lhm.reason}` +
          "\n  Baseline sensors still work; temperature and fan keys will be gaps.",
      ),
    );
  } else {
    console.log(
      style("2", `  Using the LibreHardwareMonitor already at ${lhmUrl}`),
    );
  }

  if (!isLoopbackHost(host)) {
    const lan = lanAddress();

    console.log(
      style(
        "33",
        `\n  LAN serving is ON (bound ${host}).` +
          (lan === undefined
            ? ""
            : ` Phones on this Wi-Fi: http://${lan}:${bound}`),
      ),
    );
    console.log(
      style("33", "  Plain HTTP — trusted networks only, never the internet."),
    );
    console.log(style("2", "  The editor stays restricted to this PC."));

    if (sessions !== undefined) {
      const hostPart = lan === undefined ? displayHost : lan;
      const paired = sessions.create("phone");
      // The token is in the URL because EventSource cannot set request
      // headers; anyone who sees this link can watch, which is why it expires.
      console.log(
        style(
          "2",
          `\n  Pair a phone with this link (expires ${paired.expiresAt}):`,
        ),
      );
      console.log(
        `  ${url.replace(`://${displayHost}`, `://${hostPart}`)}/?session=${encodeURIComponent(paired.token)}`,
      );
      console.log(
        style(
          "2",
          "  Revoke any time:  curl -X DELETE http://127.0.0.1:" +
            `${bound}/api/pairing/sessions/${encodeURIComponent(paired.token)}`,
        ),
      );
    }
  } else {
    console.log(
      style("2", "\n  Local only. Pass --host 0.0.0.0 to let phones connect."),
    );
  }

  console.log(style("2", "\n  Ctrl+C to stop.\n"));

  if (shouldOpen) {
    openBrowser(`${url}/editor`);
  }

  // Process lifetime belongs to the terminal until a tray host exists.
  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = (): void => {
      if (stopping) {
        return;
      }

      stopping = true;
      console.log("\nStopping.");
      // Stop only the LHM this run started; one the owner already ran is theirs.
      lhm.stop();
      void hosted.close().then(resolve, resolve);
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  return 0;
}
