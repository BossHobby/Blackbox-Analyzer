<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, watch, nextTick } from "vue";
import { EllipsisVertical } from "@lucide/vue";
import Brand from "./Brand.vue";
import Icon, { type IconName } from "./Icon.vue";
import Appearance from "./Appearance.vue";
import { useAppearance } from "../../ui/useAppearance";
const props = defineProps<{
  active: string;
  navigation: { id: string; label: string; icon: IconName }[];
  title: string;
  detail: string;
  status: string;
  ready?: boolean;
  /** Shows the #sidebar slot as a column right of the content. */
  sidebar?: boolean;
}>();

const appearance = useAppearance();
const content = ref<HTMLElement>();
const menu = ref<HTMLDetailsElement>();
watch(
  () => props.active,
  async () => {
    if (menu.value) menu.value.open = false;
    await nextTick();
    if (content.value) {
      content.value.scrollTop = 0;
      content.value.scrollLeft = 0;
    }
  },
);
</script>
<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-workspace text-ink">
    <a href="#main-content" class="sr-only z-10 bg-panel p-3 focus:not-sr-only"
      >Skip to content</a
    >
    <header
      class="flex shrink-0 items-center gap-x-4 gap-y-3 border-b border-line bg-panel px-4 py-2"
    >
      <RouterLink to="/" class="shrink-0 text-ink" aria-label="GUACALYZER home"
        ><Brand
      /></RouterLink>
      <nav
        v-if="navigation.length"
        aria-label="Analysis"
        class="flex shrink-0 gap-0.5 rounded-md border border-line bg-subtle p-0.5"
      >
        <RouterLink
          v-for="item in navigation"
          :key="item.id"
          :to="item.id"
          :aria-current="active === item.id ? 'page' : undefined"
          :aria-label="item.label"
          class="flex min-h-8 items-center gap-2 rounded px-2.5 text-sm"
          :class="
            active === item.id
              ? 'bg-panel font-medium text-ink shadow-sm ring-1 ring-line'
              : 'text-muted hover:text-ink'
          "
        >
          <Icon
            :name="item.icon"
            :class="active === item.id ? 'text-accent' : ''"
          /><span class="hidden lg:inline">{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="flex min-w-0 flex-wrap items-center gap-3 text-xs">
        <strong v-if="title" class="truncate font-medium">{{ title }}</strong
        ><span
          v-if="detail"
          class="hidden border-l border-line pl-3 text-muted tabular-nums md:inline"
          >{{ detail }}</span
        ><span class="flex items-center gap-2 text-muted"
          ><span
            class="size-2 rounded-full"
            :class="ready ? 'bg-accent' : 'bg-muted'"
          /><span class="hidden md:inline">{{ status }}</span></span
        >
      </div>
      <div class="ml-auto flex items-center gap-2 text-xs text-muted">
        <slot name="connection" />
        <details ref="menu" class="relative">
          <summary
            class="flex size-9 cursor-pointer list-none items-center justify-center rounded-md hover:bg-subtle [&::-webkit-details-marker]:hidden"
            aria-label="More"
          >
            <EllipsisVertical :size="18" aria-hidden="true" />
          </summary>
          <div
            class="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-3 rounded-lg border border-line bg-panel p-3 shadow-lg"
          >
            <slot name="utilities" /><Appearance v-model="appearance" />
            <div class="flex items-center justify-between">
              <a
                href="https://config.bosshobby.com"
                target="_blank"
                rel="noreferrer"
                class="hover:text-ink"
                >Configurator</a
              ><a
                href="https://github.com/BossHobby/Blackbox-Analyzer"
                target="_blank"
                rel="noreferrer"
                class="hover:text-ink"
                >Source</a
              >
            </div>
          </div>
        </details>
      </div>
    </header>
    <div class="flex min-h-0 flex-1 flex-col md:flex-row">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <main
          id="main-content"
          ref="content"
          class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
          tabindex="-1"
        >
          <div class="w-full p-3 lg:p-4"><slot /></div>
        </main>
        <slot name="footer" />
      </div>
      <aside
        v-if="sidebar && $slots.sidebar"
        class="max-h-[45dvh] shrink-0 overflow-y-auto overscroll-contain border-t border-line bg-panel md:max-h-none md:w-[26rem] md:border-t-0 md:border-l"
      >
        <slot name="sidebar" />
      </aside>
    </div>
  </div>
</template>
