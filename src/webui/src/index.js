const $ = require('jquery')
const fb = require('firebase')
const fetch = require('node-fetch')
const remote = require('electron').remote
const remoteMain = require('electron').remote.require('./main')
const gAuthProvider = new fb.auth.GoogleAuthProvider()
const imagesLoaded = require('imagesloaded')
const ProgressBar = require('progressbar.js')

let remoteState = remote.getGlobal('state')
let filename = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1)

const fbConfig = {
  apiKey: require('../apikey').apikey,
  authDomain: 'lcc-wifi.firebaseapp.com',
  databaseURL: 'https://lcc-wifi.firebaseio.com',
  projectId: 'lcc-wifi',
  storageBucket: 'lcc-wifi.appspot.com',
  messagingSenderId: '1038104580431'
}

fb.initializeApp(fbConfig)

function timeout (time) {
  return new Promise((resolve, reject) => {
    setTimeout(reject, time, 'request timed out')
  })
}

function signOut () {
  fb.auth().signOut()
  console.log('User successfully signed out')
  remote.getCurrentWindow().loadURL(`file://${__dirname}/index.html`)
}

function loadData (user) {
  user.getToken(true).then((token) => {
    console.log(token)
    Promise.race([timeout(1000),
      fetch(`http://localhost:8080/auth`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token
          })
        }
      )
    ]).then((res) => res.json()).then((resJson) => {
      if (!resJson.auth) { return remote.dialog.showErrorBox('Usage Error', 'You are not authorized to use our WiFi service. If you believe that this may be a mistake, please contact an admin.') }

      fetch(`http://localhost:8080/user/${user.uid}`, {method: 'GET', headers: { 'Accept': 'application/json' }})
      .then(res => res.json()).then(resJson => {
        remoteState.usage = resJson
        remoteState.user = user
        remote.getCurrentWindow().loadURL(`file://${__dirname}/app.html`)
      })
    }).catch((err) => {
      fb.auth().signOut()
      remoteState.user = undefined

      console.log(err)
      console.error('Connection to local LCC WiFi server timed out')
      remote.dialog.showErrorBox('Authentication Error', 'Please make sure that you are connected to the LCC WiFi network.')
    })
  }).catch((err) => {
    fb.auth().signOut()
    remoteState.user = undefined

    console.log(err)
    remote.dialog.showErrorBox('Authentication Error', err.message)
  })
}

function openOauthWin () {
  remoteMain.openOauth().then(userData => {
    const credential = gAuthProvider.credential(userData.id_token)

    fb.auth().signInWithCredential(credential).then((user) => {
      loadData(user)
    }).catch((err) => {
      fb.auth().signOut()
      remoteState.user = undefined

      console.log(err)
      remote.dialog.showErrorBox('Authentication Error', err.message)
    })
  }).catch(() => {})
}

function loadApp () {
  $('.app-signout-button').bind('click', signOut)
  $('.app-refresh-button').bind('click', loadData)
  $('.app-user-name').text(remoteState.user.displayName || remoteState.user.email || 'User')
  $('.app-data-label.top').text(`${remoteState.usage.used / 1000} GB /`)
  $('.app-data-label.bottom').text(`${remoteState.usage.total / 1000} GB`)

  let dataDisplay = new ProgressBar.Circle('.app-data-display', {
    strokeWidth: 8,
    easing: 'easeInOut',
    duration: 1800,
    color: '#72CADA',
    trailColor: '#FFF',
    trailWidth: 8
  })

  dataDisplay.animate(remoteState.usage.used / remoteState.usage.total)
}

function loadIndex () {
  $('.main-signin-button').bind('click', openOauthWin)

  let loader = $('.wrapper-loader')
  loader.fadeOut({duration: 500})
}

window.onload = () => {
  if (filename === 'index.html') {
    setTimeout(() => {
      imagesLoaded('body', loadIndex())
    }, 1200)
  } else if (filename === 'app.html') {
    loadApp()
  }
}
