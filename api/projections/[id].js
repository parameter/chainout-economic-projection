import { ObjectId } from 'mongodb'
import { getProjectionsCollection } from '../_lib/mongo.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: `Method ${req.method} not allowed` })
    return
  }

  const { id } = req.query

  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    res.status(400).json({ error: 'Invalid projection id' })
    return
  }

  const projections = await getProjectionsCollection()
  const doc = await projections.findOne({ _id: new ObjectId(id) })

  if (!doc) {
    res.status(404).json({ error: 'Projection not found' })
    return
  }

  res.status(200).json(doc)
}
