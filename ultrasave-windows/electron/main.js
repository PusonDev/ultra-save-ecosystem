const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

// For Vite hot module replacement
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: true, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true 
    },
    icon: path.join(__dirname, '../public/icon.ico')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper for exact path to bundled yt-dlp
function getYtdlpPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin/yt-dlp.exe')
    : path.join(__dirname, '../resources/bin/yt-dlp.exe');
}

// IPC Handler: select directory
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

// IPC Handler: fetch info directly from yt-dlp binary (No Python needed!)
ipcMain.handle('python:fetch_info', async (event, url) => {
  return new Promise((resolve, reject) => {
    const ytdlp = getYtdlpPath();
    const args = ['--dump-json', '--no-playlist', url];
    
    console.log(`Executing: ${ytdlp} ${args.join(' ')}`);

    const ytProcess = spawn(ytdlp, args);
    let output = '';
    let errorOutput = '';

    ytProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytProcess.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(`Failed to parse JSON.`);
        }
      } else {
        reject(`Process failed with code ${code}. Error: ${errorOutput}`);
      }
    });

    ytProcess.on('error', (err) => {
      reject(`Spawn failed: ${err.message}`);
    });
  });
});

// IPC Handler: download directly from yt-dlp binary (No Python needed!)
ipcMain.on('python:download', (event, { url, format, savePath, subtitle }) => {
  const ytdlp = getYtdlpPath();

  const args = [
    '-f', format,
    '--merge-output-format', 'mp4',
    '--concurrent-fragments', '8',
    '--continue', '--newline',
    '-o', path.join(savePath, '%(title)s.%(ext)s'),
    url
  ];

  if (subtitle && subtitle !== 'none') {
    args.push('--write-sub', '--sub-lang', subtitle, '--convert-subs', 'srt');
  }

  const ytProcess = spawn(ytdlp, args);

  ytProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        event.reply('python:download_progress', line.trim());
      }
    });
  });

  ytProcess.stderr.on('data', (data) => {
    event.reply('python:download_error', data.toString());
  });

  ytProcess.on('close', (code) => {
    event.reply('python:download_complete', code);
  });
});

ipcMain.on('shell:open_item', (event, fullPath) => {
  shell.showItemInFolder(fullPath);
});
