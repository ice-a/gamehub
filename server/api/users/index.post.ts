import { v4 as uuidv4 } from 'uuid'
import { hashSign } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const sign = typeof body.sign === 'string' ? body.sign : ''
  const displayName = typeof body.displayName === 'string' && body.displayName.trim()
    ? body.displayName.trim()
    : username

  if (!username || !/^[\w一-龥\-]{2,20}$/.test(username)) {
    throw createError({ statusCode: 400, statusMessage: '用户名需为 2-20 位字母/数字/中文/下划线' })
  }
  if (!sign || sign.length < 4) {
    throw createError({ statusCode: 400, statusMessage: 'sign（口令）至少 4 位' })
  }

  const db = await getDb()
  const users = db.collection('users')
  const exist = await users.findOne({ username })
  if (exist) {
    throw createError({ statusCode: 409, statusMessage: '用户名已被占用' })
  }

  const id = uuidv4()
  await users.insertOne({
    _id: id,
    username,
    signHash: hashSign(sign),
    displayName,
    bio: '',
    avatar: '',
    createdAt: new Date()
  })

  // sign 仅本次返回，后续不再以明文出现
  return { id, username, displayName, sign }
})
