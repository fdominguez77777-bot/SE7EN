const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('se7enDesktop', {
  isDesktop: true,
  notify(title, body, route) {
    ipcRenderer.send('se7en:notify', { title, body, route })
  },
})
