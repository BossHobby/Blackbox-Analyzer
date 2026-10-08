import { onMounted, onUnmounted } from "vue";
import { useBlackboxStore } from "@/stores/blackbox";
import { useTimelineStore } from "@/stores/timeline";

export const TIMELINE_KEYS: [string, string][] = [
  ["← →", "pan (Shift: a whole window)"],
  ["+ −", "zoom"],
  ["0", "whole log"],
  ["N P", "next / previous event"],
  ["[ ]", "range start / end at the pointer"],
  ["Esc", "clear range"],
];

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))
  );
}

/** Timeline keyboard navigation, active while the calling view is mounted. */
export function useTimelineKeys() {
  const bb = useBlackboxStore();
  const tl = useTimelineStore();

  function jumpEvent(direction: 1 | -1) {
    if (!bb.entriesPerMS) return;
    // Event centres in ms, compared with 1 ms slack so a repeated press
    // moves past the event the window is already centred on.
    const centers = (bb.summary?.events || [])
      .map((event) => ({
        event,
        ms: (event.start + event.end) / 2 / bb.entriesPerMS,
      }))
      .sort((a, b) => a.ms - b.ms);
    const target =
      direction > 0
        ? centers.find(({ ms }) => ms > tl.cursor + 1)
        : centers.reverse().find(({ ms }) => ms < tl.cursor - 1);
    if (target) {
      tl.focusRange(target.event.start, target.event.end);
    }
  }

  function hoverIndex() {
    return Math.min(
      Math.max(Math.round(tl.windowHoverIndex), 0),
      bb.entryCount,
    );
  }

  function onKey(e: KeyboardEvent) {
    if (
      !bb.isLoaded ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      isEditable(e.target)
    ) {
      return;
    }

    const step = e.shiftKey ? tl.zoom : tl.zoom / 10;
    switch (e.key) {
      case "ArrowLeft":
        tl.moveCursor(step);
        break;
      case "ArrowRight":
        tl.moveCursor(-step);
        break;
      case "+":
      case "=":
        tl.modifyZoom(-0.2);
        break;
      case "-":
      case "_":
        tl.modifyZoom(0.25);
        break;
      case "0":
        tl.setZoom(tl._duration);
        tl.setCursor(tl._duration / 2);
        break;
      case "n":
      case "N":
        jumpEvent(1);
        break;
      case "p":
      case "P":
        jumpEvent(-1);
        break;
      case "[":
        bb.start = hoverIndex();
        if (bb.end > 0 && bb.end <= bb.start) bb.end = -1;
        break;
      case "]":
        bb.end = Math.max(hoverIndex(), bb.start + 1);
        break;
      case "Escape":
        bb.start = 0;
        bb.end = -1;
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  onMounted(() => window.addEventListener("keydown", onKey));
  onUnmounted(() => window.removeEventListener("keydown", onKey));
}
