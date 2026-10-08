import { describe, expect, it } from "vitest";
import { BlackboxFieldUnit, type BlackboxFieldDef } from "@/log/types";
import { logCsv } from "./export";

const fields: BlackboxFieldDef[] = [
  { name: "time", title: "Time", scale: 1, unit: BlackboxFieldUnit.US },
  {
    name: "gyro_filter",
    title: "Gyro",
    scale: 1000,
    unit: BlackboxFieldUnit.RADIANS,
    axis: ["Roll", "Pitch"],
  },
  {
    name: "gps_coord",
    title: "GPS",
    scale: 1e7,
    unit: BlackboxFieldUnit.DEGREES,
    axis: ["Lat", "Lon"],
    axisDefs: [{ title: "Latitude" }, { title: "Longitude" }],
  },
];

describe("logCsv", () => {
  it("writes the selected rows in display units", () => {
    const csv = logCsv(
      fields,
      {
        time: Float64Array.of(1000, 2000, 3000),
        gyro_filter_0: Float32Array.of(0, Math.PI * 1000, 0),
        gyro_filter_1: Float32Array.of(0, -Math.PI * 500, 0),
        gps_coord_0: Float64Array.of(0, 471234567, 0),
        gps_coord_1: Float64Array.of(0, 85432109, 0),
      },
      1,
      2,
    );
    expect(csv).toBe(
      [
        "Time [us],Gyro Roll [deg],Gyro Pitch [deg],Latitude [deg],Longitude [deg]",
        "2000,180,-90,47.1234567,8.5432109",
        "",
      ].join("\n"),
    );
  });
});
