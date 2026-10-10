import { parse as acornParse } from 'acorn'

export interface ValidateResult {
  ok: boolean
  errors: string[]
}

/**
 * 校验生成的 HTML 是否“可运行”：
 * 1. 具备基本文档结构
 * 2. 内联 <script> 的 JS 语法可通过 acorn 解析
 * 3. 单文件约束：不得引用任何外部 http(s) 资源（src/href/import/@import）
 */
export function validateGameHtml(html: string): ValidateResult {
  const errors: string[] = []
  if (!html || typeof html !== 'string') {
    return { ok: false, errors: ['HTML 内容为空'] }
  }

  const lower = html.toLowerCase()
  if (!lower.includes('<html') || !lower.includes('</html>')) {
    errors.push('缺少 <html> 文档结构')
  }
  if (!lower.includes('<body')) {
    errors.push('缺少 <body>')
  }

  // 拒绝外部资源（单文件约束）
  const externalPatterns: [RegExp, string][] = [
    [/\b(?:src|href)\s*=\s*["']https?:\/\//i, '存在外部 src/href 资源'],
    [/\bimport\s+[^"']*from\s*["']https?:\/\//i, '存在远程模块 import'],
    [/\bimport\s*\(\s*["']https?:\/\//i, '存在远程动态 import'],
    [/@import\s+["']https?:\/\//i, '存在远程 @import'],
    [/<link\b[^>]*https?:\/\//i, '存在外部 <link> 资源']
  ]
  for (const [re, msg] of externalPatterns) {
    if (re.test(html)) errors.push(msg)
  }

  // 校验内联脚本语法
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = scriptRegex.exec(html)) !== null) {
    idx++
    const attrs = match[1] || ''
    const code = match[2] || ''
    // 跳过带 src 的外部脚本与纯 JSON/类型非 js 的脚本
    if (/\bsrc\s*=/.test(attrs)) continue
    if (/\btype\s*=\s*["'](?!text\/javascript|application\/javascript|module|)[^"']+["']/i.test(attrs)) {
      // 非 JS 类型（如 importmap/text/plain）跳过语法校验
      if (!/module|javascript/i.test(attrs)) continue
    }
    if (!code.trim()) continue
    try {
      acornParse(code, {
        ecmaVersion: 'latest',
        sourceType: /\btype\s*=\s*["']module["']/i.test(attrs) ? 'module' : 'script',
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        allowHashBang: true
      })
    } catch (e: any) {
      errors.push(`内联脚本#${idx} 语法错误：${e.message}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * 生成后兜底修正：保证单 HTML 游戏在 iframe 内不乱码、不被裁切。
 * 即使模型漏写 charset / viewport / 撑满样式，也强制补齐。
 * 仅在生成流程中调用（用户不可见），不改动游戏本身的玩法逻辑。
 */
export function normalizeGameHtml(raw: string): string {
  let h = (raw || '').trim()

  // 兜底去除 markdown 代码围栏
  const fence = h.match(/```(?:html)?\s*([\s\S]*?)\s*```/i)
  if (fence) h = fence[1].trim()

  // 去掉 </html> 之后的多余文本（如“希望你喜欢”之类）
  const closeIdx = h.lastIndexOf('</html>')
  if (closeIdx >= 0) h = h.slice(0, closeIdx + '</html>'.length)

  // 保证 doctype
  if (!/^<!DOCTYPE html>/i.test(h)) {
    h = '<!DOCTYPE html>\n' + h
  }
  // 保证 <html> 包裹
  if (!/<html[\s>]/i.test(h)) {
    h = h.replace(/^<!DOCTYPE html>\s*/i, '$&<html lang="zh-CN">\n') + '\n</html>'
  }
  // 保证 <head>
  if (!/<head[\s>]/i.test(h)) {
    h = h.replace(/<html[^>]*>/i, (m) => `${m}\n<head></head>`)
  }
  // 补齐 charset
  if (!/charset\s*=/i.test(h)) {
    h = h.replace(/(<head[^>]*>)/i, '$1\n<meta charset="utf-8">')
  }
  // 补齐 viewport
  if (!/name\s*=\s*["']viewport["']/i.test(h)) {
    h = h.replace(
      /(<head[^>]*>)/i,
      '$1\n<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
    )
  }

  // 兜底样式：强制撑满容器、消除默认边距、避免内容被裁切（用 !important 覆盖游戏自带样式）
  const reset = `<style id="gamehub-normalize">html,body{height:100%!important;margin:0!important;padding:0!important;overflow:auto}*,*::before,*::after{box-sizing:border-box}</style>`
  if (!/gamehub-normalize/.test(h)) {
    h = h.replace(/(<head[^>]*>)/i, `$1\n${reset}`)
  }

  return h
}
