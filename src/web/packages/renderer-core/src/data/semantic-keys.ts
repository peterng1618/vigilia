/**
 * The semantic key vocabulary — one owner for the names themes bind to (§93).
 *
 * A theme binds to `ram.used`, never to "the second sensor of the
 * LibreHardwareMonitor provider", so changing what supplies a quantity never
 * requires editing a theme. That indirection only works if both ends agree on
 * the spelling, which is why this lives in the shared library rather than in
 * the host: the host's providers declare which of these keys they can read,
 * and the editor offers them to an author. Defining the name in one place and
 * a reader for it in the other is the C#/TypeScript mirror rebuilt.
 *
 * ## This declares names, not availability
 *
 * Presence here says a key is *spelled* this way. It says nothing about
 * whether this machine can read it — that is a provider's `describe()`, and an
 * unsupplied key renders as a gap, never a zero (§97). `expectedTier` is a
 * hint for an author choosing a binding ("this one will need a driver"), not a
 * claim about the current host. Tiers are discovered and reported, never
 * hardcoded (ADR-0004).
 *
 * ## Naming rules, so future keys are derivable rather than invented
 *
 * `family.quantity`, with an optional qualifier: `cpu.load`, `ram.used`,
 * `ram.used.percent`. Rules that have already been decided:
 *
 * - **`ram` and `vram` are separate families**, not `memory` with a qualifier.
 *   System memory and video memory are different hardware read by different
 *   providers, and the short names stay unambiguous at a glance — which is why
 *   `memory.*` was renamed to `ram.*` rather than the fixtures being renamed to
 *   match it. The fixtures already used `ram.used` and `vram.used`.
 * - **A percentage is a qualifier on the quantity**, not a separate quantity:
 *   `ram.used` is in GB and `ram.used.percent` is its share of `ram.total`.
 *   A theme wanting a gauge takes the percent key; one wanting "41.2 / 63.7 GB"
 *   takes both absolute keys and no capacity is ever written into the document.
 *
 * **Undecided, deliberately:** how to address a second device of the same
 * family. Spec 0010 sketches `gpu.0.load`, and nothing needs it until a
 * multi-GPU provider exists — so no indexed form is declared here rather than
 * guessing at one that a real provider then contradicts.
 */

/**
 * Which sensors need privileged access (ADR-0004).
 *
 * Defined here because it is a word in the shared contract: the host's
 * descriptors carry it and displays report it.
 */
export type SensorTier = 'baseline' | 'extended';

/** The families, in the order a picker should group them. */
export type SemanticFamily = 'cpu' | 'ram' | 'gpu' | 'vram' | 'disk' | 'network';

/** What a semantic key means, independent of who supplies it. */
export interface SemanticKeyDescriptor {
  readonly key: string;
  readonly family: SemanticFamily;
  /** Human-readable, for a picker and for a default label. */
  readonly label: string;
  /** The unit a provider is expected to report this in. */
  readonly unit?: string;
  /**
   * What reading this normally takes. A hint for an author, **not** a
   * statement about this machine — see the module note.
   */
  readonly expectedTier: SensorTier;
}

/**
 * The canonical vocabulary.
 *
 * Baseline keys are the four the OS provider reads from Node built-ins today.
 * The extended ones are spelled here because fixtures and themes already bind
 * them and an author needs a label for them; every one is unsupplied until an
 * LHM provider exists, and renders as a gap until then.
 */
export const SEMANTIC_KEYS: readonly SemanticKeyDescriptor[] = [
  // CPU
  { key: 'cpu.load', family: 'cpu', label: 'CPU load', unit: '%', expectedTier: 'baseline' },
  { key: 'cpu.temp', family: 'cpu', label: 'CPU temperature', unit: '°C', expectedTier: 'extended' },
  { key: 'cpu.power', family: 'cpu', label: 'CPU power', unit: 'W', expectedTier: 'extended' },
  { key: 'cpu.clock', family: 'cpu', label: 'CPU clock', unit: 'MHz', expectedTier: 'extended' },
  { key: 'cpu.fan', family: 'cpu', label: 'CPU fan', unit: 'RPM', expectedTier: 'extended' },

  // System memory. Absolute and share, never a capacity in the document.
  { key: 'ram.used', family: 'ram', label: 'RAM used', unit: 'GB', expectedTier: 'baseline' },
  {
    key: 'ram.used.percent',
    family: 'ram',
    label: 'RAM used (share of total)',
    unit: '%',
    expectedTier: 'baseline',
  },
  { key: 'ram.total', family: 'ram', label: 'RAM total', unit: 'GB', expectedTier: 'baseline' },

  // GPU
  { key: 'gpu.load', family: 'gpu', label: 'GPU load', unit: '%', expectedTier: 'extended' },
  { key: 'gpu.temp', family: 'gpu', label: 'GPU temperature', unit: '°C', expectedTier: 'extended' },
  { key: 'gpu.power', family: 'gpu', label: 'GPU power', unit: 'W', expectedTier: 'extended' },
  { key: 'gpu.clock', family: 'gpu', label: 'GPU clock', unit: 'MHz', expectedTier: 'extended' },
  { key: 'gpu.fan', family: 'gpu', label: 'GPU fan', unit: 'RPM', expectedTier: 'extended' },

  // Video memory — a separate family from `ram`, see the module note.
  { key: 'vram.used', family: 'vram', label: 'VRAM used', unit: 'GB', expectedTier: 'extended' },
  {
    key: 'vram.used.percent',
    family: 'vram',
    label: 'VRAM used (share of total)',
    unit: '%',
    expectedTier: 'extended',
  },
  { key: 'vram.total', family: 'vram', label: 'VRAM total', unit: 'GB', expectedTier: 'extended' },

  // Disk and network are unimplemented on purpose: they need a runtime
  // dependency the host does not have yet (spec 0010).
  { key: 'disk.used', family: 'disk', label: 'Disk used', unit: 'GB', expectedTier: 'baseline' },
  {
    key: 'disk.used.percent',
    family: 'disk',
    label: 'Disk used (share of total)',
    unit: '%',
    expectedTier: 'baseline',
  },
  { key: 'disk.total', family: 'disk', label: 'Disk total', unit: 'GB', expectedTier: 'baseline' },
  {
    key: 'network.download',
    family: 'network',
    label: 'Network download',
    unit: 'Mb/s',
    expectedTier: 'baseline',
  },
  {
    key: 'network.upload',
    family: 'network',
    label: 'Network upload',
    unit: 'Mb/s',
    expectedTier: 'baseline',
  },
];

const BY_KEY = new Map(SEMANTIC_KEYS.map((descriptor) => [descriptor.key, descriptor]));

/**
 * The vocabulary entry for `key`, or `undefined` when it is not one of ours.
 *
 * Unknown is not an error. A theme may bind a key this build has never heard
 * of — a newer theme, or a custom HTTP sensor (§99) — and the honest response
 * is to render it as a gap with its raw key, not to refuse the document.
 */
export function describeSemanticKey(key: string): SemanticKeyDescriptor | undefined {
  return BY_KEY.get(key);
}

/** Whether `key` is part of the declared vocabulary. */
export function isKnownSemanticKey(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * A label for `key`, falling back to the key itself.
 *
 * The fallback is deliberate: showing `disk.nvme.queue-depth` is informative,
 * whereas showing "Unknown sensor" throws away the only thing known about it.
 */
export function labelForSemanticKey(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

/** The vocabulary grouped by family, in declaration order. Useful for a picker. */
export function semanticKeysByFamily(): ReadonlyMap<
  SemanticFamily,
  readonly SemanticKeyDescriptor[]
> {
  const grouped = new Map<SemanticFamily, SemanticKeyDescriptor[]>();

  for (const descriptor of SEMANTIC_KEYS) {
    const existing = grouped.get(descriptor.family);

    if (existing === undefined) {
      grouped.set(descriptor.family, [descriptor]);
    } else {
      existing.push(descriptor);
    }
  }

  return grouped;
}
