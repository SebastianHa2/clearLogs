const express = require('express')
const admin = require('firebase-admin')
const axios = require('axios')
const bodyParser = require('body-parser')

const app = express()

// Parse JSON bodies
app.use(bodyParser.json())

// -------------------------------
// Load service account credentials (inline JSON only)
// -------------------------------
let serviceAccount

try {
  // Directly parse the inline JSON from the environment variable
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  console.log('Service account loaded from inline JSON.')
} catch (e) {
  console.error('Error parsing inline JSON for service account:', e)
  process.exit(1)
}

// Create a credential instance from the service account
const myCredential = admin.credential.cert(serviceAccount)

// Initialize Firebase Admin with the certificate credential
admin.initializeApp({
  credential: myCredential,
  databaseURL: "https://tangledev00.firebaseio.com",
})

// -------------------------------
// Main endpoint: Check dashboards settings and remove workflowLogs
// -------------------------------
app.get('/', async (req, res) => {
  try {
    const projectURL = 'https://tangledev00.firebaseio.com'
    const shallowURL = `${projectURL}/dashboards.json?shallow=true`

    // Get an access token using our certificate credential
    const tokenResult = await myCredential.getAccessToken()
    const accessToken = tokenResult.access_token

    // Call the Firebase REST API with Bearer token authentication
    const response = await axios.get(shallowURL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    // Get the list of dashboard IDs from the shallow response
    const dashboardIds = Object.keys(response.data || {})
    const dashboardsToClean = []

    // Check each dashboard for the 'clearDataGridLogsDaily' setting
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

    // Loop over each dashboard and remove its workflowLogs
    for (const dashId of dashboardsToClean) {
      await admin.database().ref(`dashboards/${dashId}/workflowLogs`).remove()
      console.log(`Removed workflowLogs for dashboard ${dashId}`)
    }

    return res
      .status(200)
      .send(`Removed workflowLogs for dashboards: ${dashboardsToClean.join(', ')}`)
  } catch (err) {
    console.error('Failed to process dashboards:', err.message)
    res.status(500).send('Something went wrong')
  }
})

// -------------------------------
// Start the server
// -------------------------------
const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

module.exports = app