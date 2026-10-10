import type { WebSocket } from 'ws'

export interface RoomMember {
  clientId: string
  userId: string
  name: string
  host: boolean
  send: (message: unknown) => void
}

export interface Room {
  code: string
  gameId: string | null
  members: Map<string, RoomMember>
  hostClientId: string | null
  createdAt: number
}

// 进程内房间表（临时，不入库）
const rooms = new Map<string, Room>()

export function random6Digit(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function createRoom(gameId: string | null): { code: string; room: Room } {
  let code = random6Digit()
  while (rooms.has(code)) code = random6Digit()
  const room: Room = {
    code,
    gameId,
    members: new Map(),
    hostClientId: null,
    createdAt: Date.now()
  }
  rooms.set(code, room)
  return { code, room }
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code)
}

export function allRooms(): Room[] {
  return Array.from(rooms.values())
}

export function joinRoom(code: string, member: RoomMember): { ok: boolean; reason?: string } {
  const room = rooms.get(code)
  if (!room) return { ok: false, reason: '房间不存在或已解散' }
  if (room.members.has(member.clientId)) return { ok: false, reason: '你已在该房间' }
  if (room.members.size >= 8) return { ok: false, reason: '房间已满（最多 8 人）' }
  if (!room.hostClientId) {
    room.hostClientId = member.clientId
    member.host = true
  }
  room.members.set(member.clientId, member)
  return { ok: true }
}

export function leaveRoom(code: string, clientId: string): void {
  const room = rooms.get(code)
  if (!room) return
  const wasHost = room.hostClientId === clientId
  room.members.delete(clientId)
  if (wasHost) {
    // 转移房主给下一位成员
    const next = room.members.keys().next()
    room.hostClientId = next.done ? null : next.value
    if (room.hostClientId) {
      const m = room.members.get(room.hostClientId)
      if (m) m.host = true
    }
  }
  if (room.members.size === 0) {
    rooms.delete(code)
  }
}

export function memberList(room: Room) {
  return Array.from(room.members.values()).map((m) => ({
    clientId: m.clientId,
    userId: m.userId,
    name: m.name,
    host: m.host
  }))
}

export function broadcast(room: Room, message: unknown, exceptClientId?: string): void {
  for (const m of room.members.values()) {
    if (m.clientId === exceptClientId) continue
    m.send(message)
  }
}
