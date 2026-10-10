import { ObjectId } from 'mongodb'
import { buildGameMessages, streamChatCompletions, type AiOverrides } from '~/server/utils/ai'

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

  let closed = false
  const ac = new AbortController()
  event.node.req.on('close', () => {
    closed = true
    ac.abort()
  })

  const send = (eventName: string, data: unknown) => {
    if (closed) return
    try {
      res.write(`event: ${eventName}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch {
      /* 客户端已断开 */
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
    send('status', { phase: 'generating', message: 'AI 正在生成游戏，已生成内容见下方（可折叠）…' })
    let html = ''
    try {
      html = await streamChatCompletions(
        buildGameMessages(description, style, {
          ...ai,
          custom: typeof body.styleCustom === 'string' ? body.styleCustom : undefined
        }),
        { ...ai, temperature: 0.8, idleTimeoutMs: 90000 },
        (delta) => send('token', { delta }),
        ac.signal
      )
    } catch (e: any) {
      if (closed) return res.end()
      send('error', { message: `AI 生成失败：${e.message}` })
      return res.end()
    }
    html = stripFences(html).trim()
    // 兜底修正：补齐 charset / viewport / 撑满样式，避免乱码与被裁切
    html = normalizeGameHtml(html)

    // 3) 可运行性校验
    send('status', { phase: 'validating', message: '校验 HTML 可运行性…' })
    const result = validateGameHtml(html)
    if (!result.ok) {
      send('error', { message: `生成的 HTML 未通过校验：${result.errors.join('；')}` })
      return res.end()
    }

    // 4) 入库
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
    send('status', { phase: 'done', message: '生成完成！' })
    send('done', { id: String(ins.insertedId), title: doc.title })
    res.end()
  } catch (e: any) {
    if (!closed) send('error', { message: e?.message || '生成失败' })
    res.end()
  }
})
