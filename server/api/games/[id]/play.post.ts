import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  const body = await readBody(event)
  // 游玩身份：登录用户用其 uuid，匿名用客户端稳定生成的 id
  const pid = typeof body.userId === 'string' && body.userId ? body.userId : `anon:${randomToken()}`
  const durationMs = Math.max(0, Number(body.durationMs) || 0)
  const score = typeof body.score === 'number' ? body.score : null
  const roomCode = typeof body.roomCode === 'string' ? body.roomCode : null

  const db = await getDb()
  const games = db.collection('games')

  const game = await games.findOne({ _id: new ObjectId(id) })
  if (!game) throw createError({ statusCode: 404, statusMessage: '游戏不存在' })

  // 累计游玩次数 + 去重玩家数
  await games.updateOne(
    { _id: new ObjectId(id) },
    [
      {
        $set: {
          playCount: { $add: ['$playCount', 1] },
          players: { $setUnion: ['$players', [pid]] },
          lastPlayedAt: new Date()
        }
      }
    ]
  )
  const updated = await games.findOne({ _id: new ObjectId(id) })
  const playerCount = Array.isArray(updated?.players) ? updated!.players.length : 1

  await games.updateOne({ _id: new ObjectId(id) }, { $set: { playerCount } })

  // 记录一次游玩会话（用于时长统计与榜单）
  await db.collection('plays').insertOne({
    gameId: new ObjectId(id),
    userId: pid,
    durationMs,
    score,
    roomCode,
    startedAt: new Date(Date.now() - durationMs),
    endedAt: new Date()
  })

  return { ok: true, playCount: updated?.playCount || 0, playerCount }
})

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10)
}
