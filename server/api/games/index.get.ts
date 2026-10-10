export default defineEventHandler(async (event) => {
  const db = await getDb()
  const games = db.collection('games')
  const query = (getQuery(event) as any) || {}
  const limit = Math.min(Number(query.limit) || 50, 200)
  const search = query.q ? String(query.q).trim() : ''

  const filter: any = { status: 'published', hidden: { $ne: true } }
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ]
  }

  const list = await games
    .find(filter, {
      projection: { html: 0 }
    })
    .sort({ playCount: -1, createdAt: -1 })
    .limit(limit)
    .toArray()

  return { games: list.map(serializeGame) }
})

function serializeGame(g: any) {
  return {
    id: String(g._id),
    title: g.title,
    description: g.description,
    style: g.style,
    playCount: g.playCount || 0,
    playerCount: g.playerCount || 0,
    createdAt: g.createdAt,
    preview: typeof g.html === 'string' ? g.html.slice(0, 200) : ''
  }
}
