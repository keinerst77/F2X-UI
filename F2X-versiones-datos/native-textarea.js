const { BrowserWindow, ipcMain } = require('electron');

class NativeTextarea {
    constructor() {
        this.textareaWindow = null;
        this.resolvePromise = null;
        this._resultHandler = null;
        this._cancelHandler = null;
    }

    /**
     * Abre una ventana modal nativa con un textarea
     * @param {string} title - Título de la ventana
     * @param {string} placeholder - Placeholder del textarea
     * @param {string} defaultValue - Valor por defecto
     * @returns {Promise<string>} - Texto ingresado por el usuario
     */
    open(title = 'Motivo del Cambio', placeholder = '', defaultValue = '') {
        return new Promise((resolve) => {
            // Si ya hay una ventana abierta, cerrarla primero
            if (this.textareaWindow) {
                this.close();
            }

            this.resolvePromise = resolve;

            this.textareaWindow = new BrowserWindow({
                width: 600,
                height: 400,
                modal: true,
                resizable: false,
                frame: true,
                backgroundColor: '#FFFFFF',
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                },
                title: title
            });

            // Deshabilitar menú
            this.textareaWindow.setMenu(null);

            // HTML nativo del textarea
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #F5F7FA;
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .header {
            background: #383838;
            color: white;
            padding: 15px 20px;
            border-radius: 8px 8px 0 0;
            margin-bottom: 15px;
        }
        
        .header h2 {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }
        
        .container {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            border-radius: 0 0 8px 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        textarea {
            flex: 1;
            width: 100%;
            padding: 15px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            border: 2px solid #E0E0E0;
            border-radius: 8px;
            resize: none;
            outline: none;
            transition: border-color 0.3s;
            line-height: 1.6;
        }
        
        textarea:focus {
            border-color: #BED62F;
            box-shadow: 0 0 0 3px rgba(190, 214, 47, 0.1);
        }
        
        .char-counter {
            text-align: right;
            margin-top: 10px;
            font-size: 12px;
            color: #666;
            font-family: 'Courier New', monospace;
        }
        
        .char-counter.warning {
            color: #E65100;
            font-weight: bold;
        }
        
        .buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            justify-content: flex-end;
        }
        
        button {
            padding: 10px 24px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .btn-save {
            background: linear-gradient(135deg, #BED62F, #AEC828);
            color: #333;
        }
        
        .btn-save:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(190, 214, 47, 0.3);
        }
        
        .btn-cancel {
            background: #E0E0E0;
            color: #666;
        }
        
        .btn-cancel:hover {
            background: #BDBDBD;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>📝 ${title}</h2>
    </div>
    
    <div class="container">
        <textarea 
            id="nativeTextarea" 
            placeholder="${placeholder}"
            maxlength="500"
            autofocus>${defaultValue}</textarea>
        
        <div class="char-counter" id="charCounter">0/500</div>
        
        <div class="buttons">
            <button class="btn-cancel" onclick="cancelInput()">Cancelar</button>
            <button class="btn-save" onclick="saveInput()">Guardar</button>
        </div>
    </div>
    
    <script>
        const { ipcRenderer } = require('electron');
        const textarea = document.getElementById('nativeTextarea');
        const charCounter = document.getElementById('charCounter');
        
        // Actualizar contador de caracteres
        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            charCounter.textContent = length + '/500';
            
            if (length > 450) {
                charCounter.classList.add('warning');
            } else {
                charCounter.classList.remove('warning');
            }
        });
        
        // Forzar foco inmediato
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }, 0);
        
        // Actualizar contador inicial
        charCounter.textContent = textarea.value.length + '/500';
        
        // Guardar con Enter + Ctrl
        textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                saveInput();
            }
            
            if (e.key === 'Escape') {
                cancelInput();
            }
        });
        
        function saveInput() {
            const value = textarea.value.trim();
            ipcRenderer.send('native-textarea-result', value);
        }
        
        function cancelInput() {
            ipcRenderer.send('native-textarea-cancel');
        }
    </script>
</body>
</html>
            `;

            this.textareaWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

            // Guardar referencia a los handlers para poder removerlos manualmente
            // y usar arrow functions para preservar el contexto `this`
            this._resultHandler = (event, value) => {
                this._cleanup();
                if (this.resolvePromise) {
                    const resolveFn = this.resolvePromise;
                    this.resolvePromise = null;
                    resolveFn(value);
                }
                this._closeWindow();
            };

            this._cancelHandler = () => {
                this._cleanup();
                if (this.resolvePromise) {
                    const resolveFn = this.resolvePromise;
                    this.resolvePromise = null;
                    resolveFn(null);
                }
                this._closeWindow();
            };

            ipcMain.once('native-textarea-result', this._resultHandler);
            ipcMain.once('native-textarea-cancel', this._cancelHandler);

            //  El evento 'closed' solo resuelve si aún no se resolvió
            // (cuando el usuario cierra la ventana con la X)
            this.textareaWindow.on('closed', () => {
                this._cleanup();
                if (this.resolvePromise) {
                    const resolveFn = this.resolvePromise;
                    this.resolvePromise = null;
                    resolveFn(null);
                }
                this.textareaWindow = null;
            });
        });
    }

    // Limpia los listeners de IPC para evitar acumulación y conflictos
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
        if (this.textareaWindow) {
            const win = this.textareaWindow;
            this.textareaWindow = null;
            win.close();
        }
    }

    close() {
        this._cleanup();
        this._closeWindow();
        this.resolvePromise = null;
    }
}

module.exports = new NativeTextarea();