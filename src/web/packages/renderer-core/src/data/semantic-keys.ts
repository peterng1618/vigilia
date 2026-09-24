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
  /**
   * The family a display's measurement preference converts, when it converts
   * this key. Absent means the reported unit is the only sensible one: a unit
   * preference must not pretend to cover families it cannot (spec 2026-09-24).
   */
  readonly converts?: "temperature";
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
    converts: "temperature",
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
    converts: "temperature",
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
  // The second disk slot. A theme showing two disks binds one to the system
  // slot and one to this, so neither names a specific drive and the theme works
  // on any machine (§145's device assignments decide which drive answers each).
  {
    key: "disk.data.used",
    family: "disk",
    label: "Data disk used",
    unit: "GB",
    expectedTier: "baseline",
  },
  {
    key: "disk.data.used.percent",
    family: "disk",
    label: "Data disk used (share of total)",
    unit: "%",
    expectedTier: "baseline",
  },
  {
    key: "disk.data.total",
    family: "disk",
    label: "Data disk total",
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

/**
 * A per-device disk key, e.g. `disk.nvme0.used`, `disk.volume.C.used.percent`.
 * A machine's drives are discovered at runtime, so these cannot be enumerated
 * in `SEMANTIC_KEYS`; the shape is still fixed, which is what themes and the
 * editor bind against. `<id>` is the device's own stable name, slugged.
 */
export interface DiskKeyDescriptor extends SemanticKeyDescriptor {
  readonly deviceId: string;
}

const DISK_KEY_PATTERN =
  /^disk\.([a-z0-9_-]{1,64})\.(used|used\.percent|total)$/;

export const DISK_DEVICE_QUANTITIES = [
  "used",
  "used.percent",
  "total",
] as const;

export type DiskDeviceQuantity = (typeof DISK_DEVICE_QUANTITIES)[number];

/** The device id a per-device key names, or undefined for any other key. */
export function diskDeviceOf(key: string): string | undefined {
  return DISK_KEY_PATTERN.exec(key)?.[1];
}

/** Slug for a device's model/name so it can appear in a semantic key. */
export function diskDeviceId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "disk"
  );
}

/** Builds the vocabulary descriptor for a discovered device key. */
export function describeDiskKey(
  key: string,
  deviceName?: string,
): DiskKeyDescriptor | undefined {
  const match = DISK_KEY_PATTERN.exec(key);
  if (match === null) {
    return undefined;
  }

  const deviceId = match[1]!;
  const quantity = match[2] as DiskDeviceQuantity;
  const label = QUANTITY_LABEL[quantity];

  return {
    key,
    family: "disk",
    deviceId,
    label: `${deviceName ?? deviceId} ${label.text}`,
    unit: label.unit,
    expectedTier: "baseline",
  };
}

const QUANTITY_LABEL: Record<
  DiskDeviceQuantity,
  { readonly text: string; readonly unit: string }
> = {
  used: { text: "used", unit: "GB" },
  "used.percent": { text: "used (share)", unit: "%" },
  total: { text: "total", unit: "GB" },
};

/** Unknown keys remain valid for newer/custom sensors; callers can fall back to raw key. */
export function describeSemanticKey(
  key: string,
): SemanticKeyDescriptor | undefined {
  return BY_KEY.get(key) ?? describeDiskKey(key);
}

export function isKnownSemanticKey(key: string): boolean {
  return BY_KEY.has(key) || DISK_KEY_PATTERN.test(key);
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
