const app = require("./server")


app.listen(process.env.PORT || 3000, () => {
  console.log('Running app on port', process.env.PORT || 3000)
})