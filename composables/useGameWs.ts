import { ref, onUnmounted } from 'vue'

interface Member {
  clientId: string
  userId: string
  name: string
  host: boolean
}

interface RoomUser {
  userId: string
  name: string
}

export function useGameWs() {
  const config = useRuntimeConfig()
  const connected = ref(false)
  const code = ref('')
  const members = ref<Member[]>([])
  const error = ref('')

  let ws: WebSocket | null = null
  const queue: string[] = []
  const listeners: Record<string, ((msg: any) => void)[]> = {
    members: [],
    event: [],
    created: [],
    joined: [],
    error: []
  }

  function on(type: string, cb: (msg: any) => void) {
    listeners[type]?.push(cb)
  }
  function emit(type: string, msg: any) {
    ;(listeners[type] || []).forEach((cb) => cb(msg))
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const port = config.public.wsPort || 3001
    const url = `${proto}://${location.hostname}:${port}${config.public.wsPath}`
    ws = new WebSocket(url)
    ws.onopen = () => {
      connected.value = true
      queue.forEach((m) => ws!.send(m))
      queue.length = 0
    }
    ws.onclose = () => {
      connected.value = false
    }
    ws.onmessage = (e) => {
      let msg: any
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'members') members.value = msg.members
      if (msg.type === 'error') {
        error.value = msg.message
        emit('error', msg)
      }
      if (msg.type === 'created') {
        code.value = msg.code
        emit('created', msg)
      }
      if (msg.type === 'joined') {
        code.value = msg.code
        emit('joined', msg)
      }
      if (msg.type === 'event') emit('event', msg)
    }
  }

  function sendRaw(obj: any) {
    const str = JSON.stringify(obj)
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(str)
    else queue.push(str)
  }

  function createRoom(gameId: string | null, user: RoomUser) {
    connect()
    sendRaw({ type: 'create', gameId, user })
  }
  function joinRoom(roomCode: string, user: RoomUser) {
    connect()
    sendRaw({ type: 'join', code: roomCode, user })
  }
  function sendEvent(data: any) {
    sendRaw({ type: 'event', data })
  }
  function leave() {
    sendRaw({ type: 'leave' })
  }
  function close() {
    if (ws) {
      try {
        ws.close()
      } catch {
        /* noop */
      }
      ws = null
    }
  }

  onUnmounted(() => close())

  return { connected, code, members, error, on, createRoom, joinRoom, sendEvent, leave, close, connect }
}
