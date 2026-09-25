const path = require('node:path')
const fs = require('node:fs')
const { app, BrowserWindow, Notification, ipcMain, shell, Menu } = require('electron')

const APP_URL = (process.env.SE7EN_URL || 'https://seven-pi-nine.vercel.app').replace(/\/$/, '')
const APP_ORIGIN = new URL(APP_URL).origin
const ICON = path.join(__dirname, 'build', 'icon.png')

let mainWindow = null

function boundsFile() {
  return path.join(app.getPath('userData'), 'window.json')
}

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(boundsFile(), 'utf8'))
  } catch {
    return { width: 1440, height: 900 }
  }
}

function saveBounds(win) {
  try {
    const state = { ...win.getNormalBounds(), maximized: win.isMaximized() }
    fs.writeFileSync(boundsFile(), JSON.stringify(state))
  } catch {
    // Window state is a convenience; ignore write failures.
  }
}

function showWindow() {
  if (!mainWindow) {
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function createWindow() {
  const saved = loadBounds()
  mainWindow = new BrowserWindow({
    x: saved.x,
    y: saved.y,
    width: saved.width || 1440,
    height: saved.height || 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'SE7EN',
    icon: ICON,
    backgroundColor: '#0c0d10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (saved.maximized) {
    mainWindow.maximize()
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', () => saveBounds(mainWindow))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  void mainWindow.loadURL(APP_URL)
}

ipcMain.on('se7en:notify', (_event, payload) => {
  if (!Notification.isSupported() || !payload || typeof payload.title !== 'string') {
    return
  }
  const notice = new Notification({
    title: payload.title.slice(0, 120),
    body: typeof payload.body === 'string' ? payload.body.slice(0, 240) : '',
    icon: ICON,
  })
  notice.on('click', () => {
    showWindow()
    const route = typeof payload.route === 'string' && payload.route.startsWith('/') ? payload.route : null
    if (route && mainWindow) {
      void mainWindow.loadURL(`${APP_URL}${route}`)
    }
  })
  notice.show()
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(() => {
    app.setAppUserModelId('com.se7en.platform')
    Menu.setApplicationMenu(null)
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
