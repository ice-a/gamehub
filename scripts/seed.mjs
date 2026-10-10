import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || 'mongodb://192.168.28.9:27017'
const client = new MongoClient(uri)
await client.connect()
const db = client.db('gamehub')

const html = `<!DOCTYPE html><html><head><title>测试打砖块</title></head><body><h1>打砖块</h1><script>
  let score = 0;
  function add(n){ score += n; return score; }
  console.log('ready', add(10));
</script></body></html>`

const res = await db.collection('games').insertOne({
  title: '测试打砖块',
  description: '一个用于联调的测试游戏',
  style: 'casual',
  html,
  status: 'published',
  playCount: 0,
  playerCount: 0,
  players: [],
  createdAt: new Date(),
  updatedAt: new Date()
})
console.log('inserted game id:', res.insertedId.toString())
await client.close()
