import { defineNitroPlugin } from 'nitropack/runtime'
import { useRuntimeConfig } from 'nitropack/runtime'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  memberList,
  broadcast,
  allRooms,
  type Room
} from '../utils/rooms'

function findRoomByClient(clientId: string): Room | undefined {
  for (const room of allRooms()) {
    if (room.members.has(clientId)) return room
  }
  return undefined
}

/**
 * 独立的 WebSocket 服务（监听 WS_PORT，默认 3001）。
 * Nitro 不暴露底层 HTTP server，因此用一个独立端口承载实时联机，
 * 客户端经 runtimeConfig.public.wsPort 连接（支持 ws/wss）。
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const path = (config.public?.wsPath as string) || '/ws'
  const port = Number(config.public?.wsPort || 3001)

  const wss = new WebSocketServer({ port, path })

  wss.on('connection', (ws: WebSocket) => {
    const send = (m: unknown) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
    }

    ws.on('message', (raw) => {
      let msg: any
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!msg || typeof msg.type !== 'string') return

      if (msg.type === 'create') {
        const { code } = createRoom(msg.gameId ?? null)
        const cid = `${code}-${Math.random().toString(36).slice(2, 8)}`
        const ok = joinRoom(code, {
          clientId: cid,
          userId: String(msg.user?.userId || 'anon'),
          name: String(msg.user?.name || '玩家'),
          host: false,
          send
        })
        if (!ok.ok) {
          send({ type: 'error', message: ok.reason })
          return
        }
        ;(ws as any)._cid = cid
        ;(ws as any)._code = code
        send({ type: 'created', code, you: cid, members: memberList(getRoom(code)!) })
        return
      }

      if (msg.type === 'join') {
        const code = String(msg.code || '')
        const room = getRoom(code)
        if (!room) {
          send({ type: 'error', message: '房间不存在或已解散' })
          return
        }
        const cid = `${code}-${Math.random().toString(36).slice(2, 8)}`
        const ok = joinRoom(code, {
          clientId: cid,
          userId: String(msg.user?.userId || 'anon'),
          name: String(msg.user?.name || '玩家'),
          host: false,
          send
        })
        if (!ok.ok) {
          send({ type: 'error', message: ok.reason })
          return
        }
        ;(ws as any)._cid = cid
        ;(ws as any)._code = code
        send({ type: 'joined', code, you: cid, members: memberList(room) })
        broadcast(room, { type: 'members', members: memberList(room) }, cid)
        return
      }

      if (msg.type === 'event') {
        const room = findRoomByClient((ws as any)._cid)
        if (room) {
          broadcast(room, { type: 'event', from: (ws as any)._cid, data: msg.data }, (ws as any)._cid)
        }
        return
      }

      if (msg.type === 'leave' || msg.type === 'bye') {
        const room = findRoomByClient((ws as any)._cid)
        if (room) {
          leaveRoom(room.code, (ws as any)._cid)
          broadcast(room, { type: 'members', members: memberList(room) })
        }
        return
      }
    })

    ws.on('close', () => {
      const room = findRoomByClient((ws as any)._cid)
      if (room) {
        leaveRoom(room.code, (ws as any)._cid)
        if (getRoom(room.code)) {
          broadcast(room, { type: 'members', members: memberList(room) })
        }
      }
    })
  })

  console.log(`[ws-plugin] WebSocket server listening on port ${port} (path ${path})`)
})
