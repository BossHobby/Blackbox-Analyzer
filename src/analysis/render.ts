import type { ChartTheme } from "@/ui/useChartTheme";

export const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function monoFont(size: number) {
  return `${size}px ${MONO_FONT}`;
}

/** A boxed tooltip beside x, flipped to the left in the right half. */
export function tooltip(
  ctx: CanvasRenderingContext2D,
  theme: ChartTheme,
  x: number,
  y: number,
  width: number,
  lines: string[],
) {
  ctx.font = monoFont(12);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lineHeight = 16;
  const boxWidth =
    Math.max(...lines.map((line) => ctx.measureText(line).width)) + 16;
  const boxHeight = lines.length * lineHeight + 10;
  const left = x > width / 2 ? x - boxWidth - 10 : x + 10;

  ctx.fillStyle = theme.panel;
  ctx.strokeStyle = theme.grid;
  ctx.beginPath();
  ctx.roundRect(Math.round(left) + 0.5, y + 0.5, boxWidth, boxHeight, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.ink;
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, left + 8, y + 5 + (index + 1) * lineHeight - 4);
  }
}

export class Render {
  public static hoverText(
    ctx: CanvasRenderingContext2D,
    theme: ChartTheme,
    pos: number,
    width: number,
    height: number,
    lines: { text: string; color: string }[],
  ) {
    ctx.font = monoFont(13);

    let hoverTextPos = 0;
    if (pos > width / 2) {
      ctx.textAlign = "right";
      hoverTextPos = pos - 6;
    } else {
      ctx.textAlign = "left";
      hoverTextPos = pos + 6;
    }

    for (const [index, line] of lines.entries()) {
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, hoverTextPos, (index + 1) * 20);
    }

    ctx.strokeStyle = theme.accent;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, height);
    ctx.stroke();
  }
}
