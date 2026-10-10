<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-1">我的收藏</h1>
    <p class="text-slate-400 text-sm mb-6">凭 username 与 sign 验证后查看收藏。</p>

    <form v-if="!loaded" class="bg-slate-900 border border-slate-800 rounded-lg p-4 max-w-md space-y-3" @submit.prevent="verify">
      <input v-model="username" placeholder="用户名" class="input" />
      <input v-model="sign" type="password" placeholder="sign（口令）" class="input" />
      <p v-if="err" class="text-red-400 text-xs">{{ err }}</p>
      <button class="btn-primary">验证并查看</button>
    </form>

    <div v-else>
      <div class="flex items-center justify-between mb-4">
        <span class="text-slate-300">@{{ data.username }} 的收藏（{{ data.favorites.length }}）</span>
        <button class="btn" @click="logout">退出验证</button>
      </div>
      <div v-if="data.favorites.length === 0" class="text-slate-500 text-sm">还没有收藏。</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GameCard v-for="g in data.favorites" :key="g.id" :game="g" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const username = ref('')
const sign = ref('')
const err = ref('')
const loaded = ref(false)
const data = ref<any>({ username: '', favorites: [] })

async function verify() {
  err.value = ''
  if (!username.value.trim() || !sign.value) {
    err.value = '请填写用户名与 sign'
    return
  }
  try {
    data.value = await $fetch(`/api/favorites/${encodeURIComponent(username.value.trim())}`, {
      query: { sign: sign.value }
    })
    loaded.value = true
  } catch (e: any) {
    err.value = e?.data?.statusMessage || '验证失败'
  }
}

function logout() {
  loaded.value = false
  sign.value = ''
  data.value = { username: '', favorites: [] }
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
.btn {
  padding: 0.4rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  color: #cbd5e1;
  font-size: 0.85rem;
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
