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
        },
        icon: path.join(__dirname, 'icon.png') // Opcional
    });

    // Cargar index.html desde src/
    win.loadFile(path.join(__dirname, 'src', 'index.html'));
    
    // Abrir DevTools automáticamente (para debugging)
    win.webContents.openDevTools();
}

//  Manejar selección de carpeta automatico
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Selecciona una carpeta'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const fullPath = result.filePaths[0];
        const folderName = path.basename(fullPath);
        
        console.log('📁 Carpeta seleccionada:');
        console.log('   Nombre:', folderName);
        console.log('   Ruta completa:', fullPath);
        
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

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});