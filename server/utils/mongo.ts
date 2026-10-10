import { MongoClient, type Db } from 'mongodb'

let dbPromise: Promise<Db> | null = null

/**
 * 返回 gamehub 数据库的单例连接。
 * 连接串来自 runtimeConfig.mongodbUri（默认 192.168.28.9:27017）。
 */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    const uri = (useRuntimeConfig().mongodbUri as string) || 'mongodb://192.168.28.9:27017'
    // 数据库名由运行时变量决定，默认 'gamehub'，绝不会误写进 test/dev 库。
    const dbName = (useRuntimeConfig().mongodbDb as string) || 'gamehub'
    const client = new MongoClient(uri)
    dbPromise = client
      .connect()
      .then((c) => c.db(dbName))
      .catch((err) => {
        dbPromise = null
        throw err
      })
  }
  return dbPromise
}
