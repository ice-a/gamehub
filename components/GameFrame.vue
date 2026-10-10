<template>
  <div class="w-full">
    <iframe
      ref="frame"
      :srcdoc="srcdoc"
      class="w-full rounded-lg border border-slate-700 bg-white"
      :style="{ height: height + 'px' }"
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
      title="game"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  gameId: string
  html: string
  multiplayer?: boolean
  height?: number
}>()

const emit = defineEmits<{ (e: 'game-event', data: any): void }>()

const { playerId } = useUser()
const frame = ref<HTMLIFrameElement | null>(null)
const height = computed(() => props.height || 520)
const startTime = Date.now()

// 注入桥接脚本：让游戏能把分数/事件回传给父页面。
// 所有模式都注入（单人游戏也需上报分数，用于榜单）。
function injectBridge(html: string): string {
  const bridge = `<script>(function(){if(window.__GAMEHUB__)return;var h=[];window.__GAMEHUB__={send:function(d){try{parent.postMessage({__gh:'send',data:d},'*');}catch(e){}},onMessage:function(cb){h.push(cb);}};window.addEventListener('message',function(e){var m=e.data;if(m&&m.__gh==='recv'){h.forEach(function(cb){try{cb(m.data);}catch(e){}});}});window.dispatchEvent(new Event('gamehub-ready'));})();<\/script>`
  if (html.includes('<head')) {
    return html.replace('<head', `${bridge}<head`)
  }
  return bridge + html
}

const srcdoc = computed(() => injectBridge(props.html))

// 累计最高分（用于上报到单游戏榜单）
let bestScore: number | null = null
let lastScorePost = 0
let pendingPost: ReturnType<typeof setTimeout> | null = null

function postPlay(score: number | null) {
  const durationMs = Date.now() - startTime
  $fetch(`/api/games/${props.gameId}/play`, {
    method: 'POST',
    body: { userId: playerId(), durationMs, score }
  }).catch(() => {})
}

function onMessage(e: MessageEvent) {
  const m = e.data
  if (m && m.__gh === 'send') {
    emit('game-event', m.data)
    // 游戏通过 window.__GAMEHUB__.send({type:'score', value: N}) 上报分数
    if (m.data && m.data.type === 'score' && typeof m.data.value === 'number') {
      bestScore = bestScore === null ? m.data.value : Math.max(bestScore, m.data.value)
      const now = Date.now()
      if (now - lastScorePost > 2000) {
        lastScorePost = now
        postPlay(bestScore)
      } else {
        if (pendingPost) clearTimeout(pendingPost)
        pendingPost = setTimeout(() => {
          lastScorePost = Date.now()
          postPlay(bestScore)
        }, 2000)
      }
    }
  }
}

function sendToGame(data: any) {
  frame.value?.contentWindow?.postMessage({ __gh: 'recv', data }, '*')
}

onMounted(() => {
  window.addEventListener('message', onMessage)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  if (pendingPost) clearTimeout(pendingPost)
  // 上报游玩时长 + 最高分（分数为空则仅记时长）
  postPlay(bestScore)
})

defineExpose({ sendToGame })
</script>
