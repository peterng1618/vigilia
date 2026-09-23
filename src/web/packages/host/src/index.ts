/**
 * The host's public surface.
 *
 * The wire contract is deliberately **not** re-exported here — it lives in
 * `@vigilia/renderer-core` because both the host and every display import it.
 * Re-exporting would invite a second import path for one contract, which is
 * the first step back towards the mirrored pair ADR-0007 removed.
 */

export type { ArgsResult, HostOptions } from "./cli/args.js";

export {
  DEFAULT_HOST,
  DEFAULT_PORT,
  HELP_TEXT,
  isLoopbackHost,
  MAX_PORT_ATTEMPTS,
  parseArgs,
} from "./cli/args.js";

export {
  lanAddress,
  listenWithFallback,
  openBrowser,
  waitUntilReachable,
} from "./cli/net.js";
export { run } from "./main.js";

export type { CpuTimes, OsReadings } from "./providers/os.js";

export {
  cpuLoadBetween,
  OS_DESCRIPTORS,
  OS_PROVIDER_ID,
  OsSensorProvider,
  readingsFromCpus,
  samplesFromReadings,
} from "./providers/os.js";
export type {
  ProviderHealth,
  SensorDescriptor,
  SensorProvider,
  SensorTier,
} from "./providers/provider.js";
export type {
  DescribedSensor,
  ProviderFailure,
  SampleCycle,
} from "./providers/registry.js";
export { ProviderRegistry, unionOfKeys } from "./providers/registry.js";
export { contentTypeFor, resolveStaticPath } from "./serve/static-path.js";
export type { BundleRoots, HostServer, HostServerOptions } from "./server.js";
export { createHostServer, DEFAULT_SAMPLE_INTERVAL_MS } from "./server.js";
export { KeepLatestSlot } from "./transport/keep-latest.js";
export { SseConnection } from "./transport/sse.js";
