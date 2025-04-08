const express = require('express')
const admin = require('firebase-admin')

const app = express()

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://tangledev00.firebaseio.com',
})

app.get('/', async (req, res) => {
  try {
    await admin.database().ref('dashboards/-OMuOPY2_cQDObvXrruB/dataGridLogs').remove()
    console.log('Successfully cleared dataGridLogs')
    res.status(200).send('Cleared logs')
  } catch (err) {
    console.error('Failed to clear logs:', err)
    res.status(500).send('Something went wrong')
  }
})

module.exports = app