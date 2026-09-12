import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { buildGaugeOption, defaultGaugeSettings, type Sample } from '@vigilia/renderer-core';

/**
 * Display-only player entry point.
 *
 * SCAFFOLD STATUS: renders one demo gauge from a local waveform. The SignalR
 * transport, theme document loading and pairing are Gate 1/Gate 3 work.
 *
 * §116/§122: the phone renders; the PC acquires. This bundle must never poll
 * hardware, fetch API sensors, or hold an unbounded history — it draws whatever
 * snapshot it was last given.
 */

// Import only what is used. §47's small-bundle requirement depends on this
// staying a narrow list — never switch to the `echarts` default bundle here.
echarts.use([GaugeChart, CanvasRenderer]);

const host = document.querySelector<HTMLElement>('#artboard');

if (!host) {
  throw new Error('Artboard host element is missing.');
}

const chart = echarts.init(host, undefined, { renderer: 'canvas' });

/**
 * Local demo waveform.
 *
 * §122 allows phone animations to interpolate locally, but they "must not imply
 * additional measured samples". This placeholder exists only so the scaffold
 * renders something; it is NOT a sample source and must be deleted once the
 * transport lands.
 */
function demoSample(tick: number): Sample {
  const period = 120;
  const position = tick % (period * 2);
  const ramp = position < period ? position / period : 2 - position / period;

  return {
    sensorId: 'demo.cpu.load',
    timestamp: new Date().toISOString(),
    status: 'ok',
    value: ramp * 100,
    unit: '%',
  };
}

let tick = 0;
let running = true;

function frame(): void {
  if (!running) {
    return;
  }

  const option = buildGaugeOption(
    {
      ...defaultGaugeSettings,
      progress: {
        kind: 'gradient',
        stops: [
          { offset: 0, color: '#00b8d9' },
          { offset: 1, color: '#ff4d4f' },
        ],
      },
    },
    demoSample(tick++),
  );

  // The single engine boundary. `GaugeOption` is our own reviewable shape (§87:
  // typed settings, no raw executable options), and ECharts' option type is an
  // open index-signature record, so the two are structurally incompatible by
  // design. Cast exactly here and nowhere else — if this cast starts appearing
  // in feature code, the typed-settings boundary has been breached.
  chart.setOption(option as unknown as EChartsCoreOption);

  requestAnimationFrame(frame);
}

// §124: pause unnecessary rendering when hidden or disconnected.
document.addEventListener('visibilitychange', () => {
  running = document.visibilityState === 'visible';
  if (running) {
    requestAnimationFrame(frame);
  }
});

// §51: one uniform transform for the whole artboard. Resizing the chart is the
// scaffold stand-in for that transform, which arrives with the renderer in Gate 1.
window.addEventListener('resize', () => chart.resize());

requestAnimationFrame(frame);
