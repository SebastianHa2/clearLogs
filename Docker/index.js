const express = require('express')
const admin = require('firebase-admin')
const axios = require('axios')
const fs = require('fs')
const bodyParser = require('body-parser')

const app = express()

// Use bodyParser to parse JSON bodies
app.use(bodyParser.json())

// -------------------------------
// Load service account credentials
// -------------------------------
let serviceAccount
let credentialSource = process.env.GOOGLE_APPLICATION_CREDENTIALS || ''

// Trim any extra whitespace
credentialSource = credentialSource.trim()

// Determine whether the secret was injected inline or as a file path
if (credentialSource.startsWith('{')) {
  // Assume inline JSON
  try {
    serviceAccount = JSON.parse(credentialSource)
    console.log('Service account loaded from inline JSON.')
  } catch (e) {
    console.error('Error parsing inline JSON for service account:', e)
    process.exit(1)
  }
} else {
  // Assume it’s a file path
  if (!fs.existsSync(credentialSource)) {
    console.error(`Credentials file not found at path: ${credentialSource}`)
    process.exit(1)
  }
  try {
    const fileData = fs.readFileSync(credentialSource, 'utf8')
    serviceAccount = JSON.parse(fileData)
    console.log('Service account loaded from file:', credentialSource)
  } catch (e) {
    console.error('Error reading or parsing credentials file:', e)
    process.exit(1)
  }
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tangledev00.firebaseio.com",
})

// -------------------------------
// Main endpoint: Check dashboards settings
// -------------------------------
app.get('/', async (req, res) => {
  try {
    const projectURL = 'https://tangledev00.firebaseio.com'
    const shallowURL = `${projectURL}/dashboards.json?shallow=true`

    // Obtain an access token for the Firebase REST API call
    const accessToken = await admin.credential.applicationDefault().getAccessToken()

    // Call the Firebase REST API with Bearer token authentication
    const response = await axios.get(shallowURL, {
      headers: {
        Authorization: `Bearer ${accessToken.access_token}`,
      },
    })

    // Retrieve the dashboard IDs from the shallow response
    const dashboardIds = Object.keys(response.data || {})
    const dashboardsToClean = []

    // Check each dashboard for the 'clearDataGridLogsDaily' flag in its settings
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
    return res
      .status(200)
      .send(`Dashboards to clean: ${dashboardsToClean.join(', ')}`)
  } catch (err) {
    console.error('Failed to check dashboards:', err.message)
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