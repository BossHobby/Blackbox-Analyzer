export enum BlackboxFieldUnit {
  NONE = "none",
  US = "us",
  RADIANS = "rad",
  DEGREES = "deg",
  METERS = "m",
  HZ = "hz",
  G = "g",
  PERCENT = "percent",
  METERS_PER_SECOND = "mps",
}

export interface BlackboxAxisDef {
  title?: string;
  scale?: number;
  unit?: BlackboxFieldUnit;
  // Value-indexed names for enum channels, e.g. rth_state.
  labels?: string[];
  // Bit-indexed names for bitfield channels, e.g. heading correction flags.
  flags?: string[];
}

export interface BlackboxFieldDef extends BlackboxAxisDef {
  name: string;
  title: string;
  scale: number;
  axis?: string[];
  axisDefs?: BlackboxAxisDef[];
  unit: BlackboxFieldUnit;
}

export interface BlackboxFieldID {
  name: string;
  index?: number;
}

export interface BlackboxFilterCutoff {
  kind: "gyro" | "dterm";
  frequency: number;
  label: string;
}

// Raw fields that exceed float32's 24-bit mantissa: microsecond timestamps
// and degrees * 1e7 coordinates would otherwise snap to coarse steps.
export const PRECISE_FIELDS = new Set(["loop", "time", "gps_coord", "gps_home"]);

export type LogColumn = Float32Array | Float64Array;
export type LogColumns = { [index: string]: LogColumn };

export function blackboxFieldIDToString(id?: BlackboxFieldID) {
  if (!id) {
    return "";
  }
  if (id.index != undefined) {
    return id.name + "_" + id.index;
  }
  return id.name;
}

export function transformBlackbox(field: BlackboxAxisDef, val: number) {
  const scale = field.scale || 1;
  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
      return (val / scale) * (180 / Math.PI);

    default:
      return val / scale;
  }
}

export function unitBlackbox(field: BlackboxAxisDef) {
  if (field.labels || field.flags) {
    return "";
  }

  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
    case BlackboxFieldUnit.DEGREES:
      return "deg";

    case BlackboxFieldUnit.METERS:
      return "m";

    case BlackboxFieldUnit.PERCENT:
      return "%";

    case BlackboxFieldUnit.METERS_PER_SECOND:
      return "m/s";

    case BlackboxFieldUnit.US:
      return "us";

    case BlackboxFieldUnit.HZ:
      return "Hz";

    case BlackboxFieldUnit.G:
      return "g";

    default:
      return "";
  }
}

export function isDiscreteField(field: BlackboxAxisDef) {
  return !!(field.labels || field.flags);
}

export function formatBlackboxValue(field: BlackboxAxisDef, raw: number) {
  if (field.labels) {
    const value = Math.round(raw);
    return field.labels[value] ?? `${value}`;
  }
  if (field.flags) {
    const value = Math.round(raw);
    const names = field.flags.filter((_, bit) => value & (1 << bit));
    return names.length ? names.join(", ") : "none";
  }

  const value = transformBlackbox(field, raw);
  // Coordinates need ~1 cm resolution to be useful.
  const digits = (field.scale || 1) >= 1e6 ? 7 : 2;
  return value.toFixed(digits);
}

// Clock-style position in the log, e.g. 1:23.4.
export function formatClock(ms: number) {
  const tenths = Math.round(Math.max(ms, 0) / 100);
  const minutes = Math.floor(tenths / 600);
  const rest = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  return `${minutes}:${rest}`;
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0.00 s";
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds.toFixed(0)}s`;
}
