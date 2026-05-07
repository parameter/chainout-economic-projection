import { MongoClient, ServerApiVersion } from 'mongodb'

const mongoUri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME || 'chainout_projection'

if (!mongoUri) {
  throw new Error('MONGODB_URI is not set in the environment')
}

let cachedClient

async function getClient() {
  if (!cachedClient) {
    cachedClient = new MongoClient(mongoUri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    })
    await cachedClient.connect()
  }

  return cachedClient
}

export async function getProjectionsCollection() {
  const client = await getClient()
  const collection = client.db(dbName).collection('projections')
  await collection.createIndex({ createdAt: -1 })
  return collection
}
