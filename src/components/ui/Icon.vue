<script setup lang="ts">
import {
  Check,
  AlertTriangle,
  ChevronDown,
  LoaderCircle,
  Upload,
  Plus,
  X,
  SlidersHorizontal,
} from "@lucide/vue";
// Navigation icons are hand-drawn below; these cover everything else.
const icons = {
  check: Check,
  warning: AlertTriangle,
  chevron: ChevronDown,
  loading: LoaderCircle,
  upload: Upload,
  plus: Plus,
  close: X,
  settings: SlidersHorizontal,
};
const navigationPaths = {
  timeline: ["M3 5v14h18", "m6 14 3-5 3 3 4-7 3 4"],
  spectrum: ["M3 21h18", "M5 17v-3m4 3V7m4 10v-6m4 6V4m4 13v-4"],
};
export type IconName = keyof typeof icons | keyof typeof navigationPaths;
const props = defineProps<{ name: IconName }>();
const paths = (name: IconName) =>
  (navigationPaths as Record<string, string[]>)[name];
</script>
<template>
  <svg
    v-if="paths(props.name)"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <path v-for="path in paths(props.name)" :key="path" :d="path" />
  </svg>
  <component
    :is="icons[props.name as keyof typeof icons]"
    v-else
    :size="18"
    :stroke-width="1.75"
    aria-hidden="true"
    class="shrink-0"
  />
</template>
