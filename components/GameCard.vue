<template>
  <NuxtLink
    :to="`/games/${game.id}`"
    class="block bg-slate-900 border border-slate-800 hover:border-brand-500 rounded-xl p-4 transition"
  >
    <div class="flex items-start justify-between gap-2">
      <h3 class="font-semibold truncate">{{ game.title }}</h3>
      <span class="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-brand-400">{{ styleLabel }}</span>
    </div>
    <p class="text-sm text-slate-400 mt-1 line-clamp-2">{{ game.description }}</p>
    <div class="flex items-center gap-4 text-xs text-slate-500 mt-3">
      <span>▶ 游玩 {{ game.playCount || 0 }}</span>
      <span>👥 {{ game.playerCount || 0 }} 人</span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  game: {
    id: string
    title: string
    description: string
    style: string
    playCount?: number
    playerCount?: number
  }
}>()

const STYLES: Record<string, string> = {
  retro: '复古像素',
  neon: '赛博霓虹',
  casual: '休闲卡通',
  minimal: '极简',
  pixel: '像素冒险',
  puzzle: '解谜'
}
const styleLabel = computed(() => STYLES[props.game.style] || props.game.style || '默认')
</script>
