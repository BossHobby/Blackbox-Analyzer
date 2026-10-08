import {
  blackboxFieldIDToString,
  transformBlackbox,
  unitBlackbox,
  type BlackboxAxisDef,
  type BlackboxFieldDef,
  type LogColumns,
  PRECISE_FIELDS,
} from "@/log/types";

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function fileStem(filename: string) {
  return filename.replace(/\.json$/i, "") || "blackbox";
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Selected frames as CSV in display units, one column per field axis. */
export function logCsv(
  fields: BlackboxFieldDef[],
  entries: LogColumns,
  start: number,
  end: number,
) {
  const columns: {
    title: string;
    def: BlackboxAxisDef;
    key: string;
    digits: number;
  }[] = [];
  for (const field of fields) {
    const axes = field.axis?.length ? field.axis : [undefined];
    for (const [index, axis] of axes.entries()) {
      const id = {
        name: field.name,
        index: axis == undefined ? undefined : index,
      };
      const key = blackboxFieldIDToString(id);
      if (!entries[key]) continue;
      const def = { ...field, ...field.axisDefs?.[index] };
      columns.push({
        title:
          def.title && axis != undefined && def.title != field.title
            ? def.title
            : axis == undefined
              ? field.title
              : `${field.title} ${axis}`,
        def,
        key,
        // Float32 columns hold ~7 significant digits; coordinates need more.
        digits: PRECISE_FIELDS.has(field.name) ? 12 : 7,
      });
    }
  }

  const header = columns.map(({ title, def }) => {
    const unit = unitBlackbox(def);
    return csvCell(unit ? `${title} [${unit}]` : title);
  });
  const lines = [header.join(",")];
  for (let i = start; i < end; i++) {
    lines.push(
      columns
        .map(({ def, key, digits }) =>
          String(
            parseFloat(
              transformBlackbox(def, entries[key][i]).toPrecision(digits),
            ),
          ),
        )
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
