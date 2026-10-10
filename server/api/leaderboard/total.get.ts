export default defineEventHandler(async () => {
  const db = await getDb()
  const rows = await db
    .collection('plays')
    .aggregate([
      { $group: {
        _id: '$userId',
        totalDurationMs: { $sum: '$durationMs' },
        plays: { $sum: 1 },
        games: { $addToSet: '$gameId' }
      } },
      { $sort: { totalDurationMs: -1 } },
      { $limit: 50 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } }
    ])
    .toArray()

  const leaderboard = rows.map((r: any) => {
    const u = Array.isArray(r.u) && r.u[0] ? r.u[0] : null
    return {
      userId: r._id,
      name: u ? (u.displayName || u.username) : '匿名玩家',
      totalDurationMs: r.totalDurationMs || 0,
      plays: r.plays || 0,
      gamesCount: Array.isArray(r.games) ? r.games.length : 0
    }
  })

  return { leaderboard }
})
