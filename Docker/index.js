const express = require('express')
const admin = require('firebase-admin')
const axios = require('axios')
const fs = require('fs')

const app = express()

// -------------------------------
// Load service account credentials
// -------------------------------
let serviceAccount
let credentialSource = process.env.GOOGLE_APPLICATION_CREDENTIALS || ''

// Log the raw environment variable value (for debugging; remove or disable later)
console.log('Raw GOOGLE_APPLICATION_CREDENTIALS:', credentialSource)

// Remove any leading/trailing whitespace
credentialSource = credentialSource.trim()

// If the value is wrapped in quotes, remove them
if (credentialSource.startsWith('"') && credentialSource.endsWith('"')) {
  credentialSource = credentialSource.slice(1, -1)
}

// Determine if the credentialSource is inline JSON or a file path
if (credentialSource.startsWith('{')) {
  // It looks like inline JSON—attempt to parse it
  try {
    serviceAccount = JSON.parse(credentialSource)
    console.log('Service account loaded from inline JSON.')
  } catch (e) {
    console.error('Error parsing inline JSON for service account:', e)
    throw e
  }
} else {
  // Otherwise, treat it as a file path
  if (!fs.existsSync(credentialSource)) {
    const errMsg = `Credentials file not found at path: ${credentialSource}`
    console.error(errMsg)
    throw new Error(errMsg)
  }
  try {
    const fileData = fs.readFileSync(credentialSource, 'utf8')
    serviceAccount = JSON.parse(fileData)
    console.log('Service account loaded from file:', credentialSource)
  } catch (e) {
    console.error('Error reading or parsing credentials file:', e)
    throw e
  }
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://tangledev00.firebaseio.com',
})

// -------------------------------
// Main route: Check dashboards settings
// -------------------------------
app.get('/', async (req, res) => {
  try {
    const projectURL = 'https://tangledev00.firebaseio.com'
    const shallowURL = `${projectURL}/dashboards.json?shallow=true`

    // Obtain an access token to authenticate the REST API call
    const accessToken = await admin.credential.applicationDefault().getAccessToken()

    // Call the Firebase REST API with the Bearer token
    const response = await axios.get(shallowURL, {
      headers: {
        Authorization: `Bearer ${accessToken.access_token}`,
      },
    })

    // Get the list of dashboard IDs from the shallow response
    const dashboardIds = Object.keys(response.data || {})
    const dashboardsToClean = []

    // For each dashboard, check if settings/clearDataGridLogsDaily is set to true
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

module.exports = app