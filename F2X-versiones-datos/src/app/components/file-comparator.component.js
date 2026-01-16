angular.module('fileComparatorApp')
    .controller('FileComparatorController', ['$scope', 
        function($scope) {
            
            // Inicialización de variables
            $scope.directory1 = '';
            $scope.directory2 = '';
            $scope.file1Data = null;
            $scope.file2Data = null;
            $scope.file1Count = 0;
            $scope.file2Count = 0;
            $scope.tableData = [];
            $scope.showTable = false;
            $scope.errorMessage = '';
            $scope.successMessage = '';
            $scope.isScanning1 = false;
            $scope.isScanning2 = false;
            $scope.baseDirectory1 = '';
            $scope.baseDirectory2 = '';

            /**
             * Abre el diálogo de selección de carpetas
             */
            $scope.openFolderDialog = function(folderNumber) {
                const folderInput = document.getElementById('folder' + folderNumber);
                folderInput.click();
                
                folderInput.onchange = function(e) {
                    const files = e.target.files;
                    
                    if (files && files.length > 0) {
                        const firstFile = files[0];
                        
                        // Obtener la ruta completa del archivo
                        let fullPath = '';
                        
                        // Intentar obtener la ruta completa (disponible en algunos navegadores)
                        if (firstFile.path) {
                            // Electron o algunos navegadores modernos
                            fullPath = firstFile.path;
                        } else if (firstFile.webkitRelativePath) {
                            // Navegadores que soportan webkitRelativePath
                            fullPath = firstFile.webkitRelativePath;
                        } else {
                            // Fallback: usar solo el nombre
                            fullPath = firstFile.name;
                        }
                        
                        // Extraer el directorio base
                        let baseDirectory = '';
                        let displayPath = '';
                        
                        if (fullPath.includes('/')) {
                            // Si tiene barras, extraer el primer nivel
                            const parts = fullPath.split('/');
                            baseDirectory = parts[0];
                            
                            // Para el display, simular una ruta Windows
                            // Pedir al usuario que especifique la ruta base
                            const userBasePath = prompt(
                                'Por favor ingrese la ruta completa del directorio seleccionado:\n' +
                                'Ejemplo: C:\\Repositories\\' + baseDirectory,
                                'C:\\Repositories\\' + baseDirectory
                            );
                            
                            if (userBasePath) {
                                displayPath = userBasePath;
                                // Normalizar las barras a formato Windows
                                displayPath = displayPath.replace(/\//g, '\\');
                            } else {
                                displayPath = baseDirectory;
                            }
                        } else {
                            baseDirectory = fullPath;
                            displayPath = 'C:\\' + baseDirectory;
                        }
                        
                        if (folderNumber === 1) {
                            $scope.directory1 = displayPath;
                            $scope.baseDirectory1 = displayPath;
                        } else {
                            $scope.directory2 = displayPath;
                            $scope.baseDirectory2 = displayPath;
                        }
                        
                        $scope.$apply();
                        $scope.scanDirectory(folderNumber);
                    }
                };
            };

            /**
             * Escanea el directorio seleccionado buscando archivos .exe
             */
            $scope.scanDirectory = function(folderNumber) {
                const folderInput = document.getElementById('folder' + folderNumber);
                
                if (folderInput.files && folderInput.files.length > 0) {
                    processFiles(folderInput.files, folderNumber);
                } else {
                    $scope.errorMessage = 'Por favor, usa el botón 📁 para seleccionar la carpeta';
                }
            };

            /**
             * Procesa los archivos del directorio seleccionado
             */
            function processFiles(files, folderNumber) {
                if (folderNumber === 1) {
                    $scope.isScanning1 = true;
                } else {
                    $scope.isScanning2 = true;
                }
                
                const exeFiles = [];
                
                // Filtrar solo archivos .exe
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileName = file.name.toLowerCase();
                    
                    if (fileName.endsWith('.exe')) {
                        const relativePath = file.webkitRelativePath || file.name;
                        
                        // Construir ruta completa
                        const baseDir = folderNumber === 1 ? $scope.baseDirectory1 : $scope.baseDirectory2;
                        
                        // Construir la ruta completa en formato Windows
                        let fullPath = '';
                        if (relativePath.includes('/')) {
                            // Remover el primer segmento (nombre de la carpeta raíz) ya que está en baseDir
                            const pathParts = relativePath.split('/');
                            pathParts.shift(); // Remover primer elemento
                            const subPath = pathParts.join('\\');
                            fullPath = baseDir + '\\' + subPath;
                        } else {
                            fullPath = baseDir + '\\' + relativePath;
                        }
                        
                        // Limpiar barras dobles
                        fullPath = fullPath.replace(/\\\\/g, '\\');
                        
                        exeFiles.push({
                            name: file.name,
                            relativePath: relativePath,
                            fullPath: fullPath,
                            size: formatFileSize(file.size),
                            sizeBytes: file.size,
                            lastModified: new Date(file.lastModified).toLocaleString('es-ES'),
                            lastModifiedDate: new Date(file.lastModified).toLocaleDateString('es-ES'),
                            version: extractVersion(file)
                        });
                    }
                }
                
                // Ordenar por nombre
                exeFiles.sort((a, b) => a.name.localeCompare(b.name));
                
                if (folderNumber === 1) {
                    $scope.file1Data = exeFiles;
                    $scope.file1Count = exeFiles.length;
                    $scope.isScanning1 = false;
                    $scope.successMessage = `Directorio 1: ${exeFiles.length} archivo(s) encontrado(s)`;
                } else {
                    $scope.file2Data = exeFiles;
                    $scope.file2Count = exeFiles.length;
                    $scope.isScanning2 = false;
                    $scope.successMessage = `Directorio 2: ${exeFiles.length} archivo(s) encontrado(s)`;
                }
                
                $scope.errorMessage = '';
                $scope.$apply();
                
                setTimeout(() => {
                    $scope.successMessage = '';
                    $scope.$apply();
                }, 3000);
            }

            /**
             * Extrae la versión del archivo (simulada con fecha)
             */
            function extractVersion(file) {
                // Intenta extraer versión del nombre del archivo
                const versionMatch = file.name.match(/\d+\.\d+(\.\d+)?(\.\d+)?/);
                
                if (versionMatch) {
                    return versionMatch[0];
                }
                
                // Si no hay versión en el nombre, usa la fecha
                return new Date(file.lastModified).toLocaleDateString('es-ES');
            }

            /**
             * Formatea el tamaño del archivo
             */
            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            }

            /**
             * Genera la tabla comparativa con información detallada
             */
            $scope.generateTable = function() {
                if (!$scope.file1Data || !$scope.file2Data) {
                    $scope.errorMessage = 'Por favor, escanea ambos directorios primero';
                    return;
                }

                $scope.tableData = [];
                
                // Crear un mapa de archivos por nombre para mejor comparación
                const file2Map = new Map();
                $scope.file2Data.forEach(file => {
                    file2Map.set(file.name.toLowerCase(), file);
                });
                
                const file1Map = new Map();
                $scope.file1Data.forEach(file => {
                    file1Map.set(file.name.toLowerCase(), file);
                });
                
                // Obtener todos los nombres únicos (normalizado a minúsculas)
                const allFileNames = new Set([
                    ...$scope.file1Data.map(f => f.name.toLowerCase()),
                    ...$scope.file2Data.map(f => f.name.toLowerCase())
                ]);
                
                // Crear filas para cada archivo
                allFileNames.forEach(fileName => {
                    const file1 = file1Map.get(fileName);
                    const file2 = file2Map.get(fileName);
                    
                    const row = {
                        file1: file1 || null,
                        file2: file2 || null,
                        isDifferent: file1 && file2 && (
                            file1.version !== file2.version || 
                            file1.sizeBytes !== file2.sizeBytes
                        ),
                        isMissing: !file1 || !file2
                    };
                    
                    $scope.tableData.push(row);
                });
                
                // Ordenar por nombre
                $scope.tableData.sort((a, b) => {
                    const nameA = (a.file1 ? a.file1.name : a.file2.name).toLowerCase();
                    const nameB = (b.file1 ? b.file1.name : b.file2.name).toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                $scope.showTable = true;
                $scope.errorMessage = '';
                $scope.successMessage = 'Tabla generada exitosamente con ' + $scope.tableData.length + ' archivo(s)';
                
                setTimeout(() => {
                    $scope.successMessage = '';
                    $scope.$apply();
                }, 3000);
            };

            /**
             * Limpia todos los datos
             */
            $scope.reset = function() {
                $scope.directory1 = '';
                $scope.directory2 = '';
                $scope.file1Data = null;
                $scope.file2Data = null;
                $scope.file1Count = 0;
                $scope.file2Count = 0;
                $scope.tableData = [];
                $scope.showTable = false;
                $scope.errorMessage = '';
                $scope.successMessage = '';
                $scope.baseDirectory1 = '';
                $scope.baseDirectory2 = '';
            };
        }
    ]);