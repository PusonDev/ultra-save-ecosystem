const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  fetchInfo: (url) => ipcRenderer.invoke('python:fetch_info', url),
  downloadVideo: (options) => ipcRenderer.send('python:download', options),
  onDownloadProgress: (callback) => ipcRenderer.on('python:download_progress', callback),
  onDownloadError: (callback) => ipcRenderer.on('python:download_error', callback),
  onDownloadComplete: (callback) => ipcRenderer.on('python:download_complete', callback),
  openItem: (path) => ipcRenderer.send('shell:open_item', path),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('python:download_progress');
    ipcRenderer.removeAllListeners('python:download_error');
    ipcRenderer.removeAllListeners('python:download_complete');
  }
});
