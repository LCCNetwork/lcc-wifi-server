const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const cheerio = require('cheerio')
const app = express()

app.set('views', path.join(process.cwd(), 'build'))
app.engine('html', require('ejs').renderFile)
app.set('view engine', 'html')
app.use(express.static(path.join(process.cwd(), 'build')))
app.use(bodyParser.json())

const authUsers = JSON.parse(fs.readFileSync('./cfg/authUsers.json'))

app.server = app.listen(8080, function () {
  const host = app.server.address().address
  const port = app.server.address().port
  console.info('Server listening at http://%s:%s', host, port)
})

app.post('/auth', (req, res) => {
  console.log(req.body)

  if (authUsers.users.indexOf(req.body.email) !== -1) {
    res.json({
      auth: true
    })
  } else {
    res.json({
      auth: false
    })
  }
})

app.get('/user/:uid', (req, res) => {
  res.json({
    used: 1000,
    total: 2000
  })
})

app.use((req, res) => {
  console.info('[404] ' + req.path)
  res.status(404)

  if (req.accepts('html')) res.render('error/404')
  else if (req.accepts('json')) res.end({error: 'Not found'})
  else res.type('txt').end('Not found')
})
