<template>
  <button
    class="px-3 py-1.5 rounded-md text-sm border transition"
    :class="favorited ? 'bg-pink-600/20 border-pink-500 text-pink-300' : 'border-slate-600 text-slate-300 hover:border-pink-500'"
    @click="toggle"
  >
    {{ favorited ? '★ 已收藏' : '☆ 收藏' }}
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{ gameId: string }>()
const { user } = useUser()
const favorited = ref(false)
const hint = ref('')

async function toggle() {
  hint.value = ''
  if (!user.value) {
    hint.value = '请先登录后再收藏'
    return
  }
  try {
    const res = await $fetch<{ favorited: boolean }>(`/api/games/${props.gameId}/favorite`, {
      method: 'POST',
      body: { username: user.value.username, sign: user.value.sign }
    })
    favorited.value = res.favorited
  } catch (e: any) {
    hint.value = e?.data?.statusMessage || '操作失败'
  }
}
</script>
