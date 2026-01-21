const { contextBridge, ipcRenderer } = require('electron');

// Exponer la API de Electron al frontend de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder')
});

console.log('✅ Preload script cargado - electronAPI disponible');