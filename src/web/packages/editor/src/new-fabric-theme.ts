import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import {
  clockCard,
  cpuCard,
  gpuCard,
  networkCard,
  ramCard,
  storageCard,
  trendsCard,
  vramCard,
} from "./new-fabric-theme-cards.js";
import {
  starterPalette,
  starterTypePresets,
} from "./new-fabric-theme-globals.js";
import { label } from "./new-fabric-theme-objects.js";
import { starterBackdrop } from "./starter-backdrop.js";

/**
 * The default scene a new theme starts from: the reference composition at the
 * reference's artboard size, with every card's reading bound to a key a
 * provider actually owns.
 *
 * Nothing here is created by saving this document. `onNew` builds one and mounts
 * it; `onOpenTheme` mounts the envelope a saved file already holds, so a change
 * here reaches a new theme and never rewrites a user's own.
 */
export function createNewFabricTheme(): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "vigilia-demo-dashboard",
    metadata: {
      name: "System dashboard",
      author: "Vigilia",
      description:
        "The reference composition: a clock, two usage cards, two memory rings, a performance chart and stacked storage and network panels.",
      // The editor's own copy is English, so a new theme starts where its
      // author does rather than guessing from the browser.
      locale: "en",
    },
    artboard: {
      width: 1672,
      height: 941,
      // Transparent, because the backdrop is a media layer mounted *below* the
      // canvas: an opaque artboard paint is exactly what would hide it. The
      // letterbox bars outside the artboard are `barColor`, which stays.
      background: { ref: "palette.none" },
      barColor: { ref: "palette.bars" },
      backgroundMedia: { assetId: starterBackdrop.id, fit: "cover" },
    },
    globals: {
      palette: starterPalette,
      typePresets: starterTypePresets,
    },
    assets: [starterBackdrop],
    bindings: {
      time: [{ id: "clock-time", semanticKey: "time.now", format: "hh:mm" }],
      "time-period": [
        { id: "clock-period", semanticKey: "time.now", format: "A" },
      ],
      date: [
        {
          id: "clock-date",
          semanticKey: "date.today",
          format: "ddd, MMM DD, YYYY",
        },
      ],
      "cpu-card-value": [
        { id: "cpu-card-load", semanticKey: "cpu.load", precision: 0 },
      ],
      "cpu-card-sparkline": [{ id: "cpu-card-spark", semanticKey: "cpu.load" }],
      // Three captions, each bound to the device the card's figures describe.
      // `cpu.brand` rather than `cpu.model`: the library reports all three and
      // the brand is the one that reads as a product name on a caption.
      "cpu-card-caption": [{ id: "cpu-card-model", semanticKey: "cpu.brand" }],
      // The reference writes GHz; the key reports MHz, so the binding scales and
      // the author writes the unit. A conversion of a real reading, not a unit
      // the provider cannot produce.
      "cpu-card-freq": [
        {
          id: "cpu-card-clock",
          semanticKey: "cpu.clock",
          scale: 0.001,
          precision: 1,
        },
      ],
      "gpu-card-value": [
        { id: "gpu-card-load", semanticKey: "gpu.load", precision: 0 },
      ],
      "gpu-card-sparkline": [{ id: "gpu-card-spark", semanticKey: "gpu.load" }],
      "gpu-card-caption": [{ id: "gpu-card-model", semanticKey: "gpu.name" }],
      "gpu-card-freq": [
        {
          id: "gpu-card-clock",
          semanticKey: "gpu.clock",
          scale: 0.001,
          precision: 1,
        },
      ],
      "gpu-card-temp": [
        { id: "gpu-card-temp", semanticKey: "gpu.temp", precision: 0 },
      ],
      "ram-gauge": [
        { id: "ram-gauge-percent", semanticKey: "ram.used.percent" },
      ],
      "ram-value": [{ id: "ram-percent", semanticKey: "ram.used.percent" }],
      "ram-capacity": [
        {
          id: "ram-used",
          semanticKey: "ram.used",
          precision: 1,
          unitDisplay: "none",
        },
        {
          id: "ram-total",
          semanticKey: "ram.total",
          precision: 0,
          unitDisplay: "none",
        },
      ],
      "vram-gauge": [
        { id: "vram-gauge-percent", semanticKey: "vram.used.percent" },
      ],
      "vram-value": [{ id: "vram-percent", semanticKey: "vram.used.percent" }],
      "vram-capacity": [
        {
          id: "vram-used",
          semanticKey: "vram.used",
          precision: 1,
          unitDisplay: "none",
        },
        {
          id: "vram-total",
          semanticKey: "vram.total",
          precision: 0,
          unitDisplay: "none",
        },
      ],
      "trends-chart": [
        { id: "trends-cpu", semanticKey: "cpu.load" },
        { id: "trends-gpu", semanticKey: "gpu.load" },
        { id: "trends-ram", semanticKey: "ram.used.percent" },
      ],
      "storage-card-value": [
        { id: "storage-percent", semanticKey: "disk.used.percent" },
      ],
      "storage-bar": [{ id: "storage-used", semanticKey: "disk.used.percent" }],
      "storage-card-name": [
        { id: "storage-card-volume", semanticKey: "disk.name" },
      ],
      "network-down": [
        {
          id: "network-download-label",
          semanticKey: "network.download",
          precision: 1,
        },
      ],
      "network-up": [
        {
          id: "network-upload-label",
          semanticKey: "network.upload",
          precision: 1,
        },
      ],
      "network-chart": [
        { id: "net-download", semanticKey: "network.download" },
        { id: "net-upload", semanticKey: "network.upload" },
      ],
    },
    scene: {
      version: "7.4.0",
      objects: [
        // The wordmark is tracked by its preset, not by spaces between the
        // letters: a space is a fixed width the font chooses, and it survives
        // into the text the author edits and the reading a screen reader gets.
        label("wordmark", 118, 56, 460, 40.68, "VIGILIA", 36, "text", "500"),
        label(
          "strapline",
          120,
          100,
          460,
          19.21,
          "SYSTEM INSIGHTS",
          17,
          "dim",
          "400",
        ),
        ...clockCard(),
        ...cpuCard(),
        ...gpuCard(),
        ...ramCard(),
        ...vramCard(),
        ...trendsCard(),
        ...storageCard(),
        ...networkCard(),
      ],
    },
  };
}
