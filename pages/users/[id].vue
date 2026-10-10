<template>
  <div class="max-w-4xl mx-auto px-4 py-8" v-if="profile">
    <div class="flex items-center gap-4 mb-6">
      <div class="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-2xl font-bold">
        {{ (profile.displayName || profile.username).slice(0, 1).toUpperCase() }}
      </div>
      <div class="flex-1">
        <h1 class="text-2xl font-bold">{{ profile.displayName }}</h1>
        <p class="text-slate-400 text-sm">@{{ profile.username }}</p>
      </div>
      <button class="btn" @click="share">🔗 分享资料页</button>
    </div>

    <p v-if="profile.bio" class="text-slate-300 mb-6">{{ profile.bio }}</p>

    <!-- 本人可编辑 -->
    <div v-if="isMe" class="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
      <p class="text-sm text-slate-400 mb-2">编辑我的资料（需 sign 验证）</p>
      <div class="flex flex-col gap-2">
        <input v-model="edit.displayName" placeholder="昵称" class="input" />
        <input v-model="edit.avatar" placeholder="头像 URL（可选）" class="input" />
        <textarea v-model="edit.bio" rows="2" placeholder="个人简介" class="input"></textarea>
        <button class="btn-primary self-start" @click="save">保存</button>
        <span v-if="saveMsg" class="text-xs text-slate-400">{{ saveMsg }}</span>
      </div>
    </div>

    <h2 class="text-xl font-semibold mb-3">收藏的游戏</h2>
    <div v-if="profile.favorites.length === 0" class="text-slate-500 text-sm">暂无收藏。</div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <GameCard v-for="g in profile.favorites" :key="g.id" :game="g" />
    </div>
  </div>
  <div v-else class="max-w-4xl mx-auto px-4 py-8 text-slate-500">加载中…</div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const { user } = useUser()
const profile = ref<any>(null)
const isMe = computed(() => !!user.value && user.value.id === id)
const edit = reactive({ displayName: '', avatar: '', bio: '' })
const saveMsg = ref('')

async function load() {
  profile.value = await $fetch(`/api/users/${id}`)
  edit.displayName = profile.value.displayName || ''
  edit.bio = profile.value.bio || ''
  edit.avatar = profile.value.avatar || ''
}

function share() {
  navigator.clipboard?.writeText(location.href)
  alert('资料页链接已复制：' + location.href)
}

async function save() {
  if (!user.value) return
  try {
    await $fetch(`/api/users/${id}`, {
      method: 'PATCH',
      body: {
        sign: user.value.sign,
        displayName: edit.displayName,
        bio: edit.bio,
        avatar: edit.avatar
      }
    })
    saveMsg.value = '已保存'
    await load()
  } catch (e: any) {
    saveMsg.value = e?.data?.statusMessage || '保存失败'
  }
}

onMounted(load)
</script>

<style scoped>
.btn {
  padding: 0.4rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  color: #cbd5e1;
  font-size: 0.85rem;
}
.btn:hover {
  border-color: #6366f1;
}
.input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  outline: none;
}
.btn-primary {
  background: #4f46e5;
  color: #fff;
  padding: 0.4rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
}
.btn-primary:hover {
  background: #6366f1;
}
</style>
