import { optimizePrompt } from '~/server/utils/ai'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: '请先填写游戏描述，再优化提示词' })
  }
  if (text.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: '描述过长（最多 2000 字）' })
  }
  try {
    const optimized = await optimizePrompt(text)
    if (!optimized) {
      throw createError({ statusCode: 502, statusMessage: '优化模型返回为空，请重试' })
    }
    return { text: optimized }
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: `优化失败：${e?.message || '未知错误'}` })
  }
})
