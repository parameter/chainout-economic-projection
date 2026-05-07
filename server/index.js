import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'

const app = express()
const port = Number(process.env.PORT) || 4000
const mongoUri = process.env.MONGODB_URI

if (!mongoUri) {
  throw new Error('MONGODB_URI is not set in the environment')
}

const client = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

await client.connect()

const db = client.db(process.env.MONGODB_DB_NAME || 'chainout_projection')
const projections = db.collection('projections')

await projections.createIndex({ createdAt: -1 })

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/projections', async (_req, res) => {
  const docs = await projections
    .find(
      {},
      {
        projection: {
          _id: 1,
          name: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray()

  res.json(docs)
})

app.get('/api/projections/:id', async (req, res) => {
  const { id } = req.params

  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    res.status(400).json({ error: 'Invalid projection id' })
    return
  }

  const doc = await projections.findOne({ _id: new ObjectId(id) })

  if (!doc) {
    res.status(404).json({ error: 'Projection not found' })
    return
  }

  res.json(doc)
})

app.post('/api/projections', async (req, res) => {
  const { name, inputs } = req.body ?? {}

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Projection name is required' })
    return
  }

  if (!inputs || typeof inputs !== 'object') {
    res.status(400).json({ error: 'Projection inputs are required' })
    return
  }

  const now = new Date()
  const document = {
    name: name.trim(),
    inputs,
    createdAt: now,
    updatedAt: now,
  }

  const result = await projections.insertOne(document)
  res.status(201).json({ id: result.insertedId, ...document })
})

app.listen(port, () => {
  console.log(`Projection API listening on http://localhost:${port}`)
})
