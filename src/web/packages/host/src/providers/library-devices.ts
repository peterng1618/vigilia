import { diskDeviceId } from "@vigilia/renderer-core";
import { displayNameFor } from "../settings/devices.js";

/**
 * Which physical drive a volume lives on, and what the machine calls it.
 *
 * The library reports a volume's mount and capacity in one list, and a drive's
 * model in another, with no field in common: `fsSize()` knows `C:`, `diskLayout()`
 * knows `\\.\PHYSICALDRIVE1` and the model. Only `blockDevices()` carries both,
 * so resolving a drive model back to a volume is a three-way join. That is why
 * the volume is identified by its model — it is the one name both providers
 * agree on, so a consumer's choice reaches the same drive whichever provider
 * they chose it with.
 *
 * `serialNum` is deliberately absent from these shapes: a serial identifies an
 * instance on this PC, and a theme must not carry one.
 */

export interface VolumeLike {
  /** Drive letter or mount point, e.g. `C:`. */
  readonly mount?: string;
  /** The device path the volume sits on, as `fsSize` spells it. */
  readonly fs?: string;
  readonly size?: number;
  readonly used?: number;
}

export interface DriveLayoutLike {
  readonly name?: string;
  readonly device?: string;
}

export interface BlockDeviceLike {
  readonly mount?: string;
  readonly device?: string;
  /** The filesystem label ("Data"); not the drive's identity. */
  readonly label?: string;
}

/** A drive, and the volumes a consumer can reach it through. */
export interface DriveDevice {
  readonly deviceId: string;
  readonly name: string;
  readonly mounts: readonly string[];
}

function named(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** The volume's own path, which is what `fsSize` reports it under. */
function pathOf(volume: VolumeLike): string {
  return (volume.fs ?? volume.mount ?? "").replace(/\/$/, "");
}

/**
 * The drives this machine reports, each with the volumes it holds.
 *
 * A drive with several partitions appears once with several mounts, so a
 * consumer chooses a *drive* and every partition of it answers.
 */
export function drivesFrom(
  layout: readonly DriveLayoutLike[],
  volumes: readonly BlockDeviceLike[],
): readonly DriveDevice[] {
  const mountsOf = new Map<string, string[]>();

  for (const volume of volumes) {
    if (!named(volume.device) || !named(volume.mount)) {
      continue;
    }

    const existing = mountsOf.get(volume.device);
    if (existing === undefined) {
      mountsOf.set(volume.device, [volume.mount]);
    } else if (!existing.includes(volume.mount)) {
      existing.push(volume.mount);
    }
  }

  const seen = new Set<string>();
  const drives: DriveDevice[] = [];

  for (const entry of layout) {
    if (!named(entry.name) || !named(entry.device)) {
      continue;
    }

    const deviceId = diskDeviceId(entry.name);
    if (seen.has(deviceId)) {
      continue;
    }

    seen.add(deviceId);
    drives.push({
      deviceId,
      name: entry.name,
      mounts: mountsOf.get(entry.device) ?? [],
    });
  }

  return drives;
}

/** The drive a device id names, or undefined when this PC does not have it. */
export function driveFor(
  drives: readonly DriveDevice[],
  deviceId: string,
): DriveDevice | undefined {
  return drives.find((drive) => drive.deviceId === deviceId);
}

/** The volumes of one drive, in the order the machine lists them. */
export function volumesOf(
  filesystems: readonly VolumeLike[],
  drive: DriveDevice,
): readonly VolumeLike[] {
  return filesystems.filter((entry) =>
    drive.mounts.some((mount) => mount === pathOf(entry)),
  );
}

/** What the display calls a device: the consumer's choice, else its model. */
export function nameFor(
  names: Readonly<Record<string, string>> | undefined,
  deviceId: string,
  detectedName: string,
): string {
  return displayNameFor(names ?? {}, deviceId, detectedName);
}
