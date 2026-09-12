import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the C# ↔ TypeScript mirror that AGENTS.md calls the highest-risk edit
 * in the repository.
 *
 * `src/Vigilia.Contracts/*.cs` and `renderer-core/src/types.ts` describe the
 * same wire shapes and are maintained by hand. A change to one compiles cleanly
 * on both sides and produces wrong values at runtime — a temperature rendered
 * as a fan speed, a status silently reading as `ok`. Nothing enforced agreement.
 *
 * ## Why this parses source text
 *
 * The honest options were: parse both sides, generate one from the other, or
 * carry on hoping. Generation is the right long-term answer and needs a .NET SDK
 * to exist first; there is none on this machine, so nothing generated could even
 * be built. Parsing text is available **today**, and a guard that exists beats a
 * better guard that does not.
 *
 * It is deliberately narrow: property names and enum members of the three shapes
 * the renderer actually consumes. It does not check types, nullability or
 * ordering, and it would not notice `double` becoming `float`. What it does
 * notice is the failure that has actually happened in projects like this one —
 * a field added, renamed or removed on one side only.
 *
 * ## When this fails
 *
 * Read the message. It names the side that has a member the other lacks. Fix
 * whichever is wrong, in the same commit, and do not "fix" the test by widening
 * the lists — that is the whole hazard it exists to catch.
 */

// fileURLToPath, not URL.pathname: on Windows the latter yields "/D:/..." and
// every fs call then fails to resolve it.
const CONTRACTS = fileURLToPath(new URL('../../../../Vigilia.Contracts/', import.meta.url));
const TYPES_TS = fileURLToPath(new URL('./types.ts', import.meta.url));

function csharp(file: string): string {
  return readFileSync(`${CONTRACTS}${file}`, 'utf8');
}

/**
 * Property names of a C# record, lowercased.
 *
 * Matches `public required Type Name { get; init; }` and its variants, and
 * deliberately stops at the record's closing brace so the static factory methods
 * below it are not mistaken for properties.
 */
function csharpProperties(source: string, recordName: string): string[] {
  const start = source.indexOf(`record ${recordName}`);

  if (start === -1) {
    throw new Error(`No record named ${recordName}. It was renamed or removed.`);
  }

  // Brace-matched, not sliced to end of file. Sample.cs also declares
  // SampleBatch, and reading to the end collected *its* properties as Sample's —
  // the first version of this test failed on that rather than on real drift.
  const body = braceBody(source, start);
  const names: string[] = [];

  // `{ get;` is what distinguishes a property from a method or a field.
  const pattern = /public\s+(?:required\s+)?[\w?<>.[\]]+\s+(\w+)\s*\{\s*get;/g;
  let match = pattern.exec(body);

  while (match !== null) {
    names.push(match[1]!.toLowerCase());
    match = pattern.exec(body);
  }

  return names.sort();
}

/**
 * The braced block that follows `from`, without its outer braces.
 *
 * Counts depth rather than finding the first `}`, so nested property bodies and
 * object initialisers inside the declaration do not end it early.
 */
function braceBody(source: string, from: number): string {
  const open = source.indexOf('{', from);

  if (open === -1) {
    return '';
  }

  let depth = 0;

  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, i);
      }
    }
  }

  return source.slice(open + 1);
}

/** Member names of a C# enum, lowercased. */
function csharpEnumMembers(source: string, enumName: string): string[] {
  const start = source.indexOf(`enum ${enumName}`);

  if (start === -1) {
    throw new Error(`No enum named ${enumName}. It was renamed or removed.`);
  }

  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  const body = source.slice(open + 1, close);

  const names: string[] = [];
  // `Name = 0,` — the explicit values are what the wire format transmits, so
  // members without one would be a separate problem.
  const pattern = /^\s*(\w+)\s*=\s*\d+\s*,/gm;
  let match = pattern.exec(body);

  while (match !== null) {
    names.push(match[1]!.toLowerCase());
    match = pattern.exec(body);
  }

  return names.sort();
}

/** Property names of a TypeScript interface, lowercased. */
function tsInterfaceProperties(source: string, interfaceName: string): string[] {
  const start = source.indexOf(`interface ${interfaceName} {`);

  if (start === -1) {
    throw new Error(`No interface named ${interfaceName}. It was renamed or removed.`);
  }

  const open = source.indexOf('{', start);
  const close = source.indexOf('\n}', open);
  const body = source.slice(open + 1, close);

  const names: string[] = [];
  const pattern = /^\s*readonly\s+(\w+)\??:/gm;
  let match = pattern.exec(body);

  while (match !== null) {
    names.push(match[1]!.toLowerCase());
    match = pattern.exec(body);
  }

  return names.sort();
}

/** Members of a TypeScript string-literal union, lowercased. */
function tsUnionMembers(source: string, typeName: string): string[] {
  const pattern = new RegExp(`type ${typeName}\\s*=([^;]+);`);
  const match = pattern.exec(source);

  if (match === null) {
    throw new Error(`No type alias named ${typeName}. It was renamed or removed.`);
  }

  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!.toLowerCase()).sort();
}

/** Explains a mismatch in terms of which side is missing what. */
function describeDrift(name: string, csharpSide: string[], tsSide: string[]): string {
  const onlyCs = csharpSide.filter((member) => !tsSide.includes(member));
  const onlyTs = tsSide.filter((member) => !csharpSide.includes(member));

  return [
    `${name} has drifted between C# and TypeScript.`,
    onlyCs.length > 0 ? `  Only in Vigilia.Contracts: ${onlyCs.join(', ')}` : '',
    onlyTs.length > 0 ? `  Only in renderer-core/src/types.ts: ${onlyTs.join(', ')}` : '',
    '  Change both sides in the same commit. Do not widen this test.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

describe('Vigilia.Contracts ↔ renderer-core/src/types.ts', () => {
  const typesTs = readFileSync(TYPES_TS, 'utf8');

  it('finds both sides at all', () => {
    // A silently unresolvable path would make every assertion below vacuous —
    // the exact failure mode a guard must not have.
    expect(csharp('Sample.cs').length).toBeGreaterThan(0);
    expect(typesTs.length).toBeGreaterThan(0);
  });

  it('agrees on the members of Sample', () => {
    const cs = csharpProperties(csharp('Sample.cs'), 'Sample');
    const ts = tsInterfaceProperties(typesTs, 'Sample');

    expect(cs.length).toBeGreaterThan(4);
    expect(ts, describeDrift('Sample', cs, ts)).toEqual(cs);
  });

  it('agrees on the members of SensorStatus', () => {
    // The highest-consequence of the three: §83's gap rule branches on this, so
    // a member present on one side only means a status that renders as `ok`.
    const cs = csharpEnumMembers(csharp('SensorEnums.cs'), 'SensorStatus');
    const ts = tsUnionMembers(typesTs, 'SensorStatus');

    expect(cs).toContain('unavailable');
    expect(ts, describeDrift('SensorStatus', cs, ts)).toEqual(cs);
  });

  it('reports a missing record or enum instead of passing vacuously', () => {
    // A rename must fail loudly. Silently finding nothing and comparing two
    // empty lists would be the worst possible outcome.
    expect(() => csharpProperties(csharp('Sample.cs'), 'NotARecord')).toThrow(/renamed or removed/);
    expect(() => csharpEnumMembers(csharp('SensorEnums.cs'), 'NotAnEnum')).toThrow(
      /renamed or removed/,
    );
    expect(() => tsInterfaceProperties(typesTs, 'NotAnInterface')).toThrow(/renamed or removed/);
    expect(() => tsUnionMembers(typesTs, 'NotAUnion')).toThrow(/renamed or removed/);
  });

  it('parses the C# side the way the file is actually written', () => {
    // Pins the parser against the real file: if the C# style changes — primary
    // constructors, expression-bodied properties — these break and the parser
    // needs updating rather than quietly matching nothing.
    const sample = csharpProperties(csharp('Sample.cs'), 'Sample');

    expect(sample).toContain('sensorid');
    expect(sample).toContain('timestamp');
    expect(sample).toContain('status');
    expect(sample).toContain('value');
    // A static factory returning Sample must NOT be collected as a property.
    expect(sample).not.toContain('ok');
  });

  it('does not claim to check types, only membership', () => {
    // Stated as a test so the limitation is visible where the guard lives, not
    // only in a comment someone may not read. `Timestamp` is DateTimeOffset in
    // C# and an ISO-8601 string in TypeScript — deliberately, and this guard
    // cannot see that.
    expect(csharp('Sample.cs')).toContain('DateTimeOffset Timestamp');
    expect(typesTs).toContain('readonly timestamp: string');
  });
});
