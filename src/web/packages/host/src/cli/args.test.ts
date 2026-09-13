import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  HELP_TEXT,
  isLoopbackHost,
  parseArgs,
} from './args.js';

const VERSION = '1.2.3';

function run(...argv: string[]) {
  return parseArgs(argv, VERSION);
}

describe('parseArgs', () => {
  it('defaults to loopback, the documented port, and opening a browser', () => {
    expect(run()).toEqual({
      kind: 'run',
      options: { port: DEFAULT_PORT, host: DEFAULT_HOST, openBrowser: true },
    });
  });

  it('is loopback by default, not a wildcard bind (§7)', () => {
    const result = run();

    // The whole point of ADR-0007's divergence from 9router. If this ever
    // reads 0.0.0.0, the host publishes telemetry to the local network on a
    // bare `npx vigilia`.
    expect(result).toMatchObject({ options: { host: '127.0.0.1' } });
    expect(isLoopbackHost(DEFAULT_HOST)).toBe(true);
  });

  it.each([
    ['--port', '8080'],
    ['-p', '8080'],
  ])('reads a port from %s', (flag, value) => {
    expect(run(flag, value)).toMatchObject({ options: { port: 8080 } });
  });

  it.each([
    ['--host', '0.0.0.0'],
    ['-H', '192.168.1.10'],
  ])('reads an address from %s', (flag, value) => {
    expect(run(flag, value)).toMatchObject({ options: { host: value } });
  });

  it.each(['--no-browser', '-n'])('%s suppresses the browser', (flag) => {
    expect(run(flag)).toMatchObject({ options: { openBrowser: false } });
  });

  it.each(['--help', '-h'])('%s prints help and runs nothing', (flag) => {
    expect(run(flag)).toEqual({ kind: 'message', text: HELP_TEXT });
  });

  it.each(['--version', '-v'])('%s prints the injected version', (flag) => {
    expect(run(flag)).toEqual({ kind: 'message', text: VERSION });
  });

  it('combines flags', () => {
    expect(run('-p', '9000', '-H', '0.0.0.0', '-n')).toEqual({
      kind: 'run',
      options: { port: 9000, host: '0.0.0.0', openBrowser: false },
    });
  });

  describe('refusing bad input rather than coercing it', () => {
    // A typo'd port that silently falls back to the default looks exactly like
    // the flag was ignored, which is the worst of both outcomes.
    it.each(['0', '65536', '8080abc', 'abc', '-1'])('refuses the port %s', (value) => {
      expect(run('--port', value).kind).toBe('error');
    });

    it('refuses a port with no value', () => {
      expect(run('--port')).toMatchObject({ kind: 'error' });
    });

    it('refuses a host with no value, and does not eat the next flag', () => {
      expect(run('--host', '-n')).toMatchObject({ kind: 'error' });
    });

    it('refuses an unknown option and points at --help', () => {
      const result = run('--turbo');

      expect(result.kind).toBe('error');
      expect(result).toMatchObject({ message: expect.stringContaining('--help') });
    });
  });
});

describe('isLoopbackHost', () => {
  it.each(['127.0.0.1', 'localhost', '::1', '[::1]', 'LOCALHOST', ' 127.0.0.1 '])(
    'treats %s as reachable only from this machine',
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    },
  );

  it.each(['0.0.0.0', '::', '192.168.1.10', '10.0.0.5'])(
    'treats %s as network-reachable, so the warning fires',
    (host) => {
      // A wildcard is the opposite of loopback. Getting this backwards would
      // suppress exactly the warning that matters.
      expect(isLoopbackHost(host)).toBe(false);
    },
  );
});
