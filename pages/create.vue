<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-1">创建游戏</h1>
    <p class="text-slate-400 mb-6">用一句话描述你想要的游戏，AI 会生成可运行的单文件 HTML 小游戏。</p>

    <div class="space-y-5">
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm text-slate-300">游戏描述</label>
          <button
            type="button"
            class="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="optimizing || generating || !description.trim()"
            @click="optimize"
          >
            {{ optimizing ? '优化中…' : '✨ 一键优化提示词' }}
          </button>
        </div>
        <textarea
          v-model="description"
          rows="4"
          :disabled="generating || optimizing"
          placeholder="例如：一个躲避下落方块的街机游戏，难度随时间递增，带计分板。"
          class="input"
        ></textarea>
        <p class="text-xs text-slate-500 mt-1.5">
          只需描述你的游戏创意即可 —— 系统会自动加入「无限关卡」与「难度随关卡自动递增」机制，无需你手动配置。
        </p>
      </div>

      <StylePicker v-model="styleModel" />

      <details class="bg-slate-900 border border-slate-800 rounded-lg p-3">
        <summary class="cursor-pointer text-sm text-slate-300">使用我自己的 AI 接口（不保存，仅本次生成使用）</summary>
        <div class="grid grid-cols-1 gap-3 mt-3">
          <input v-model="ai.baseUrl" :disabled="generating" placeholder="Base URL，如 https://api.openai.com/v1" class="input" />
          <input v-model="ai.apiKey" :disabled="generating" placeholder="API Key" class="input" />
          <input v-model="ai.model" :disabled="generating" placeholder="模型名，如 gpt-4o-mini" class="input" />
        </div>
      </details>

      <div v-if="error" class="text-red-400 text-sm">{{ error }}</div>
      <div v-if="optimizeError" class="text-red-400 text-sm">{{ optimizeError }}</div>

      <button class="btn-primary" :disabled="generating" @click="submit">
        {{ generating ? '生成中…' : '生成游戏' }}
      </button>

      <!-- 进度与流式输出 -->
      <div v-if="generating || streamed || phase === 'done'" class="mt-6 space-y-3">
        <div class="flex items-center gap-3">
          <span v-if="generating" class="loader"></span>
          <span class="text-sm text-slate-300">{{ statusText || '处理中…' }}</span>
        </div>

        <!-- 可折叠的 AI 返回内容 -->
        <div class="border border-slate-700 rounded-lg overflow-hidden">
          <button
            class="w-full flex items-center justify-between px-3 py-2 bg-slate-900 text-sm text-slate-300 hover:bg-slate-800"
            @click="collapsed = !collapsed"
          >
            <span>AI 返回内容（实时流式，可折叠）</span>
            <span>{{ collapsed ? '展开 ▸' : '折叠 ▾' }}</span>
          </button>
          <pre
            v-show="!collapsed"
            ref="streamBox"
            class="max-h-72 overflow-auto bg-slate-950 text-xs text-slate-300 p-3 whitespace-pre-wrap break-all"
          >{{ streamed || '（等待输出…）' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const description = ref('')
const styleModel = ref<{ style: string; custom: string }>({ style: 'casual', custom: '' })
const ai = reactive({ baseUrl: '', apiKey: '', model: '' })
const generating = ref(false)
const optimizing = ref(false)
const error = ref('')
const optimizeError = ref('')
const statusText = ref('')
const phase = ref('')
const streamed = ref('')
const collapsed = ref(false)
const streamBox = ref<HTMLElement | null>(null)

function scrollStream() {
  nextTick(() => {
    const el = streamBox.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function optimize() {
  optimizeError.value = ''
  if (!description.value.trim()) {
    optimizeError.value = '请先填写游戏描述，再优化'
    return
  }
  optimizing.value = true
  try {
    const res = await fetch('/api/optimize-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: description.value.trim() })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      optimizeError.value = data.statusMessage || `优化失败（${res.status}）`
      return
    }
    description.value = data.text
  } catch (e: any) {
    optimizeError.value = e?.message || '优化失败，请重试'
  } finally {
    optimizing.value = false
  }
}

async function submit() {
  error.value = ''
  statusText.value = ''
  phase.value = ''
  streamed.value = ''
  collapsed.value = false
  if (!description.value.trim()) {
    error.value = '请先填写游戏描述'
    return
  }
  generating.value = true

  const body: any = {
    description: description.value.trim(),
    style: styleModel.value.style,
    styleCustom: styleModel.value.custom
  }
  if (ai.baseUrl || ai.apiKey || ai.model) {
    body.ai = {
      baseUrl: ai.baseUrl || undefined,
      apiKey: ai.apiKey || undefined,
      model: ai.model || undefined
    }
  }

  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}))
      error.value = err.statusMessage || `请求失败（${res.status}）`
      generating.value = false
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let curEvent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx)
        buf = buf.slice(idx + 1)
        if (line.startsWith('event:')) {
          curEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim()
          handleEvent(curEvent, dataStr)
          curEvent = ''
        }
      }
    }
  } catch (e: any) {
    if (!error.value) error.value = e?.message || '连接中断'
  } finally {
    generating.value = false
  }
}

function handleEvent(eventName: string, dataStr: string) {
  let data: any = {}
  try {
    data = JSON.parse(dataStr)
  } catch {
    return
  }
  if (eventName === 'status') {
    phase.value = data.phase
    statusText.value = data.message
    if (data.phase === 'generating') collapsed.value = false
  } else if (eventName === 'token') {
    streamed.value += data.delta
    scrollStream()
  } else if (eventName === 'error') {
    error.value = data.message
  } else if (eventName === 'done') {
    statusText.value = '生成完成！正在跳转…'
    setTimeout(() => navigateTo(`/games/${data.id}`), 600)
  }
}
</script>

<style scoped>
.input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  font-size: 0.9rem;
  outline: none;
}
.input:focus {
  border-color: #6366f1;
}
.input:disabled {
  opacity: 0.6;
}
.btn-primary {
  background: #4f46e5;
  color: #fff;
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 500;
}
.btn-primary:hover {
  background: #6366f1;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.loader {
  width: 16px;
  height: 16px;
  border: 2px solid #334155;
  border-top-color: #818cf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
