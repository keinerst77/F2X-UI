angular.module('fileComparatorApp')
.service('FileReaderService', function() {
    
    /**
     * Lee el contenido de un archivo de texto
     * @param {File} file - Archivo a leer
     * @returns {Promise<string>} - Contenido del archivo
     */
    this.readAsText = function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            
            reader.onerror = function(e) {
                reject(new Error('Error al leer el archivo'));
            };
            
            reader.readAsText(file);
        });
    };
    
    /**
     * Parsea un archivo CSV y retorna un array de objetos
     * @param {string} csvContent - Contenido del CSV
     * @returns {Array} - Array de objetos parseados
     */
    this.parseCSV = function(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            
            data.push(obj);
        }
        
        return data;
    };
    
    /**
     * Valida que un archivo tenga la extensión correcta
     * @param {File} file - Archivo a validar
     * @param {Array<string>} validExtensions - Extensiones válidas
     * @returns {boolean}
     */
    this.validateFileExtension = function(file, validExtensions) {
        const fileName = file.name.toLowerCase();
        return validExtensions.some(ext => fileName.endsWith(ext.toLowerCase()));
    };
});