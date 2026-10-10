import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  const db = await getDb()
  const rows = await db
    .collection('plays')
    .aggregate([
      { $match: { gameId: new ObjectId(id) } },
      {
        $group: {
          _id: '$userId',
          totalDurationMs: { $sum: '$durationMs' },
          bestScore: { $max: '$score' },
          plays: { $sum: 1 }
        }
      },
      { $sort: { bestScore: -1, totalDurationMs: -1 } },
      { $limit: 50 }
    ])
    .toArray()

  // 关联用户名（仅真实注册用户可关联，匿名显示为 匿名玩家）
  const users = db.collection('users')
  const result = await Promise.all(
    rows.map(async (r) => {
      let name = '匿名玩家'
      if (r._id && !String(r._id).startsWith('anon:')) {
        const u = await users.findOne({ _id: r._id })
        if (u) name = u.displayName || u.username
      }
      return {
        userId: r._id,
        name,
        bestScore: r.bestScore ?? 0,
        totalDurationMs: r.totalDurationMs || 0,
        plays: r.plays || 0
      }
    })
  )

  return { leaderboard: result }
})
