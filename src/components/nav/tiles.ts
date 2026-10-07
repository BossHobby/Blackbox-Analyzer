// Basemap tiles are fetched from these providers only when the user turns
// them on, since every request reveals the flight area to the provider.
// Swap a provider here to change it everywhere.
export type TileProvider = "off" | "streets" | "satellite";

export const TILE_PROVIDERS: Record<
  TileProvider,
  { url: string; attribution: string; maxZoom: number } | undefined
> = {
  off: undefined,
  streets: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
};

const STORAGE_KEY = "nav-map-tiles";

export function readTileProvider(): TileProvider {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value == "streets" || value == "satellite" ? value : "off";
  } catch {
    return "off";
  }
}

export function saveTileProvider(provider: TileProvider) {
  try {
    localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    /* The choice still applies for this session. */
  }
}
