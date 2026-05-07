import { getProjectionsCollection } from '../_lib/mongo.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const projections = await getProjectionsCollection()
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

    res.status(200).json(docs)
    return
  }

  if (req.method === 'POST') {
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

    const projections = await getProjectionsCollection()
    const result = await projections.insertOne(document)
    res.status(201).json({ id: result.insertedId, ...document })
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: `Method ${req.method} not allowed` })
}
