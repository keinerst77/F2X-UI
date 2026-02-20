const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class NativeTextarea {
    constructor() {
        this.textareaWindow = null;
        this.resolvePromise = null;
        this._resultHandler = null;
        this._cancelHandler = null;
    }

    open(title = 'Descripción Release', placeholder = '', defaultValue = '', fieldLabel = '') {
        return new Promise((resolve) => {
            if (this.textareaWindow && !this.textareaWindow.isDestroyed()) {
                this.close();
            }

            this.resolvePromise = resolve;

            ipcMain.removeAllListeners('native-textarea-result');
            ipcMain.removeAllListeners('native-textarea-cancel');

            this._resultHandler = (event, value) => {
                const fn = this.resolvePromise;
                this.resolvePromise = null;
                this._cleanup();
                this._closeWindow();
                if (fn) fn(typeof value === 'string' ? value : '');
            };

            this._cancelHandler = () => {
                const fn = this.resolvePromise;
                this.resolvePromise = null;
                this._cleanup();
                this._closeWindow();
                if (fn) fn(null);
            };

            ipcMain.on('native-textarea-result', this._resultHandler);
            ipcMain.on('native-textarea-cancel',  this._cancelHandler);

            const win = new BrowserWindow({
                width:     720,
                height:    520,
                minWidth:  580,
                minHeight: 400,
                resizable: true,
                frame:     true,
                backgroundColor: '#EEF2F6',
                webPreferences: {
                    preload:            path.join(__dirname, 'native-textarea-preload.js'),
                    nodeIntegration:    false,
                    contextIsolation:   true,
                    enableRemoteModule: false
                },
                title: fieldLabel || title
            });

            this.textareaWindow = win;
            win.setMenu(null);

            const initData = {
                title,
                placeholder: placeholder || 'Ingrese el contenido aquí...',
                defaultValue: defaultValue || '',
                fieldLabel:   fieldLabel   || title
            };

            win.loadFile(path.join(__dirname, 'src', 'native-editor.html'));

            win.webContents.once('did-finish-load', () => {
                if (!win.isDestroyed()) {
                    win.webContents.send('editor-init', initData);
                }
            });

            win.on('closed', () => {
                if (this.textareaWindow === win) this.textareaWindow = null;
                this._cleanup();
                if (this.resolvePromise) {
                    const fn = this.resolvePromise;
                    this.resolvePromise = null;
                    fn(null);
                }
            });
        });
    }

    _cleanup() {
        if (this._resultHandler) {
            ipcMain.removeListener('native-textarea-result', this._resultHandler);
            this._resultHandler = null;
        }
        if (this._cancelHandler) {
            ipcMain.removeListener('native-textarea-cancel', this._cancelHandler);
            this._cancelHandler = null;
        }
    }

    _closeWindow() {
        const win = this.textareaWindow;
        if (win && !win.isDestroyed()) {
            this.textareaWindow = null;
            try { win.close(); } catch(e) {}
        }
    }

    close() {
        this._cleanup();
        this._closeWindow();
        this.resolvePromise = null;
    }
}

module.exports = new NativeTextarea();