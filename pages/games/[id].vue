<template>
  <div class="max-w-5xl mx-auto px-4 py-8" v-if="game">
    <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
      <div>
        <h1 class="text-2xl font-bold">{{ game.title }}</h1>
        <p class="text-slate-400 mt-1" :class="{ 'line-clamp-3': !descExpanded }">{{ game.description }}</p>
        <button
          v-if="game.description && game.description.length > 60"
          class="text-brand-400 text-sm mt-1 hover:underline"
          @click="descExpanded = !descExpanded"
        >{{ descExpanded ? '收起 ▲' : '展开介绍 ▼' }}</button>
        <div class="flex items-center gap-4 text-sm text-slate-500 mt-2">
          <span>▶ 游玩 {{ game.playCount }}</span>
          <span>👥 {{ game.playerCount }} 人</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <FavoriteButton :game-id="game.id" />
        <button
          class="px-3 py-1.5 rounded-md text-sm border border-amber-600 text-amber-300 hover:bg-amber-600/10"
          @click="reportOpen = true"
        >⚠ 提交问题</button>
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

  <!-- 举报弹窗 -->
  <div v-if="reportOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" @click.self="reportOpen = false">
    <div class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h3 class="text-lg font-semibold mb-3">提交游戏问题</h3>
      <p class="text-sm text-slate-400 mb-3">如果游戏无法运行、有严重 bug 或内容不当，请告诉我们。同一用户仅计一次，达到 5 次举报将自动隐藏该游戏。</p>
      <textarea
        v-model="reportReason"
        rows="3"
        placeholder="问题描述（可选）"
        class="input w-full mb-3"
      ></textarea>
      <div v-if="reportMsg" class="text-sm mb-3" :class="reportOk ? 'text-green-400' : 'text-red-400'">{{ reportMsg }}</div>
      <div class="flex justify-end gap-2">
        <button class="px-3 py-1.5 rounded-md text-sm border border-slate-600 text-slate-300" @click="reportOpen = false">取消</button>
        <button
          class="px-3 py-1.5 rounded-md text-sm bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
          :disabled="reporting"
          @click="submitReport"
        >{{ reporting ? '提交中…' : '提交举报' }}</button>
      </div>
    </div>
  </div>

  <div v-else-if="gameHidden" class="max-w-5xl mx-auto px-4 py-16 text-center">
    <h1 class="text-2xl font-bold mb-2">游戏不可用</h1>
    <p class="text-slate-400">{{ hiddenMsg || '该游戏因收到多处问题反馈已被隐藏。' }}</p>
    <NuxtLink to="/" class="inline-block mt-4 text-brand-400 hover:underline">返回首页</NuxtLink>
  </div>
  <div v-else class="max-w-5xl mx-auto px-4 py-8 text-slate-500">加载中…</div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const game = ref<any>(null)
const gameHidden = ref(false)
const hiddenMsg = ref('')
const leaderboard = ref<any[]>([])
const boardLoading = ref(true)

const reportOpen = ref(false)
const reportReason = ref('')
const descExpanded = ref(false)
const reportMsg = ref('')
const reportOk = ref(false)
const reporting = ref(false)
const { playerId } = useUser()

function fmt(ms: number) {
  const s = Math.round((ms || 0) / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`
}

async function submitReport() {
  reporting.value = true
  reportMsg.value = ''
  try {
    const res = await $fetch<{ reportCount: number; hidden: boolean; alreadyReported: boolean }>(
      `/api/games/${id}/report`,
      { method: 'POST', body: { userId: playerId(), reason: reportReason.value } }
    )
    reportOk.value = true
    reportMsg.value = res.alreadyReported
      ? `你已举报过该游戏（当前 ${res.reportCount} 次举报）`
      : `举报已提交（当前 ${res.reportCount} 次举报${res.hidden ? '，游戏已被隐藏' : ''}）`
    setTimeout(() => (reportOpen.value = false), 1200)
  } catch (e: any) {
    reportOk.value = false
    reportMsg.value = e?.data?.statusMessage || e?.message || '举报失败，请稍后再试'
  } finally {
    reporting.value = false
  }
}

onMounted(async () => {
  try {
    game.value = await $fetch(`/api/games/${id}`)
  } catch (e: any) {
    if (e?.statusCode === 404) {
      gameHidden.value = true
      hiddenMsg.value = e?.data?.statusMessage || ''
    } else {
      hiddenMsg.value = '加载失败，请刷新重试'
      gameHidden.value = true
    }
    boardLoading.value = false
    return
  }
  const lb = await $fetch<{ leaderboard: any[] }>(`/api/games/${id}/leaderboard`).catch(() => ({ leaderboard: [] }))
  leaderboard.value = lb.leaderboard || []
  boardLoading.value = false
})
</script>
