import { MAX_ARTBOARD_DIMENSION, type Artboard, type AssetReference, type Globals, type ThemeMetadata } from '@vigilia/renderer-core';

export interface ArtboardPanel {
  readonly root: HTMLElement;
  render(artboard: Artboard, metadata?: ThemeMetadata): void;
  setGlobals(globals: Globals | undefined): void;
  setAssets(assets: readonly AssetReference[]): void;
}

export interface ThemeSettingsOptions {
  readonly assets?: readonly AssetReference[];
  readonly onMetadataChange?: (metadata: ThemeMetadata) => void;
}

/** Product-owned document preview controls; Fabric objects retain their geometry. */
export function createArtboardPanel(
  host: HTMLElement,
  globals: Globals | undefined,
  onChange: (artboard: Artboard) => void,
  options: ThemeSettingsOptions = {},
): ArtboardPanel {
  const root = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Theme settings';
  const name = textInput('Name', 'vigiliaThemeName');
  const author = textInput('Author', 'vigiliaThemeAuthor');
  const description = textInput('Description', 'vigiliaThemeDescription');
  const version = textInput('Release version', 'vigiliaThemeVersion');
  const width = dimensionInput('Width');
  const height = dimensionInput('Height');
  const label = document.createElement('label');
  label.textContent = 'Preview fit';
  const select = document.createElement('select');
  select.dataset['vigiliaArtboardFitMode'] = '';
  for (const fitMode of ['contain', 'cover'] as const) {
    const option = document.createElement('option');
    option.value = fitMode;
    option.textContent = fitMode[0]!.toUpperCase() + fitMode.slice(1);
    select.append(option);
  }
  const background = paletteInput('Background', 'background');
  const bars = paletteInput('Bar colour', 'barColor');
  const media = document.createElement('select');
  media.dataset['vigiliaBackgroundAsset'] = '';
  const mediaFit = document.createElement('select');
  mediaFit.dataset['vigiliaBackgroundMediaFit'] = '';
  for (const fit of ['cover', 'contain'] as const) mediaFit.append(new Option(fit, fit));
  refreshMediaOptions(media, options.assets);
  refreshPaletteOptions(background.select, globals);
  refreshPaletteOptions(bars.select, globals);
  let current: Artboard;
  let currentMetadata: ThemeMetadata | undefined;
  const submit = (): void => {
    const nextWidth = Number(width.input.value);
    const nextHeight = Number(height.input.value);
    if (!isDimension(nextWidth) || !isDimension(nextHeight)) {
      render(current);
      return;
    }
    const next: Artboard = {
      ...current,
      width: nextWidth,
      height: nextHeight,
      fitMode: select.value === 'cover' ? 'cover' : 'contain',
    };
    setPaletteReference(next, 'background', background.select.value, current.background);
    setPaletteReference(next, 'barColor', bars.select.value, current.barColor);
    onChange(media.value === ''
      ? omitBackgroundMedia(next)
      : { ...next, backgroundMedia: { assetId: media.value, fit: mediaFit.value === 'contain' ? 'contain' : 'cover' } });
  };
  const submitMetadata = (): void => {
    const next = compactMetadata({ name: name.input.value, author: author.input.value, description: description.input.value, version: version.input.value });
    currentMetadata = next;
    options.onMetadataChange?.(next);
  };
  width.input.addEventListener('change', submit);
  height.input.addEventListener('change', submit);
  select.addEventListener('change', submit);
  background.select.addEventListener('change', submit);
  bars.select.addEventListener('change', submit);
  media.addEventListener('change', submit);
  mediaFit.addEventListener('change', submit);
  name.input.addEventListener('change', submitMetadata);
  author.input.addEventListener('change', submitMetadata);
  description.input.addEventListener('change', submitMetadata);
  version.input.addEventListener('change', submitMetadata);
  root.append(
    heading,
    name.label, name.input, author.label, author.input, description.label, description.input, version.label, version.input,
    width.label, width.input,
    height.label, height.input,
    label, select,
    background.label, background.select,
    bars.label, bars.select,
    Object.assign(document.createElement('label'), { textContent: 'Background media' }), media,
    Object.assign(document.createElement('label'), { textContent: 'Media fit' }), mediaFit,
  );
  host.append(root);

  const render = (artboard: Artboard, metadata: ThemeMetadata | undefined = currentMetadata): void => {
    current = artboard;
    currentMetadata = metadata;
    width.input.value = String(artboard.width);
    height.input.value = String(artboard.height);
    select.value = artboard.fitMode ?? 'contain';
    background.select.value = paletteReference(artboard.background);
    bars.select.value = paletteReference(artboard.barColor);
    media.value = artboard.backgroundMedia?.assetId ?? '';
    mediaFit.value = artboard.backgroundMedia?.fit ?? 'cover';
    name.input.value = metadata?.name ?? '';
    author.input.value = metadata?.author ?? '';
    description.input.value = metadata?.description ?? '';
    version.input.value = metadata?.version ?? '';
  };

  return {
    root,
    render,
    setGlobals(nextGlobals) {
      refreshPaletteOptions(background.select, nextGlobals);
      refreshPaletteOptions(bars.select, nextGlobals);
      render(current);
    },
    setAssets(assets) {
      const selected = media.value;
      media.replaceChildren();
      refreshMediaOptions(media, assets);
      media.value = selected;
    },
  };
}

function textInput(text: string, data: 'vigiliaThemeName' | 'vigiliaThemeAuthor' | 'vigiliaThemeDescription' | 'vigiliaThemeVersion'): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const input = document.createElement('input');
  input.dataset[data] = '';
  return { label, input };
}

function compactMetadata(metadata: ThemeMetadata): ThemeMetadata {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== '')) as ThemeMetadata;
}

function refreshMediaOptions(select: HTMLSelectElement, assets: readonly AssetReference[] | undefined): void {
  select.append(new Option('None', ''));
  for (const asset of assets ?? []) {
    if (asset.kind === 'image' || asset.kind === 'svg' || asset.kind === 'video') select.append(new Option(asset.id, asset.id));
  }
}

function omitBackgroundMedia(artboard: Artboard): Artboard {
  const { backgroundMedia: _backgroundMedia, ...withoutMedia } = artboard;
  return withoutMedia;
}

function paletteInput(
  text: string,
  property: 'background' | 'barColor',
): { readonly label: HTMLLabelElement; readonly select: HTMLSelectElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const select = document.createElement('select');
  select.dataset[`vigiliaArtboard${property[0]!.toUpperCase()}${property.slice(1)}`] = '';
  return { label, select };
}

function refreshPaletteOptions(select: HTMLSelectElement, globals: Globals | undefined): void {
  const value = select.value;
  select.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Not set';
  select.append(none);
  for (const [id, entry] of Object.entries(globals?.palette ?? {})) {
    const option = document.createElement('option');
    option.value = `palette.${id}`;
    option.textContent = entry.name;
    select.append(option);
  }
  select.value = value;
}

function paletteReference(value: Artboard['background']): string {
  return value !== undefined && 'ref' in value && value.ref.startsWith('palette.') ? value.ref : '';
}

function setPaletteReference(
  artboard: { background?: Artboard['background']; barColor?: Artboard['barColor'] },
  property: 'background' | 'barColor',
  value: string,
  current: Artboard['background'],
): void {
  if (value === '') {
    if (current === undefined || ('ref' in current && current.ref.startsWith('palette.'))) delete artboard[property];
    return;
  }
  artboard[property] = { ref: value as `palette.${string}` };
}

function dimensionInput(text: string): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = text;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = String(MAX_ARTBOARD_DIMENSION);
  input.step = '1';
  input.dataset[`vigiliaArtboard${text}`] = '';
  return { label, input };
}

function isDimension(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_ARTBOARD_DIMENSION;
}
