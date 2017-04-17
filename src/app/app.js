const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const cheerio = require('cheerio')
const _eval = require('eval')
const firebaseAdmin = require('firebase-admin')
const app = express()

app.set('views', path.join(process.cwd(), 'build'))
app.engine('html', require('ejs').renderFile)
app.set('view engine', 'html')
app.use(express.static(path.join(process.cwd(), 'build')))
app.use(bodyParser.json())

const fbKey = require('../../cfg/lcc-wifi-firebase-adminsdk-7t3k9-909305e431.json')
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(fbKey),
  databaseURL: 'https://lcc-wifi.firebaseio.com'
})

const authUsers = require('../../cfg/authUsers.json').users
let users = []

function getDataUsage (uid) {
  return new Promise((resolve, reject) => {
    fs.readFile('out.html', 'utf8', (err, file) => {
      if (err) reject(err)
      const $ = cheerio.load(file)
      const user = users[uid]

      const values = _eval($('script', 'body').text() + 'module.exports = values', '', {
        document: {
          write: function () {}
        },
        getSize: function () {}
      })

      let dataSum = 0

      for (let device in values) {
        device = values[device]
        if (user.ips[device[2]]) dataSum += device[5]
      }

      resolve(dataSum)
    })
  })
}

class User {
  constructor (email, uid, dataCap, ips) {
    this.email = email
    this.uid = uid
    this.dataCap = dataCap
    this.ips = ips
  }
}

app.server = app.listen(8080, function () {
  const host = app.server.address().address
  const port = app.server.address().port
  console.info('Server listening at http://%s:%s', host, port)
})

app.post('/auth', (req, res) => {
  console.log(req.body.token)

  firebaseAdmin.auth().verifyIdToken(req.body.token).then((decodedToken) => {
    console.log(decodedToken)
    const uid = decodedToken.uid

    firebaseAdmin.auth().getUser(uid).then((userRecord) => {
      const email = userRecord.email

      if (authUsers[email]) {
        if (!users[uid]) users[uid] = new User(email, uid, authUsers[email], [req.ip])
        else users[uid].ips[users[uid].ips.length] = req.ip

        res.json({
          auth: true
        })
      } else {
        res.json({
          auth: false
        })
      }
    }).catch((err) => {
      console.log('Token verification error: ' + err)
      res.json({
        auth: false
      })
    })
  }).catch((err) => {
    console.log('Token verification error: ' + err)
    res.json({
      auth: false
    })
  })
})

app.get('/user/:uid', (req, res) => {
  getDataUsage(req.params.uid).then((used) => {
    res.json({
      used: used,
      total: 2000
    })
  }).catch((err) => {
    console.log(err)
  })
})

app.use((req, res) => {
  console.info('[404] ' + req.path)
  res.status(404)

  if (req.accepts('html')) res.render('error/404')
  else if (req.accepts('json')) res.end({error: 'Not found'})
  else res.type('txt').end('Not found')
})
