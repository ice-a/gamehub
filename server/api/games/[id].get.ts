import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  const db = await getDb()
  const game = await db.collection('games').findOne({ _id: new ObjectId(id) })
  if (!game) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  if (game.hidden) {
    throw createError({ statusCode: 404, statusMessage: '该游戏因收到多处问题反馈已被隐藏' })
  }
  return {
    id: String(game._id),
    title: game.title,
    description: game.description,
    style: game.style,
    html: game.html,
    playCount: game.playCount || 0,
    playerCount: game.playerCount || 0,
    createdAt: game.createdAt
  }
})
