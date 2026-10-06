import type { ChartTheme } from "@/ui/useChartTheme";

export const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function monoFont(size: number) {
  return `${size}px ${MONO_FONT}`;
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
