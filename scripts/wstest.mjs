import { WebSocket } from 'ws'

const URL = 'ws://localhost:3001/ws'
const log = (...a) => console.log(...a)

function open() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

const results = {}
const host = await open()
host.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.type === 'created') results.code = m.code
  if (m.type === 'members') results.hostMembers = m.members.length
  if (m.type === 'event') results.hostGotEvent = m.data
})

host.send(JSON.stringify({ type: 'create', gameId: null, user: { userId: 'u1', name: 'Host' } }))

// 等待房间码
await new Promise((r) => setTimeout(r, 300))
const code = results.code
log('created code =', code)
if (!code) {
  log('FAIL: 未拿到房间码')
  process.exit(1)
}

const guest = await open()
guest.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.type === 'joined') results.guestJoined = true
  if (m.type === 'event') results.guestGotEvent = m.data
})
guest.send(JSON.stringify({ type: 'join', code, user: { userId: 'u2', name: 'Guest' } }))
await new Promise((r) => setTimeout(r, 300))
log('guest joined =', results.guestJoined, ' host sees members =', results.hostMembers)

// guest 发事件，host 应收到
guest.send(JSON.stringify({ type: 'event', data: { move: 'left' } }))
// host 发事件，guest 应收到
await new Promise((r) => setTimeout(r, 100))
host.send(JSON.stringify({ type: 'event', data: { move: 'right' } }))
await new Promise((r) => setTimeout(r, 300))

log('host got event from guest =', JSON.stringify(results.hostGotEvent))
log('guest got event from host =', JSON.stringify(results.guestGotEvent))

const ok = results.guestJoined && results.hostMembers === 2 && results.hostGotEvent?.move === 'left' && results.guestGotEvent?.move === 'right'
log(ok ? 'PASS ✅' : 'FAIL ❌')
process.exit(ok ? 0 : 1)
