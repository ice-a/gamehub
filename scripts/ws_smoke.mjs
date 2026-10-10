import { WebSocket } from 'ws'

const URL = 'ws://localhost:3001/ws'
let fails = 0
const ok = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++ }
const wait = (ms) => new Promise(r => setTimeout(r, ms))
function open() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(URL)
    ws.on('open', () => res(ws))
    ws.on('error', rej)
  })
}
function send(ws, m) { ws.send(JSON.stringify(m)) }
function next(ws, type, timeout = 5000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout waiting ' + type)), timeout)
    const h = (raw) => {
      let m; try { m = JSON.parse(raw.toString()) } catch { return }
      if (m.type === type) { clearTimeout(t); ws.off('message', h); res(m) }
    }
    ws.on('message', h)
  })
}

(async () => {
  const a = await open()
  const b = await open()
  ok('both ws connected', a.readyState === 1 && b.readyState === 1)

  // A creates a room
  const createdP = next(a, 'created')
  send(a, { type: 'create', gameId: '6ac8c6f0fe2a9d3fb27118ba', user: { userId: 'u-a', name: 'Host' } })
  const created = await createdP
  ok('room created with 6-digit code', /^\d{6}$/.test(created.code), `code=${created.code}`)
  ok('creator is host', created.members?.some(m => m.name === 'Host' && m.host) === true)
  const code = created.code

  // B joins
  const bJoined = next(b, 'joined')
  const aSeesMembers = next(a, 'members')
  send(b, { type: 'join', code, user: { userId: 'u-b', name: 'Guest' } })
  const joined = await bJoined
  ok('join returns code', joined.code === code)
  const mem = await aSeesMembers
  ok('host sees 2 members', mem.members?.length === 2, `n=${mem.members?.length}`)

  // A sends event -> B receives
  const bEvent = next(b, 'event')
  send(a, { type: 'event', data: { type: 'move', x: 10, y: 20 } })
  const ev = await bEvent
  ok('event relayed to other client', ev.from && ev.data?.type === 'move' && ev.data.x === 10, JSON.stringify(ev.data))

  // B sends event -> A receives
  const aEvent = next(a, 'event')
  send(b, { type: 'event', data: { hello: 'world' } })
  const ev2 = await aEvent
  ok('event relayed back', ev2.data?.hello === 'world')

  // Host (A) disconnects -> host transfers to B, member count drops to 1
  const aGone = next(b, 'members')
  a.close()
  const after = await aGone
  ok('member removed on host leave', after.members?.length === 1, `n=${after.members?.length}`)
  ok('host transferred to remaining member', after.members?.[0]?.host === true, `name=${after.members?.[0]?.name}`)

  await wait(200)
  b.close()
  console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}`)
  process.exit(fails === 0 ? 0 : 1)
})().catch(e => { console.error('ERR', e); process.exit(2) })
