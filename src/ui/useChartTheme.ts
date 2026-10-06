import { shallowRef, onMounted, onUnmounted } from "vue";

export interface ChartTheme {
  text: string;
  grid: string;
  series: string[];
  ink: string;
  accent: string;
  danger: string;
  subtle: string;
  selection: string;
  bands: string[];
}

const SERIES = 6;

/** Reads the chart palette from the CSS tokens defined in style.css. */
function readTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    text: token("--ui-muted"),
    grid: token("--ui-line"),
    series: Array.from({ length: SERIES }, (_, i) =>
      token(`--ui-series-${i + 1}`),
    ),
    ink: token("--ui-ink"),
    accent: token("--ui-accent"),
    danger: token("--ui-danger"),
    subtle: token("--ui-subtle"),
    selection: token("--ui-plot-selection"),
    bands: [token("--ui-plot-band-1"), token("--ui-plot-band-2")],
  };
}

/** Series colour for any index; wraps once the palette is exhausted. */
export function seriesColor(theme: ChartTheme, index: number) {
  return theme.series[index % theme.series.length];
}

export function useChartTheme() {
  const theme = shallowRef<ChartTheme>(readTheme());
  let observer: MutationObserver | undefined;
  function update() {
    theme.value = readTheme();
  }
  onMounted(() => {
    update();
    observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  });
  onUnmounted(() => observer?.disconnect());
  return theme;
}
