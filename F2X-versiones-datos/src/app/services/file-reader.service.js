angular.module('fileComparatorApp')
    .service('FileReaderService', [function() {
        
        /**
         * Lee el contenido de un archivo y lo procesa
         * @param {File} file - Archivo a leer
         * @param {Function} successCallback - Callback en caso de éxito
         * @param {Function} errorCallback - Callback en caso de error
         */
        this.readFile = function(file, successCallback, errorCallback) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    const lines = content.split('\n')
                        .map(line => line.trim())
                        .filter(line => line !== '');
                    
                    successCallback(lines);
                } catch (error) {
                    errorCallback('Error al procesar el archivo: ' + error.message);
                }
            };
            
            reader.onerror = function() {
                errorCallback('Error al leer el archivo');
            };
            
            reader.readAsText(file);
        };

        /**
         * Valida el tipo de archivo
         * @param {File} file - Archivo a validar
         * @param {Array} allowedTypes - Tipos permitidos
         * @returns {boolean}
         */
        this.validateFileType = function(file, allowedTypes) {
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            return allowedTypes.includes(fileExtension);
        };
    }]);