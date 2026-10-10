<template>
  <div class="max-w-md mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold mb-6 text-center">多人联机大厅</h1>

    <div class="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-4">
      <h2 class="font-semibold mb-3">创建房间（房主）</h2>
      <input v-model="hostName" placeholder="你的昵称" class="input mb-2" />
      <input v-model="hostGame" :placeholder="prefillGame || '游戏 ID（可选，留空仅聊天房）'" class="input mb-3" />
      <button class="w-full btn-primary" @click="create">创建并发起</button>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-lg p-5">
      <h2 class="font-semibold mb-3">加入房间</h2>
      <input v-model="joinCode" placeholder="6 位房间码" class="input mb-2" />
      <input v-model="joinName" placeholder="你的昵称" class="input mb-3" />
      <button class="w-full btn-primary" @click="join">加入房间</button>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const prefillGame = (route.query.game as string) || ''
const hostName = ref('')
const hostGame = ref(prefillGame)
const joinCode = ref('')
const joinName = ref('')

function create() {
  const name = encodeURIComponent(hostName.value || '房主')
  const game = hostGame.value ? `&game=${encodeURIComponent(hostGame.value)}` : ''
  navigateTo(`/rooms/new?create=1&name=${name}${game}`)
}
function join() {
  const name = encodeURIComponent(joinName.value || '玩家')
  const code = joinCode.value.trim()
  if (!code) return
  const game = hostGame.value ? `&game=${encodeURIComponent(hostGame.value)}` : ''
  navigateTo(`/rooms/${code}?name=${name}${game}`)
}
</script>

<style scoped>
.input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  outline: none;
}
.btn-primary {
  background: #4f46e5;
  color: #fff;
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
}
.btn-primary:hover {
  background: #6366f1;
}
</style>
