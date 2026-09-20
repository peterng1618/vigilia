/** Shared editor control styles using semantic CSS variables. */

export interface ButtonOptions {
  readonly text: string;
  readonly title: string;
  readonly dataset?: Readonly<Record<string, string>>;
  readonly onClick: () => void;
  readonly flex?: string;
  readonly width?: string;
  readonly height?: string;
  readonly fontSize?: string;
  readonly padding?: string;
  readonly variant?: "solid" | "ghost";
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = options.text;
  button.title = options.title;

  for (const [key, value] of Object.entries(options.dataset ?? {})) {
    button.dataset[key] = value;
  }

  button.style.cssText = buttonStyle(options);
  button.addEventListener("click", options.onClick);
  return button;
}

export function buttonStyle(
  options: Pick<
    ButtonOptions,
    "flex" | "width" | "height" | "fontSize" | "padding" | "variant"
  > = {},
): string {
  return [
    `flex:${options.flex ?? "none"}`,
    options.width === undefined ? undefined : `width:${options.width}`,
    `height:${options.height ?? "22px"}`,
    `padding:${options.padding ?? "0 8px"}`,
    `background:${options.variant === "ghost" ? "none" : "var(--vigilia-control-bg)"}`,
    "color:var(--vigilia-muted)",
    `border:1px solid ${options.variant === "ghost" ? "transparent" : "var(--vigilia-control-border)"}`,
    "border-radius:3px",
    "cursor:pointer",
    `font:${options.fontSize ?? "11px"}/1 system-ui,sans-serif`,
    "min-width:0",
  ]
    .filter((part) => part !== undefined)
    .join(";");
}

export function inputStyle(font = "12px/1.4 ui-monospace,monospace"): string {
  return [
    "flex:1",
    "min-width:0",
    "background:var(--vigilia-input-bg)",
    "color:var(--vigilia-text)",
    "border:1px solid var(--vigilia-control-border)",
    "border-radius:3px",
    "padding:2px 5px",
    `font:${font}`,
  ].join(";");
}

/** Shared scrolling treatment; reserves scrollbar space and suppresses horizontal bars. */
export function scrollAreaStyle(extra = ""): string {
  return [
    "overflow-y:auto",
    "overflow-x:hidden",
    "scrollbar-gutter:stable",
    "min-height:0",
    "min-width:0",
    extra,
  ]
    .filter((part) => part !== "")
    .join(";");
}

export function sectionHeadingStyle(margin = "14px 2px 10px"): string {
  return [
    `margin:${margin}`,
    "font-size:11px",
    "text-transform:uppercase",
    "letter-spacing:0.06em",
    "color:var(--vigilia-muted)",
    "font-weight:600",
  ].join(";");
}
