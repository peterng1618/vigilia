import { Group, type StaticCanvas } from 'fabric/es';
import { VIGILIA_TEXT_PROPERTY } from './fabric-text.js';
import { VIGILIA_PAINT_PROPERTY, type FabricPaintRefs } from './object-paint.js';

/** Rewrite persisted object/run palette references before a token is removed. */
export function reassignObjectPaletteReferences(canvas: StaticCanvas, from: `palette.${string}`, to: `palette.${string}`): number {
  let changes = 0;
  const visit = (objects: readonly Paintable[]): void => {
    for (const object of objects) {
      const paints = object.get(VIGILIA_PAINT_PROPERTY);
      if (isPaintRefs(paints)) {
        const next = Object.fromEntries(Object.entries(paints).map(([property, ref]) => {
          if (ref === from) { changes += 1; return [property, to]; }
          return [property, ref];
        }));
        object.set(VIGILIA_PAINT_PROPERTY, next);
      }
      const text = object.get(VIGILIA_TEXT_PROPERTY);
      if (isText(text)) {
        const runs = text.runs.map((run) => {
          const color = run.style?.color;
          if (color?.ref !== from) return run;
          changes += 1;
          return { ...run, style: { ...run.style, color: { ref: to } } };
        });
        object.set(VIGILIA_TEXT_PROPERTY, { ...text, runs });
      }
      if (object instanceof Group) visit(object.getObjects());
    }
  };
  visit(canvas.getObjects());
  return changes;
}

type Paintable = { get(name: string): unknown; set(name: string, value: unknown): unknown };
type TextRun = { style?: { color?: { ref?: string } }; [key: string]: unknown };
type AuthoredText = { runs: readonly TextRun[]; [key: string]: unknown };

function isPaintRefs(value: unknown): value is FabricPaintRefs {
  return typeof value === 'object' && value !== null && Object.values(value).every((ref) => typeof ref === 'string' && ref.startsWith('palette.'));
}
function isText(value: unknown): value is AuthoredText {
  return typeof value === 'object' && value !== null && Array.isArray((value as Record<string, unknown>)['runs']);
}
