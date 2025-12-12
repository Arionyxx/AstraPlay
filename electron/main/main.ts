import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { DatabaseManager } from '../database/schema';
import { ProviderManager } from '../providers/provider-manager';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

async function createWindow(): Promise<void> {
  await session.defaultSession.clearStorageData();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; img-src 'self' data: https:; media-src 'self' https: blob:;"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https: blob:; connect-src 'self' https:;"
        ]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp(): Promise<void> {
  console.log('[Main] Initializing AstraPlay...');

  DatabaseManager.getInstance();
  console.log('[Main] Database initialized');

  const providerManager = ProviderManager.getInstance();
  await providerManager.initializeAll();
  console.log('[Main] Providers initialized');

  registerIpcHandlers();
  console.log('[Main] IPC handlers registered');
}

app.whenReady().then(async () => {
  try {
    await initializeApp();
    await createWindow();

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });
  } catch (error) {
    console.error('[Main] Failed to initialize app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  console.log('[Main] Shutting down...');
  
  const providerManager = ProviderManager.getInstance();
  await providerManager.shutdownAll();
  
  const db = DatabaseManager.getInstance();
  db.close();
  
  console.log('[Main] Cleanup complete');
});

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Main] Unhandled rejection:', error);
});
