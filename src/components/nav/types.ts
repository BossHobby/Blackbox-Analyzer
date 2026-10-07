import type { BlackboxAxisDef } from "@/log/types";

export interface NavSeries {
  column: string;
  label: string;
  def: BlackboxAxisDef;
  color?: number;
  // Values wrap at this span (360 for headings): no line across the wrap.
  wrap?: number;
}
