<template>
  <section
    :aria-label="title"
    class="min-w-0 rounded-lg border border-line bg-panel"
  >
    <h2 class="px-3 pt-2 pb-1 text-sm font-semibold">{{ title }}</h2>
    <div class="px-1 pb-1"><slot /></div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
