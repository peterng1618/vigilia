import type { FabricThemeEnvelope } from '@vigilia/renderer-core';

/** The editor's development fixture is the same v2 envelope that Open revives. */
export function createNewFabricTheme(): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: '7.4.0',
    id: 'demo',
    artboard: { width: 1280, height: 720 },
    scene: {
      version: '7.4.0',
      objects: [
        { type: 'Rect', id: 'background', left: 0, top: 0, width: 1280, height: 720, fill: '#0c1018', selectable: false, evented: false },
        { type: 'Textbox', id: 'title', left: 56, top: 42, width: 700, text: 'Vigilia  demo dashboard', fontSize: 32, fontWeight: '600', fill: '#e8ecf3', selectable: false, evented: false },
        { type: 'Textbox', id: 'subtitle', left: 58, top: 88, width: 700, text: 'Fabric v2 development theme', fontSize: 16, fill: '#8a97ab', selectable: false, evented: false },
        ...card('cpu-card', 56, 152, 'CPU', '65%', '#00b8d9'),
        ...card('gpu-card', 322, 152, 'GPU', '46%', '#7c6ae6'),
        { type: 'Rect', id: 'load-card', left: 588, top: 152, width: 636, height: 252, rx: 18, ry: 18, fill: '#171d29', selectable: false, evented: false },
        { type: 'Textbox', id: 'load-label', left: 614, top: 176, width: 300, text: 'Load · last 60 s', fontSize: 16, fill: '#8a97ab', selectable: false, evented: false },
        { type: 'Path', id: 'load-area', left: 614, top: 228, path: [['M', 0, 120], ['L', 70, 15], ['L', 140, 112], ['L', 240, 70], ['L', 330, 118], ['L', 450, 12], ['L', 580, 120], ['Z']], fill: '#00b8d955', stroke: '#00b8d9', strokeWidth: 3, selectable: false, evented: false },
        { type: 'Rect', id: 'temperature-card', left: 56, top: 430, width: 510, height: 226, rx: 18, ry: 18, fill: '#171d29', selectable: false, evented: false },
        { type: 'Textbox', id: 'temperature-label', left: 82, top: 454, width: 380, text: 'Temperatures · thresholds per bar', fontSize: 16, fill: '#8a97ab', selectable: false, evented: false },
        { type: 'Rect', id: 'temperature-track', left: 82, top: 508, width: 456, height: 12, rx: 6, ry: 6, fill: '#2a3242', selectable: false, evented: false },
        { type: 'Rect', id: 'temperature-value', left: 82, top: 508, width: 258, height: 12, rx: 6, ry: 6, fill: '#42c98f', selectable: false, evented: false },
        { type: 'Textbox', id: 'temperature-readout', left: 82, top: 542, width: 430, text: 'CPU package  54.8°C', fontSize: 17, fill: '#e8ecf3', selectable: false, evented: false },
        { type: 'Rect', id: 'memory-card', left: 588, top: 430, width: 636, height: 226, rx: 18, ry: 18, fill: '#171d29', selectable: false, evented: false },
        { type: 'Circle', id: 'memory-ring', left: 636, top: 472, radius: 70, fill: 'transparent', stroke: '#2a3242', strokeWidth: 26, selectable: false, evented: false },
        { type: 'Circle', id: 'memory-value', left: 636, top: 472, radius: 70, fill: 'transparent', stroke: '#7c6ae6', strokeWidth: 26, startAngle: -90, endAngle: 140, selectable: false, evented: false },
        { type: 'Textbox', id: 'memory-readout', left: 824, top: 495, width: 300, text: '20.2 GB', fontSize: 42, fontWeight: '600', fill: '#e8ecf3', selectable: false, evented: false },
        { type: 'Textbox', id: 'memory-caption', left: 828, top: 550, width: 300, text: 'Memory · 32 GB installed', fontSize: 16, fill: '#8a97ab', selectable: false, evented: false },
      ].map(({ selectable: _selectable, evented: _evented, ...object }) => ({
        originX: 'left', originY: 'top', ...object,
      })),
    },
  };
}

function card(id: string, left: number, top: number, label: string, value: string, colour: string): readonly Readonly<Record<string, unknown>>[] {
  return [
    { type: 'Rect', id, left, top, width: 242, height: 252, rx: 18, ry: 18, fill: '#171d29', selectable: false, evented: false },
    { type: 'Circle', id: `${id}-ring`, left: left + 58, top: top + 56, radius: 62, fill: 'transparent', stroke: '#2a3242', strokeWidth: 12, selectable: false, evented: false },
    { type: 'Textbox', id: `${id}-value`, left: left + 57, top: top + 111, width: 130, text: value, fontSize: 36, fontWeight: '600', textAlign: 'center', fill: '#e8ecf3', selectable: false, evented: false },
    { type: 'Textbox', id: `${id}-label`, left: left + 26, top: top + 205, width: 190, text: label, fontSize: 17, textAlign: 'center', fill: colour, selectable: false, evented: false },
  ];
}
