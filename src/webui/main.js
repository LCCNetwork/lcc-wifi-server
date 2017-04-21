const {app, BrowserWindow} = require('electron')
const electronGoogleOauth = require('electron-google-oauth')
const authConfig = require('../oauth2-config')
const path = require('path')

global.state = {user: undefined, usage: undefined}

app.on('ready', () => {
  let win = new BrowserWindow({
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    title: 'LCC WiFi',
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 800,
    resizable: true
  })

  win.loadURL(`file://${__dirname}/index.html`)
})

app.on('window-all-closed', () => {
  app.quit()
})

exports.openOauth = () => {
  const browserWindowParams = {
    'use-content-size': true,
    center: true,
    resizable: false,
    'always-on-top': true,
    'standard-window': true,
    'auto-hide-menu-bar': true,
    'node-integration': false
  }
  const googleOauth = electronGoogleOauth(browserWindowParams)

  return googleOauth.getAccessToken(
    ['profile', 'email'],
    authConfig.client_id,
    authConfig.client_secret
  )
  .catch(() => {})
}
