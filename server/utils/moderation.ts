import { callChatCompletions, type AiOverrides } from './ai'

export interface ModerationResult {
  safe: boolean
  reason?: string
}

/** 本地兜底关键词黑名单（命中直接拦截，避免依赖外部调用） */
const BLOCKLIST = [
  // 暴力/自残/违法/色情/政治敏感等示意关键词，可按需扩充
  '制作炸弹', '炸药配方', '制毒', '毒品配方', '自杀方法', '自残教程',
  '色情', '裸聊', '成人内容', '赌博平台', '洗钱', '诈骗脚本',
  '黑客攻击', '入侵教程', '武器制造', '枪支制造', '儿童色情',
  'how to make a bomb', 'meth recipe', 'suicide method', 'child porn',
  'weapon manufacturing', 'hack attack tutorial'
]

/**
 * 检测描述是否含恶意/不安全内容。
 * 先走本地黑名单，再走 AI 内容审核（返回 JSON {safe, reason}）。
 */
export async function checkContentSafe(
  text: string,
  overrides: AiOverrides = {}
): Promise<ModerationResult> {
  const lower = text.toLowerCase()
  for (const word of BLOCKLIST) {
    if (lower.includes(word.toLowerCase())) {
      return { safe: false, reason: `描述包含不被允许的内容（命中安全词：${word}）` }
    }
  }

  try {
    const content = await callChatCompletions(
      [
        {
          role: 'system',
          content:
            '你是一个内容安全审核器。判断用户输入是否包含暴力、色情、仇恨、违法、自残等不安全内容。' +
            '仅返回 JSON：{"safe": true/false, "reason": "简短中文原因"}。不要返回其他内容。'
        },
        { role: 'user', content: text }
      ],
      { ...overrides, json: true, temperature: 0 }
    )
    const parsed = parseJsonSafe(content)
    if (parsed && typeof parsed.safe === 'boolean') {
      return { safe: parsed.safe, reason: parsed.reason }
    }
  } catch {
    // AI 审核失败时不阻断（依赖黑名单 + 下方放行），但可记录
  }
  return { safe: true }
}

function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        return null
      }
    }
    return null
  }
}
