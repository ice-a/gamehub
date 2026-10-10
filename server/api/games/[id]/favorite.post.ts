import { ObjectId } from 'mongodb'
import { hashSign, verifySign } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  const body = await readBody(event)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const sign = typeof body.sign === 'string' ? body.sign : ''
  if (!username || !sign) {
    throw createError({ statusCode: 400, statusMessage: '需要 username 与 sign 验证身份' })
  }

  const db = await getDb()
  const user = await db.collection('users').findOne({ username })
  if (!user || !verifySign(sign, user.signHash)) {
    throw createError({ statusCode: 401, statusMessage: '用户名或 sign 不正确' })
  }

  const favorites = db.collection('favorites')
  const existing = await favorites.findOne({ userId: user._id.toString(), gameId: id })
  if (existing) {
    await favorites.deleteOne({ _id: existing._id })
    return { favorited: false }
  }
  await favorites.insertOne({
    userId: user._id.toString(),
    gameId: id,
    createdAt: new Date()
  })
  return { favorited: true }
})
