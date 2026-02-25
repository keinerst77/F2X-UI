const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class NativeTextarea {
    constructor() {
        this.win        = null;
        this.resolve    = null;
        this._onResult  = null;
        this._onCancel  = null;
    }

    open(title = 'Editor', placeholder = '', defaultValue = '', fieldLabel = '') {
        return new Promise((res) => {

            // Limpiar listeners anteriores antes de crear los nuevos
            this._cleanup();

            // Destruir ventana anterior si quedó abierta
            if (this.win && !this.win.isDestroyed()) {
                this.win.destroy();
                this.win = null;
            }

            this.resolve = res;

            this._onResult = (event, value) => {
                this._finish(typeof value === 'string' ? value : '');
            };
            this._onCancel = () => {
                this._finish(null);
            };

            ipcMain.on('native-textarea-result', this._onResult);
            ipcMain.on('native-textarea-cancel',  this._onCancel);

            const win = new BrowserWindow({
                width: 720, height: 520,
                minWidth: 580, minHeight: 400,
                resizable: true,
                frame: true,
                backgroundColor: '#EEF2F6',
                webPreferences: {
                    preload:          path.join(__dirname, 'native-textarea-preload.js'),
                    nodeIntegration:  false,
                    contextIsolation: true,
                },
                title: fieldLabel || title
            });

            this.win = win;
            win.setMenu(null);

            const safeDefault = (typeof defaultValue === 'string')
                ? defaultValue
                : String(defaultValue || '');

            const initData = {
                title,
                placeholder:  placeholder || 'Ingrese el contenido aqui...',
                defaultValue: safeDefault,
                fieldLabel:   fieldLabel || title
            };

            win.loadFile(path.join(__dirname, 'src', 'native-editor.html'));

            win.webContents.once('did-finish-load', () => {
                if (!win.isDestroyed()) win.webContents.send('editor-init', initData);
            });

            // Cerrar con X = cancelar
            win.on('closed', () => {
                this.win = null;
                if (this.resolve) this._finish(null);
            });
        });
    }

    _finish(value) {
        const fn = this.resolve;
        this.resolve = null;
        this._cleanup();
        if (this.win && !this.win.isDestroyed()) {
            const w = this.win;
            this.win = null;
            try { w.close(); } catch(e) {}
        }
        if (fn) fn(value);
    }

    _cleanup() {
        if (this._onResult) {
            ipcMain.removeListener('native-textarea-result', this._onResult);
            this._onResult = null;
        }
        if (this._onCancel) {
            ipcMain.removeListener('native-textarea-cancel', this._onCancel);
            this._onCancel = null;
        }
    }
}

module.exports = new NativeTextarea();