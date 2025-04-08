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
      const dashboardsListSnapshot = await admin.database().ref('dashboards').once('value', { shallow: true })
      const dashboardIds = Object.keys(dashboardsListSnapshot.val() || {})
  
      const dashboardsToClean = []
  
      for (const dashId of dashboardIds) {
        const settingSnap = await admin
          .database()
          .ref(`dashboards/${dashId}/settings/clearDataGridLogsDaily`)
          .once('value')
  
        if (settingSnap.val() === true) {
          dashboardsToClean.push(dashId)
        }
      }
  
      if (dashboardsToClean.length === 0) {
        console.log('No dashboards with clearDataGridLogsDaily enabled.')
        return res.status(200).send('No dashboards need cleaning.')
      }
  
      console.log('Dashboards to clean:', dashboardsToClean)
      return res.status(200).send(`Dashboards to clean: ${dashboardsToClean.join(', ')}`)
    } catch (err) {
      console.error('Failed to check dashboards:', err)
      res.status(500).send('Something went wrong')
    }
  })

module.exports = app