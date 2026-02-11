const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    
    // Método para abrir textarea nativa
    openNativeTextarea: (options) => ipcRenderer.invoke('open-native-textarea', options)
});

console.log('✅ Preload script cargado - electronAPI disponible');