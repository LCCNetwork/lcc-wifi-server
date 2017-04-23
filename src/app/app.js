'use strict'

const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')
const cheerio = require('cheerio')
const _eval = require('eval')
const firebaseAdmin = require('firebase-admin')
const exec = require('child_process').exec
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

setInterval(checkUsage, 30000)

function checkUsage () {
  reloadUsage()

  for (let user in users) {
    user = users[user]

    if (getDataUsage(user.uid) >= user.dataCap) {
      for (let ip in user.ips) {
        ip = user.ips[ip]

        exec('iptables -t nat -D PREROUTING -s ' + ip + ' -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53', (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`)
            return
          }

          console.log('deauth ' + ip)
          console.log(`stdout: ${stdout}`)
          console.log(`stderr: ${stderr}`)
        })
      }
    }
  }
}

function reloadUsage () {
  return Promise((resolve, reject) => {
    exec('wrtbwmon update ~/usage.db', (error, stdout, stderr) => {
      if (error) {
        reject(error)
      }
      console.log(`stdout: ${stdout}`)
      console.log(`stderr: ${stderr}`)

      exec('wrtbwmon publish ~/usage.db ~/lcc-wifi-server-master/out.html', (error, stdout, stderr) => {
        if (error) {
          reject(error)
        }

        console.log(`stdout: ${stdout}`)
        console.log(`stderr: ${stderr}`)
        resolve()
      })
    })
  })
}

function getDataUsage (uid) {
  return new Promise((resolve, reject) => {
    reloadUsage().then(() => {
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
          if (device[2] in user.ips) dataSum += device[5]
        }

        resolve(dataSum)
      })
    }).catch((err) => {
      reject(err)
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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  if (req.method === 'OPTIONS') { res.sendStatus(200) }
  else { next() }
})

app.post('/auth', (req, res) => {
  console.log(req.body.token)

  firebaseAdmin.auth().verifyIdToken(req.body.token).then((decodedToken) => {
    console.log(decodedToken)
    const uid = decodedToken.uid

    firebaseAdmin.auth().getUser(uid).then((userRecord) => {
      const email = userRecord.email
      const ip = req.ip.split(':').reverse()[0]

      if (authUsers[email]) {
        if (!users[uid]) users[uid] = new User(email, uid, authUsers[email], [ip])
        else if (!(req.ip in users[uid].ips)) users[uid].ips[users[uid].ips.length] = ip

        if (getDataUsage(uid) > users[uid].dataCap) {
          res.json({
            auth: false
          })
          return
        }

        exec('iptables -t nat -I PREROUTING -s ' + ip + ' -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53', (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`)
            return
          }

          console.log('auth ' + ip)
          console.log(`stdout: ${stdout}`)
          console.log(`stderr: ${stderr}`)

          res.json({
            auth: true
          })
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
    console.log(used)

    res.json({
      used: used,
      total: users[req.params.uid].dataCap
    })
  }).catch((err) => {
    console.log(err)
  })
})

app.use((req, res) => {
  console.info('[404] ' + req.method + req.path)
  res.status(404)

  if (req.accepts('html')) res.render('error/404')
  else if (req.accepts('json')) res.end({error: 'Not found'})
  else res.type('txt').end('Not found')
})
