<template>
  <div>
    <div
      v-show="contextMenu.show"
      role="menu"
      class="fixed z-30 flex w-40 flex-col rounded-lg border border-line bg-panel p-1 text-sm shadow-lg"
      :style="{ top: contextMenu.top + 'px', left: contextMenu.left + 'px' }"
    >
      <button
        v-for="item in contextMenuItems"
        :key="item.label"
        type="button"
        role="menuitem"
        class="rounded-md px-3 py-1.5 text-left hover:bg-subtle"
        @click="
          item.action();
          contextMenu.show = false;
        "
      >
        {{ item.label }}
      </button>
    </div>
    <div class="h-[300px]">
      <CanvasComponent
        ref="canvas"
        @draw="draw"
        @mousedown="mousedown"
        @mousemove="mousemove"
        @mouseup="mouseup"
        @wheel="wheel"
        @contextmenu.capture.prevent="context"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  blackboxFieldIDToString,
  formatBlackboxValue,
  formatDuration,
  isDiscreteField,
  transformBlackbox,
  unitBlackbox,
  useBlackboxStore,
} from "@/stores/blackbox";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { useTimelineStore } from "@/stores/timeline";
import { Analysis } from "@/analysis";
import { monoFont, Render } from "@/analysis/render";
import { seriesColor, useChartTheme } from "@/ui/useChartTheme";

const ROVER_MODE_LABELS = ["Manual", "Rate Assist", "Rate Throttle"];

export default defineComponent({
  name: "TimeGraphComponent",
  components: {
    CanvasComponent,
  },
  props: {
    fields: {
      type: Array<Object>,
      default() {
        return [];
      },
    },
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      tl: useTimelineStore(),
      theme: useChartTheme(),
    };
  },
  data() {
    return {
      graphPath: new Path2D(),
      drag: false,
      select: false,
      selectStart: 0,
      selectEnd: 0,
      contextMenu: {
        show: false,
        top: 0,
        left: 0,
      },
    };
  },
  computed: {
    contextMenuItems() {
      return [
        {
          label: "Start here",
          action: () => (this.bb.start = this.tl.windowHoverIndex),
        },
        {
          label: "End here",
          action: () => (this.bb.end = this.tl.windowHoverIndex),
        },
        {
          label: "Start cut here",
          action: () => this.bb.cutEntries(this.tl.windowHoverIndex),
        },
        {
          label: "End cut here",
          action: () => this.bb.cutEntries(0, this.tl.windowHoverIndex),
        },
      ];
    },
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    halfHeight() {
      return this.canvas.height / 2;
    },
    entriesPerMS() {
      return this.bb.entriesPerMS;
    },
    tickWidth() {
      if (!this.tl.windowSize) {
        return 0;
      }
      return this.canvas.width / this.tl.windowSize;
    },
    graphFields() {
      return this.fields
        .map((field: any) => {
          return {
            ...this.bb.fields[field.name],
            ...field,
          };
        })
        .filter(
          (field: any) => this.bb.entries[blackboxFieldIDToString(field.id)],
        );
    },
    graphValues() {
      const fields = this.graphFields.map((field) => {
        const entry = this.bb.entries[blackboxFieldIDToString(field.id)];
        const raw = Float32Array.from(entry, (val) =>
          transformBlackbox(field, val),
        );

        return {
          ...field,
          ...Analysis.transform(field.expo / 100.0, 1, raw),
        };
      });

      const range: any = {};
      for (const f of fields) {
        range[f.unit + f.expo] = Math.max(range[f.unit + f.expo] || 0, f.range);
      }

      return fields.map((f) => {
        return {
          ...f,
          range: range[f.unit + f.expo],
        };
      });
    },
    graphPaths() {
      const { windowSize, windowOffset } = this.tl;
      const { halfHeight, tickWidth } = this;
      return this.graphValues.map((field) => {
        const mul = 1 / field.range;
        const start = Math.max(windowOffset, 0);
        const end = Math.min(windowOffset + windowSize, field.values.length);
        const values = field.values.slice(start, end);

        const path = new Path2D();
        if (!values.length || !Number.isFinite(mul) || !this.tickWidth) {
          return path;
        }
        const xOffset = (start - windowOffset) * tickWidth;
        path.moveTo(xOffset, halfHeight);
        for (let i = 0; i < values.length; i++) {
          const val = values[i] * mul;
          path.lineTo(
            xOffset + i * tickWidth,
            val * -1 * halfHeight + halfHeight,
          );
        }
        return path;
      });
    },
    roverModeBands() {
      if (!this.bb.isRoverLog || !this.tickWidth) {
        return [];
      }

      const modeEntry = this.bb.entries.rover_debug_0;
      if (!modeEntry?.length) {
        return [];
      }

      const start = Math.max(Math.floor(this.tl.windowOffset), 0);
      const end = Math.min(
        Math.ceil(this.tl.windowOffset + this.tl.windowSize),
        modeEntry.length,
      );
      if (end <= start) {
        return [];
      }

      const bands = [] as {
        mode: number;
        label: string;
        x: number;
        width: number;
        transition: boolean;
      }[];
      let mode = Math.round(modeEntry[start]);
      let bandStart = start;
      const pushBand = (nextIndex: number, transition: boolean) => {
        const x = (bandStart - this.tl.windowOffset) * this.tickWidth;
        const width = Math.max((nextIndex - bandStart) * this.tickWidth, 1);
        bands.push({
          mode,
          label: ROVER_MODE_LABELS[mode] || `Mode ${mode}`,
          x,
          width,
          transition,
        });
      };

      for (let index = start + 1; index < end; index++) {
        const nextMode = Math.round(modeEntry[index]);
        if (nextMode == mode) {
          continue;
        }
        pushBand(index, index > start + 1);
        mode = nextMode;
        bandStart = index;
      }
      pushBand(end, false);
      return bands;
    },
    hoverTimeLabel() {
      const time = this.bb.entries.time;
      if (!time?.length) {
        return "Time 0.00 s";
      }

      const index = Math.min(
        Math.max(Math.round(this.tl.windowHoverIndex), 0),
        time.length - 1,
      );
      return `Time ${formatDuration((time[index] - time[0]) / 1000)}`;
    },
    hoverValues() {
      const hoverIndex = this.tl.windowHoverIndex;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = hoverIndex - hoverIndexLower;
      const hoverWeigthLower = 1 - hoverWeigthUpper;

      let maxLen = 0;
      return this.graphFields
        .map((field) => {
          // Read the raw column so expo shaping does not distort the readout.
          const values = this.bb.entries[blackboxFieldIDToString(field.id)];
          if (!values?.length) {
            return { field, str: "" };
          }
          const clamp = (index: number) =>
            Math.min(Math.max(index, 0), values.length - 1);
          const val = isDiscreteField(field)
            ? values[clamp(Math.round(hoverIndex))]
            : values[clamp(hoverIndexUpper)] * hoverWeigthUpper +
              values[clamp(hoverIndexLower)] * hoverWeigthLower;
          const str = formatBlackboxValue(field, val);
          maxLen = Math.max(maxLen, str.length);
          return { field, str };
        })
        .map(({ field, str }) => {
          const unit = unitBlackbox(field);
          while (str.length < maxLen) str = " " + str;
          return `${field.title} ${str} ${unit}`.trimEnd();
        });
    },
  },
  methods: {
    mousedown(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.contextMenu.show = false;

      switch (e.button) {
        case 0:
          if (e.ctrlKey) {
            this.select = true;
            this.selectStart = e.offsetX;
            this.selectEnd = e.offsetX;
          } else {
            this.drag = true;
          }
          break;
      }
    },
    mousemove(e: MouseEvent) {
      if (this.drag) {
        this.tl.moveCursor(
          e.movementX / this.tl.windowPixelsPerMS(this.canvas.width),
        );
      }
      if (this.select) {
        this.selectEnd = e.offsetX;
      }
      this.tl.setWindowHover(this.canvas.width, e.offsetX);
    },
    mouseup(e: MouseEvent) {
      const pixelsPer = this.tl.windowPixelsPerMS(this.canvas.width);
      this.tl.moveCursor(e.movementX / pixelsPer);
      switch (e.button) {
        case 0:
          if (e.ctrlKey) {
            if (this.select) {
              this.selectEnd = e.offsetX;

              const start = Math.min(this.selectStart, this.selectEnd);
              const end = Math.max(this.selectStart, this.selectEnd);

              const delta = end - start;
              const pos = (start + delta / 2) / pixelsPer;
              const cursor = this.tl.cursor - this.tl.zoom / 2 + pos;

              this.tl.setZoom(delta / pixelsPer);
              this.tl.setCursor(cursor);
            }
            this.select = false;
          } else {
            this.drag = false;
          }
          break;
      }
    },
    wheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.tl.modifyZoom(e.deltaY / 500);
      this.tl.moveCursor(
        e.deltaX / this.tl.windowPixelsPerMS(this.canvas.width),
      );
    },
    context(e: PointerEvent) {
      this.contextMenu.show = true;
      this.contextMenu.top = e.y;
      this.contextMenu.left = e.x;
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.tl.ready) {
        return;
      }

      const theme = this.theme;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.roverModeBands.length) {
        ctx.font = monoFont(12);
        ctx.textAlign = "left";
        for (const band of this.roverModeBands) {
          // Manual (mode 0) is the baseline and stays unshaded.
          const fill = theme.bands[band.mode - 1];
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect(band.x, 0, band.width, this.canvas.height);
          }

          if (band.transition) {
            ctx.strokeStyle = theme.text;
            ctx.beginPath();
            ctx.moveTo(band.x, 0);
            ctx.lineTo(band.x, this.canvas.height);
            ctx.stroke();
          }

          if (band.width > 80) {
            ctx.fillStyle = theme.text;
            ctx.fillText(band.label, band.x + 6, 16);
          }
        }
      }

      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      const divs = 6;
      for (let i = 0; i <= divs; i++) {
        ctx.moveTo(0, (i * this.canvas.height) / divs);
        ctx.lineTo(this.canvas.width, (i * this.canvas.height) / divs);
      }
      ctx.stroke();

      for (const [index, path] of this.graphPaths.entries()) {
        ctx.strokeStyle = seriesColor(theme, index);
        ctx.stroke(path);
      }

      if (this.select) {
        ctx.fillStyle = theme.selection;
        ctx.strokeStyle = theme.text;
        ctx.beginPath();
        ctx.moveTo(this.selectStart, this.canvas.height);
        ctx.lineTo(this.selectEnd, this.canvas.height);
        ctx.lineTo(this.selectEnd, 0);
        ctx.lineTo(this.selectStart, 0);
        ctx.lineTo(this.selectStart, this.canvas.height);
        ctx.stroke();
        ctx.fill();

        const selectionWidth = Math.abs(this.selectEnd - this.selectStart);
        const selectionDuration =
          selectionWidth / this.tl.windowPixelsPerMS(this.canvas.width);
        ctx.font = monoFont(13);
        ctx.textAlign = "center";
        ctx.fillStyle = theme.accent;
        ctx.fillText(
          formatDuration(selectionDuration),
          (this.selectStart + this.selectEnd) / 2,
          22,
        );
      }

      if (this.bb.start >= this.tl.windowOffset) {
        const pos = (this.bb.start - this.tl.windowOffset) * this.tickWidth;
        ctx.strokeStyle = theme.danger;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, this.canvas.height);
        ctx.stroke();
      }

      if (this.bb.end >= this.tl.windowOffset) {
        const pos = (this.bb.end - this.tl.windowOffset) * this.tickWidth;
        ctx.strokeStyle = theme.danger;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, this.canvas.height);
        ctx.stroke();
      }

      const hoverPos = this.tl.windowHoverPos(this.canvas.width);

      const lines = [{ text: this.hoverTimeLabel, color: theme.accent }];
      for (const [index, val] of this.hoverValues.entries()) {
        lines.push({
          text: val,
          color: seriesColor(theme, index),
        });
      }
      Render.hoverText(
        ctx,
        theme,
        hoverPos,
        this.canvas.width,
        this.canvas.height,
        lines,
      );
    },
  },
});
</script>
