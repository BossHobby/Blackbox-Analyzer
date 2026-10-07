import {
  ROVER_DEBUG_FIELDS,
  enrichBlackboxField,
  isRoverDebugProfileLog,
} from "./profile";
import {
  PRECISE_FIELDS,
  blackboxFieldIDToString,
  type BlackboxFieldDef,
  type BlackboxFieldID,
  type LogColumns,
} from "./types";

export interface ParsedLog {
  rate: number;
  looptime: number;
  profile: any;
  fields: BlackboxFieldDef[];
  entries: LogColumns;
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

// Repeats the last valid entry over malformed entries and loop gaps, so every
// column has one sample per loop.
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

function splitColumns(rawEntries: any[][], fields: BlackboxFieldDef[]) {
  const entries: LogColumns = {};
  for (const [fieldIndex, field] of fields.entries()) {
    let ids = [{ name: field.name } as BlackboxFieldID];
    if (field.axis) {
      ids = field.axis.map((_, index) => ({ name: field.name, index }));
    }
    const Column = PRECISE_FIELDS.has(field.name) ? Float64Array : Float32Array;

    for (const id of ids) {
      const values = new Column(rawEntries.length);
      for (let entryIndex = 0; entryIndex < rawEntries.length; entryIndex++) {
        let val = rawEntries[entryIndex][fieldIndex];
        if (id.index != undefined) {
          val = Array.isArray(val) ? val[id.index] : id.index == 0 ? val : 0;
        }
        values[entryIndex] = Number.isFinite(val) ? val : 0;
      }
      entries[blackboxFieldIDToString(id)] = values;
    }
  }
  return entries;
}

function addDerivedColumns(entries: LogColumns, profile: any) {
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
        (_, index) => setpoint[index] - gyroFilter[index],
      );
    }
  }

  if (isRoverDebugProfileLog(profile)) {
    for (let index = 0; index < ROVER_DEBUG_FIELDS.length; index++) {
      const debug = entries[`debug_${index}`];
      if (debug) {
        entries[`rover_debug_${index}`] = debug;
      }
    }
  }
}

export function parseBlackbox(text: string): ParsedLog {
  const blackbox = JSON.parse(text);
  validateBlackboxFile(blackbox);

  const profile = blackbox.profile;
  const fields = (blackbox.fields as BlackboxFieldDef[]).map((field) =>
    enrichBlackboxField(field, profile),
  );

  const rawEntries = processEntries(blackbox.entries, fields);
  if (!rawEntries.length) {
    throw new Error("Blackbox file does not contain any valid log entries");
  }

  const entries = splitColumns(rawEntries, fields);
  addDerivedColumns(entries, profile);

  return {
    rate: blackbox.blackbox_rate,
    looptime: blackbox.looptime,
    profile,
    fields,
    entries,
  };
}
