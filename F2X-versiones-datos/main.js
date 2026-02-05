const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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
        icon: path.join(__dirname, 'icon.png')
    });

    // Cargar index.html desde src/
    win.loadFile(path.join(__dirname, 'src', 'index.html'));
    
    // Abre el devtools automaticamente
    win.webContents.openDevTools();
}

// ========== MENÚ PERSONALIZADO EN ESPAÑOL ==========
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
                    click: () => {
                        app.quit();
                    }
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
                        if (focusedWindow) {
                            focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Acercar',
                    role: 'zoomIn'
                },
                {
                    label: 'Alejar',
                    role: 'zoomOut'
                },
                {
                    label: 'Restablecer zoom',
                    role: 'resetZoom'
                },
                { type: 'separator' },
                // AGREGAR OPCIÓN PARA DEVTOOLS
                {
                    label: 'Herramientas de Desarrollador',
                    accelerator: 'F12',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) {
                            focusedWindow.webContents.toggleDevTools();
                        }
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

// Manejar selección de carpeta automatico
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

app.whenReady().then(() => {
    createMenu();
    createWindow();
});

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