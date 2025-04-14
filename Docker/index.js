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
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  console.log('Service account loaded from inline JSON.')
} catch (e) {
  console.error('Error parsing inline JSON for service account:', e)
  process.exit(1)
}

const myCredential = admin.credential.cert(serviceAccount)

admin.initializeApp({
  credential: myCredential,
  databaseURL: "https://tangledev00.firebaseio.com",
})

// -------------------------------
// Batch deletion helper for large logs
// -------------------------------
async function deleteDataGridLogsInBatches(dashId, batchSize = 5000) {
  const logsRef = admin.database().ref(`dashboards/${dashId}/dataGridLogs`)
  const snapshot = await logsRef.once('value')
  const logs = snapshot.val()

  if (!logs) {
    console.log(`No dataGridLogs found for dashboard ${dashId}`)
    return
  }

  const allKeys = Object.keys(logs)
  console.log(`Found ${allKeys.length} dataGridLogs for dashboard ${dashId}`)

  for (let i = 0; i < allKeys.length; i += batchSize) {
    const batch = allKeys.slice(i, i + batchSize)
    const updates = {}
    batch.forEach(key => updates[key] = null)
    await logsRef.update(updates)
    console.log(`Deleted batch ${i / batchSize + 1} (${batch.length} items) for dashboard ${dashId}`)
  }

  console.log(`Finished cleaning dataGridLogs for dashboard ${dashId}`)
}

// -------------------------------
// Main endpoint
// -------------------------------
app.get('/', async (req, res) => {
  try {
    const projectURL = 'https://tangledev00.firebaseio.com'
    const shallowURL = `${projectURL}/dashboards.json?shallow=true`

    const tokenResult = await myCredential.getAccessToken()
    const accessToken = tokenResult.access_token

    const response = await axios.get(shallowURL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const dashboardIds = Object.keys(response.data || {})
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

    for (const dashId of dashboardsToClean) {
      await deleteDataGridLogsInBatches(dashId)
    }

    return res
      .status(200)
      .send(`Removed dataGridLogs for dashboards: ${dashboardsToClean.join(', ')}`)
  } catch (err) {
    console.error('Failed to process dashboards:', err.message)
    res.status(500).send('Something went wrong')
  }
})

// -------------------------------
const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

module.exports = app