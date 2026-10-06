<template>
  <div class="flex flex-wrap items-center gap-2 text-xs">
    <div class="contents tabular-nums">
      <span
        class="rounded border border-accent px-2 py-1 font-medium text-accent"
        >{{ bb.profileName || bb.filename }}</span
      >
      <span class="rounded border border-line bg-panel px-2 py-1"
        >{{ bb.entryCount }} samples</span
      >
      <span class="rounded border border-line bg-panel px-2 py-1">{{
        formatDuration(bb.duration)
      }}</span>
      <span class="rounded border border-line bg-panel px-2 py-1"
        >{{ bb.sampleFrequency.toFixed(0) }} Hz</span
      >
      <slot />
      <span
        v-if="bb.hasSelection"
        class="rounded border border-line bg-panel px-2 py-1"
      >
        Selected {{ bb.selectedEntryCount }} samples ·
        {{ formatDuration(bb.selectedDuration) }}
      </span>
    </div>
    <div v-if="bb.profileSummaryTags.length" class="contents">
      <span
        v-for="tag in bb.profileSummaryTags"
        :key="'profile-tag-' + tag"
        class="rounded border border-line bg-subtle px-2 py-1 text-muted"
      >
        {{ tag }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDuration, useBlackboxStore } from "@/stores/blackbox";

const bb = useBlackboxStore();
</script>
