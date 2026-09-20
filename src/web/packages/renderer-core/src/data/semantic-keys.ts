/**
 * Canonical semantic-key vocabulary shared by host and editor (§93). Entries
 * define meaning/spelling, not runtime availability; providers report that.
 */

export type SensorTier = "baseline" | "extended";

/** Picker/display grouping order. */
export type SemanticFamily =
  | "cpu"
  | "ram"
  | "gpu"
  | "vram"
  | "disk"
  | "network";

export interface SemanticKeyDescriptor {
  readonly key: string;
  readonly family: SemanticFamily;
  readonly label: string;
  readonly unit?: string;
  /** Authoring hint, not a claim about this machine. */
  readonly expectedTier: SensorTier;
}

/** `family.quantity[.qualifier]`; availability is discovered separately. */
export const SEMANTIC_KEYS: readonly SemanticKeyDescriptor[] = [
  // CPU
  {
    key: "cpu.load",
    family: "cpu",
    label: "CPU load",
    unit: "%",
    expectedTier: "baseline",
  },
  {
    key: "cpu.temp",
    family: "cpu",
    label: "CPU temperature",
    unit: "°C",
    expectedTier: "extended",
  },
  {
    key: "cpu.power",
    family: "cpu",
    label: "CPU power",
    unit: "W",
    expectedTier: "extended",
  },
  {
    key: "cpu.clock",
    family: "cpu",
    label: "CPU clock",
    unit: "MHz",
    expectedTier: "extended",
  },
  {
    key: "cpu.fan",
    family: "cpu",
    label: "CPU fan",
    unit: "RPM",
    expectedTier: "extended",
  },

  // RAM absolute values and used share.
  {
    key: "ram.used",
    family: "ram",
    label: "RAM used",
    unit: "GB",
    expectedTier: "baseline",
  },
  {
    key: "ram.used.percent",
    family: "ram",
    label: "RAM used (share of total)",
    unit: "%",
    expectedTier: "baseline",
  },
  {
    key: "ram.total",
    family: "ram",
    label: "RAM total",
    unit: "GB",
    expectedTier: "baseline",
  },

  // GPU
  {
    key: "gpu.load",
    family: "gpu",
    label: "GPU load",
    unit: "%",
    expectedTier: "extended",
  },
  {
    key: "gpu.temp",
    family: "gpu",
    label: "GPU temperature",
    unit: "°C",
    expectedTier: "extended",
  },
  {
    key: "gpu.power",
    family: "gpu",
    label: "GPU power",
    unit: "W",
    expectedTier: "extended",
  },
  {
    key: "gpu.clock",
    family: "gpu",
    label: "GPU clock",
    unit: "MHz",
    expectedTier: "extended",
  },
  {
    key: "gpu.fan",
    family: "gpu",
    label: "GPU fan",
    unit: "RPM",
    expectedTier: "extended",
  },

  // VRAM is a separate family from system RAM.
  {
    key: "vram.used",
    family: "vram",
    label: "VRAM used",
    unit: "GB",
    expectedTier: "extended",
  },
  {
    key: "vram.used.percent",
    family: "vram",
    label: "VRAM used (share of total)",
    unit: "%",
    expectedTier: "extended",
  },
  {
    key: "vram.total",
    family: "vram",
    label: "VRAM total",
    unit: "GB",
    expectedTier: "extended",
  },

  // Declared ahead of their providers so themes/editors share stable names.
  {
    key: "disk.used",
    family: "disk",
    label: "Disk used",
    unit: "GB",
    expectedTier: "baseline",
  },
  {
    key: "disk.used.percent",
    family: "disk",
    label: "Disk used (share of total)",
    unit: "%",
    expectedTier: "baseline",
  },
  {
    key: "disk.total",
    family: "disk",
    label: "Disk total",
    unit: "GB",
    expectedTier: "baseline",
  },
  {
    key: "network.download",
    family: "network",
    label: "Network download",
    unit: "Mb/s",
    expectedTier: "baseline",
  },
  {
    key: "network.upload",
    family: "network",
    label: "Network upload",
    unit: "Mb/s",
    expectedTier: "baseline",
  },
];

const BY_KEY = new Map(
  SEMANTIC_KEYS.map((descriptor) => [descriptor.key, descriptor]),
);

/** Unknown keys remain valid for newer/custom sensors; callers can fall back to raw key. */
export function describeSemanticKey(
  key: string,
): SemanticKeyDescriptor | undefined {
  return BY_KEY.get(key);
}

export function isKnownSemanticKey(key: string): boolean {
  return BY_KEY.has(key);
}

/** Preserve unknown-key information by showing the raw key. */
export function labelForSemanticKey(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

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
