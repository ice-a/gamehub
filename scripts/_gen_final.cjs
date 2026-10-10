const BASE = 'http://localhost:3000'
const fs = require('fs')
const before = (() => { try { return fs.readFileSync('/tmp/gen_before.txt','utf8') } catch { return '' } })()
;(async () => {
  const res = await fetch(`${BASE}/api/games`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '经典打砖块游戏，挡板接球消除所有砖块通关', style: 'casual', userId: 'final_test' })
  })
  console.log('client: started (status', res.status + ')')
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let doneId=null; let err=null
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true }); const lines = buf.split('\n\n'); buf = lines.pop() || ''
      for (const c of lines) { const ev=(c.match(/event: (.+)/)||[])[1]; const data=(c.match(/data: (.+)/s)||[])[1]
        if (ev==='done'){try{doneId=JSON.parse(data).id}catch{}}
        if (ev==='error'){try{err=JSON.parse(data).message}catch{}}
        if (ev) process.stdout.write(`  [${ev}]\n`) } }
  } catch {}
  console.log('RESULT doneId=', doneId, 'err=', err)
  const { MongoClient } = require('mongodb')
  const c = new MongoClient('mongodb://192.168.28.9:27017'); await c.connect()
  const db = c.db('gamehub')
  const cnt = await db.collection('games').countDocuments()
  const found = doneId ? await db.collection('games').findOne({ _id: new (require('mongodb').ObjectId)(doneId) }) : null
  console.log('total games:', cnt, 'saved:', !!found)
  await c.close()
})().catch(e=>{console.error('ERR',e.message);process.exit(1)})
