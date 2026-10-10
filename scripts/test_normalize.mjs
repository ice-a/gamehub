// 复制 server/utils/validateHtml.ts 中的 normalizeGameHtml 做算法验证
function normalizeGameHtml(raw) {
  let h = (raw || '').trim()
  const fence = h.match(/```(?:html)?\s*([\s\S]*?)\s*```/i)
  if (fence) h = fence[1].trim()
  const closeIdx = h.lastIndexOf('</html>')
  if (closeIdx >= 0) h = h.slice(0, closeIdx + '</html>'.length)
  if (!/^<!DOCTYPE html>/i.test(h)) h = '<!DOCTYPE html>\n' + h
  if (!/<html[\s>]/i.test(h)) h = h.replace(/^<!DOCTYPE html>\s*/i, '$&<html lang="zh-CN">\n') + '\n</html>'
  if (!/<head[\s>]/i.test(h)) h = h.replace(/<html[^>]*>/i, (m) => `${m}\n<head></head>`)
  if (!/charset\s*=/i.test(h)) h = h.replace(/(<head[^>]*>)/i, '$1\n<meta charset="utf-8">')
  if (!/name\s*=\s*["']viewport["']/i.test(h)) h = h.replace(/(<head[^>]*>)/i, '$1\n<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">')
  const reset = `<style id="gamehub-normalize">html,body{height:100%!important;margin:0!important;padding:0!important;overflow:auto}*,*::before,*::after{box-sizing:border-box}</style>`
  if (!/gamehub-normalize/.test(h)) h = h.replace(/(<head[^>]*>)/i, `$1\n${reset}`)
  return h
}

let fails = 0
const ok = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++ }

// 1) 完全缺失结构
let r = normalizeGameHtml('<body><div>hi</div>')
ok('missing: doctype added', /^<!DOCTYPE html>/i.test(r))
ok('missing: html added', /<html lang="zh-CN">/i.test(r))
ok('missing: head added', /<head>/.test(r))
ok('missing: charset injected', /<meta charset="utf-8">/i.test(r))
ok('missing: viewport injected', /name="viewport"/i.test(r))
ok('missing: normalize style injected', /gamehub-normalize/.test(r))
ok('missing: closed html', /<\/html>$/.test(r.trim()))

// 2) 已有 charset(大写) 与 viewport，不应重复注入 charset
r = normalizeGameHtml('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head><body>x</body></html>')
ok('dup: charset not duplicated', (r.match(/charset=/gi) || []).length === 1)
ok('dup: viewport present', /name="viewport"/i.test(r))
ok('dup: normalize still added', /gamehub-normalize/.test(r))

// 3) markdown 围栏 + 尾部废话
r = normalizeGameHtml('```html\n<!DOCTYPE html><html><head></head><body>game</body></html>\n```\n希望你喜欢这个游戏')
ok('fence: stripped', !/```/.test(r))
ok('fence: trailing prose removed', !/希望你喜欢/.test(r))
ok('fence: has doctype', /^<!DOCTYPE html>/i.test(r))

// 4) 仅 doctype+html 片段
r = normalizeGameHtml('<!DOCTYPE html><html><body><h1>标题</h1></body>')
ok('fragment: head injected', /<head>/.test(r))
ok('fragment: charset injected', /<meta charset="utf-8">/i.test(r))
ok('fragment: viewport injected', /name="viewport"/i.test(r))

// 5) 已有完整结构（不破坏原内容）
const full = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>t</title></head><body><button>go</button></body></html>'
r = normalizeGameHtml(full)
ok('full: content preserved', /<button>go<\/button>/.test(r))
ok('full: charset kept', /<meta charset="utf-8">/i.test(r))

// 6) 验证 SYSTEM_PROMPT 锁定了硬性要求（读源码）
import('fs').then(async (fs) => {
  const src = fs.readFileSync('server/utils/ai.ts', 'utf8')
  ok('prompt: charset required', /charset="utf-8"/.test(src))
  ok('prompt: viewport required', /name="viewport"/.test(src))
  ok('prompt: no 100vh allowed', /禁止用 100vh/.test(src))
  ok('prompt: win animation required', /过关\/胜利/.test(src))
  console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}`)
  process.exit(fails === 0 ? 0 : 1)
})
