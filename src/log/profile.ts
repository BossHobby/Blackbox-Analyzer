import {
  BlackboxFieldUnit,
  type BlackboxAxisDef,
  type BlackboxFieldDef,
  type BlackboxFilterCutoff,
} from "./types";

const AXIS_NAMES = ["Roll", "Pitch", "Yaw"];
const ROVER_AXIS_NAMES = ["Roll", "Pitch", "Steering", "Throttle"];
const DYNAMIC_NOTCH_DEBUG_FLAG = 0x1 << 0;
const ROVER_DEBUG_FLAG = 0x1 << 1;
const NAVIGATION_DEBUG_FLAG = 0x1 << 2;
const WING_DEBUG_FLAG = 0x1 << 3;
// Enum and bitfield names match the firmware's control.h / profile.h order.
const ROVER_MODE_LABELS = ["Manual", "Rate Assist", "Rate Throttle"];
const RTH_STATE_LABELS = [
  "Inactive",
  "Climb",
  "Acquire Heading",
  "Turn",
  "Navigate",
  "Hover Home",
  "Heading Failed",
  "Aborted",
  "Nav Failed",
];
const HEADING_CORRECTION_FLAGS = [
  "No Fix",
  "Stale",
  "Low Speed",
  "Poor Accuracy",
  "Roll",
  "Yaw",
  "Not Forward",
  "RTH Phase",
];
const WING_MODE_LABELS = ["Manual", "Acro", "Level"];
const WING_LAUNCH_LABELS = [
  "Idle",
  "Idle Delay",
  "Wait",
  "Detected",
  "Motor Delay",
  "Spinup",
  "Active",
  "Finish",
  "Done",
  "Aborted",
];
const WING_AUTOTRIM_LABELS = ["Idle", "Active", "Save Pending", "Saved"];
const FAILSAFE_PHASE_LABELS = [
  "Idle",
  "Hold Last",
  "Stage 1 Guard",
  "Stage 2 Drop",
  "Recovery",
];
const NONE = BlackboxFieldUnit.NONE;
export const ROVER_DEBUG_FIELDS: BlackboxAxisDef[] = [
  { title: "Mode", scale: 1, unit: NONE, labels: ROVER_MODE_LABELS },
  { title: "Steering Clamp", scale: 1, unit: NONE },
  { title: "Steering Scale", scale: 100, unit: NONE },
  { title: "Steering Throttle", scale: 100, unit: NONE },
  { title: "Decel Factor", scale: 100, unit: NONE },
  { title: "Throttle Assist", scale: 100, unit: NONE },
  { title: "Accel Factor", scale: 100, unit: NONE },
];
// Slot layouts match the firmware's blackbox_set_debug() call sites.
const NAVIGATION_DEBUG_FIELDS: BlackboxAxisDef[] = [
  { title: "Heading", scale: 10, unit: BlackboxFieldUnit.DEGREES },
  { title: "GPS Heading", scale: 10, unit: BlackboxFieldUnit.DEGREES },
  { title: "Altitude", scale: 10, unit: BlackboxFieldUnit.METERS },
  { title: "Heading Confidence", scale: 10, unit: BlackboxFieldUnit.PERCENT },
  { title: "RTH State", scale: 1, unit: NONE, labels: RTH_STATE_LABELS },
  { title: "Home Distance", scale: 1, unit: BlackboxFieldUnit.METERS },
  { title: "Home Bearing", scale: 10, unit: BlackboxFieldUnit.DEGREES },
  {
    title: "Heading Correction Flags",
    scale: 1,
    unit: NONE,
    flags: HEADING_CORRECTION_FLAGS,
  },
  { title: "GPS Heading Accuracy", scale: 10, unit: BlackboxFieldUnit.DEGREES },
  { title: "Heading Error", scale: 10, unit: BlackboxFieldUnit.DEGREES },
  { title: "Desired Vel North (m/s)", scale: 10, unit: BlackboxFieldUnit.NONE },
  { title: "Desired Vel East (m/s)", scale: 10, unit: BlackboxFieldUnit.NONE },
  { title: "GPS Vel North (m/s)", scale: 10, unit: BlackboxFieldUnit.NONE },
  { title: "GPS Vel East (m/s)", scale: 10, unit: BlackboxFieldUnit.NONE },
  { title: "RX Override Pitch", scale: 1000, unit: BlackboxFieldUnit.NONE },
  { title: "RX Override Roll", scale: 1000, unit: BlackboxFieldUnit.NONE },
];
const WING_DEBUG_FIELDS: BlackboxAxisDef[] = [
  { title: "Mode", scale: 1, unit: NONE, labels: WING_MODE_LABELS },
  { title: "Launch State", scale: 1, unit: NONE, labels: WING_LAUNCH_LABELS },
  {
    title: "Autotrim State",
    scale: 1,
    unit: NONE,
    labels: WING_AUTOTRIM_LABELS,
  },
  {
    title: "Failsafe Phase",
    scale: 1,
    unit: NONE,
    labels: FAILSAFE_PHASE_LABELS,
  },
];
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

export function cleanString(value: any) {
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

function hasDebugFlag(profile: any, flag: number) {
  return (debugFlags(profile) & flag) == flag;
}

export function isRoverDebugProfileLog(profile: any) {
  return hasDebugFlag(profile, ROVER_DEBUG_FLAG);
}

// firmware only serializes the vehicle-specific profile section for its build
export function isRoverProfileLog(profile: any) {
  return !!profile?.rover || isRoverDebugProfileLog(profile);
}

function isWingProfileLog(profile: any) {
  return !!profile?.wing && !isRoverProfileLog(profile);
}

export function profileVehicleLabel(profile: any) {
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

export function isDynamicNotchProfileLog(profile: any) {
  return hasDebugFlag(profile, DYNAMIC_NOTCH_DEBUG_FLAG);
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
  index: number,
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
    return ROVER_DEBUG_FIELDS.map((def) => ({
      ...def,
      title: `Debug ${def.title}`,
    }));
  }

  if (isDynamicNotchProfileLog(profile)) {
    return DYNAMIC_NOTCH_DEBUG_FIELDS.map((title) => ({
      title: `${title} Frequency`,
      scale: 1,
      unit: BlackboxFieldUnit.HZ,
    }));
  }

  if (hasDebugFlag(profile, NAVIGATION_DEBUG_FLAG)) {
    return NAVIGATION_DEBUG_FIELDS.map((def) => ({
      ...def,
      title: `Debug ${def.title}`,
    }));
  }

  if (hasDebugFlag(profile, WING_DEBUG_FLAG)) {
    return WING_DEBUG_FIELDS.map((def) => ({
      ...def,
      title: `Debug ${def.title}`,
    }));
  }

  return undefined;
}

export function buildProfileSummaryTags(profile: any) {
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
        1,
      )}/${compactNumber(profile.rover.pid.kd, 1)}`,
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

export function enrichBlackboxField(
  field: BlackboxFieldDef,
  profile: any,
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
  parameter: any,
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

export function profileFilterCutoffs(profile: any): BlackboxFilterCutoff[] {
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
      },
    );
  }

  return cutoffs.sort((a, b) => a.frequency - b.frequency);
}
