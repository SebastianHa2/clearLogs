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

// For debugging: log the raw value (remove or comment out later)
console.log('Raw GOOGLE_APPLICATION_CREDENTIALS:', credentialSource)

// Trim extra whitespace
credentialSource = credentialSource.trim()

// Remove leading/trailing quotes if present
if (credentialSource.startsWith('"') && credentialSource.endsWith('"')) {
  credentialSource = credentialSource.slice(1, -1)
}

// Determine if credentialSource is inline JSON or a file path
if (credentialSource.startsWith('{')) {
  // Looks like inline JSON
  try {
    serviceAccount = JSON.parse(credentialSource)
    console.log('Service account loaded from inline JSON.')
  } catch (e) {
    console.error('Error parsing inline JSON for service account:', e)
    throw e
  }
} else {
  // Treat as a file path
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
// Main endpoint: Check dashboards settings
// -------------------------------
app.get('/', async (req, res) => {
  try {
    const projectURL = 'https://tangledev00.firebaseio.com'
    const shallowURL = `${projectURL}/dashboards.json?shallow=true`

    // Obtain an access token to authenticate the REST API call
    const accessToken = await admin.credential.applicationDefault().getAccessToken()

    // Call Firebase REST API with bearer token authentication
    const response = await axios.get(shallowURL, {
      headers: {
        Authorization: `Bearer ${accessToken.access_token}`,
      },
    })

    // Retrieve the dashboard IDs from the shallow response
    const dashboardIds = Object.keys(response.data || {})
    const dashboardsToClean = []

    // Check each dashboard for the setting 'clearDataGridLogsDaily'
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