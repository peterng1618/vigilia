import * as echarts from "echarts/core";
import { BarChart, GaugeChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

/** Registers the narrow canvas-only ECharts feature set required by VigiliaChart. */
echarts.use([
  GaugeChart,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  CanvasRenderer,
]);
