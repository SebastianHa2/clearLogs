app.get('/', async (req, res) => {
    try {
      const dashboardsRef = admin.database().ref('dashboards')
      const snapshot = await dashboardsRef.once('value')
      const dashboards = snapshot.val()
  
      if (!dashboards) {
        console.log('No dashboards found.')
        return res.status(200).send('No dashboards found.')
      }
  
      const dashboardsToClean = []
  
      Object.entries(dashboards).forEach(([dashId, dashData]) => {
        if (
          dashData.settings &&
          dashData.settings.clearDataGridLogsDaily === true
        ) {
          dashboardsToClean.push(dashId)
        }
      })
  
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