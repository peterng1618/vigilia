/**
 * `lucide-react@1.48.0` keeps each glyph's node array in its own module as
 * `__iconData` and exports it there. The package root re-exports the React
 * components, which wrap the same array in a `forwardRef` object with no way
 * back to it — and a React component is not something a Fabric scene can
 * author, since the scene is geometry. The editor reads the modules instead,
 * so a lucide upgrade moves the starter's icons with it.
 *
 * The shapes below are the ones `createLucideIcon` consumes. Attributes are the
 * SVG presentation and geometry attributes Lucide emits; a starter icon only
 * reads `d` and the `rect` fields, and the converter refuses anything else.
 */
declare module "lucide-react/dist/esm/icons/*" {
  export const __iconData: {
    readonly name: string;
    readonly size: number;
    readonly node: ReadonlyArray<
      readonly [string, Readonly<Record<string, string | number | undefined>>]
    >;
  };
}
