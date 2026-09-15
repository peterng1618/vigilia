import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

/**
 * Registers the ECharts pieces a Fabric chart object needs.
 *
 * ## Why this is a module side effect rather than the app's job
 *
 * `echarts/core` ships an empty registry and `echarts.use` fills it. Miss a
 * registration and `setOption` does not throw — the chart simply draws nothing,
 * which on a detached canvas is invisible until someone looks at a screenshot.
 * {@link VigiliaChart} calls `echarts.init`, so the registration belongs beside
 * it: importing the chart object is what guarantees the engine can draw it.
 *
 * Before this file, the list lived in `player/src/main.ts` and
 * `editor/src/main.ts` — twice — and `chart-object.ts` depended on one of them
 * having run without saying so. A third entry point, or a browser test that
 * mounted a chart directly, would have rendered blank.
 *
 * `echarts.use` is idempotent, so the app-level lists that still serve
 * `scene/mount.ts` cost nothing and are deleted with it in stage 2.
 *
 * ## The list is narrow on purpose, and canvas-only
 *
 * §47's budget depends on never importing the `echarts` default bundle. Only the
 * four v1 families are registered; `GridComponent` is what the cartesian
 * families need, and gauge and pie do not use it.
 *
 * **`CanvasRenderer` only.** A Fabric object draws by blitting a canvas, so
 * `SVGRenderer` cannot be reached through one at all — see spec 0013's accepted
 * compromises for what that costs.
 */
echarts.use([GaugeChart, LineChart, BarChart, PieChart, GridComponent, CanvasRenderer]);
