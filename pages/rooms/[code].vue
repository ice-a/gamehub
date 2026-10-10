<template>
  <div class="max-w-5xl mx-auto px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h1 class="text-2xl font-bold">联机房</h1>
        <p class="text-slate-400 text-sm">
          房间码：<span class="font-mono text-brand-400 text-lg tracking-widest">{{ roomCode }}</span>
          <button class="ml-2 text-xs underline text-slate-400" @click="copyCode">复制分享链接</button>
        </p>
      </div>
      <div class="text-sm text-slate-400">
        连接：<span :class="connected ? 'text-green-400' : 'text-red-400'">{{ connected ? '已连接' : '连接中…' }}</span>
      </div>
    </div>

    <div v-if="status.startsWith('error')" class="text-red-400 mb-4">{{ status }}</div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
      <div>
        <GameFrame
          v-if="game"
          ref="frameRef"
          :game-id="game.id"
          :html="game.html"
          :multiplayer="true"
          :height="520"
          @game-event="onGameEvent"
        />
        <div v-else class="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500">
          等待房主载入游戏…（只有房主选择游戏时可联机试玩）
        </div>
      </div>

      <aside class="bg-slate-900 border border-slate-800 rounded-lg p-4 h-fit">
        <h2 class="font-semibold mb-2">房间成员（{{ members.length }}）</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="m in members" :key="m.clientId" class="flex items-center gap-2">
            <span>{{ m.name }}</span>
            <span v-if="m.host" class="text-[10px] px-1.5 py-0.5 rounded bg-brand-600 text-white">房主</span>
          </li>
          <li v-if="members.length === 0" class="text-slate-500">暂无</li>
        </ul>
        <p class="text-[11px] text-slate-500 mt-3 leading-relaxed">
          游戏可通过 <code>window.__GAMEHUB__</code> 收发实时事件实现联机逻辑（send / onMessage）。
        </p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const code = computed(() => route.params.code as string)
const isCreate = route.query.create === '1'
const gameId = (route.query.game as string) || ''
const name = (route.query.name as string) || '玩家'

const { playerId } = useUser()
const { connected, members, createRoom, joinRoom, sendEvent, on } = useGameWs()
const frameRef = ref<any>(null)
const game = ref<any>(null)
const roomCode = ref(code.value === 'new' ? '' : code.value)
const status = ref('connecting')

function onGameEvent(data: any) {
  sendEvent(data)
}

onMounted(async () => {
  if (gameId) {
    game.value = await $fetch(`/api/games/${gameId}`).catch(() => null)
  }
  const user = { userId: playerId(), name }
  on('created', (m: any) => {
    roomCode.value = m.code
    status.value = 'ready'
    // 更新 URL 为真实房间码（不触发重新挂载）
    history.replaceState({}, '', `/rooms/${m.code}`)
  })
  on('joined', () => {
    status.value = 'ready'
  })
  on('error', (m: any) => {
    status.value = 'error: ' + m.message
  })
  on('event', (m: any) => {
    frameRef.value?.sendToGame(m.data)
  })

  if (isCreate) {
    createRoom(gameId || null, user)
  } else if (roomCode.value) {
    joinRoom(roomCode.value, user)
  } else {
    status.value = 'error: 缺少房间码'
  }
})

function copyCode() {
  const url = `${location.origin}/rooms/${roomCode.value}`
  navigator.clipboard?.writeText(url)
  alert('房间链接已复制：' + url)
}
</script>
