<template>
  <div>
    <label class="block text-sm text-slate-300 mb-2">游戏风格（可多选预设 + 自定义补充）</label>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="s in styles"
        :key="s.id"
        type="button"
        :class="selected.has(s.id) ? 'style-on' : 'style-off'"
        @click="toggle(s.id)"
      >
        {{ s.label }}
      </button>
    </div>
    <input
      v-model="custom"
      placeholder="自定义风格描述（可选，例如：水墨国风、暗黑哥特）"
      class="input mt-3"
    />
  </div>
</template>

<script setup lang="ts">
const styles = [
  { id: 'retro', label: '复古像素' },
  { id: 'neon', label: '赛博霓虹' },
  { id: 'casual', label: '休闲卡通' },
  { id: 'minimal', label: '极简' },
  { id: 'pixel', label: '像素冒险' },
  { id: 'puzzle', label: '解谜' }
]

const selected = ref<Set<string>>(new Set(['casual']))
const custom = ref('')

function toggle(id: string) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

// 暴露给父组件：选中的风格（首个）与自定义文本
const model = defineModel<{ style: string; custom: string }>({ required: false })
watchEffect(() => {
  const first = Array.from(selected.value)[0] || 'casual'
  model.value = { style: first, custom: custom.value }
})

</script>

<style scoped>
.style-on {
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  background: #4f46e5;
  color: #fff;
  border: 1px solid #4f46e5;
}
.style-off {
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  background: transparent;
  color: #cbd5e1;
  border: 1px solid #334155;
}
.style-off:hover {
  border-color: #6366f1;
}
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
</style>
