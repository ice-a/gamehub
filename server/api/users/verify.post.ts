import { verifySign } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const sign = typeof body.sign === 'string' ? body.sign : ''
  if (!username || !sign) {
    throw createError({ statusCode: 400, statusMessage: '需要 username 与 sign' })
  }
  const db = await getDb()
  const user = await db.collection('users').findOne({ username })
  if (!user || !verifySign(sign, user.signHash)) {
    throw createError({ statusCode: 401, statusMessage: '用户名或 sign 不正确' })
  }
  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName
  }
})
