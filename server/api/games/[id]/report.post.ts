import { ObjectId } from 'mongodb'

// 达到该举报人数（去重后）即自动隐藏游戏
const REPORT_HIDE_THRESHOLD = 5

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!ObjectId.isValid(id)) {
    throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  }
  const body = await readBody(event)
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : null
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : ''

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: '请先登录或提供用户标识后再举报' })
  }

  const db = await getDb()
  const games = db.collection('games')
  const game = await games.findOne({ _id: new ObjectId(id) })
  if (!game) throw createError({ statusCode: 404, statusMessage: '游戏不存在' })
  if (game.hidden) {
    return { ok: true, hidden: true, reportCount: game.reportCount || 0, alreadyReported: true }
  }

  // 同一用户针对同一游戏只计一次举报（唯一索引兜底并发）
  const reports = db.collection('reports')
  await reports.createIndex({ gameId: 1, userId: 1 }, { unique: true }).catch(() => {})
  let alreadyReported = false
  try {
    await reports.insertOne({
      gameId: new ObjectId(id),
      userId,
      reason,
      createdAt: new Date()
    })
  } catch (e: any) {
    // 并发重复插入：视为已举报
    if (e?.code === 11000) alreadyReported = true
    else throw e
  }

  const reportCount = await reports.countDocuments({ gameId: new ObjectId(id) })
  const hidden = reportCount >= REPORT_HIDE_THRESHOLD

  await games.updateOne(
    { _id: new ObjectId(id) },
    { $set: { reportCount, hidden } }
  )

  return { ok: true, reportCount, hidden, alreadyReported }
})
