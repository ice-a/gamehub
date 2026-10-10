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

function injectBridge(html: string): string {
  const bridge = `<script>(function(){if(window.__GAMEHUB__)return;var h=[];window.__GAMEHUB__={send:function(d){try{parent.postMessage({__gh:'send',data:d},'*');}catch(e){}},onMessage:function(cb){h.push(cb);}};window.addEventListener('message',function(e){var m=e.data;if(m&&m.__gh==='recv'){h.forEach(function(cb){try{cb(m.data);}catch(e){}});}});window.dispatchEvent(new Event('gamehub-ready'));})();<\/script>`
  if (html.includes('<head')) {
    return html.replace('<head', `${bridge}<head`)
  }
  return bridge + html
}

const srcdoc = computed(() => (props.multiplayer ? injectBridge(props.html) : props.html))

function onMessage(e: MessageEvent) {
  const m = e.data
  if (m && m.__gh === 'send') {
    emit('game-event', m.data)
  }
}

function sendToGame(data: any) {
  frame.value?.contentWindow?.postMessage({ __gh: 'recv', data }, '*')
}

onMounted(() => {
  if (props.multiplayer) window.addEventListener('message', onMessage)
})
onBeforeUnmount(() => {
  if (props.multiplayer) window.removeEventListener('message', onMessage)
  // 上报游玩时长
  const durationMs = Date.now() - startTime
  $fetch(`/api/games/${props.gameId}/play`, {
    method: 'POST',
    body: { userId: playerId(), durationMs }
  }).catch(() => {})
})

defineExpose({ sendToGame })
</script>
