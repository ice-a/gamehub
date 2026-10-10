/**
 * OpenAI 兼容的 /v1/chat/completions 调用。
 * 默认读取 runtimeConfig 中的 AI_* 环境变量；
 * 允许在单次请求中通过 overrides 传入用户自己的 baseUrl / apiKey / model（不落库）。
 *
 * 使用真实 undici 的 fetch（而非 Nitro 的 unenv polyfill）：
 *  - unenv 的 fetch 在 Nitro 生产环境下读取 SSE 流时不会稳定分块（token 流不出）；
 *  - 原生 node:http 又被部分网关按客户端指纹拦截（如本机到 amd.com.cn 返回 403/405）；
 *  - undici 既能稳定流式读取，又能正常访问目标接口。
 */
import { fetch as undiciFetch } from 'undici'

export interface AiOverrides {
  baseUrl?: string
  apiKey?: string
  model?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCfg {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

/** 单次（非流式）对话调用，按给定配置访问 OpenAI 兼容接口 */
async function chatOnce(
  messages: ChatMessage[],
  cfg: ChatCfg,
  opts: { temperature?: number; json?: boolean } = {}
): Promise<string> {
  const baseUrl = cfg.baseUrl.replace(/\/$/, '')
  if (!baseUrl) throw new Error('未配置 AI_BASE_URL')
  if (!cfg.apiKey) throw new Error('未配置 AI_API_KEY（可在生成时填写你自己的 key）')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await undiciFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        'User-Agent': 'GameHub/1.0 (Nuxt-Server)'
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: controller.signal
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`AI 接口返回 ${res.status}: ${txt.slice(0, 600)}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('AI 接口返回内容异常')
    return content
  } finally {
    clearTimeout(timer)
  }
}

export async function callChatCompletions(
  messages: ChatMessage[],
  overrides: AiOverrides & { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const config = useRuntimeConfig()
  // 优先读取运行时环境变量（.env 在进程启动时注入），runtimeConfig 仅作兜底。
  // 注意：runtimeConfig 的私密字段在构建期会被固化，运行时改 .env 不会自动生效。
  const baseUrl = (overrides.baseUrl || process.env.AI_BASE_URL || config.aiBaseUrl || '').replace(/\/$/, '')
  const apiKey = overrides.apiKey || process.env.AI_API_KEY || (config.aiApiKey as string) || ''
  const model = overrides.model || process.env.AI_MODEL || (config.aiModel as string) || 'gpt-4o-mini'
  const timeoutMs = Number(config.aiTimeoutMs || 120000)
  return chatOnce(messages, { baseUrl, apiKey, model, timeoutMs }, overrides)
}

/** 可选的预设游戏风格（前端 StylePicker 也复用此列表） */
export const GAME_STYLES = [
  { id: 'retro', label: '复古像素', prompt: '8-bit 复古像素风，使用方块字体与霓虹配色，音效用 WebAudio 方波。' },
  { id: 'neon', label: '赛博霓虹', prompt: '暗色背景、霓虹发光描边、玻璃拟态 UI，科幻赛博朋克氛围。' },
  { id: 'casual', label: '休闲卡通', prompt: '明亮柔和的卡通配色，圆角元素，轻松友好的休闲风格。' },
  { id: 'minimal', label: '极简', prompt: '大量留白、黑白灰为主、无装饰，专注玩法本身。' },
  { id: 'pixel', label: '像素冒险', prompt: '经典像素艺术、 tile 地图、俯视视角冒险风格。' },
  { id: 'puzzle', label: '解谜', prompt: '干净理性的解谜界面，强调逻辑与提示反馈。' }
] as const

const SYSTEM_PROMPT = `你是一位资深前端游戏开发者。请只输出一个【单文件、可直接在浏览器打开运行】的 HTML 游戏。

硬性要求（必须全部满足，否则视为不合格）：
1. 文档结构：以 <!DOCTYPE html> 开头，必须包含 <html lang="zh-CN">、<head>、<body>。
2. 编码与视口（必须原样包含，缺一不可）：
   - <head> 内第一行必须是 <meta charset="utf-8">
   - 紧接着一行 <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
3. 单文件约束：所有 CSS 与 JavaScript 必须内联；禁止任何外部资源——不得出现 http(s):// 的 <script src>、<link href>、@import、远程模块 import、远程图片/字体/音频。允许用 WebAudio 合成音效、emoji、纯 CSS 绘制图形。
4. 布局必须撑满容器且响应式：
   - 必须设置 html,body{height:100%;margin:0}
   - 游戏主容器使用 width:100%;height:100%（用百分比，禁止用 100vh/100vw 等视口单位，否则在嵌入框里会被裁切、显示不全）
   - 适配桌面与移动端，元素不得溢出可视区域，关键内容无需外部滚动即可看到。
5. 游戏必须完整可玩：包含明确的开始、进行、胜利/过关、失败/重玩状态，并有计分或进度。
6. 必须包含“过关/胜利”动画：玩家达成胜利或通过一个关卡时，必须用 CSS @keyframes 动画（如光芒、烟花、撒花、弹窗、缩放淡入等）明显展示庆祝效果，并清晰提示“过关 / 胜利 / 通关”。
7. 不要输出任何解释文字，只输出 HTML 代码本身（不要使用 markdown 代码围栏 \`\`\`）。
8. 收到请求后直接开始输出 HTML，不要进行任何推理、思考或分析过程，也不要输出思考内容；把全部精力放在生成可运行的游戏代码上。
9. 游戏必须支持【无限关卡】：玩家通关后自动进入下一关，关卡编号无限递增、永不结束；每一关的地图/敌人/目标必须由程序依据“当前关卡编号”动态生成，禁止只做固定的几关。
10. 难度必须由游戏自身的“后台逻辑”自动配置并随关卡递增：速度、数量、移动频率、目标值等关键参数用公式随关卡编号自动计算（例如 speed = base + level * k、count = base + level），无需玩家或外部手动设置；确保前期轻松、后期有挑战，但不会出现“瞬间不可能通关”的死局。
11. 游戏必须上报分数以参与榜单：页面已注入桥接对象 window.__GAMEHUB__。每当玩家得分发生变化（如得分增加、过关、游戏结束时），调用 window.__GAMEHUB__.send({ type: 'score', value: <当前总分，数字> })。例如得分 +10 时调用 window.__GAMEHUB__.send({ type: 'score', value: score })。若游戏确实没有分数概念（纯放松类），可不上报，但绝大多数游戏必须有分数。
12. 代码必须精简紧凑：用尽量少的代码实现完整玩法，避免冗余与重复；单文件控制在可运行的最小规模（通常 150～400 行），不要写冗长的注释或多余样式。这样既能保证可运行，也能显著缩短生成时间。`

/** 组装发给 AI 的 messages（生成单文件 HTML 游戏） */
export function buildGameMessages(
  description: string,
  styleId: string,
  overrides: AiOverrides & { custom?: string } = {}
): ChatMessage[] {
  const style = GAME_STYLES.find((s) => s.id === styleId)
  const styleText = style ? `游戏风格：${style.label}。风格要求：${style.prompt}` : ''
  const customText = overrides.custom ? `额外风格要求：${overrides.custom}` : ''
  const userContent = `请生成游戏：${description}\n${styleText}${customText ? '\n' + customText : ''}`
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ]
}

/**
 * 根据描述与风格生成单文件 HTML 游戏（非流式，备用）。
 * overrides 可携带用户自己的 AI 配置（仅本次使用，不保存）。
 */
export async function generateGameHtml(
  description: string,
  styleId: string,
  overrides: AiOverrides & { custom?: string } = {}
): Promise<string> {
  const content = await callChatCompletions(buildGameMessages(description, styleId, overrides), {
    ...overrides,
    temperature: 0.8
  })
  return stripFences(content).trim()
}

/**
 * 流式生成：逐 token 回调 onToken，避免一次性等待导致超时中断。
 * 兼容 OpenAI 的 stream:true SSE 响应（data:{...delta.content}）。
 * signal 用于客户端断开时中止。
 *
 * 使用真实 undici 的 fetch：在 Nitro 生产环境下也能稳定地按块读取 SSE 流。
 */
export async function streamChatCompletions(
  messages: ChatMessage[],
  overrides: AiOverrides & { temperature?: number } = {},
  onToken?: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const config = useRuntimeConfig()
  const baseUrl = (overrides.baseUrl || process.env.AI_BASE_URL || config.aiBaseUrl || '').replace(/\/$/, '')
  const apiKey = overrides.apiKey || process.env.AI_API_KEY || (config.aiApiKey as string) || ''
  const model = overrides.model || process.env.AI_MODEL || (config.aiModel as string) || 'gpt-4o-mini'

  if (!baseUrl) throw new Error('未配置 AI_BASE_URL')
  if (!apiKey) throw new Error('未配置 AI_API_KEY（可在生成时填写你自己的 key）')

  // 空闲看门狗：若长时间收不到任何数据（上游卡死），主动中止并返回明确错误，
  // 避免请求无限挂起（区别于“正在缓慢流式输出”的正常情况）。
  const idleTimeoutMs = Number(overrides.idleTimeoutMs ?? 90000)
  const idleAbort = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  // 硬上限：防止上游极慢/限流导致生成无限拖尾（如数十分钟）。超时即中止并给出明确提示。
  const maxTimeoutMs = Number(overrides.maxTimeoutMs ?? 900000)
  const maxTimer = setTimeout(() => {
    reader?.cancel?.().catch(() => {})
    idleAbort.abort()
  }, maxTimeoutMs)
  let reader: any = null
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleAbort.abort()
      // 响应已收到但后续 body 不再流动时，需主动取消 reader 才能退出读取循环
      reader?.cancel?.().catch(() => {})
    }, idleTimeoutMs)
  }
  resetIdle()
  // 外部（如客户端断开）中止时，一并中止
  if (signal) {
    if (signal.aborted) idleAbort.abort()
    else signal.addEventListener('abort', () => idleAbort.abort(), { once: true })
  }

  const url = `${baseUrl}/chat/completions`
  const body = JSON.stringify({
    model,
    messages,
    temperature: overrides.temperature ?? 0.7,
    stream: true
  })

  let res
  try {
    res = await undiciFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'GameHub/1.0 (Nuxt-Server)',
        Accept: 'text/event-stream, application/json, */*'
      },
      body,
      signal: idleAbort.signal
    })
  } catch (e: any) {
    if (idleTimer) clearTimeout(idleTimer)
    clearTimeout(maxTimer)
    if (idleAbort.signal.aborted && !signal?.aborted) {
      throw new Error('AI 接口在生成过程中无响应（超时），请稍后重试或更换描述/模型')
    }
    throw e
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`AI 接口返回 ${res.status}: ${txt.slice(0, 600)}`)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  // 逐块读取 SSE；若运行时不支持流式 body，则整体解析兜底
  reader = res.body?.getReader?.()
  if (!reader) {
    const text = await res.text().catch(() => '')
    return parseSse(text, onToken)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      resetIdle()
      buffer += decoder.decode(value as Uint8Array, { stream: true })
      const r = drain(buffer, onToken)
      buffer = r.rest
      full += r.got
      if (r.done) break
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    clearTimeout(maxTimer)
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }

  // 处理尾部未以换行结束的残留
  const rest = buffer.trim()
  if (rest.startsWith('data:')) {
    const data = rest.slice(5).trim()
    if (data && data !== '[DONE]') {
      try {
        const json = JSON.parse(data)
        const delta: string | undefined = json.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onToken?.(delta)
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 因空闲看门狗触发而中止（非客户端断开）→ 视为上游无响应
  if (idleAbort.signal.aborted && !signal?.aborted) {
    throw new Error('AI 接口在生成过程中无响应（超时），请稍后重试或更换描述')
  }

  return full
}

/**
 * 修复模式：把生成后校验未通过的 HTML（含具体语法错误）回喂给模型，
 * 仅修复语法/结构错误，不改玩法逻辑，输出完整可运行的单文件 HTML。
 * 用于提升“生成 → 入库”的成功率，避免因为偶发的 JS 语法错误而丢弃整局生成。
 */
const REPAIR_SYSTEM_PROMPT = `你是一位资深前端游戏开发者。下面是一段【单文件 HTML 游戏】代码，它目前存在 JavaScript 语法错误，无法在浏览器中运行。

请只修复这些语法错误，不要改动游戏的玩法、样式与其余逻辑，也不要新增功能。
修复后请只输出【完整、可直接运行、单文件的 HTML 代码本身】（不要使用 markdown 代码围栏 \`\`\`）。`

export async function repairGameHtml(
  html: string,
  errors: string[],
  overrides: AiOverrides & { temperature?: number; idleTimeoutMs?: number; maxTimeoutMs?: number } = {},
  onToken?: (delta: string) => void
): Promise<string> {
  const config = useRuntimeConfig()
  const baseUrl = (overrides.baseUrl || process.env.AI_BASE_URL || config.aiBaseUrl || '').replace(/\/$/, '')
  const apiKey = overrides.apiKey || process.env.AI_API_KEY || (config.aiApiKey as string) || ''
  const model = overrides.model || process.env.AI_MODEL || (config.aiModel as string) || 'gpt-4o-mini'

  if (!baseUrl) throw new Error('未配置 AI_BASE_URL')
  if (!apiKey) throw new Error('未配置 AI_API_KEY（可在生成时填写你自己的 key）')

  const idleTimeoutMs = Number(overrides.idleTimeoutMs ?? 120000)
  const maxTimeoutMs = Number(overrides.maxTimeoutMs ?? 600000)
  const messages: ChatMessage[] = [
    { role: 'system', content: REPAIR_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `以下 HTML 存在这些错误，请修复后输出完整修正版：\n${errors.join('\n')}\n\n原始 HTML：\n\n${html}`
    }
  ]

  // 复用流式读取与看门狗逻辑
  const idleAbort = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const maxTimer = setTimeout(() => {
    reader?.cancel?.().catch(() => {})
    idleAbort.abort()
  }, maxTimeoutMs)
  let reader: any = null
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleAbort.abort()
      reader?.cancel?.().catch(() => {})
    }, idleTimeoutMs)
  }
  resetIdle()

  const url = `${baseUrl}/chat/completions`
  const body = JSON.stringify({ model, messages, temperature: overrides.temperature ?? 0.3, stream: true })

  let res
  try {
    res = await undiciFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'GameHub/1.0 (Nuxt-Server)',
        Accept: 'text/event-stream, application/json, */*'
      },
      body,
      signal: idleAbort.signal
    })
  } catch (e: any) {
    if (idleTimer) clearTimeout(idleTimer)
    clearTimeout(maxTimer)
    if (idleAbort.signal.aborted) {
      throw new Error('AI 接口在修复过程中无响应（超时），请稍后重试')
    }
    throw e
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`AI 接口返回 ${res.status}: ${txt.slice(0, 600)}`)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  reader = res.body?.getReader?.()
  if (!reader) {
    const text = await res.text().catch(() => '')
    return parseSse(text, onToken)
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      resetIdle()
      buffer += decoder.decode(value as Uint8Array, { stream: true })
      const r = drain(buffer, onToken)
      buffer = r.rest
      full += r.got
      if (r.done) break
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    clearTimeout(maxTimer)
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }
  const rest = buffer.trim()
  if (rest.startsWith('data:')) {
    const data = rest.slice(5).trim()
    if (data && data !== '[DONE]') {
      try {
        const json = JSON.parse(data)
        const delta: string | undefined = json.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onToken?.(delta)
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (idleAbort.signal.aborted) {
    throw new Error('AI 接口在修复过程中无响应（超时），请稍后重试')
  }
  return full
}

/** 解析 SSE 文本缓冲区，返回已解析内容、剩余缓冲与是否结束 */
function drain(buf: string, onToken?: (delta: string) => void): { got: string; rest: string; done: boolean } {
  let got = ''
  let done = false
  let idx: number
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') {
      done = true
      continue
    }
    if (!data) continue
    try {
      const json = JSON.parse(data)
      const delta: string | undefined = json.choices?.[0]?.delta?.content
      if (delta) {
        got += delta
        onToken?.(delta)
      }
    } catch {
      /* 忽略不完整/非 JSON 行 */
    }
  }
  return { got, rest: buf, done }
}

/** 整体解析 SSE 文本（兜底用） */
function parseSse(text: string, onToken?: (delta: string) => void): string {
  let full = ''
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const json = JSON.parse(data)
      const delta: string | undefined = json.choices?.[0]?.delta?.content
      if (delta) {
        full += delta
        onToken?.(delta)
      }
    } catch {
      /* ignore */
    }
  }
  return full
}

function stripFences(text: string): string {
  // 去掉 ```html ... ``` 或 ``` ... ``` 代码围栏
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fence) return fence[1].trim()
  // 去掉开头可能的标记
  return text.replace(/^```(?:html)?/i, '').replace(/```$/i, '').trim()
}

/**
 * 优化提示词：使用【独立的优化大模型】（OPT_AI_* 环境变量配置，缺省时回退到主 AI_*）
 * 把用户简短粗糙的游戏点子扩写成结构清晰、可直接用于生成游戏的中文设计提示词。
 * 与游戏生成模型解耦，互不干扰。
 */
const OPTIMIZE_SYSTEM_PROMPT = `你是一位专业的游戏策划与提示词工程师。用户会用一两句话描述他/她想做的游戏点子。
请把这段粗糙的描述，扩写成一段【结构清晰、信息丰富、可直接用于生成单文件 HTML 小游戏】的中文游戏设计提示词。

要求：
- 保留用户原本的核心创意与游戏类型，不要擅自改成别的游戏。
- 补足缺失的设计要素：核心玩法、操作方式（键盘/鼠标/触屏）、目标与胜负条件、计分方式、视觉与音效风格，以及“无限关卡 + 难度随关卡自动递增”的机制说明。
- 使用中文，具体、可执行，不要泛泛而谈；不要使用 markdown 代码块，直接输出优化后的提示词文本本身。
- 总长度控制在 600 字以内。`

export async function optimizePrompt(raw: string): Promise<string> {
  const config = useRuntimeConfig()
  const baseUrl = (
    process.env.OPT_AI_BASE_URL ||
    (config.optAiBaseUrl as string) ||
    process.env.AI_BASE_URL ||
    (config.aiBaseUrl as string) ||
    ''
  ).replace(/\/$/, '')
  const apiKey =
    process.env.OPT_AI_API_KEY ||
    (config.optAiApiKey as string) ||
    process.env.AI_API_KEY ||
    (config.aiApiKey as string) ||
    ''
  const model =
    process.env.OPT_AI_MODEL ||
    (config.optAiModel as string) ||
    process.env.AI_MODEL ||
    (config.aiModel as string) ||
    'gpt-4o-mini'
  const timeoutMs = Number(
    process.env.OPT_AI_TIMEOUT_MS || (config.optAiTimeoutMs as number) || 120000
  )
  const text = await chatOnce(
    [
      { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
      { role: 'user', content: `请优化这段游戏点子：${raw}` }
    ],
    { baseUrl, apiKey, model, timeoutMs },
    { temperature: 0.6 }
  )
  return stripFences(text).trim()
}
