import {
  defaultBarSettings,
  defaultGaugeSettings,
  defaultLineSettings,
  defaultPieSettings,
  type FabricThemeEnvelope,
} from '@vigilia/renderer-core';

type ObjectJson = Readonly<Record<string, unknown>>;
type PathData = readonly (readonly [string, ...number[]])[];

// Authored positions are artboard top-left coordinates, never Fabric's centered defaults.
const positioned = { originX: 'left', originY: 'top' } as const;
const backgroundOnly = { ...positioned, selectable: false, evented: false } as const;
const text = '#ecf5ff';
const dim = '#a8bed0';
const panel = '#081523d9';

/** A mockup-inspired v2 starter scene, limited to currently revivable objects. */
export function createNewFabricTheme(): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: '7.4.0',
    id: 'vigilia-demo-dashboard',
    metadata: {
      name: 'Twilight system dashboard',
      author: 'Vigilia',
      description: 'A v2 scene exercising supported Fabric primitives and every chart family.',
    },
    artboard: { width: 1280, height: 720 },
    bindings: {
      'load-gauge': [{ id: 'cpu-load', semanticKey: 'cpu.load', precision: 0 }],
      'trend-line': [{ id: 'trend-cpu', semanticKey: 'cpu.load' }, { id: 'trend-gpu', semanticKey: 'gpu.load' }],
      'thermal-bars': [{ id: 'cpu-temperature', semanticKey: 'cpu.temp' }, { id: 'gpu-temperature', semanticKey: 'gpu.temp' }],
      'resource-pie': [
        { id: 'cpu-share', semanticKey: 'cpu.load' },
        { id: 'gpu-share', semanticKey: 'gpu.load' },
        { id: 'memory-share', semanticKey: 'memory.used' },
      ],
    },
    scene: {
      version: '7.4.0',
      objects: [
        rect('background', 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly),
        rect('header-wash', 0, 0, 1280, 142, '#06101a70', 0),
        label('wordmark', 54, 38, 520, 'V I G I L I A', 32, text, '500'),
        label('strapline', 58, 82, 520, 'YOUR SYSTEM. A CLEARER TOMORROW.', 12, dim, '400'),
        path('header-rule', 58, 109, [['M', 0, 0], ['L', 172, 0]], '#7dbde0', 1),
        label('motto', 1040, 42, 180, 'MONITOR\nOPTIMIZE\nSTAY IN FLOW', 11, dim, '500'),

        card('time-card', 52, 150, 260, 330),
        label('time', 78, 189, 210, '07:24', 70, text, '300'),
        label('time-period', 253, 251, 45, 'PM', 17, dim, '500'),
        label('date', 80, 288, 200, 'TUE, APR 23, 2024', 16, text, '400'),
        path('time-rule', 80, 335, [['M', 0, 0], ['L', 36, 0]], '#82c8e9', 2),
        label('time-quote', 80, 363, 180, '“A calmer system\nfor a brighter you.”', 14, dim, '400'),

        card('weather-card', 332, 150, 420, 152),
        path('weather-cloud-svg-path', 358, 190, cloudPath, '#b9d7f2', 0),
        label('weather-temperature', 442, 181, 100, '18°C', 36, text, '600'),
        label('weather-condition', 443, 227, 150, 'Mostly cloudy', 15, text, '400'),
        path('location-pin-svg-path', 613, 184, pinPath, '#8fc6e6', 0),
        label('weather-location', 634, 180, 100, 'Seattle, WA', 13, dim, '400'),
        label('weather-details', 634, 210, 100, 'H: 21°   L: 12°\nFeels like 17°', 13, text, '400'),

        card('gauge-card', 332, 322, 200, 176),
        path('cpu-icon-svg-path', 352, 344, chipPath, '#7ec7f0', 0),
        label('gauge-title', 383, 342, 100, 'CPU LOAD', 13, text, '600'),
        chart('load-gauge', 432, 418, 112, 88, 'gauge', {
          ...defaultGaugeSettings,
          thickness: 14,
          progress: { kind: 'gradient', stops: [{ offset: 0, color: '#41b8ff' }, { offset: 1, color: '#bc75ff' }] },
        }),
        label('gauge-caption', 364, 466, 140, 'LIVE', 11, dim, '500'),

        card('trend-card', 552, 322, 676, 176),
        path('trend-icon-svg-path', 574, 345, trendPath, '#a98bff', 1.5),
        label('trend-title', 607, 342, 220, 'PERFORMANCE TRENDS', 13, text, '600'),
        label('trend-legend', 989, 342, 190, '● CPU    ● GPU', 11, dim, '400'),
        chart('trend-line', 888, 428, 612, 92, 'line', {
          ...defaultLineSettings,
          palette: [{ kind: 'solid', color: '#4db8ff' }, { kind: 'solid', color: '#ae7cff' }],
          area: { kind: 'gradient', stops: [{ offset: 0, color: '#4db8ff66' }, { offset: 1, color: '#4db8ff00' }] },
          min: 0, max: 100, showAxes: false,
        }),

        card('thermal-card', 332, 518, 396, 154),
        path('thermal-icon-svg-path', 354, 540, thermometerPath, '#71e7c1', 0),
        label('thermal-title', 384, 538, 220, 'THERMAL HEADROOM', 13, text, '600'),
        chart('thermal-bars', 605, 607, 190, 54, 'bar', {
          ...defaultBarSettings,
          min: 20, max: 100, barWidth: 16,
          fill: { kind: 'gradient', stops: [{ offset: 0, color: '#48d9b0' }, { offset: 1, color: '#f3bb68' }] },
          track: { kind: 'solid', color: '#183145' },
        }),
        label('thermal-caption', 356, 642, 150, 'CPU & GPU · °C', 11, dim, '400'),

        card('resource-card', 748, 518, 250, 154),
        path('resource-icon-svg-path', 770, 540, resourcePath, '#f3c879', 0),
        label('resource-title', 800, 538, 150, 'RESOURCE MIX', 13, text, '600'),
        chart('resource-pie', 861, 613, 82, 82, 'pie', {
          ...defaultPieSettings,
          innerRadiusPercent: 64,
          padAngle: 3,
          palette: [{ kind: 'solid', color: '#4db8ff' }, { kind: 'solid', color: '#ae7cff' }, { kind: 'solid', color: '#48d9b0' }],
        }),
        label('resource-caption', 912, 596, 66, 'LIVE\nMIX', 11, dim, '500'),

        card('status-card', 1018, 518, 210, 154),
        path('signal-icon-svg-path', 1042, 541, signalPath, '#6ee1c0', 1.5),
        label('status-title', 1074, 538, 120, 'SYSTEM STATUS', 13, text, '600'),
        circle('status-dot', 1042, 587, 5, '#48d9b0'),
        label('status-main', 1058, 578, 140, 'All systems nominal', 13, text, '400'),
        path('status-rule', 1042, 609, [['M', 0, 0], ['L', 150, 0]], '#7dbde044', 1),
        label('status-caption', 1042, 625, 150, 'VIGILIA · LIVE DEMO', 11, dim, '500'),
      ],
    },
  };
}

function rect(id: string, left: number, top: number, width: number, height: number, fill: unknown, radius: number, interaction: ObjectJson = positioned): ObjectJson {
  return { type: 'Rect', id, left, top, width, height, fill, rx: radius, ry: radius, ...interaction };
}

function card(id: string, left: number, top: number, width: number, height: number): ObjectJson {
  return { ...rect(id, left, top, width, height, panel, 18), stroke: '#9fc7e52b', strokeWidth: 1 };
}

function circle(id: string, left: number, top: number, radius: number, fill: string): ObjectJson {
  return { type: 'Circle', id, left, top, radius, fill, ...positioned };
}

function label(id: string, left: number, top: number, width: number, value: string, fontSize: number, fill: string, fontWeight: string): ObjectJson {
  return { type: 'Textbox', id, left, top, width, text: value, fontFamily: 'Segoe UI, sans-serif', fontSize, fontWeight, fill, lineHeight: 1.18, ...positioned };
}

function path(id: string, left: number, top: number, points: PathData, colour: string, strokeWidth: number): ObjectJson {
  return strokeWidth === 0
    ? { type: 'Path', id, left, top, path: points, fill: colour, stroke: null, ...positioned }
    : { type: 'Path', id, left, top, path: points, fill: null, stroke: colour, strokeWidth, ...positioned };
}

function chart(id: string, left: number, top: number, width: number, height: number, family: string, settings: unknown): ObjectJson {
  return { type: 'VigiliaChart', id, left, top, width, height, family, settings, originX: 'center', originY: 'center' };
}

const twilightGradient = {
  type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: 720 },
  colorStops: [{ offset: 0, color: '#355473' }, { offset: 0.42, color: '#16283d' }, { offset: 1, color: '#07111d' }],
  offsetX: 0, offsetY: 0,
} as const;

// SVG paths, stored as the currently supported Fabric Path primitive.
const cloudPath: PathData = [['M', 13, 47], ['C', 5, 47, 0, 41, 0, 33], ['C', 0, 24, 7, 17, 17, 17], ['C', 21, 7, 29, 0, 40, 0], ['C', 53, 0, 64, 11, 64, 25], ['C', 71, 27, 76, 33, 76, 40], ['C', 76, 44, 73, 47, 69, 47], ['Z']];
const pinPath: PathData = [['M', 10, 0], ['C', 4, 0, 0, 5, 0, 11], ['C', 0, 19, 10, 28, 10, 28], ['C', 10, 28, 20, 19, 20, 11], ['C', 20, 5, 16, 0, 10, 0], ['Z'], ['M', 10, 7], ['C', 13, 7, 14, 11, 10, 14], ['C', 6, 11, 7, 7, 10, 7], ['Z']];
const chipPath: PathData = [['M', 6, 0], ['L', 26, 0], ['L', 26, 6], ['L', 32, 6], ['L', 32, 26], ['L', 26, 26], ['L', 26, 32], ['L', 6, 32], ['L', 6, 26], ['L', 0, 26], ['L', 0, 6], ['L', 6, 6], ['Z'], ['M', 9, 9], ['L', 23, 9], ['L', 23, 23], ['L', 9, 23], ['Z']];
const trendPath: PathData = [['M', 0, 24], ['L', 9, 15], ['L', 17, 20], ['L', 29, 5], ['L', 36, 11], ['M', 25, 5], ['L', 29, 5], ['L', 29, 9]];
const thermometerPath: PathData = [['M', 10, 0], ['L', 16, 0], ['L', 16, 18], ['C', 25, 29, 4, 35, 10, 18], ['Z'], ['M', 13, 10], ['L', 13, 24]];
const resourcePath: PathData = [['M', 0, 0], ['L', 24, 0], ['L', 24, 8], ['L', 0, 8], ['Z'], ['M', 0, 13], ['L', 24, 13], ['L', 24, 21], ['L', 0, 21], ['Z']];
const signalPath: PathData = [['M', 0, 24], ['C', 7, 14, 17, 14, 24, 24], ['M', 4, 29], ['C', 11, 20, 19, 20, 28, 29], ['M', 10, 34], ['C', 14, 29, 18, 29, 22, 34]];
