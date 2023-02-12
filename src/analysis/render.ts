export enum Color {
  GREEN = "hsl(96deg 53% 43%)",
  GREEN_LIGHT = "hsl(96deg 53% 48%)",
  GREEN_DARK = "hsl(96deg 53% 40%)",
  GRAY = "hsl(0, 0%, 19%)",
  GRAY_LIGTH = "hsl(0, 0%, 29%)",
  GRAY_LIGTHER = "hsl(0, 0%, 73%)",
  GRAY_DARKER = "hsl(0, 0%, 16%)",
  GRAY_DARKEST = "hsl(0, 0%, 3%)",
  WHITE = "rgb(255, 255, 255)",
  WHITE_OFF = "rgb(233, 235, 252)",
}

export class Render {
  public static hoverText(
    ctx: CanvasRenderingContext2D,
    pos: number,
    width: number,
    height: number,
    lines: any[]
  ) {
    ctx.font = "14px Roboto Mono";

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

    ctx.strokeStyle = Color.GREEN;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, height);
    ctx.stroke();
  }
}
