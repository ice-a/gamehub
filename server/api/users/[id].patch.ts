import { verifySign } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const sign = typeof body.sign === 'string' ? body.sign : ''
  if (!sign) {
    throw createError({ statusCode: 400, statusMessage: '需要 sign 验证身份' })
  }

  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: id })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }
  if (!verifySign(sign, user.signHash)) {
    throw createError({ statusCode: 401, statusMessage: 'sign 不正确' })
  }

  const update: any = {}
  if (typeof body.displayName === 'string' && body.displayName.trim()) {
    update.displayName = body.displayName.trim().slice(0, 40)
  }
  if (typeof body.bio === 'string') {
    update.bio = body.bio.slice(0, 200)
  }
  if (typeof body.avatar === 'string') {
    update.avatar = body.avatar.slice(0, 500)
  }
  if (Object.keys(update).length === 0) {
    return { ok: true, updated: false }
  }
  await db.collection('users').updateOne({ _id: id }, { $set: update })
  return { ok: true, updated: true }
})
