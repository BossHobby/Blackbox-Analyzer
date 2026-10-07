import { useRouter } from "vue-router";
import { useBlackboxStore } from "@/stores/blackbox";
import { useTimelineStore } from "@/stores/timeline";

/** Frame index <-> log position helpers shared by the Overview widgets. */
export function useLogPosition() {
  const bb = useBlackboxStore();
  const tl = useTimelineStore();
  const router = useRouter();

  return {
    // Milliseconds since log start, matching the timeline's frame-based axis.
    msAt(index: number) {
      return bb.entriesPerMS ? index / bb.entriesPerMS : 0;
    },
    cursorIndex() {
      return tl.cursor * bb.entriesPerMS;
    },
    jump(start: number, end = start) {
      tl.focusRange(start, end);
      router.push("/timeline");
    },
  };
}
