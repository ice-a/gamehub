<template>
  <div class="max-w-5xl mx-auto px-4 py-8" v-if="game">
    <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
      <div>
        <h1 class="text-2xl font-bold">{{ game.title }}</h1>
        <p class="text-slate-400 mt-1">{{ game.description }}</p>
        <div class="flex items-center gap-4 text-sm text-slate-500 mt-2">
          <span>▶ 游玩 {{ game.playCount }}</span>
          <span>👥 {{ game.playerCount }} 人</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <FavoriteButton :game-id="game.id" />
        <a :href="`/api/games/${game.id}/download`" class="px-3 py-1.5 rounded-md text-sm border border-slate-600 text-slate-300 hover:border-brand-500" download>⬇ 下载 HTML</a>
      </div>
    </div>

    <GameFrame :game-id="game.id" :html="game.html" :height="560" />

    <section class="mt-8">
      <h2 class="text-xl font-semibold mb-3">本游戏榜单</h2>
      <div v-if="boardLoading" class="text-slate-500">加载中…</div>
      <table v-else class="w-full text-sm">
        <thead class="text-slate-400">
          <tr class="border-b border-slate-800">
            <th class="text-left py-2">#</th>
            <th class="text-left py-2">玩家</th>
            <th class="text-right py-2">最高分</th>
            <th class="text-right py-2">累计时长</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in leaderboard" :key="i" class="border-b border-slate-800/60">
            <td class="py-2">{{ i + 1 }}</td>
            <td class="py-2">{{ row.name }}</td>
            <td class="py-2 text-right">{{ row.bestScore }}</td>
            <td class="py-2 text-right">{{ fmt(row.totalDurationMs) }}</td>
          </tr>
          <tr v-if="leaderboard.length === 0">
            <td colspan="4" class="py-3 text-slate-500">还没有记录，快去玩一局吧。</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
  <div v-else class="max-w-5xl mx-auto px-4 py-8 text-slate-500">加载中…</div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const game = ref<any>(null)
const leaderboard = ref<any[]>([])
const boardLoading = ref(true)

function fmt(ms: number) {
  const s = Math.round((ms || 0) / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`
}

onMounted(async () => {
  game.value = await $fetch(`/api/games/${id}`)
  const lb = await $fetch<{ leaderboard: any[] }>(`/api/games/${id}/leaderboard`).catch(() => ({ leaderboard: [] }))
  leaderboard.value = lb.leaderboard || []
  boardLoading.value = false
})
</script>
