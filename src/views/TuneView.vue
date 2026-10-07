<template>
  <EmptyState v-if="!bb.isLoaded" />
  <div v-else class="flex min-w-0 flex-col gap-3">
    <LogSummary />

    <Panel title="Step response" :description="stepDescription">
      <p
        v-if="!closedLoop.known"
        role="status"
        class="flex items-start gap-2 text-sm text-muted"
      >
        <Icon name="warning" class="text-warning" />In Manual mode the sticks
        drive the {{ bb.isRoverLog ? "steering" : "control surfaces" }}
        directly, so gyro does not track setpoint. This log cannot tell Manual
        flight apart; enable the
        {{ bb.isRoverLog ? "Rover" : "Wing" }} blackbox debug mode to get a step
        response from the stabilized sections.
      </p>
      <div
        v-else
        class="grid gap-6"
        :class="axes.length == 1 ? 'max-w-xl' : 'lg:grid-cols-3'"
      >
        <section v-for="axis in axes" :key="axis.index" class="min-w-0">
          <h3 class="flex items-baseline justify-between gap-2 text-sm">
            <span class="font-semibold">{{ axis.name }}</span>
            <span class="text-xs text-muted tabular-nums">
              {{ axis.gains }}
            </span>
          </h3>
          <StepResponsePlot
            :response="steps[axis.index]"
            :sample-frequency="bb.sampleFrequency"
            :loading="stepLoading"
          />
          <p
            v-if="steps[axis.index]"
            class="mt-1 flex items-center gap-1.5 text-xs text-muted tabular-nums"
          >
            <Icon
              v-if="steps[axis.index]!.windows < MIN_RELIABLE_WINDOWS"
              name="warning"
              class="text-warning"
            />
            {{ steps[axis.index]!.windows }} of
            {{ steps[axis.index]!.candidates }} one-second windows used{{
              steps[axis.index]!.windows < MIN_RELIABLE_WINDOWS
                ? " · too few for a reliable estimate"
                : ""
            }}
          </p>
        </section>
      </div>
    </Panel>

    <Panel title="Noise spectrogram" :description="spectrogramDescription">
      <template #actions>
        <Segmented v-model="field" label="Field" :options="fieldOptions" />
        <Segmented
          v-model="mode"
          label="Horizontal axis"
          :options="[
            { value: 'throttle', label: 'By throttle' },
            { value: 'time', label: 'By time' },
          ]"
        />
      </template>
      <div class="mb-3 flex items-center gap-2 text-xs text-muted tabular-nums">
        <span>{{ range[0].toFixed(0) }} dB</span>
        <span
          class="h-2.5 w-48 rounded-sm ring-1 ring-line"
          :style="{ background: rampGradient }"
          aria-hidden="true"
        />
        <span>{{ range[1].toFixed(0) }} dB</span>
        <span class="ml-2">power spectral density, shared scale</span>
      </div>
      <div class="grid gap-4 lg:grid-cols-3">
        <section v-for="axis in AXES" :key="axis" class="min-w-0">
          <h3 class="mb-1 text-sm font-semibold">{{ axisNames[axis] }}</h3>
          <SpectrogramHeatmap
            :data="heatmaps[axis]"
            :db-range="range"
            :cutoffs="cutoffs"
            :tracks="mode == 'time' ? notchTracks[axis] : undefined"
            :loading="spectrogramLoading"
          />
        </section>
      </div>
      <p
        v-if="aliasNote"
        class="mt-3 flex items-start gap-2 text-xs text-muted"
      >
        <Icon name="warning" class="text-warning" />{{ aliasNote }}
      </p>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import {
  formatDuration,
  transformBlackbox,
  useBlackboxStore,
  type LogColumn,
} from "@/stores/blackbox";
import { pidGainsLabel } from "@/log/profile";
import { closedLoopFrames } from "@/log/summary";
import { Analysis, type StepResponse } from "@/analysis";
import {
  columnMeans,
  computeSpectrogram,
  dbRange,
  throttleHeatmap,
  timeHeatmap,
  type HeatmapData,
  type RawSpectrogram,
} from "@/analysis/spectrogram";
import EmptyState from "@/components/EmptyState.vue";
import LogSummary from "@/components/LogSummary.vue";
import Panel from "@/components/ui/Panel.vue";
import Icon from "@/components/ui/Icon.vue";
import Segmented from "@/components/ui/Segmented.vue";
import StepResponsePlot from "@/components/tune/StepResponsePlot.vue";
import SpectrogramHeatmap from "@/components/tune/SpectrogramHeatmap.vue";
import { useChartTheme } from "@/ui/useChartTheme";
import { heatColor, heatRamp } from "@/ui/heatRamp";

type SpectrumField = "gyro_raw" | "gyro_filter" | "pid_dterm";

const AXES = [0, 1, 2];
// Windows need some stick movement to say anything about the response.
const MIN_STEP_INPUT_DEG_S = 20;
const MIN_RELIABLE_WINDOWS = 20;

const bb = useBlackboxStore();
const theme = useChartTheme();

const axisNames = computed(() =>
  bb.isRoverLog ? ["Roll", "Pitch", "Steering"] : ["Roll", "Pitch", "Yaw"],
);
const axes = computed(() =>
  (bb.isRoverLog ? [2] : AXES).map((index) => ({
    index,
    name: axisNames.value[index],
    gains: pidGainsLabel(bb.profile, index),
  })),
);

const rangeLabel = computed(() =>
  bb.hasSelection
    ? `the selected ${formatDuration(bb.selectedDuration)}`
    : "the whole log",
);

const closedLoop = computed(() => closedLoopFrames(bb.entries, bb.profile));

// Copies a column slice into a fresh array the worker can take ownership of.
function slice(column: LogColumn, scale = 1) {
  const out = new Float32Array(bb.selectionEndIndex - bb.selectionStartIndex);
  for (let i = 0; i < out.length; i++) {
    out[i] = column[bb.selectionStartIndex + i] / scale;
  }
  return out;
}

// Step response ------------------------------------------------------------

const steps = shallowRef<(StepResponse | undefined)[]>([]);
const stepLoading = ref(false);
let stepToken = 0;

const stepDescription = computed(
  () =>
    `How gyro follows setpoint over ${rangeLabel.value}, deconvolved from windows with stick input; crashes${closedLoop.value.mask ? ", hard hits and Manual mode" : " and hard hits"} are left out. The band shows the spread between groups of windows; 1.0 is the target.`,
);

async function updateSteps() {
  const token = ++stepToken;
  const setpointDef = bb.fields.setpoint;
  if (!setpointDef || !bb.fields.gyro_filter || !closedLoop.value.known) {
    steps.value = [];
    return;
  }
  stepLoading.value = true;
  steps.value = [];
  const minInput = transformInverse(setpointDef, MIN_STEP_INPUT_DEG_S);
  const results = await Promise.all(
    AXES.map((axis) => {
      const setpoint = bb.entries[`setpoint_${axis}`];
      const gyro = bb.entries[`gyro_filter_${axis}`];
      if (!setpoint || !gyro || !axes.value.some((a) => a.index == axis)) {
        return undefined;
      }
      const mask = closedLoop.value.mask;
      return Analysis.stepResponse(
        bb.sampleFrequency,
        minInput,
        slice(setpoint),
        slice(gyro),
        mask?.slice(bb.selectionStartIndex, bb.selectionEndIndex),
      ).catch((err) => {
        console.warn("step response failed", err);
        return undefined;
      });
    }),
  );
  if (token == stepToken) {
    steps.value = results;
    stepLoading.value = false;
  }
}

// Raw value for a value in display units (deg/s for radian fields).
function transformInverse(def: { scale: number; unit: any }, value: number) {
  return value / transformBlackbox(def, 1);
}

// Spectrogram --------------------------------------------------------------

const field = ref<SpectrumField>("gyro_filter");
const mode = ref<"throttle" | "time">("throttle");
const raw = shallowRef<(RawSpectrogram | undefined)[]>([]);
const spectrogramLoading = ref(false);
let spectrogramToken = 0;

const fieldOptions = computed(() =>
  (
    [
      { value: "gyro_raw", label: "Gyro raw" },
      { value: "gyro_filter", label: "Gyro filtered" },
      { value: "pid_dterm", label: "D-term" },
    ] as { value: SpectrumField; label: string }[]
  ).filter((option) => bb.fields[option.value]),
);

async function updateSpectrogram() {
  const token = ++spectrogramToken;
  const def = bb.fields[field.value];
  if (!def) {
    raw.value = [];
    return;
  }
  spectrogramLoading.value = true;
  raw.value = [];
  const scale = 1 / transformBlackbox(def, 1);
  const results = await Promise.all(
    AXES.map((axis) => {
      const column = bb.entries[`${field.value}_${axis}`];
      return column
        ? computeSpectrogram(bb.sampleFrequency, slice(column, scale)).catch(
            (err) => {
              console.warn("spectrogram failed", err);
              return undefined;
            },
          )
        : undefined;
    }),
  );
  if (token == spectrogramToken) {
    raw.value = results;
    spectrogramLoading.value = false;
  }
}

const throttle = computed(() => {
  const column = bb.entries.setpoint_3;
  const def = bb.fields.setpoint;
  if (!column || !def) {
    return undefined;
  }
  const throttleDef = { ...def, ...def.axisDefs?.[3] };
  const values = new Float32Array(
    bb.selectionEndIndex - bb.selectionStartIndex,
  );
  for (let i = 0; i < values.length; i++) {
    values[i] = transformBlackbox(
      throttleDef,
      column[bb.selectionStartIndex + i],
    );
  }
  return values;
});

const throttleLow = computed(() =>
  (bb.summary?.throttle?.min ?? 0) < 0 ? -1 : 0,
);

const startMs = computed(() =>
  bb.entriesPerMS ? bb.selectionStartIndex / bb.entriesPerMS : 0,
);

const heatmaps = computed<(HeatmapData | undefined)[]>(() =>
  raw.value.map((spectrogram) => {
    if (!spectrogram) return undefined;
    if (mode.value == "time" || !throttle.value) {
      return timeHeatmap(spectrogram, startMs.value);
    }
    return throttleHeatmap(
      spectrogram,
      columnMeans(spectrogram, throttle.value),
      throttleLow.value,
    );
  }),
);

const range = computed(() => dbRange(heatmaps.value));

const cutoffs = computed(() => {
  const kind = field.value == "pid_dterm" ? "dterm" : "gyro";
  return bb.filterCutoffs.filter((cutoff) => cutoff.kind == kind);
});

// Dynamic notch centre frequencies (Hz) per spectrogram column.
const notchTracks = computed(() =>
  AXES.map((axis) => {
    const spectrogram = raw.value[axis];
    if (!bb.isDynamicNotchLog || !spectrogram || field.value == "pid_dterm") {
      return undefined;
    }
    return [0, 1, 2].flatMap((peak) => {
      const column = bb.entries[`debug_${axis * 3 + peak}`];
      if (!column) return [];
      const track = new Float32Array(spectrogram.columns);
      for (let c = 0; c < spectrogram.columns; c++) {
        const index =
          bb.selectionStartIndex + c * spectrogram.hop + spectrogram.fftLen / 2;
        track[c] = column[Math.min(index, column.length - 1)];
      }
      return [track];
    });
  }),
);

const spectrogramDescription = computed(() => {
  const by =
    mode.value == "throttle" && throttle.value
      ? "averaged per throttle band"
      : "over time";
  return `Noise power ${by} for ${rangeLabel.value}. Dashed lines are the configured low-pass cutoffs${bb.isDynamicNotchLog && mode.value == "time" ? "; dots mark the dynamic notch centres" : ""}.`;
});

const aliasNote = computed(() => {
  const nyquist = bb.sampleFrequency / 2;
  return field.value == "gyro_raw" && nyquist < 1000
    ? `The log samples at ${bb.sampleFrequency.toFixed(0)} Hz, so this view stops at ${nyquist.toFixed(0)} Hz. Raw gyro noise above that folds back into the visible range and can show up as false lines.`
    : "";
});

const rampGradient = computed(() => {
  const ramp = heatRamp(theme.value, 8);
  const stops = Array.from({ length: 8 }, (_, i) => {
    const [r, g, b] = heatColor(ramp, i / 7);
    return `rgb(${r} ${g} ${b}) ${((i / 7) * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
});

watch(
  () => [bb.entries, bb.selectionStartIndex, bb.selectionEndIndex],
  () => updateSteps(),
  { immediate: true },
);
watch(
  () => [bb.entries, bb.selectionStartIndex, bb.selectionEndIndex, field.value],
  () => updateSpectrogram(),
  { immediate: true },
);
watch(fieldOptions, (options) => {
  if (options.length && !options.some((o) => o.value == field.value)) {
    field.value = options[0].value;
  }
});
</script>
