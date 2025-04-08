const app = require('./index')
const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log(`Log clearer service listening on port ${PORT}`)
})