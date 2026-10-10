<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-1">总榜单</h1>
    <p class="text-slate-400 text-sm mb-6">统计各用户累计游玩时长。</p>

    <div v-if="loading" class="text-slate-500">加载中…</div>
    <table v-else class="w-full text-sm">
      <thead class="text-slate-400">
        <tr class="border-b border-slate-800">
          <th class="text-left py-2">#</th>
          <th class="text-left py-2">玩家</th>
          <th class="text-right py-2">累计时长</th>
          <th class="text-right py-2">游玩次数</th>
          <th class="text-right py-2">游戏数</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in board" :key="i" class="border-b border-slate-800/60">
          <td class="py-2">{{ i + 1 }}</td>
          <td class="py-2">{{ row.name }}</td>
          <td class="py-2 text-right">{{ fmt(row.totalDurationMs) }}</td>
          <td class="py-2 text-right">{{ row.plays }}</td>
          <td class="py-2 text-right">{{ row.gamesCount }}</td>
        </tr>
        <tr v-if="board.length === 0">
          <td colspan="5" class="py-3 text-slate-500">暂无数据。</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const board = ref<any[]>([])
const loading = ref(true)

function fmt(ms: number) {
  const s = Math.round((ms || 0) / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`
}

onMounted(async () => {
  const res = await $fetch<{ leaderboard: any[] }>('/api/leaderboard/total').catch(() => ({ leaderboard: [] }))
  board.value = res.leaderboard || []
  loading.value = false
})
</script>
