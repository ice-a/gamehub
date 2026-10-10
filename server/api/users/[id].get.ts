import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  const db = await getDb()
  const user = await db.collection('users').findOne(
    { _id: id },
    { projection: { signHash: 0 } }
  )
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  // 该用户收藏的游戏
  const favIds = await db.collection('favorites').find({ userId: id }).toArray()
  const games = db.collection('games')
  const favorites = favIds.length
    ? await games
        .find({ _id: { $in: favIds.map((f) => new ObjectId(f.gameId)) }, status: 'published' }, { projection: { html: 0 } })
        .toArray()
    : []

  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio || '',
    avatar: user.avatar || '',
    createdAt: user.createdAt,
    favorites: favorites.map((g: any) => ({
      id: String(g._id),
      title: g.title,
      style: g.style,
      playCount: g.playCount || 0
    }))
  }
})
