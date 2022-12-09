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
  BlackboxFieldIdentifier,
  transformBlackbox,
  useBlackboxStore,
} from "@/stores/blackbox";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { useTimelineStore } from "@/stores/timeline";
import { Color, useRenderStore } from "@/stores/render";
import { Analysis } from "@/analysis";

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
    windowSize() {
      return Math.floor(this.tl.zoom * this.entriesPerMS);
    },
    windowOffset() {
      return Math.floor(
        this.tl.cursor * this.entriesPerMS - this.windowSize / 2
      );
    },
    tickWidth() {
      return (this.canvas.width / this.tl.zoom) * this.entriesPerMS;
    },
    graphFields() {
      return this.fields.map((field: any) => {
        return {
          id: new BlackboxFieldIdentifier(field.name, field.index),
          ...this.bb.fields[field.name],
          ...field,
        };
      });
    },
    graphValues() {
      const fields = {
        range: 0,
        values: this.graphFields.map((field) => {
          return this.bb.entries[field.id.toString()]
            .slice(0)
            .map((val) => transformBlackbox(field, val));
        }),
      };

      for (let i = 0; i < fields.values.length; i++) {
        const res = Analysis.transform(this.tl.expo, 1, fields.values[i]);

        fields.range = Math.max(fields.range, Math.abs(res.range));
        fields.values[i] = res.values;
      }

      return fields;
    },
    graphPaths() {
      return this.graphValues.values.map((field) => {
        const path = new Path2D();

        path.moveTo(field[0], this.halfHeight);
        for (let i = 0; i < this.windowSize; i++) {
          const val = field[this.windowOffset + i] / this.graphValues.range;
          path.lineTo(
            i * this.tickWidth,
            val * -1 * this.halfHeight + this.halfHeight
          );
        }
        return path;
      });
    },
    hoverValues() {
      const hoverIndex = this.windowOffset + this.tl.hover * this.windowSize;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      let maxLen = 0;
      return this.graphFields
        .map((field, fieldIndex) => {
          const valUpper = this.graphValues.values[fieldIndex][hoverIndexUpper];
          const valLower = this.graphValues.values[fieldIndex][hoverIndexLower];
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

      if (e.button == 2) {
        this.drag = true;
      }
      if (e.button == 0) {
        this.select = true;
        this.selectStart = e.offsetX;
        this.selectEnd = e.offsetX;
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
      if (e.button == 2) {
        this.drag = false;
      }
      if (e.button == 0) {
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

      const hoverPos = this.tl.windowHoverPos(this.canvas.width);
      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(hoverPos, 0);
      ctx.lineTo(hoverPos, this.canvas.height);
      ctx.stroke();

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

      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "right";
      for (const [index, val] of this.hoverValues.entries()) {
        ctx.fillStyle = this.render.colors[index];
        ctx.fillText(val, hoverPos - 6, 20 * (index + 1));
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.timeline-graph {
  height: 300px;
}
</style>
