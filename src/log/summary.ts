import {
  isRoverDebugProfileLog,
  isWingDebugProfileLog,
  navigationStates,
  profileVehicleLabel,
  rateMaxForAxis,
} from "./profile";
import {
  blackboxFieldIDToString,
  transformBlackbox,
  type BlackboxAxisDef,
  type BlackboxFieldDef,
  type LogColumn,
  type LogColumns,
} from "./types";

// Detector thresholds. Indices are frame indices into the parsed columns.
const SATURATION_LEVEL = 0.99;
const SATURATION_MIN_MS = 20;
const TRACKING_ERROR_DEG_S = 150;
// Normal control lag after a sharp setpoint step (stick flick, RTH engaging)
// lasts about the loop delay, 10-17 ms on the logs checked.
const TRACKING_MIN_MS = 20;
const EVENT_MERGE_MS = 50;
const GAP_EVENT_FRAMES = 10;
const MAX_EVENTS_PER_KIND = 40;

const STRIP_BUCKETS = 600;
const TRACK_POINTS = 2000;
// Matches the firmware's METERS_PER_DEGREE_LAT (navigation.h).
const METERS_PER_DEGREE = (6371000 * Math.PI) / 180;

const AXIS_NAMES = ["Roll", "Pitch", "Yaw"];
const ROVER_AXIS_NAMES = ["Roll", "Pitch", "Steering"];

export type LogEventKind = "saturation" | "tracking" | "rth" | "gap";
export type LogEventSeverity = "info" | "warning" | "critical";

export interface LogEvent {
  kind: LogEventKind;
  severity: LogEventSeverity;
  start: number;
  end: number;
  label: string;
  detail: string;
}

export interface AxisSummary {
  name: string;
  peakRate: number; // deg/s
  maxRate?: number; // configured, deg/s
  rmsError?: number; // deg/s
  peakError?: number; // deg/s
}

export interface FlightStrip {
  buckets: number;
  throttle?: Float32Array; // 0..1 mean per bucket
  saturation?: Float32Array; // fraction of frames per bucket
  rthState?: Uint8Array; // state at bucket midpoint
}

export interface FlightTrack {
  // Local north/east meters around the origin (home when known).
  north: Float32Array;
  east: Float32Array;
  index: Uint32Array;
  hasHome: boolean;
  homeNorth: number;
  homeEast: number;
  maxDistance: number;
}

export interface LogSummary {
  frames: number;
  filledFrames: number;
  axes: AxisSummary[];
  saturation?: { fraction: number; longestMs: number };
  throttle?: { mean: number; max: number; min: number };
  cpu?: { mean: number; peak: number; unit: "%" | "us" };
  strip: FlightStrip;
  track?: FlightTrack;
  events: LogEvent[];
  // Events beyond MAX_EVENTS_PER_KIND, left out of `events`.
  hiddenEvents: number;
}

type Run = { start: number; end: number; peak: number };

export interface ClosedLoop {
  // 1 where the controller tracks setpoint; undefined when every frame does.
  mask?: Uint8Array;
  // False when the log cannot tell manual (open-loop) flight apart.
  known: boolean;
}

/**
 * Frames where gyro is expected to follow setpoint. Wing and rover Manual
 * modes pass the sticks straight to the outputs, so tracking metrics there
 * are meaningless; their mode is only known with the vehicle debug mode.
 */
export function closedLoopFrames(entries: LogColumns, profile: any): ClosedLoop {
  const vehicle = profileVehicleLabel(profile);
  if (vehicle == "Multirotor" || !vehicle) {
    return { known: true };
  }
  const mode =
    vehicle == "Rover"
      ? isRoverDebugProfileLog(profile) && column(entries, "rover_debug", 0)
      : isWingDebugProfileLog(profile) && column(entries, "debug", 0);
  if (!mode) {
    return { known: false };
  }
  // Mode 0 is Manual for both the rover and the wing.
  return { mask: Uint8Array.from(mode, (v) => (v != 0 ? 1 : 0)), known: true };
}

function axisDef(fields: BlackboxFieldDef[], name: string, index?: number) {
  const field = fields.find((f) => f.name == name);
  if (!field) {
    return undefined;
  }
  const def: BlackboxAxisDef = { ...field, ...field.axisDefs?.[index ?? -1] };
  return def;
}

function column(entries: LogColumns, name: string, index?: number) {
  return entries[blackboxFieldIDToString({ name, index })] as
    | LogColumn
    | undefined;
}

// Collects runs where `active(i)` holds, merging runs separated by at most
// `mergeFrames` inactive frames and dropping runs shorter than `minFrames`.
function findRuns(
  length: number,
  active: (i: number) => number | undefined,
  minFrames: number,
  mergeFrames: number,
) {
  const runs: Run[] = [];
  let current: Run | undefined;
  for (let i = 0; i < length; i++) {
    const value = active(i);
    if (value == undefined) {
      continue;
    }
    if (current && i - current.end <= mergeFrames + 1) {
      current.end = i;
      current.peak = Math.max(current.peak, value);
      continue;
    }
    if (current) {
      runs.push(current);
    }
    current = { start: i, end: i, peak: value };
  }
  if (current) {
    runs.push(current);
  }
  return runs.filter((run) => run.end - run.start + 1 >= minFrames);
}

function strongest(runs: Run[], summary: LogSummary) {
  summary.hiddenEvents += Math.max(runs.length - MAX_EVENTS_PER_KIND, 0);
  if (runs.length <= MAX_EVENTS_PER_KIND) {
    return runs;
  }
  return [...runs]
    .sort((a, b) => b.peak - a.peak)
    .slice(0, MAX_EVENTS_PER_KIND)
    .sort((a, b) => a.start - b.start);
}

function formatMs(frames: number, framesPerMs: number) {
  return `${Math.max(Math.round(frames / framesPerMs), 1)} ms`;
}

function usedOutputs(entries: LogColumns) {
  const outputs: LogColumn[] = [];
  for (let index = 0; ; index++) {
    const values = column(entries, "output", index);
    if (!values) {
      break;
    }
    if (values.some((v) => v != 0)) {
      outputs.push(values);
    }
  }
  return outputs;
}

function summarizeAxes(
  fields: BlackboxFieldDef[],
  entries: LogColumns,
  profile: any,
  axes: number[],
  axisNames: string[],
  closedLoop: ClosedLoop,
): AxisSummary[] {
  return axes.map((axis) => {
    const name = axisNames[axis];
    const gyro = column(entries, "gyro_filter", axis);
    const gyroDef = axisDef(fields, "gyro_filter", axis);
    const error = column(entries, "setpoint_error", axis);
    const errorDef = axisDef(fields, "setpoint", axis);

    let peakRate = 0;
    if (gyro && gyroDef) {
      for (const v of gyro) {
        peakRate = Math.max(peakRate, Math.abs(transformBlackbox(gyroDef, v)));
      }
    }

    const summary: AxisSummary = {
      name,
      peakRate,
      maxRate: rateMaxForAxis(profile, axis),
    };
    if (error?.length && errorDef && closedLoop.known) {
      let sum = 0;
      let count = 0;
      let peak = 0;
      for (let i = 0; i < error.length; i++) {
        if (closedLoop.mask && !closedLoop.mask[i]) continue;
        const v = transformBlackbox(errorDef, error[i]);
        sum += v * v;
        count++;
        peak = Math.max(peak, Math.abs(v));
      }
      if (count) {
        summary.rmsError = Math.sqrt(sum / count);
        summary.peakError = peak;
      }
    }
    return summary;
  });
}

function summarizeTrack(entries: LogColumns): FlightTrack | undefined {
  const lat = column(entries, "gps_coord", 0);
  const lon = column(entries, "gps_coord", 1);
  if (!lat || !lon) {
    return undefined;
  }

  const fixed: number[] = [];
  for (let i = 0; i < lat.length; i++) {
    if (lat[i] != 0 || lon[i] != 0) {
      fixed.push(i);
    }
  }
  if (fixed.length < 2) {
    return undefined;
  }

  const homeLat = column(entries, "gps_home", 0);
  const homeLon = column(entries, "gps_home", 1);
  const last = fixed[fixed.length - 1];
  const hasHome = !!(homeLat?.[last] || homeLon?.[last]);
  const originLat = hasHome ? homeLat![last] : lat[fixed[0]];
  const originLon = hasHome ? homeLon![last] : lon[fixed[0]];
  const eastScale = Math.cos((originLat * 1e-7 * Math.PI) / 180);

  const step = Math.max(Math.ceil(fixed.length / TRACK_POINTS), 1);
  const count = Math.ceil(fixed.length / step);
  const track: FlightTrack = {
    north: new Float32Array(count),
    east: new Float32Array(count),
    index: new Uint32Array(count),
    hasHome,
    homeNorth: 0,
    homeEast: 0,
    maxDistance: 0,
  };
  for (let n = 0; n < count; n++) {
    const i = fixed[Math.min(n * step, fixed.length - 1)];
    const north = (lat[i] - originLat) * 1e-7 * METERS_PER_DEGREE;
    const east = (lon[i] - originLon) * 1e-7 * METERS_PER_DEGREE * eastScale;
    track.north[n] = north;
    track.east[n] = east;
    track.index[n] = i;
    track.maxDistance = Math.max(track.maxDistance, Math.hypot(north, east));
  }
  return track;
}

export function summarizeLog(
  fields: BlackboxFieldDef[],
  entries: LogColumns,
  profile: any,
  framesPerMs: number,
): LogSummary {
  const frames = entries.time?.length || 0;
  const vehicle = profileVehicleLabel(profile);
  const isRover = vehicle == "Rover";
  // Rovers only close the loop on steering.
  const axes = isRover ? [2] : [0, 1, 2];
  const axisNames = isRover ? ROVER_AXIS_NAMES : AXIS_NAMES;
  const closedLoop = closedLoopFrames(entries, profile);
  const msFrames = (ms: number) => Math.max(Math.round(ms * framesPerMs), 1);
  const events: LogEvent[] = [];

  // processEntries repeats the previous frame over loop gaps.
  const loop = entries.loop;
  let filledFrames = 0;
  if (loop) {
    let gapStart = -1;
    for (let i = 1; i <= loop.length; i++) {
      const filled = i < loop.length && loop[i] == loop[i - 1];
      if (filled) {
        filledFrames++;
        if (gapStart < 0) {
          gapStart = i;
        }
      } else if (gapStart >= 0) {
        if (i - gapStart >= GAP_EVENT_FRAMES) {
          events.push({
            kind: "gap",
            severity: "warning",
            start: gapStart,
            end: i - 1,
            label: "Frames missing",
            detail: `${i - gapStart} frames (${formatMs(i - gapStart, framesPerMs)}) not logged`,
          });
        }
        gapStart = -1;
      }
    }
  }

  const strip: FlightStrip = { buckets: Math.min(STRIP_BUCKETS, frames) };
  const bucketOf = (i: number) => Math.floor((i * strip.buckets) / frames);
  const bucketCounts = new Uint32Array(strip.buckets);
  for (let i = 0; i < frames; i++) {
    bucketCounts[bucketOf(i)]++;
  }

  const summary: LogSummary = {
    frames,
    filledFrames,
    axes: summarizeAxes(fields, entries, profile, axes, axisNames, closedLoop),
    strip,
    events,
    hiddenEvents: 0,
  };

  const throttle = column(entries, "setpoint", 3);
  const throttleDef = axisDef(fields, "setpoint", 3);
  if (throttle && throttleDef && frames) {
    strip.throttle = new Float32Array(strip.buckets);
    let sum = 0;
    let max = 0;
    let min = 0;
    for (let i = 0; i < frames; i++) {
      const v = transformBlackbox(throttleDef, throttle[i]);
      sum += v;
      max = Math.max(max, v);
      min = Math.min(min, v);
      strip.throttle[bucketOf(i)] += v;
    }
    for (let b = 0; b < strip.buckets; b++) {
      strip.throttle[b] /= bucketCounts[b] || 1;
    }
    summary.throttle = { mean: sum / frames, max, min };
  }

  // Wings and rovers sit at full throttle or servo throw by design; saturation
  // only means lost authority on a multirotor.
  const outputs = vehicle == "Multirotor" ? usedOutputs(entries) : [];
  const outputDef = axisDef(fields, "output", 0);
  if (outputs.length && outputDef && frames) {
    const level = SATURATION_LEVEL * (outputDef.scale || 1);
    const saturated = (i: number) => {
      let peak: number | undefined;
      for (const out of outputs) {
        if (Math.abs(out[i]) >= level) {
          peak = Math.max(peak ?? 0, Math.abs(out[i]));
        }
      }
      return peak;
    };

    strip.saturation = new Float32Array(strip.buckets);
    let count = 0;
    for (let i = 0; i < frames; i++) {
      if (saturated(i) != undefined) {
        count++;
        strip.saturation[bucketOf(i)]++;
      }
    }
    for (let b = 0; b < strip.buckets; b++) {
      strip.saturation[b] /= bucketCounts[b] || 1;
    }

    const runs = findRuns(frames, saturated, 1, 0);
    const longest = runs.reduce((m, r) => Math.max(m, r.end - r.start + 1), 0);
    summary.saturation = {
      fraction: count / frames,
      longestMs: longest / framesPerMs,
    };

    const bursts = findRuns(
      frames,
      saturated,
      msFrames(SATURATION_MIN_MS),
      msFrames(EVENT_MERGE_MS),
    );
    for (const run of strongest(bursts, summary)) {
      events.push({
        kind: "saturation",
        severity: "warning",
        start: run.start,
        end: run.end,
        label: "Output saturation",
        detail: `Outputs at limit for ${formatMs(run.end - run.start + 1, framesPerMs)}`,
      });
    }
  }

  for (const axis of closedLoop.known ? axes : []) {
    const error = column(entries, "setpoint_error", axis);
    const errorDef = axisDef(fields, "setpoint", axis);
    if (!error || !errorDef) {
      continue;
    }
    const over = (i: number) => {
      if (closedLoop.mask && !closedLoop.mask[i]) {
        return undefined;
      }
      const v = Math.abs(transformBlackbox(errorDef, error[i]));
      return v >= TRACKING_ERROR_DEG_S ? v : undefined;
    };
    const runs = findRuns(
      frames,
      over,
      msFrames(TRACKING_MIN_MS),
      msFrames(EVENT_MERGE_MS),
    );
    for (const run of strongest(runs, summary)) {
      events.push({
        kind: "tracking",
        severity: "warning",
        start: run.start,
        end: run.end,
        label: `${axisNames[axis]} tracking error`,
        detail: `Peak ${run.peak.toFixed(0)} deg/s off setpoint`,
      });
    }
  }

  const nav = navigationStates(profile);
  const navState = nav ? column(entries, "debug", 4) : undefined;
  if (nav && navState && frames) {
    strip.rthState = new Uint8Array(strip.buckets);
    for (let b = 0; b < strip.buckets; b++) {
      strip.rthState[b] = navState[Math.floor(((b + 0.5) * frames) / strip.buckets)];
    }

    const name = (state: number) => nav.labels[state] ?? `${state}`;
    const runs = findRuns(frames, (i) => navState[i] || undefined, 1, 0);
    for (const run of runs) {
      const visited: number[] = [];
      for (let i = run.start; i <= run.end; i++) {
        if (visited[visited.length - 1] != navState[i]) {
          visited.push(navState[i]);
        }
      }
      // Navigation usually ends because the pilot switches it off, so the
      // last phase is where it stopped, not an outcome.
      const failure = visited.find((s) => nav.failures.has(s));
      const last = name(visited[visited.length - 1]);
      const loiter = nav.loiter && visited.every((s) => nav.loiter!.has(s));
      const what = loiter ? "Loiter" : "RTH";
      const label =
        failure != undefined
          ? `${what}: ${name(failure)}`
          : run.end >= frames - 1
            ? `${what} active until log end (${last})`
            : loiter
              ? "Loiter"
              : nav.home != undefined && visited.includes(nav.home)
                ? "RTH reached home"
                : `RTH stopped during ${last}`;
      events.push({
        kind: "rth",
        severity: failure != undefined ? "critical" : "info",
        start: run.start,
        end: run.end,
        label,
        detail: visited.map(name).join(" → "),
      });
    }
  }

  const cpu = column(entries, "cpu_load");
  if (cpu?.length) {
    let sum = 0;
    let peak = 0;
    for (const v of cpu) {
      sum += v;
      peak = Math.max(peak, v);
    }
    // Blackbox before 0.3.2 logged CPU time in microseconds.
    const mean = sum / cpu.length;
    summary.cpu = { mean, peak, unit: mean > 100 ? "us" : "%" };
  }

  summary.track = summarizeTrack(entries);
  events.sort((a, b) => a.start - b.start);
  return summary;
}
