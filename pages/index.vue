<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <section class="mb-8">
      <h1 class="text-3xl font-bold">热门游戏</h1>
      <p class="text-slate-400 mt-2">由 AI 生成的单文件 HTML 小游戏，按游玩次数排序。</p>
    </section>

    <div class="flex gap-2 mb-6">
      <input
        v-model="q"
        placeholder="搜索游戏…"
        class="input flex-1"
        @keyup.enter="load"
      />
      <button class="btn" @click="load">搜索</button>
      <NuxtLink to="/create" class="btn bg-brand-600 hover:bg-brand-500 text-white">+ 创建</NuxtLink>
    </div>

    <div v-if="loading" class="text-slate-500">加载中…</div>
    <div v-else-if="games.length === 0" class="text-slate-500">暂无游戏，去创建一个吧。</div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <GameCard v-for="g in games" :key="g.id" :game="g" />
    </div>
  </div>
</template>

<script setup lang="ts">
const games = ref<any[]>([])
const q = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ games: any[] }>('/api/games', { query: { q: q.value || undefined, limit: 60 } })
    games.value = res.games || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  outline: none;
}
.input:focus {
  border-color: #6366f1;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  color: #cbd5e1;
  white-space: nowrap;
}
.btn:hover {
  border-color: #6366f1;
}
</style>
