import { ObjectId } from 'mongodb'
import { verifySign } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username') as string
  const query = getQuery(event) as any
  const sign = typeof query.sign === 'string' ? query.sign : ''
  if (!sign) {
    throw createError({ statusCode: 400, statusMessage: '需要 sign 参数验证身份' })
  }

  const db = await getDb()
  const user = await db.collection('users').findOne({ username })
  if (!user || !verifySign(sign, user.signHash)) {
    throw createError({ statusCode: 401, statusMessage: '用户名或 sign 不正确' })
  }

  const favs = await db.collection('favorites').find({ userId: user._id.toString() }).sort({ createdAt: -1 }).toArray()
  const games = db.collection('games')
  const list = favs.length
    ? await games
        .find({ _id: { $in: favs.map((f) => new ObjectId(f.gameId)) }, status: 'published', hidden: { $ne: true } }, { projection: { html: 0 } })
        .toArray()
    : []

  return {
    username: user.username,
    displayName: user.displayName,
    favorites: list.map((g: any) => ({
      id: String(g._id),
      title: g.title,
      description: g.description,
      style: g.style,
      playCount: g.playCount || 0,
      playerCount: g.playerCount || 0,
      createdAt: g.createdAt
    }))
  }
})
