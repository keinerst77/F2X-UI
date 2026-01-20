const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
    win.webContents.openDevTools(); // Opcional: para debugging
}

// Manejar selección de carpeta
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const fullPath = result.filePaths[0];
        const folderName = path.basename(fullPath);
        
        return {
            success: true,
            fullPath: fullPath,
            folderName: folderName
        };
    }
    
    return { success: false };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});