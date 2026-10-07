<template>
  <EmptyState v-if="!bb.isLoaded || !summary" />
  <div v-else class="flex min-w-0 flex-col gap-3">
    <LogSummary />

    <dl class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div
        v-for="tile in tiles"
        :key="tile.label"
        class="rounded-lg border border-line bg-panel px-4 py-3"
      >
        <dt class="text-xs text-muted">{{ tile.label }}</dt>
        <dd class="mt-1 text-xl font-semibold tabular-nums">
          {{ tile.value }}
        </dd>
        <dd v-if="tile.detail" class="mt-0.5 text-xs text-muted tabular-nums">
          {{ tile.detail }}
        </dd>
      </div>
    </dl>

    <Panel
      title="Flight"
      description="Throttle, saturation and RTH over the whole log. Click to open that moment in the Timeline."
    >
      <FlightStrip />
    </Panel>

    <div
      class="grid min-w-0 gap-3"
      :class="summary.track ? 'xl:grid-cols-[minmax(0,1fr)_28rem]' : ''"
    >
      <Panel
        title="Events"
        :description="
          summary.events.length
            ? `${eventCount} · click a row to open it in the Timeline`
            : 'Nothing stood out in this log.'
        "
      >
        <div
          v-if="summary.events.length"
          class="max-h-[420px] overflow-y-auto overscroll-contain"
        >
          <table class="w-full text-left text-sm">
            <thead class="sticky top-0 bg-panel text-xs text-muted">
              <tr>
                <th class="py-1.5 pr-3 font-medium">Time</th>
                <th class="py-1.5 pr-3 font-medium">Event</th>
                <th class="py-1.5 pr-3 font-medium">Detail</th>
                <th class="py-1.5 text-right font-medium">Length</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(event, index) in summary.events"
                :key="index"
                tabindex="0"
                class="cursor-pointer border-t border-line hover:bg-subtle focus-visible:bg-subtle"
                @click="position.jump(event.start, event.end)"
                @keydown.enter="position.jump(event.start, event.end)"
              >
                <td class="py-1.5 pr-3 font-mono text-xs tabular-nums">
                  {{ formatClock(position.msAt(event.start)) }}
                </td>
                <td class="py-1.5 pr-3">
                  <span class="flex items-center gap-1.5">
                    <Icon
                      v-if="event.severity != 'info'"
                      name="warning"
                      :class="
                        event.severity == 'critical'
                          ? 'text-danger'
                          : 'text-warning'
                      "
                    /><span
                      v-else
                      class="mx-[5px] size-2 rounded-full bg-accent"
                      aria-hidden="true"
                    />{{ event.label }}
                  </span>
                </td>
                <td class="py-1.5 pr-3 text-muted">{{ event.detail }}</td>
                <td class="py-1.5 text-right font-mono text-xs tabular-nums">
                  {{
                    formatDuration(
                      position.msAt(event.end) - position.msAt(event.start),
                    )
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        v-if="summary.track"
        title="Track"
        :description="
          summary.track.hasHome
            ? 'GPS track around home. Click the track to open that moment.'
            : 'GPS track around the first fix; no home was set.'
        "
      >
        <FlightTrack />
      </Panel>
    </div>

    <Panel
      title="Rate tracking"
      description="Gyro against setpoint for the whole log."
    >
      <table class="w-full text-left text-sm tabular-nums">
        <thead class="text-xs text-muted">
          <tr>
            <th class="py-1.5 pr-3 font-medium">Axis</th>
            <th class="py-1.5 pr-3 text-right font-medium">
              Peak rate (deg/s)
            </th>
            <th class="py-1.5 pr-3 text-right font-medium">
              Configured max (deg/s)
            </th>
            <th class="py-1.5 pr-3 text-right font-medium">
              RMS error (deg/s)
            </th>
            <th class="py-1.5 text-right font-medium">Peak error (deg/s)</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="axis in summary.axes"
            :key="axis.name"
            class="border-t border-line"
          >
            <td class="py-1.5 pr-3">{{ axis.name }}</td>
            <td class="py-1.5 pr-3 text-right">
              {{ axis.peakRate.toFixed(0) }}
            </td>
            <td class="py-1.5 pr-3 text-right">
              {{ axis.maxRate?.toFixed(0) ?? "–" }}
            </td>
            <td class="py-1.5 pr-3 text-right">
              {{ axis.rmsError?.toFixed(1) ?? "–" }}
            </td>
            <td class="py-1.5 text-right">
              {{ axis.peakError?.toFixed(0) ?? "–" }}
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  formatClock,
  formatDuration,
  useBlackboxStore,
} from "@/stores/blackbox";
import EmptyState from "@/components/EmptyState.vue";
import LogSummary from "@/components/LogSummary.vue";
import Panel from "@/components/ui/Panel.vue";
import Icon from "@/components/ui/Icon.vue";
import FlightStrip from "@/components/overview/FlightStrip.vue";
import FlightTrack from "@/components/overview/FlightTrack.vue";
import { useLogPosition } from "@/ui/useJump";

const bb = useBlackboxStore();
const position = useLogPosition();
const summary = computed(() => bb.summary);

const eventCount = computed(() => {
  const s = summary.value!;
  return s.hiddenEvents
    ? `Strongest ${s.events.length} of ${s.events.length + s.hiddenEvents} shown`
    : `${s.events.length} detected`;
});

function percent(fraction: number) {
  return fraction > 0 && fraction < 0.001
    ? "<0.1%"
    : `${(fraction * 100).toFixed(1)}%`;
}

const tiles = computed(() => {
  const s = summary.value;
  if (!s) {
    return [];
  }
  const tiles: { label: string; value: string; detail?: string }[] = [
    {
      label: "Duration",
      value: formatDuration(bb.duration),
      detail: `${s.frames.toLocaleString()} frames`,
    },
    {
      label: "Missing frames",
      value: s.filledFrames.toLocaleString(),
      detail: percent(s.filledFrames / Math.max(s.frames, 1)),
    },
  ];
  if (s.saturation) {
    tiles.push({
      label: "Motor saturation",
      value: percent(s.saturation.fraction),
      detail: `longest ${formatDuration(s.saturation.longestMs)}`,
    });
  }
  if (s.throttle) {
    tiles.push({
      label: "Throttle",
      value: `${(s.throttle.mean * 100).toFixed(0)}% avg`,
      detail: `peak ${(s.throttle.max * 100).toFixed(0)}%`,
    });
  }
  if (s.cpu) {
    const unit = s.cpu.unit == "%" ? "%" : " µs";
    tiles.push({
      label: "CPU load",
      value: `${s.cpu.mean.toFixed(0)}${unit} avg`,
      detail: `peak ${s.cpu.peak.toFixed(0)}${unit}`,
    });
  }
  if (s.track) {
    tiles.push({
      label: s.track.hasHome ? "Max distance from home" : "Max distance",
      value: `${s.track.maxDistance.toFixed(0)} m`,
    });
  }
  return tiles;
});
</script>
