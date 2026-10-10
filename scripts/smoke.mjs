const BASE = 'http://localhost:3000'
const GAME = '6ac8c6f0fe2a9d3fb27118ba' // existing game from prior session
let fails = 0
function ok(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`)
  if (!cond) fails++
}
async function j(method, path, body, query) {
  const url = BASE + path + (query ? '?' + new URLSearchParams(query) : '')
  const opt = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opt.body = JSON.stringify(body)
  const r = await fetch(url, opt)
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text) } catch {}
  return { status: r.status, data, text }
}

(async () => {
  // 1) Register user
  const uname = 'smoke_' + Math.random().toString(36).slice(2, 8)
  const sign = 'secret123'
  const reg = await j('POST', '/api/users', { username: uname, sign, displayName: 'SmokeBot' })
  ok('register user', reg.status === 200 && reg.data?.id, `status=${reg.status} id=${reg.data?.id}`)
  const uid = reg.data.id
  const gotSign = reg.data.sign
  ok('register returns plain sign once', gotSign === sign, `sign=${gotSign}`)

  // 2) Re-register same username -> 409
  const dup = await j('POST', '/api/users', { username: uname, sign })
  ok('duplicate username rejected', dup.status === 409, `status=${dup.status}`)

  // 3) Verify (login)
  const ver = await j('POST', '/api/users/verify', { username: uname, sign })
  ok('verify user', ver.status === 200 && ver.data?.id === uid, `status=${ver.status}`)
  const bad = await j('POST', '/api/users/verify', { username: uname, sign: 'wrong' })
  ok('verify wrong sign rejected', bad.status === 401, `status=${bad.status}`)

  // 4) Profile GET
  const prof = await j('GET', `/api/users/${uid}`)
  ok('profile get', prof.status === 200 && prof.data?.username === uname && prof.data?.signHash === undefined, `displayName=${prof.data?.displayName}`)
  ok('profile no signHash leak', prof.data?.signHash === undefined)

  // 5) Patch profile (sign required)
  const patch = await j('PATCH', `/api/users/${uid}`, { sign, bio: 'hello', displayName: 'SmokeBot2' })
  ok('patch profile', patch.status === 200 && patch.data?.updated === true, `status=${patch.status}`)
  const patchBad = await j('PATCH', `/api/users/${uid}`, { sign: 'wrong', bio: 'x' })
  ok('patch wrong sign rejected', patchBad.status === 401, `status=${patchBad.status}`)
  const prof2 = await j('GET', `/api/users/${uid}`)
  ok('patch persisted', prof2.data?.bio === 'hello' && prof2.data?.displayName === 'SmokeBot2')

  // 6) Favorite the game
  const fav = await j('POST', `/api/games/${GAME}/favorite`, { username: uname, sign })
  ok('favorite add', fav.status === 200 && fav.data?.favorited === true, `status=${fav.status}`)
  const fav2 = await j('POST', `/api/games/${GAME}/favorite`, { username: uname, sign })
  ok('favorite toggle off', fav2.status === 200 && fav2.data?.favorited === false)
  const fav3 = await j('POST', `/api/games/${GAME}/favorite`, { username: uname, sign })
  ok('favorite add again', fav3.status === 200 && fav3.data?.favorited === true)
  const favNoSign = await j('POST', `/api/games/${GAME}/favorite`, { username: uname, sign: 'nope' })
  ok('favorite wrong sign rejected', favNoSign.status === 401)

  // 7) Favorites list (signed query)
  const fl = await j('GET', `/api/favorites/${encodeURIComponent(uname)}`, null, { sign })
  ok('favorites list', fl.status === 200 && Array.isArray(fl.data?.favorites) && fl.data.favorites.some(f => f.id === GAME), `count=${fl.data?.favorites?.length}`)
  const flBad = await j('GET', `/api/favorites/${encodeURIComponent(uname)}`, null, { sign: 'nope' })
  ok('favorites wrong sign rejected', flBad.status === 401)

  // 8) Play the game (populate plays + leaderboard)
  const before = (await j('GET', `/api/games/${GAME}`)).data.playCount
  const play = await j('POST', `/api/games/${GAME}/play`, { userId: uid, durationMs: 65000, score: 42 })
  ok('play recorded', play.status === 200 && play.data?.playCount > before, `before=${before} after=${play.data?.playCount}`)

  // 9) Per-game leaderboard
  const gboard = await j('GET', `/api/games/${GAME}/leaderboard`)
  const me = gboard.data?.leaderboard?.find(r => String(r.userId) === uid)
  ok('per-game leaderboard has player', !!me, `rows=${gboard.data?.leaderboard?.length}`)
  ok('per-game duration correct', me && me.totalDurationMs === 65000, `dur=${me?.totalDurationMs}`)
  ok('per-game best score', me && me.bestScore === 42, `score=${me?.bestScore}`)

  // 10) Total leaderboard
  const tboard = await j('GET', '/api/leaderboard/total')
  const tme = tboard.data?.leaderboard?.find(r => String(r.userId) === uid)
  ok('total leaderboard has player', !!tme, `rows=${tboard.data?.leaderboard?.length}`)
  ok('total duration correct', tme && tme.totalDurationMs >= 65000, `dur=${tme?.totalDurationMs}`)

  // 11) Download endpoint
  const dl = await fetch(BASE + `/api/games/${GAME}/download`)
  const buf = Buffer.from(await dl.arrayBuffer())
  ok('download html', dl.status === 200 && buf.length > 100 && buf.toString('utf8', 0, 15).includes('<!DOCTYPE'), `bytes=${buf.length}`)

  console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}`)
  process.exit(fails === 0 ? 0 : 1)
})().catch(e => { console.error('ERR', e); process.exit(2) })
