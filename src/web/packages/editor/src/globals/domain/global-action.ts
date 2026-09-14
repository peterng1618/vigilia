import type { GlobalGroupName } from '@vigilia/renderer-core';

/**
 * What the globals panel asks for.
 *
 * ## Why it lives here and not in the panel
 *
 * It was declared in `globals-panel.ts`, the DOM module that emits it, while
 * the code that *interpreted* it sat at the bottom of `main.ts`. So the pure
 * half depended on a panel's vocabulary, which is the dependency the rest of
 * this package points the other way: the module that owns a concept is the one
 * that decides what it means, and a surface emits into it.
 *
 * Practically, that inversion is what let the interpretation drift out of
 * reach — two functions stranded below `start()`, next to nothing they were
 * about, imported by nothing else.
 *
 * Every variant names the group and (except `add`) the key, so applying one
 * never needs to consult the panel for context it did not send.
 */
export type GlobalAction =
  | { readonly kind: 'add'; readonly group: GlobalGroupName }
  | {
      readonly kind: 'value';
      readonly group: GlobalGroupName;
      readonly key: string;
      readonly value: unknown;
    }
  | {
      readonly kind: 'name';
      readonly group: GlobalGroupName;
      readonly key: string;
      readonly name: string;
    }
  | {
      readonly kind: 'key';
      readonly group: GlobalGroupName;
      readonly key: string;
      readonly nextKey: string;
    }
  | { readonly kind: 'delete'; readonly group: GlobalGroupName; readonly key: string };
