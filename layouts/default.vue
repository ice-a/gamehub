<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <NuxtLink to="/" class="font-bold text-lg text-brand-400 flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-brand-500"></span>
          GameHub
        </NuxtLink>
        <nav class="flex items-center gap-1 text-sm">
          <NuxtLink to="/" class="px-3 py-1.5 rounded-md hover:bg-slate-800">热门</NuxtLink>
          <NuxtLink to="/create" class="px-3 py-1.5 rounded-md hover:bg-slate-800">创建游戏</NuxtLink>
          <NuxtLink to="/leaderboard" class="px-3 py-1.5 rounded-md hover:bg-slate-800">总榜单</NuxtLink>
          <NuxtLink v-if="user" to="/favorites" class="px-3 py-1.5 rounded-md hover:bg-slate-800">我的收藏</NuxtLink>
        </nav>
        <div class="ml-auto flex items-center gap-2 text-sm">
          <template v-if="user">
            <NuxtLink :to="`/users/${user.id}`" class="px-3 py-1.5 rounded-md hover:bg-slate-800">
              {{ user.displayName }}
            </NuxtLink>
            <button class="px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-400" @click="logout">退出</button>
          </template>
          <template v-else>
            <button class="px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white" @click="open = true">
              登录 / 注册
            </button>
          </template>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-slate-800 text-center text-xs text-slate-500 py-6">
      GameHub · Nuxt 全栈游戏平台 · 单文件 HTML 游戏生成与分享
    </footer>

    <!-- 登录/注册弹窗 -->
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="open = false">
      <div class="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-5">
        <div class="flex gap-2 mb-4">
          <button :class="mode === 'login' ? 'tab-active' : 'tab'" @click="mode = 'login'">登录</button>
          <button :class="mode === 'register' ? 'tab-active' : 'tab'" @click="mode = 'register'">注册</button>
        </div>
        <form @submit.prevent="submit" class="space-y-3">
          <input v-model="form.username" placeholder="用户名" class="input" />
          <input v-model="form.sign" type="password" placeholder="sign（口令，4 位以上）" class="input" />
          <input v-if="mode === 'register'" v-model="form.displayName" placeholder="昵称（可选）" class="input" />
          <p v-if="err" class="text-red-400 text-xs">{{ err }}</p>
          <button class="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-md py-2 text-sm">
            {{ mode === 'login' ? '登录' : '注册并创建资料页' }}
          </button>
        </form>
        <p class="text-[11px] text-slate-500 mt-3">
          注册后分配随机 uuid 路由的资料页；sign 用于查看收藏与修改资料，请妥善保存。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, login, register, logout } = useUser()
const open = ref(false)
const mode = ref<'login' | 'register'>('login')
const form = reactive({ username: '', sign: '', displayName: '' })
const err = ref('')

async function submit() {
  err.value = ''
  try {
    if (mode.value === 'login') {
      await login(form.username.trim(), form.sign)
    } else {
      await register(form.username.trim(), form.sign, form.displayName.trim() || undefined)
    }
    open.value = false
    form.username = ''
    form.sign = ''
    form.displayName = ''
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.message || '操作失败'
  }
}
</script>

<style scoped>
.input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  outline: none;
}
.input:focus {
  border-color: #6366f1;
}
.tab {
  flex: 1;
  padding: 0.4rem;
  border-radius: 0.375rem;
  color: #94a3b8;
}
.tab-active {
  flex: 1;
  padding: 0.4rem;
  border-radius: 0.375rem;
  background: #312e81;
  color: #fff;
}
</style>
