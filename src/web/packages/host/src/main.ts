import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLoopbackHost, parseArgs } from './cli/args.js';
import { lanAddress, listenWithFallback, openBrowser, waitUntilReachable } from './cli/net.js';
import { OsSensorProvider } from './providers/os.js';
import { ProviderRegistry } from './providers/registry.js';
import { createHostServer } from './server.js';

/**
 * The launcher — what `npx vigilia` runs.
 *
 * Order matters and is the point of the whole file: bind, **wait until the
 * port actually answers**, then print and open a browser. A fixed sleep before
 * opening is a race that usually wins, and on a cold start loses — making a
 * new user's first experience a connection error page.
 */

/** ANSI dim/yellow, applied only to a TTY so piped output stays clean. */
function style(code: string, text: string): string {
  return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
}

const VERSION = '0.1.0';

export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv, VERSION);

  if (parsed.kind === 'message') {
    console.log(parsed.text);
    return 0;
  }

  if (parsed.kind === 'error') {
    console.error(`${parsed.message}`);
    return 1;
  }

  const { port: wanted, host, openBrowser: shouldOpen } = parsed.options;

  // The provider order IS the ownership table in spec 0010: the OS baseline
  // provider is registered first, so a baseline dashboard never picks up a
  // dependency on LibreHardwareMonitor for data the OS exposes reliably.
  const registry = new ProviderRegistry([new OsSensorProvider()]);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const packagesDir = path.resolve(here, '..', '..');

  const hosted = createHostServer({
    registry,
    bundles: {
      player: path.join(packagesDir, 'player', 'dist'),
      editor: path.join(packagesDir, 'editor', 'dist'),
    },
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
    console.error(`The server bound port ${bound} but never answered. Giving up.`);
    await hosted.close();
    return 1;
  }

  const displayHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  const url = `http://${displayHost}:${bound}`;

  console.log(`\nVigilia v${VERSION}`);

  if (bound !== wanted) {
    // Never silent: someone is about to read this URL aloud to a person
    // holding a phone.
    console.log(style('33', `Port ${wanted} was busy, so this is on ${bound}.`));
  }

  console.log(`  Dashboard  ${url}`);
  console.log(`  Editor     ${url}/editor`);

  if (!isLoopbackHost(host)) {
    const lan = lanAddress();

    console.log(
      style(
        '33',
        `\n  LAN serving is ON (bound ${host}).` +
          (lan === undefined ? '' : ` Phones on this Wi-Fi: http://${lan}:${bound}`),
      ),
    );
    // §7: plain LAN HTTP has no confidentiality. Saying so every time is
    // cheap; a user discovering it later is not.
    console.log(
      style('33', '  Plain HTTP — trusted networks only, never the internet.'),
    );
    console.log(style('2', '  The editor stays restricted to this PC.'));
  } else {
    console.log(style('2', '\n  Local only. Pass --host 0.0.0.0 to let phones connect.'));
  }

  console.log(style('2', '\n  Ctrl+C to stop.\n'));

  if (shouldOpen) {
    openBrowser(`${url}/editor`);
  }

  // §7: a stopped host cannot restart itself through its own website, so
  // process lifetime belongs here — to the terminal, and later the tray.
  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = (): void => {
      if (stopping) {
        return;
      }

      stopping = true;
      console.log('\nStopping.');
      void hosted.close().then(resolve, resolve);
    };

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });

  return 0;
}
