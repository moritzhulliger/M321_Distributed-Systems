import { Router } from 'express'
import auth from '../middleware/auth.js'

const router = Router()

const comments = [];

router.get('/data', auth, (req, res) => {
  res.json({
    message: 'Geschützte Daten aus dem Backend',
    timestamp: new Date().toISOString(),
    claims: req.auth || null,
  })
})

router.get('/comments', auth, (req, res) => {
  res.json({
    comments,
  })
});

router.post('/comments', auth, (req, res) => {
  const receivedData = req.body
  console.log('Empfangene Daten zum Speichern:', receivedData)
  comments.push(receivedData)
  res.status(201).json({ message: 'Kommentar gespeichert', data: receivedData })
})

export default router