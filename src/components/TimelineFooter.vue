<template>
  <div
    class="flex h-[110px] shrink-0 items-stretch gap-3 border-t border-line bg-panel px-2"
  >
    <StickOverlay class="hidden w-[220px] shrink-0 sm:block" />
    <TimelineComponent class="min-w-0 flex-1" />
  </div>
</template>

<script setup lang="ts">
import StickOverlay from "@/components/StickOverlay.vue";
import TimelineComponent from "@/components/TimelineComponent.vue";
</script>
