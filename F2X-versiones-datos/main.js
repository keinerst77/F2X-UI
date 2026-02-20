const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron');
const path = require('path');
const nativeTextarea = require('./native-textarea');

let mainWindow = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            offscreen: false,
            enableRemoteModule: false,
            backgroundThrottling: false
        },
        icon: path.join(__dirname, 'icon.png'),
        transparent: false,
        frame: true
    });

    mainWindow = win;
    win.webContents.setBackgroundThrottling(false);
    win.loadFile(path.join(__dirname, 'src', 'index.html'));

    win.webContents.on('did-finish-load', () => {
        win.webContents.setIgnoreMenuShortcuts(false);
    });

    win.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('open-native-textarea', async (event, options) => {
    const result = await nativeTextarea.open(
        options.title        || 'Descripción Release',
        options.placeholder  || 'Ingrese el contenido aquí...',
        options.defaultValue || '',
        options.fieldLabel   || options.title || '' 
    );
    return result;
});

function createMenu() {
    const menuTemplate = [
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Recargar',
                    accelerator: 'CmdOrCtrl+R',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) focusedWindow.reload();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Salir',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => { app.quit(); }
                }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { label: 'Deshacer', role: 'undo' },
                { label: 'Rehacer', role: 'redo' },
                { type: 'separator' },
                { label: 'Cortar', role: 'cut' },
                { label: 'Copiar', role: 'copy' },
                { label: 'Pegar', role: 'paste' },
                { label: 'Seleccionar todo', role: 'selectAll' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                {
                    label: 'Pantalla completa',
                    accelerator: 'F11',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                    }
                },
                { type: 'separator' },
                {
                    label: 'Acercar',
                    accelerator: 'CmdOrCtrl+=',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) {
                            const wc = focusedWindow.webContents;
                            const current = wc.getZoomFactor();
                            wc.setZoomFactor(Math.min(current + 0.1, 3.0));
                        }
                    }
                },
                {
                    label: 'Alejar',
                    accelerator: 'CmdOrCtrl+-',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) {
                            const wc = focusedWindow.webContents;
                            const current = wc.getZoomFactor();
                            wc.setZoomFactor(Math.max(current - 0.1, 0.3));
                        }
                    }
                },
                {
                    label: 'Restablecer zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) focusedWindow.webContents.setZoomFactor(1.0);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Herramientas de Desarrollador',
                    accelerator: 'F12',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) focusedWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { label: 'Minimizar', role: 'minimize' },
                { label: 'Cerrar', role: 'close' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Acerca de F2X',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Acerca de',
                            message: 'F2X - Versión de Datos',
                            detail: 'Versión: 1.2.0\nDesarrollado por: Flytech Simplexity\n© 2026 Todos los derechos reservados',
                            buttons: ['Aceptar']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Selecciona una carpeta'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const fullPath   = result.filePaths[0];
        const folderName = path.basename(fullPath);
        return { success: true, fullPath, folderName };
    }
    return { success: false };
});

app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-frame-rate-limit');

app.whenReady().then(() => {
    createMenu();
    createWindow();

    // Atajos globales de zoom
    globalShortcut.register('CommandOrControl+Plus', () => {
        if (mainWindow) {
            const current = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.min(current + 0.1, 3.0));
        }
    });

    globalShortcut.register('CommandOrControl+numadd', () => {
        if (mainWindow) {
            const current = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.min(current + 0.1, 3.0));
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});