import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_HOST, isLoopbackHost, parseArgs } from "./cli/args.js";
import { createHostBinding } from "./cli/hosting.js";
import {
  lanAddress,
  listenWithFallback,
  openBrowser,
  waitUntilReachable,
} from "./cli/net.js";
import { ClockSensorProvider } from "./providers/clock.js";
import { LhmSensorProvider } from "./providers/lhm.js";
import { launchLhm, registerLhmTask } from "./providers/lhm-launcher.js";
import { LibrarySensorProvider } from "./providers/library.js";
import { ProviderRegistry } from "./providers/registry.js";
import { type HostingState, createHostServer } from "./server.js";
import { createSessionStore } from "./session/pairing.js";
import { createActiveThemeStore } from "./settings/active-theme.js";
import { createDeviceSettingsStore } from "./settings/devices.js";
import { createDisplaySettingsStore } from "./settings/display.js";
import { createFontFavoritesStore } from "./settings/font-favorites.js";
import { createHostingSettingsStore } from "./settings/hosting.js";
import { createThemeSettingsStore } from "./settings/theme-settings.js";
import { createThemeStore } from "./themes/store.js";
import { createThumbnailStore } from "./themes/thumbnails.js";

/** Launcher: bind, verify reachability, then print/open URLs. */

/** ANSI styling only for TTY output. */
function style(code: string, text: string): string {
  return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
}

const VERSION = "0.1.0";

/** The staged LibreHardwareMonitor, for setup commands that need a default. */
function defaultLhmExecutable(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "vendor", "lhm", "LibreHardwareMonitor.exe");
}

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
    hostGiven,
    openBrowser: shouldOpen,
    themesDir,
    settingsDir,
    lhmUrl,
    lhmExecutable,
    registerLhmTask: shouldRegisterTask,
  } = parsed.options;

  // One-time setup, then exit: registering needs an elevated shell with a
  // visible consent prompt, so it must not run inside the server.
  if (shouldRegisterTask === true) {
    const outcome = await registerLhmTask(
      lhmExecutable ?? defaultLhmExecutable(),
    );
    console.log(outcome.message);
    return outcome.ok ? 0 : 1;
  }

  // Launching LHM is opt-in via `--lhm-exe`, never automatic: its manifest
  // requires administrator rights, so starting it unattended would raise a UAC
  // prompt on every host start. The provider reads whichever server answers,
  // whether Vigilia launched it or the owner already runs it.
  const lhm =
    lhmExecutable === undefined
      ? { started: false, stop: (): void => undefined }
      : await launchLhm({
          executable: lhmExecutable,
          baseUrl: lhmUrl,
          timeoutMs: 20_000,
        });

  // Provider order defines ownership priority. LibreHardwareMonitor answers the
  // extended sensors (CPU temperature, fans, GPU detail) when the machine owner
  // runs it; the systeminformation-backed provider answers everything else, and
  // covers any key LHM could not read. Both are optional sources, never a
  // collector Vigilia maintains (§97).
  const lhmProvider = new LhmSensorProvider({ baseUrl: lhmUrl });
  const libraryProvider = new LibrarySensorProvider();
  // Time is a reading from this PC, so displays agree and a wrong device clock
  // cannot mislead.
  const clockProvider = new ClockSensorProvider();
  const registry = new ProviderRegistry([
    clockProvider,
    lhmProvider,
    libraryProvider,
  ]);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packagesDir = path.resolve(here, "..", "..");

  // Sessions exist whether or not the LAN is on, because the control can turn it
  // on after launch; the binding decides whether anything but loopback can reach
  // them at all (§145).
  const sessions = createSessionStore();
  const hosting = createHostingSettingsStore(settingsDir);
  const storedHosting = await hosting.read();
  // Everything the host knows about *this* machine lives in one settings
  // folder, so a theme folder is only ever a theme (ADR-0017).
  const deviceSettings = createDeviceSettingsStore(settingsDir);
  // The consumer's display preferences, read by the provider that acquires the
  // readings they apply to.
  const displaySettings = createDisplaySettingsStore(settingsDir);
  // Which theme this host displays; consumer state beside the device choices.
  const activeTheme = createActiveThemeStore(settingsDir);
  // Which curated font trios this author reaches for. Author preference about
  // this PC, so it sits with the other settings and never in a theme folder.
  const fontFavorites = createFontFavoritesStore(settingsDir);

  // Read per request; assigned the binding's own reader once the socket exists.
  // `createHostServer` captures `options.hosting` at creation (server.ts:319), so
  // a later assignment to the options object would have no effect, and a request
  // arriving in the window between `listenWithFallback` and the binding's
  // construction would hit a `const binding` still in its temporal dead zone.
  const NO_HOSTING_STATE: HostingState = {
    lan: false,
    address: null,
    port: null,
  };
  let hostingState = (): HostingState => NO_HOSTING_STATE;

  const hosted = createHostServer({
    registry,
    // Where a phone should point, and whether one can reach this host at all.
    hosting: () => hostingState(),
    // The route moves the one listener; the binding is built once the port the
    // socket actually took is known, so these read it when they are called.
    setLan: (on) => binding.setLan(on),
    rememberLan: async (on) => {
      await hosting.write({ lan: on });
    },
    bundles: {
      player: path.join(packagesDir, "player", "dist"),
      editor: path.join(packagesDir, "editor", "dist"),
      // Served from source: the settings page has no build step.
      admin: path.join(packagesDir, "host", "public"),
    },
    themeStore: createThemeStore(themesDir),
    // A thumbnail is this machine's rendering of a theme, so it lives in that
    // theme's own folder rather than in a directory of its own. The editor
    // writes it after the save that replaced the folder, which is why the
    // library always has a picture for what was just saved.
    thumbnails: createThumbnailStore(themesDir),
    themeSettings: createThemeSettingsStore(settingsDir),
    ...(sessions === undefined ? {} : { sessions }),
    devices: deviceSettings,
    display: displaySettings,
    fontFavorites,
    onDisplayChange: (settings) => clockProvider.setTimeZone(settings.timeZone),
    activeTheme,
    onDeviceAssignment: (assignment) => {
      lhmProvider.setAssignment(assignment);
      libraryProvider.setAssignment(assignment);
    },
    // Both providers know the machine's devices; LHM's list is richer, so its
    // entries come first and the library fills in what LHM does not report
    // (a machine without LHM still gets a usable device list).
    describeDevices: async () => {
      const [fromLhm, fromLibrary] = await Promise.all([
        lhmProvider.describeDevices(),
        libraryProvider.describeDevices(),
      ]);
      // Not a union: both providers name a drive by its model now, so LHM's
      // list already covers the drives the library can reach, and concatenating
      // them would list one physical drive twice under two different slugs.
      // The list must describe what the provider that answers readings can
      // actually serve, so LHM's list wins whenever it has one and the
      // library's fills in only when it does not.
      const prefer = <T extends { readonly id: string }>(
        first: readonly T[],
        second: readonly T[],
      ): readonly T[] => (first.length > 0 ? first : second);

      return {
        gpus: prefer(fromLhm.gpus, fromLibrary.gpus),
        disks: prefer(fromLhm.disks, fromLibrary.disks),
      };
    },
  });

  // Apply the settled display choice before the first poll, so the first frame
  // already shows the time the consumer asked for.
  const storedDisplay = await displaySettings.read();
  clockProvider.setTimeZone(storedDisplay.timeZone);

  // Apply the settled device choices before the first poll.
  const storedDevices = await deviceSettings.read();
  const initialAssignment = {
    ...(storedDevices.assigned.gpu === undefined
      ? {}
      : { gpu: storedDevices.assigned.gpu }),
    ...(storedDevices.assigned["system-disk"] === undefined
      ? {}
      : { systemDisk: storedDevices.assigned["system-disk"] }),
    ...(storedDevices.assigned["data-disk"] === undefined
      ? {}
      : { dataDisk: storedDevices.assigned["data-disk"] }),
  };
  lhmProvider.setAssignment(initialAssignment);
  libraryProvider.setAssignment(initialAssignment);

  // `--host` wins for the run; a run without it obeys what this PC remembers.
  const initialHost = hostGiven
    ? host
    : storedHosting.lan
      ? "0.0.0.0"
      : DEFAULT_HOST;

  let bound: number;

  try {
    bound = await listenWithFallback(hosted.server, wanted, initialHost);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const binding = createHostBinding(hosted.server, {
    port: bound,
    host: initialHost,
  });
  hostingState = binding.state;

  const reachable = await waitUntilReachable(bound, initialHost);

  if (!reachable) {
    console.error(
      `The server bound port ${bound} but never answered. Giving up.`,
    );
    await hosted.close();
    return 1;
  }

  const displayHost =
    initialHost === "0.0.0.0" || initialHost === "::"
      ? "localhost"
      : initialHost;
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
      style(
        "2",
        `  Extended sensors (CPU temperature, fans, power) need ` +
          `LibreHardwareMonitor running at ${lhmUrl}.` +
          "\n  Start it yourself with its web server enabled, or pass --lhm-exe.",
      ),
    );
  }

  if (!isLoopbackHost(initialHost)) {
    const lan = lanAddress();

    console.log(
      style(
        "33",
        `\n  LAN serving is ON (bound ${initialHost}).` +
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
