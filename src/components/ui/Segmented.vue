<script setup lang="ts" generic="T extends string">
defineProps<{
  label: string;
  options: { value: T; label: string }[];
}>();
const model = defineModel<T>({ required: true });
</script>
<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="flex gap-0.5 rounded-md border border-line bg-subtle p-0.5 text-xs"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="min-h-7 rounded px-2.5"
      :class="
        model === option.value
          ? 'bg-panel font-medium text-ink shadow-sm ring-1 ring-line'
          : 'text-muted hover:text-ink'
      "
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
