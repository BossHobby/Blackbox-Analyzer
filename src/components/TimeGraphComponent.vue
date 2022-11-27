<template>
  <div class="timeline-graph">
    <CanvasComponent
      ref="canvas"
      @draw="draw"
      @mousedown="mousedown"
      @mousemove="mousemove"
      @mouseup="mouseup"
      @wheel="wheel"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useBlackboxStore } from "@/stores/blackbox";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { useTimelineStore } from "@/stores/timeline";
import { Color } from "@/stores/render";

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
    };
  },
  data() {
    return {
      graphPath: new Path2D(),
      drag: false,
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
          ...this.bb.fields[field.name],
          ...field,
        };
      });
    },
    graphValues() {
      const fields = {
        range: 0,
        values: this.graphFields.map(() => new Array(this.bb.entries.length)),
      };

      for (const [entryIndex, entry] of this.bb.entries.entries()) {
        for (const [fieldIndex, field] of this.graphFields.entries()) {
          let val = entry[field.name];
          if (field.index != undefined) {
            val = val[field.index];
          }
          val = this.bb.transform(field.name, val);

          fields.range = Math.max(fields.range, Math.abs(val) * 1.2);
          fields.values[fieldIndex][entryIndex] = val;
        }
      }

      return fields;
    },
    graphPaths() {
      return this.graphFields.map((_, fieldIndex) => {
        const path = new Path2D();

        path.moveTo(0, this.halfHeight);
        for (let i = 0; i < this.windowSize; i++) {
          const val =
            this.graphValues.values[fieldIndex][this.windowOffset + i] /
            this.graphValues.range;
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
    mousedown() {
      this.drag = true;
    },
    mousemove(e: MouseEvent) {
      if (this.drag) {
        this.tl.moveCursor(
          e.movementX / this.tl.windowPixelsPerMS(this.canvas.width)
        );
      }
      this.tl.setWindowHover(this.canvas.width, e.offsetX);
    },
    mouseup(e: MouseEvent) {
      this.tl.moveCursor(
        e.movementX / this.tl.windowPixelsPerMS(this.canvas.width)
      );
      this.drag = false;
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

      let colorIndex = 0;
      for (const path of this.graphPaths) {
        ctx.strokeStyle = this.tl.colors[colorIndex++];
        ctx.stroke(path);
      }

      const hoverPos = this.tl.windowHoverPos(this.canvas.width);
      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(hoverPos, 0);
      ctx.lineTo(hoverPos, this.canvas.height);
      ctx.stroke();

      colorIndex = 0;
      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "right";
      for (const val of this.hoverValues) {
        ctx.fillStyle = this.tl.colors[colorIndex];
        ctx.fillText(val, hoverPos - 6, 20 * (colorIndex + 1));
        colorIndex++;
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
