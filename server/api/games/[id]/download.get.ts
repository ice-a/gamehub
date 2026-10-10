import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  const db = await getDb()
  const game = await db.collection('games').findOne({ _id: new ObjectId(id) }, { projection: { html: 1, title: 1 } })
  if (!game || !game.html) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="game-${id}.html"`)
  return game.html as string
})
