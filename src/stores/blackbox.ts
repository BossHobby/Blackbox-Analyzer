import { defineStore } from "pinia";
import { useSpectrumStore } from "./spectrum";
import { useTimelineStore } from "./timeline";

export enum BlackboxFieldUnit {
  NONE = "none",
  US = "us",
  RADIANS = "rad",
  DEGREES = "deg",
  METERS = "m",
  HZ = "hz",
  G = "g",
  PERCENT = "percent",
}

export enum BlackboxLoadState {
  EMPTY = "empty",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
}

export interface BlackboxFieldDef {
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

export interface BlackboxAxisDef {
  title?: string;
  scale?: number;
  unit?: BlackboxFieldUnit;
}

export interface BlackboxFilterCutoff {
  kind: "gyro" | "dterm";
  frequency: number;
  label: string;
}

interface PickedBlackboxFile {
  name: string;
  text: string;
}

const AXIS_NAMES = ["Roll", "Pitch", "Yaw"];
const ROVER_AXIS_NAMES = ["Roll", "Pitch", "Steering", "Throttle"];
const DYNAMIC_NOTCH_DEBUG_FLAG = 0x1 << 0;
const ROVER_DEBUG_FLAG = 0x1 << 1;
const ROVER_DEBUG_FIELDS = [
  "Mode",
  "Steering Clamp",
  "Steering Scale",
  "Steering Throttle",
  "Decel Factor",
  "Throttle Assist",
  "Accel Factor",
];
const ROVER_DEBUG_SCALES = [1, 1, 100, 100, 100, 100, 100];
const DYNAMIC_NOTCH_DEBUG_FIELDS = AXIS_NAMES.flatMap((axis) => {
  return [1, 2, 3].map((peak) => `${axis} Notch ${peak}`);
});
const FILTER_TYPE_LABELS = ["Off", "PT1", "PT2", "PT3"];
const RATE_MODE_LABELS = ["Silverware", "Betaflight", "Actual"];
const OUTPUT_PROTOCOL_LABELS = ["Unused", "DShot", "Brushed", "PWM"];
const OUTPUT_SOURCE_LABELS: { [index: number]: string } = {
  1: "Throttle",
  2: "Roll",
  3: "Pitch",
  4: "Yaw",
  5: "RX",
};
const MULTI_AUX_LABELS: { [index: number]: string } = {
  0: "Arm",
  7: "Buzzer",
  12: "Blackbox",
  13: "Prearm",
  14: "OSD",
  15: "RTH",
};
const WING_AUX_LABELS: { [index: number]: string } = {
  0: "Arm",
  4: "Buzzer",
  7: "Blackbox",
  8: "Prearm",
  9: "OSD",
  10: "RTH",
  11: "Autotrim",
  12: "Autolaunch",
};
const ROVER_AUX_LABELS: { [index: number]: string } = {
  0: "Arm",
  1: "Buzzer",
  4: "Blackbox",
  5: "Prearm",
  6: "OSD",
  7: "RTH",
  8: "Rate Assist",
  9: "Rate Throttle",
};

export function blackboxFieldIDToString(id?: BlackboxFieldID) {
  if (!id) {
    return "";
  }
  if (id.index != undefined) {
    return id.name + "_" + id.index;
  }
  return id.name;
}

export function transformBlackbox(field: BlackboxFieldDef, val: number) {
  const scale = field.scale || 1;
  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
      return (val / scale) * (180 / Math.PI);

    default:
      return val / scale;
  }
}

export function unitBlackbox(field: BlackboxFieldDef) {
  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
    case BlackboxFieldUnit.DEGREES:
      return "deg";

    case BlackboxFieldUnit.METERS:
      return "m";

    case BlackboxFieldUnit.PERCENT:
      return "%";

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

function processEntries(entries: any[], fields: BlackboxFieldDef[]) {
  let lastEntry: any[] | undefined;
  const rawEntries = entries.reduce((validEntries: any[], entry: any[]) => {
    if (!Array.isArray(entry) || entry.length != fields.length) {
      if (lastEntry) {
        validEntries.push(lastEntry);
      }
      return validEntries;
    }
    lastEntry = entry;
    validEntries.push(entry);
    return validEntries;
  }, []);

  if (!rawEntries.length) {
    return [];
  }

  const startLoop = rawEntries[0][0];
  const endLoop = rawEntries[rawEntries.length - 1][0];

  if (!Number.isFinite(startLoop) || !Number.isFinite(endLoop)) {
    return rawEntries;
  }

  const fullEntries = [rawEntries[0]];
  for (let i = startLoop + 1, rawEntryIndex = 1; i <= endLoop; i++) {
    while (rawEntries[rawEntryIndex]?.[0] < i) {
      rawEntryIndex++;
    }

    const rawEntry = rawEntries[rawEntryIndex];
    if (rawEntry?.[0] == i) {
      fullEntries.push(rawEntry);
      rawEntryIndex++;
    } else {
      fullEntries.push(fullEntries[fullEntries.length - 1]);
    }
  }
  return fullEntries;
}

function finiteNumber(value: any) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function compactNumber(value: any, digits = 0) {
  const number = finiteNumber(value);
  if (number == undefined) {
    return undefined;
  }
  return Number.isInteger(number) ? number.toString() : number.toFixed(digits);
}

function cleanString(value: any) {
  return typeof value == "string" ? value.replace(/\0/g, "").trim() : "";
}

function decodeSemver(value: any) {
  const version = finiteNumber(value);
  if (version == undefined) {
    return undefined;
  }
  return `v${(version >> 16) & 0xff}.${(version >> 8) & 0xff}.${
    version & 0xff
  }`;
}

function debugFlags(profile: any) {
  return finiteNumber(profile?.blackbox?.debug_flags) || 0;
}

function isRoverDebugProfileLog(profile: any) {
  return (debugFlags(profile) & ROVER_DEBUG_FLAG) == ROVER_DEBUG_FLAG;
}

// firmware only serializes the vehicle-specific profile section for its build
function isRoverProfileLog(profile: any) {
  return !!profile?.rover || isRoverDebugProfileLog(profile);
}

function isWingProfileLog(profile: any) {
  return !!profile?.wing && !isRoverProfileLog(profile);
}

function profileVehicleLabel(profile: any) {
  if (!profile) {
    return undefined;
  }
  if (isRoverProfileLog(profile)) {
    return "Rover";
  }
  if (isWingProfileLog(profile)) {
    return "Wing";
  }
  return "Multirotor";
}

function isDynamicNotchProfileLog(profile: any) {
  return (
    (debugFlags(profile) & DYNAMIC_NOTCH_DEBUG_FLAG) == DYNAMIC_NOTCH_DEBUG_FLAG
  );
}

function activePidRate(profile: any) {
  const index = finiteNumber(profile?.pid?.pid_profile) || 0;
  return profile?.pid?.pid_rates?.[index];
}

function activeStickRate(profile: any) {
  const index = finiteNumber(profile?.pid?.stick_profile) || 0;
  return profile?.pid?.stick_rates?.[index];
}

function activeRateProfile(profile: any) {
  const index = finiteNumber(profile?.rate?.profile) || 0;
  return profile?.rate?.rates?.[index];
}

function rateModeLabel(profile: any) {
  const mode = finiteNumber(activeRateProfile(profile)?.mode);
  return mode != undefined ? RATE_MODE_LABELS[mode] : undefined;
}

function rateMaxForAxis(profile: any, axis: number) {
  if (isRoverProfileLog(profile) && axis == 2) {
    return finiteNumber(profile?.rover?.yaw_rate);
  }

  const rateProfile = activeRateProfile(profile);
  const mode = finiteNumber(rateProfile?.mode);
  if (mode == 0) {
    return finiteNumber(rateProfile?.rate?.[0]?.[axis]);
  }
  if (mode == 2) {
    return finiteNumber(rateProfile?.rate?.[1]?.[axis]);
  }
  return undefined;
}

function axisValues(values: any[] | undefined, digits = 0) {
  if (!Array.isArray(values)) {
    return undefined;
  }
  const parts = values.slice(0, 3).map((value) => compactNumber(value, digits));
  return parts.every(Boolean) ? parts.join("/") : undefined;
}

function pidAxisValue(profile: any, term: "kp" | "ki" | "kd", axis: number) {
  if (isRoverProfileLog(profile) && axis == 2) {
    return compactNumber(profile?.rover?.pid?.[term], 1);
  }
  return compactNumber(activePidRate(profile)?.[term]?.[axis], 1);
}

function pidAxisTitle(field: BlackboxFieldDef, profile: any, axis: number) {
  const term =
    field.name == "pid_pterm" ? "kp" : field.name == "pid_iterm" ? "ki" : "kd";
  const label = term.slice(1).toUpperCase();
  const value = pidAxisValue(profile, term, axis);
  return value
    ? `${field.title} ${AXIS_NAMES[axis]} (${label} ${value})`
    : undefined;
}

function setpointAxisTitle(
  field: BlackboxFieldDef,
  profile: any,
  axis: string,
  index: number
) {
  if (index == 3) {
    return `${field.title} ${axis}`;
  }
  const maxRate = rateMaxForAxis(profile, index);
  return maxRate != undefined
    ? `${field.title} ${axis} (${maxRate.toFixed(0)} deg/s)`
    : undefined;
}

function channelLabel(map: any) {
  const channel = finiteNumber(map?.channel);
  return channel != undefined && channel < 16 ? `CH${channel + 1}` : undefined;
}

function rxRoleChannel(profile: any, role: number) {
  return channelLabel(profile?.receiver?.role_map?.[role]);
}

function auxSummary(profile: any) {
  const labels = isRoverProfileLog(profile)
    ? ROVER_AUX_LABELS
    : isWingProfileLog(profile)
    ? WING_AUX_LABELS
    : MULTI_AUX_LABELS;
  return Object.entries(labels)
    .map(([index, label]) => {
      const channel = channelLabel(profile?.receiver?.aux?.[Number(index)]);
      return channel ? `${label} ${channel}` : undefined;
    })
    .filter((label): label is string => !!label)
    .slice(0, 4);
}

function rxAxisDefs(profile: any) {
  if (isRoverProfileLog(profile)) {
    const steeringChannel = rxRoleChannel(profile, 1);
    const throttleChannel = rxRoleChannel(profile, 0);
    return [
      { title: "RX Roll" },
      { title: "RX Pitch" },
      {
        title: steeringChannel
          ? `RX Steering (${steeringChannel})`
          : "RX Steering",
      },
      {
        title: throttleChannel
          ? `RX Throttle (${throttleChannel})`
          : "RX Throttle",
      },
    ];
  }

  return ["Roll", "Pitch", "Yaw", "Throttle"].map((name, role) => {
    const channel = rxRoleChannel(profile, role);
    return { title: channel ? `RX ${name} (${channel})` : `RX ${name}` };
  });
}

function outputSourceLabel(rule: any) {
  const source = finiteNumber(rule?.source);
  if (source == undefined || source <= 0) {
    return undefined;
  }

  let label = OUTPUT_SOURCE_LABELS[source] || `Source ${source}`;
  if (source == 5) {
    const sourceIndex = finiteNumber(rule?.source_index);
    label = sourceIndex != undefined ? `${label}${sourceIndex + 1}` : label;
  }

  const weight = finiteNumber(rule?.weight);
  if (weight != undefined && weight != 100) {
    return `${label} ${weight}%`;
  }
  return label;
}

function outputAxisDefs(profile: any, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const output = profile?.outputs?.[index];
    const targetOutput = finiteNumber(output?.target_output);
    const protocol = finiteNumber(output?.protocol);
    const outputLabel =
      targetOutput != undefined
        ? `Output ${targetOutput + 1}`
        : `Output ${index + 1}`;
    const protocolLabel =
      protocol != undefined ? OUTPUT_PROTOCOL_LABELS[protocol] : undefined;
    const sources = (profile?.mixer || [])
      .filter((rule: any) => finiteNumber(rule?.output_index) == index)
      .map(outputSourceLabel)
      .filter((label: string | undefined): label is string => !!label);

    const parts = [outputLabel];
    if (protocolLabel && protocolLabel != "Unused") {
      parts.push(protocolLabel);
    }
    if (sources.length) {
      parts.push(sources.join("+"));
    }

    return { title: parts.join(" ") };
  });
}

function debugAxisDefs(profile: any) {
  if (isRoverDebugProfileLog(profile)) {
    return ROVER_DEBUG_FIELDS.map((title, index) => ({
      title: `Debug ${title}`,
      scale: ROVER_DEBUG_SCALES[index] || 1,
      unit: BlackboxFieldUnit.NONE,
    }));
  }

  if (isDynamicNotchProfileLog(profile)) {
    return DYNAMIC_NOTCH_DEBUG_FIELDS.map((title) => ({
      title: `${title} Frequency`,
      scale: 1,
      unit: BlackboxFieldUnit.HZ,
    }));
  }

  return undefined;
}

function buildProfileSummaryTags(profile: any) {
  if (!profile) {
    return [] as string[];
  }

  const tags = [] as string[];
  const name = cleanString(profile?.meta?.name);
  const version = decodeSemver(profile?.meta?.version);
  const vehicle = profileVehicleLabel(profile);
  const blackboxRate = finiteNumber(profile?.blackbox?.sample_rate_hz);
  const pidRate = activePidRate(profile);
  const stickRate = activeStickRate(profile);
  const rateMode = rateModeLabel(profile);
  const cutoffs = profileFilterCutoffs(profile);
  const cutoffFrequencies = (kind: BlackboxFilterCutoff["kind"]) =>
    cutoffs
      .filter((cutoff) => cutoff.kind == kind)
      .map((cutoff) => `${cutoff.frequency.toFixed(0)}Hz`);
  const gyroCutoffs = cutoffFrequencies("gyro");
  const dtermCutoffs = cutoffFrequencies("dterm");

  if (name) {
    tags.push(name);
  }
  if (vehicle) {
    tags.push(vehicle);
  }
  if (version) {
    tags.push(`Profile ${version}`);
  }
  if (blackboxRate) {
    tags.push(`Blackbox ${blackboxRate}Hz`);
  }
  if (rateMode) {
    tags.push(`Rates ${rateMode}`);
  }
  if (pidRate) {
    const pids = [
      axisValues(pidRate.kp, 1),
      axisValues(pidRate.ki, 1),
      axisValues(pidRate.kd, 1),
    ];
    if (pids.every(Boolean)) {
      tags.push(`PID ${pids.join(" ")}`);
    }
  } else if (profile?.rover?.pid) {
    tags.push(
      `PID ${compactNumber(profile.rover.pid.kp, 1)}/${compactNumber(
        profile.rover.pid.ki,
        1
      )}/${compactNumber(profile.rover.pid.kd, 1)}`
    );
  }
  if (stickRate?.accelerator) {
    const accelerator = axisValues(stickRate.accelerator, 2);
    if (accelerator) {
      tags.push(`Stick accel ${accelerator}`);
    }
  }
  if (gyroCutoffs.length) {
    tags.push(`Gyro LPF ${gyroCutoffs.join("/")}`);
  }
  if (dtermCutoffs.length) {
    tags.push(`DTerm LPF ${dtermCutoffs.join("/")}`);
  }
  tags.push(...auxSummary(profile));

  return tags;
}

function enrichBlackboxField(
  field: BlackboxFieldDef,
  profile: any
): BlackboxFieldDef {
  const enriched: BlackboxFieldDef = {
    ...field,
    axis: field.axis ? [...field.axis] : undefined,
    axisDefs: field.axisDefs
      ? field.axisDefs.map((axis) => ({ ...axis }))
      : undefined,
  };

  switch (field.name) {
    case "rx":
      enriched.axis = isRoverProfileLog(profile)
        ? ROVER_AXIS_NAMES
        : field.axis || ["Roll", "Pitch", "Yaw", "Throttle"];
      enriched.axisDefs = rxAxisDefs(profile);
      break;

    case "setpoint":
      enriched.axisDefs = (field.axis || []).map((axis, index) => ({
        title: setpointAxisTitle(field, profile, axis, index),
        ...(index == 3 ? { unit: BlackboxFieldUnit.NONE } : {}),
      }));
      break;

    // older configurator exports labeled accel as radians
    case "accel_raw":
    case "accel_filter":
      enriched.unit = BlackboxFieldUnit.G;
      break;

    case "pid_pterm":
    case "pid_iterm":
    case "pid_dterm":
      enriched.axisDefs = (field.axis || AXIS_NAMES).map((_, index) => ({
        title: pidAxisTitle(field, profile, index),
      }));
      break;

    case "output":
      enriched.axisDefs = outputAxisDefs(profile, field.axis?.length || 0);
      break;

    case "debug":
      enriched.axisDefs = debugAxisDefs(profile);
      break;
  }

  return enriched;
}

function filterCutoff(
  kind: "gyro" | "dterm",
  label: string,
  parameter: any
): BlackboxFilterCutoff | undefined {
  const type = finiteNumber(parameter?.type) || 0;
  const frequency = finiteNumber(parameter?.cutoff_freq);
  if (type <= 0 || frequency == undefined || frequency <= 0) {
    return undefined;
  }

  return {
    kind,
    frequency,
    label: `${label} ${
      FILTER_TYPE_LABELS[type] || `Type ${type}`
    } ${frequency.toFixed(0)}Hz`,
  };
}

function profileFilterCutoffs(profile: any): BlackboxFilterCutoff[] {
  const filter = profile?.filter;
  if (!filter) {
    return [];
  }

  const cutoffs = [
    filterCutoff("gyro", "Gyro LPF1", filter.gyro?.[0]),
    filterCutoff("gyro", "Gyro LPF2", filter.gyro?.[1]),
    filterCutoff("dterm", "DTerm LPF1", filter.dterm?.[0]),
    filterCutoff("dterm", "DTerm LPF2", filter.dterm?.[1]),
  ].filter((cutoff): cutoff is BlackboxFilterCutoff => cutoff != undefined);

  const dynamicType = finiteNumber(filter.dterm_dynamic_type) || 0;
  const dynamicMin = finiteNumber(filter.dterm_dynamic_min);
  const dynamicMax = finiteNumber(filter.dterm_dynamic_max);
  if (
    dynamicType > 0 &&
    dynamicMin != undefined &&
    dynamicMax != undefined &&
    dynamicMin > 0 &&
    dynamicMax > 0
  ) {
    cutoffs.push(
      {
        kind: "dterm",
        frequency: dynamicMin,
        label: `DTerm Dyn Min ${dynamicMin.toFixed(0)}Hz`,
      },
      {
        kind: "dterm",
        frequency: dynamicMax,
        label: `DTerm Dyn Max ${dynamicMax.toFixed(0)}Hz`,
      }
    );
  }

  return cutoffs.sort((a, b) => a.frequency - b.frequency);
}

function validateBlackboxFile(blackbox: any) {
  if (!blackbox || typeof blackbox != "object") {
    throw new Error("Invalid blackbox file");
  }
  if (!Array.isArray(blackbox.fields) || !Array.isArray(blackbox.entries)) {
    throw new Error("Blackbox file is missing fields or entries");
  }
  if (!blackbox.fields.length || !blackbox.entries.length) {
    throw new Error("Blackbox file does not contain any log entries");
  }
  if (
    !Number.isFinite(blackbox.blackbox_rate) ||
    !Number.isFinite(blackbox.looptime)
  ) {
    throw new Error("Blackbox file has invalid timing metadata");
  }
}

async function pickBlackboxFile(): Promise<PickedBlackboxFile | undefined> {
  if ("showOpenFilePicker" in window) {
    const pickerOpts = {
      types: [
        {
          description: "Logs",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    };

    const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
    const file = await fileHandle.getFile();
    return { name: fileHandle.name, text: await file.text() };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : undefined);
    };
    input.click();
  });
}

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    rate: 0,
    looptime: 0,
    duration: 0,
    filename: "",
    loadState: BlackboxLoadState.EMPTY,
    loadError: "",
    profile: undefined as any,
    start: 0,
    end: -1,
    fields: {} as { [index: string]: BlackboxFieldDef },
    entries: {} as { [index: string]: Float32Array },
  }),
  getters: {
    entriesPerMS(state) {
      if (!state.looptime || !state.rate) {
        return 0;
      }
      return 1000 / state.looptime / state.rate;
    },
    isLoaded(state) {
      return state.loadState == BlackboxLoadState.LOADED;
    },
    sampleFrequency(state) {
      if (!state.looptime || !state.rate) {
        return 0;
      }
      return 1000000 / (state.rate * state.looptime);
    },
    entryCount(state) {
      return state.entries.time?.length || 0;
    },
    activeEnd(state) {
      const length = state.entries.time?.length || 0;
      return state.end > 0 ? Math.min(state.end, length) : length;
    },
    hasSelection(state) {
      const length = state.entries.time?.length || 0;
      const end = state.end > 0 ? Math.min(state.end, length) : length;
      return length > 0 && (state.start > 0 || end < length);
    },
    selectedEntryCount(): number {
      return Math.max(this.activeEnd - this.start, 0);
    },
    selectedDuration(state): number {
      const time = state.entries.time;
      if (!time?.length || this.selectedEntryCount <= 1) {
        return 0;
      }

      const start = Math.min(Math.max(state.start, 0), time.length - 1);
      const end = Math.min(
        Math.max(this.activeEnd - 1, start),
        time.length - 1
      );
      return (time[end] - time[start]) / 1000;
    },
    selectionStartIndex(state): number {
      const length = state.entries.time?.length || 0;
      return Math.min(Math.max(state.start, 0), length);
    },
    selectionEndIndex(): number {
      return this.activeEnd;
    },
    isRoverLog(state) {
      return isRoverProfileLog(state.profile);
    },
    isDynamicNotchLog(state) {
      return isDynamicNotchProfileLog(state.profile);
    },
    vehicleLabel(state) {
      return profileVehicleLabel(state.profile);
    },
    profileName(state) {
      return cleanString(state.profile?.meta?.name);
    },
    profileSummaryTags(state) {
      return buildProfileSummaryTags(state.profile);
    },
    filterCutoffs(state): BlackboxFilterCutoff[] {
      return profileFilterCutoffs(state.profile);
    },
    fieldOptions() {
      const options = [[]] as any[];
      const fields = Object.values(this.fields);

      const generateOption = (field: BlackboxFieldDef) => {
        if (!Array.isArray(field?.axis)) {
          options[0].push({
            ...field,
            id: { name: field.name } as BlackboxFieldID,
          });
          return;
        }

        const opt: any[] = [
          {
            ...field,
            id: { name: field.name } as BlackboxFieldID,
            title: field.title + " All",
            groupTitle: field.title,
            group: field?.axis.length,
          },
          ...field.axis.map((name, index) => {
            const axisDef = field.axisDefs?.[index] || {};
            return {
              ...field,
              ...axisDef,
              id: { name: field.name, index } as BlackboxFieldID,
              title: axisDef.title || field.title + " " + name,
              index,
            };
          }),
        ];
        options.push(opt);
      };

      for (const field of fields) {
        generateOption(field);
      }
      if (
        ["pid_pterm", "pid_iterm", "pid_dterm"].every(
          (name) => this.fields[name]
        )
      ) {
        generateOption({
          name: "pid_sum",
          scale: this.fields.pid_pterm.scale || 1,
          title: "Pid Sum",
          unit: BlackboxFieldUnit.NONE,
          axis: ["Roll", "Pitch", "Yaw"],
        });
      }

      if (this.fields.setpoint && this.fields.gyro_filter) {
        generateOption({
          name: "setpoint_error",
          scale: this.fields.setpoint.scale || 1,
          title: "Setpoint Error",
          unit: BlackboxFieldUnit.RADIANS,
          axis: ["Roll", "Pitch", "Yaw"],
        });
      }

      if (isRoverDebugProfileLog(this.profile)) {
        for (const [index, title] of ROVER_DEBUG_FIELDS.entries()) {
          if (!this.entries[`rover_debug_${index}`]) {
            continue;
          }
          generateOption({
            name: `rover_debug_${index}`,
            scale: ROVER_DEBUG_SCALES[index] || 1,
            title,
            unit: BlackboxFieldUnit.NONE,
          });
        }
      }

      return options;
    },
  },
  actions: {
    async loadBlackbox() {
      this.loadError = "";
      let pickedFile: PickedBlackboxFile | undefined;
      try {
        pickedFile = await pickBlackboxFile();
      } catch (err: any) {
        if (err?.name != "AbortError") {
          this.loadError = err instanceof Error ? err.message : String(err);
          this.loadState = BlackboxLoadState.ERROR;
        }
        return;
      }

      if (!pickedFile) {
        return;
      }

      await this.loadPickedBlackbox(pickedFile);
    },
    async loadBlackboxFile(file: File) {
      await this.loadPickedBlackbox({
        name: file.name,
        text: await file.text(),
      });
    },
    async loadPickedBlackbox(pickedFile: PickedBlackboxFile) {
      this.loadError = "";
      this.loadState = BlackboxLoadState.LOADING;
      this.clearLoadedData();

      let blackbox: any;
      try {
        blackbox = JSON.parse(pickedFile.text);
        validateBlackboxFile(blackbox);
      } catch (err) {
        this.loadError = err instanceof Error ? err.message : String(err);
        this.loadState = BlackboxLoadState.ERROR;
        return;
      }

      this.filename = pickedFile.name;
      this.profile = blackbox.profile;
      this.rate = blackbox.blackbox_rate;
      this.looptime = blackbox.looptime;
      this.start = 0;
      this.end = -1;
      const blackboxFields = (blackbox.fields as BlackboxFieldDef[]).map(
        (field) => enrichBlackboxField(field, this.profile)
      );
      this.fields = blackboxFields.reduce(
        (prev: any, curr: BlackboxFieldDef) => {
          prev[curr.name] = curr;
          return prev;
        },
        {}
      );

      const entries = {} as { [index: string]: Float32Array };
      const rawEntries = processEntries(blackbox.entries, blackboxFields);
      if (!rawEntries.length) {
        this.loadError = "Blackbox file does not contain any valid log entries";
        this.loadState = BlackboxLoadState.ERROR;
        return;
      }

      for (const [fieldIndex, field] of blackboxFields.entries()) {
        let fields = [{ name: field.name } as BlackboxFieldID];
        if (field.axis) {
          fields = field.axis.map((_, index) => {
            return { name: field.name, index } as BlackboxFieldID;
          });
        }
        for (const id of fields) {
          const values = new Float32Array(rawEntries.length);
          for (const [entryIndex, entry] of rawEntries.entries()) {
            let val = entry[fieldIndex];
            if (id.index != undefined) {
              val = Array.isArray(val)
                ? val[id.index]
                : id.index == 0
                ? val
                : 0;
            }
            values[entryIndex] = Number.isFinite(val) ? val : 0;
          }

          entries[blackboxFieldIDToString(id)] = values;
        }
      }
      for (let axis = 0; axis < 3; axis++) {
        const pterm = entries[`pid_pterm_${axis}`];
        const iterm = entries[`pid_iterm_${axis}`];
        const dterm = entries[`pid_dterm_${axis}`];
        if (pterm && iterm && dterm) {
          entries[`pid_sum_${axis}`] = Float32Array.from(pterm, (_, index) => {
            return pterm[index] + iterm[index] + dterm[index];
          });
        }

        const setpoint = entries[`setpoint_${axis}`];
        const gyroFilter = entries[`gyro_filter_${axis}`];
        if (setpoint && gyroFilter) {
          entries[`setpoint_error_${axis}`] = Float32Array.from(
            setpoint,
            (_, index) => {
              return setpoint[index] - gyroFilter[index];
            }
          );
        }
      }

      if (isRoverDebugProfileLog(this.profile)) {
        for (let index = 0; index < ROVER_DEBUG_FIELDS.length; index++) {
          const debug = entries[`debug_${index}`];
          if (debug) {
            entries[`rover_debug_${index}`] = debug;
          }
        }
      }

      this.entries = entries;
      this.loadState = BlackboxLoadState.LOADED;
      this.refreshAfterEntriesChanged();
    },
    cutEntries(start = 0, end = -1) {
      if (!this.entries.time?.length) {
        return;
      }

      const length = this.entries.time.length;
      const safeStart = Math.min(Math.max(Math.floor(start), 0), length);
      const safeEnd =
        end < 0
          ? length
          : Math.min(Math.max(Math.floor(end), safeStart), length);
      for (const key of Object.keys(this.entries)) {
        this.entries[key] = this.entries[key].slice(safeStart, safeEnd);
      }

      this.start = 0;
      this.end = -1;
      this.refreshAfterEntriesChanged();
    },
    refreshAfterEntriesChanged() {
      const time = this.entries.time;
      this.duration = time?.length
        ? (time[time.length - 1] - time[0]) / 1000
        : 0;

      const timeline = useTimelineStore();
      timeline.initTimeline(time?.length || 0, this.duration, this.isRoverLog);

      const spectrum = useSpectrumStore();
      spectrum.initSpectrum(this.isRoverLog);
    },
    clearLoadedData() {
      this.rate = 0;
      this.looptime = 0;
      this.duration = 0;
      this.filename = "";
      this.profile = undefined;
      this.start = 0;
      this.end = -1;
      this.fields = {};
      this.entries = {};

      useTimelineStore().$reset();
      useSpectrumStore().$reset();
    },
  },
});
