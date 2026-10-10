import { ObjectId } from 'mongodb'
import { buildGameMessages, streamChatCompletions, repairGameHtml, type AiOverrides } from '~/server/utils/ai'

function stripFences(text: string): string {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fence) return fence[1].trim()
  return text.replace(/^```(?:html)?/i, '').replace(/```$/i, '').trim()
}
import { checkContentSafe } from '~/server/utils/moderation'
import { validateGameHtml, normalizeGameHtml } from '~/server/utils/validateHtml'

function extractTitle(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (m && m[1].trim()) return m[1].trim().slice(0, 80)
  return fallback.slice(0, 60)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const style = typeof body.style === 'string' ? body.style : 'casual'
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : null

  // 用户可临时提供自己的 AI 配置（仅本次使用，不保存）
  const ai: AiOverrides = {}
  if (body.ai && typeof body.ai === 'object') {
    if (body.ai.baseUrl) ai.baseUrl = String(body.ai.baseUrl)
    if (body.ai.apiKey) ai.apiKey = String(body.ai.apiKey)
    if (body.ai.model) ai.model = String(body.ai.model)
  }

  // 同步校验（未开始流式前，以普通 JSON 返回错误）
  if (!description) {
    throw createError({ statusCode: 400, statusMessage: '描述不能为空' })
  }
  if (description.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: '描述过长（最多 2000 字）' })
  }

  const res = event.node.res
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  // 客户端是否断开：仅用于决定是否继续向客户端推送事件，
  // 但【不再因此中止生成】——保证即便用户关掉页面/刷新，游戏仍会写入数据库。
  let clientGone = false
  event.node.req.on('close', () => {
    clientGone = true
  })

  const send = (eventName: string, data: unknown) => {
    if (clientGone) return
    try {
      res.write(`event: ${eventName}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch {
      /* 客户端已断开，停止推送即可，不影响服务端生成与入库 */
    }
  }

  try {
    // 1) 恶意内容检测
    send('status', { phase: 'moderating', message: '内容安全检测中…' })
    const mod = await checkContentSafe(description, ai)
    if (!mod.safe) {
      send('error', { message: mod.reason || '内容未通过安全检测' })
      return res.end()
    }

    // 2) 流式生成
    // 注意：不把客户端断开信号传给生成过程，避免“用户离开 → 游戏丢失”。
    // 仅由服务端的空闲看门狗（idleTimeoutMs）判定上游真正卡死才中止。
    send('status', { phase: 'generating', message: 'AI 正在生成游戏，已生成内容见下方（可折叠）…' })
    let html = ''
    try {
      html = await streamChatCompletions(
        buildGameMessages(description, style, {
          ...ai,
          custom: typeof body.styleCustom === 'string' ? body.styleCustom : undefined
        }),
        { ...ai, temperature: 0.8, idleTimeoutMs: 120000, maxTimeoutMs: 900000 },
        (delta) => send('token', { delta })
      )
    } catch (e: any) {
      console.error('[generate] AI 生成失败:', e?.message)
      send('error', { message: `AI 生成失败：${e.message}` })
      return res.end()
    }
    html = stripFences(html).trim()
    // 兜底修正：补齐 charset / viewport / 撑满样式，避免乱码与被裁切
    html = normalizeGameHtml(html)

    // 3) 可运行性校验（含自动修复重试）
    send('status', { phase: 'validating', message: '校验 HTML 可运行性…' })
    let result = validateGameHtml(html)
    const MAX_REPAIR = 2
    for (let attempt = 1; attempt <= MAX_REPAIR && !result.ok; attempt++) {
      console.warn('[generate] 校验未通过，尝试自动修复（第', attempt, '次）:', result.errors.join('；'))
      send('status', { phase: 'repairing', message: `生成的 HTML 有语法问题，正在自动修复（第 ${attempt}/${MAX_REPAIR} 次）…` })
      try {
        const fixed = await repairGameHtml(
          html,
          result.errors,
          { ...ai, temperature: 0.3, idleTimeoutMs: 120000, maxTimeoutMs: 600000 },
          (delta) => send('token', { delta })
        )
        html = normalizeGameHtml(stripFences(fixed).trim())
        result = validateGameHtml(html)
      } catch (e: any) {
        console.error('[generate] 自动修复失败:', e?.message)
        send('error', { message: `生成的 HTML 未通过校验且自动修复失败：${result.errors.join('；')}` })
        return res.end()
      }
    }
    if (!result.ok) {
      console.error('[generate] 多次修复后仍校验失败:', result.errors.join('；'))
      send('error', { message: `生成的 HTML 多次修复仍不通过校验：${result.errors.join('；')}` })
      return res.end()
    }

    // 4) 入库（无论客户端是否还在，都完成写入）
    const db = await getDb()
    const doc = {
      title: extractTitle(html, description),
      description,
      style,
      html,
      status: 'published',
      playCount: 0,
      playerCount: 0,
      players: [],
      generatedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const ins = await db.collection('games').insertOne(doc)
    console.log('[generate] 已入库 gameId=', String(ins.insertedId), 'title=', doc.title)
    send('status', { phase: 'done', message: '生成完成！' })
    send('done', { id: String(ins.insertedId), title: doc.title })
    res.end()
  } catch (e: any) {
    console.error('[generate] 未预期错误:', e?.message)
    if (!clientGone) send('error', { message: e?.message || '生成失败' })
    try { res.end() } catch { /* 连接已关闭，忽略 */ }
  }
})
