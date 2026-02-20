const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('editorAPI', {
    onInit: (callback) => {
        ipcRenderer.on('editor-init', (event, data) => callback(data));
    },
    sendResult: (value) => {
        ipcRenderer.send('native-textarea-result', value);
    },
    sendCancel: () => {
        ipcRenderer.send('native-textarea-cancel');
    }
});