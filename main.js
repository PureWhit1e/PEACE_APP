const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    transparent: false,
    resizable: true,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    // On Windows: enable custom title bar overlay for close/min/max buttons
    ...(process.platform === 'win32' ? {
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#ffffff80',
        height: 36,
      },
    } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Vite dev server in development, built files in production
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

// ── IPC: Save file (supports html, md, txt) ────────────────────────────────
ipcMain.handle('save-file', async (_event, content, format) => {
  const filterMap = {
    html: { name: 'HTML Files', extensions: ['html'], default: 'peace-writing.html' },
    md:   { name: 'Markdown Files', extensions: ['md'], default: 'peace-writing.md' },
    txt:  { name: 'Text Files', extensions: ['txt'], default: 'peace-writing.txt' },
  };
  const f = filterMap[format] || filterMap.txt;

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save your writing',
    defaultPath: path.join(app.getPath('documents'), f.default),
    filters: [
      { name: f.name, extensions: f.extensions },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePath) return { success: false };

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Close app ──────────────────────────────────────────────────────────
ipcMain.handle('quit-app', () => {
  app.quit();
});

// ── IPC: Pick background image ──────────────────────────────────────────────
ipcMain.handle('pick-image', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose rain background image',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
    ],
    properties: ['openFile'],
  });

  if (canceled || !filePaths.length) return { success: false };

  try {
    const imgPath = filePaths[0];
    const data = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const base64 = `data:${mime};base64,${data.toString('base64')}`;
    return { success: true, dataUrl: base64, filePath: imgPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Pick video file ────────────────────────────────────────────────────
ipcMain.handle('pick-video', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a video',
    filters: [
      { name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov'] },
    ],
    properties: ['openFile'],
  });

  if (canceled || !filePaths.length) return { success: false };

  try {
    const vidPath = filePaths[0];
    const data = fs.readFileSync(vidPath);
    const ext = path.extname(vidPath).slice(1).toLowerCase();
    const mimeMap = { mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime' };
    const mime = mimeMap[ext] || 'video/mp4';
    const base64 = `data:${mime};base64,${data.toString('base64')}`;
    return { success: true, dataUrl: base64, filePath: vidPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Window controls ────────────────────────────────────────────────────
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});
