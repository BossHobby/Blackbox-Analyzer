<template>
  <div class="timeline-graph">
    <CanvasComponent
      ref="canvas"
      @draw="draw"
      @mousedown="mousedown"
      @mousemove="mousemove"
      @mouseup="mouseup"
      @contextmenu.capture.prevent
      @wheel="wheel"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  blackboxFieldIDToString,
  transformBlackbox,
  useBlackboxStore,
} from "@/stores/blackbox";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { useTimelineStore } from "@/stores/timeline";
import { useRenderStore } from "@/stores/render";
import { Analysis } from "@/analysis";
import { Color, Render } from "@/analysis/render";

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
      render: useRenderStore(),
      bb: useBlackboxStore(),
      tl: useTimelineStore(),
    };
  },
  data() {
    return {
      graphPath: new Path2D(),
      drag: false,
      select: false,
      selectStart: 0,
      selectEnd: 0,
    };
  },
  computed: {
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
      return this.canvas.width / this.tl.windowSize;
    },
    graphFields() {
      return this.fields.map((field: any) => {
        return {
          ...this.bb.fields[field.name],
          ...field,
        };
      });
    },
    graphValues() {
      const fields = this.graphFields.map((field) => {
        const raw = this.bb.entries[blackboxFieldIDToString(field.id)]
          .slice(0)
          .map((val) => transformBlackbox(field, val));

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
        const values = field.values.slice(
          windowOffset,
          windowOffset + windowSize
        );

        const path = new Path2D();
        path.moveTo(values[0], halfHeight);
        for (let i = 0; i < values.length; i++) {
          const val = values[i] * mul;
          path.lineTo(i * tickWidth, val * -1 * halfHeight + halfHeight);
        }
        return path;
      });
    },
    hoverValues() {
      const hoverIndex = this.tl.windowHoverIndex;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      let maxLen = 0;
      return this.graphFields
        .map((field, fieldIndex) => {
          const valUpper = this.graphValues[fieldIndex].values[hoverIndexUpper];
          const valLower = this.graphValues[fieldIndex].values[hoverIndexLower];
          const val = valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
          const str = val.toFixed(2).toString();
          maxLen = Math.max(maxLen, str.length);
          return { field, str };
        })
        .map(({ field, str }) => {
          while (str.length < maxLen) str = " " + str;
          return field.title + " " + str;
        });
    },
  },
  methods: {
    mousedown(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();

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
          e.movementX / this.tl.windowPixelsPerMS(this.canvas.width)
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

        case 2:
          if (e.ctrlKey) {
            this.bb.end = this.tl.windowHoverIndex;
          } else {
            this.bb.start = this.tl.windowHoverIndex;
          }
          break;
      }
    },
    wheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.tl.modifyZoom(e.deltaY / 500);
      this.tl.moveCursor(
        e.deltaX / this.tl.windowPixelsPerMS(this.canvas.width)
      );
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.tl.ready) {
        return;
      }

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.beginPath();
      const divs = 6;
      for (let i = 0; i <= divs; i++) {
        ctx.moveTo(0, (i * this.canvas.height) / divs);
        ctx.lineTo(this.canvas.width, (i * this.canvas.height) / divs);
      }
      ctx.stroke();

      for (const [index, path] of this.graphPaths.entries()) {
        ctx.strokeStyle = this.render.colors[index];
        ctx.stroke(path);
      }

      if (this.select) {
        ctx.fillStyle = "hsla(0, 0%, 29%, 0.4)";
        ctx.strokeStyle = Color.GRAY_LIGTHER;
        ctx.beginPath();
        ctx.moveTo(this.selectStart, this.canvas.height);
        ctx.lineTo(this.selectEnd, this.canvas.height);
        ctx.lineTo(this.selectEnd, 0);
        ctx.lineTo(this.selectStart, 0);
        ctx.lineTo(this.selectStart, this.canvas.height);
        ctx.stroke();
        ctx.fill();
      }

      if (this.bb.start >= this.tl.windowOffset) {
        const pos =
          (this.bb.start - this.tl.windowOffset) *
          this.tl.windowPixelsPerMS(this.canvas.width);
        ctx.strokeStyle = Color.RED;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, this.canvas.height);
        ctx.stroke();
      }

      if (this.bb.end >= this.tl.windowOffset) {
        const pos =
          (this.bb.end - this.tl.windowOffset) *
          this.tl.windowPixelsPerMS(this.canvas.width);
        ctx.strokeStyle = Color.RED;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, this.canvas.height);
        ctx.stroke();
      }

      const hoverPos = this.tl.windowHoverPos(this.canvas.width);

      const lines = [];
      for (const [index, val] of this.hoverValues.entries()) {
        lines.push({
          text: val,
          color: this.render.colors[index],
        });
      }
      Render.hoverText(
        ctx,
        hoverPos,
        this.canvas.width,
        this.canvas.height,
        lines
      );
    },
  },
});
</script>

<style lang="scss" scoped>
.timeline-graph {
  height: 300px;
}
</style>
