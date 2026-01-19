angular.module('fileComparatorApp')
    .controller('FileComparatorController', ['$scope', '$http', '$timeout',
        function($scope, $http, $timeout) {
            
            // Inicialización de variables
            $scope.directory1 = 'C:\\';
            $scope.directory2 = 'C:\\';
            $scope.file1Data = null;
            $scope.file2Data = null;
            $scope.file1Count = 0;
            $scope.file2Count = 0;
            $scope.tableData = [];
            $scope.statistics = {
                total: 0,
                versionChanged: 0,
                sizeChanged: 0,
                noChanges: 0
            };
            $scope.showTable = false;
            $scope.errorMessage = '';
            $scope.successMessage = '';
            $scope.isScanning1 = false;
            $scope.isScanning2 = false;

            // URL del backend
            const API_URL = 'https://localhost:7000/api/versionscanner/scan';

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
                        
                        let fullPath = '';
                        if (firstFile.path) {
                            fullPath = firstFile.path;
                        } else if (firstFile.webkitRelativePath) {
                            fullPath = firstFile.webkitRelativePath;
                        } else {
                            fullPath = firstFile.name;
                        }
                        
                        let baseDirectory = '';
                        let displayPath = '';
                        
                        if (fullPath.includes('/')) {
                            const parts = fullPath.split('/');
                            baseDirectory = parts[0];
                            
                            const userBasePath = prompt(
                                'Por favor ingrese la ruta completa del directorio seleccionado:\n' +
                                'Ejemplo: C:\\' + baseDirectory,
                                'C:\\' + baseDirectory
                            );
                            
                            if (userBasePath) {
                                displayPath = userBasePath;
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
                        } else {
                            $scope.directory2 = displayPath;
                        }
                        
                        // Usar $timeout en lugar de $apply
                        $timeout(function() {
                            $scope.scanDirectory(folderNumber);
                        });
                    }
                };
            };

            /**
             * Escanea el directorio usando el backend de C#
             */
            $scope.scanDirectory = function(folderNumber) {
                const directory = (folderNumber === 1) ? $scope.directory1 : $scope.directory2;
                
                if (!directory || directory.trim() === '') {
                    $scope.errorMessage = 'Por favor ingresa una ruta de directorio válida';
                    return;
                }

                // Activar indicador de carga
                if (folderNumber === 1) {
                    $scope.isScanning1 = true;
                } else {
                    $scope.isScanning2 = true;
                }

                $scope.errorMessage = '';
                $scope.successMessage = '';

                // Llamar al backend
                $http.post(API_URL, {
                    directory: directory,
                    includeSubdirectories: true,
                    searchPattern: '*.exe'
                })
                .then(function(response) {
                    console.log('Respuesta del backend:', response.data);
                    
                    if (response.data.success) {
                        const files = response.data.files || [];
                        
                        if (folderNumber === 1) {
                            $scope.file1Data = files;
                            $scope.file1Count = files.length;
                            $scope.isScanning1 = false;
                            $scope.successMessage = `Versión Actual: ${files.length} archivo(s) encontrado(s)`;
                        } else {
                            $scope.file2Data = files;
                            $scope.file2Count = files.length;
                            $scope.isScanning2 = false;
                            $scope.successMessage = `Versión Futura: ${files.length} archivo(s) encontrado(s)`;
                        }

                        // Limpiar mensaje después de 3 segundos
                        $timeout(function() {
                            $scope.successMessage = '';
                        }, 3000);
                    } else {
                        $scope.errorMessage = response.data.error || 'Error al escanear el directorio';
                        if (folderNumber === 1) {
                            $scope.isScanning1 = false;
                        } else {
                            $scope.isScanning2 = false;
                        }
                    }
                })
                .catch(function(error) {
                    console.error('Error al llamar al backend:', error);
                    
                    let errorMsg = 'Error al conectar con el backend. ';
                    
                    if (error.status === -1) {
                        errorMsg += 'Verifica que el backend esté ejecutándose en https://localhost:7000';
                    } else if (error.status === 404) {
                        errorMsg += 'Endpoint no encontrado. Verifica la URL del API.';
                    } else if (error.data && error.data.error) {
                        errorMsg += error.data.error;
                    } else {
                        errorMsg += error.statusText || 'Error desconocido';
                    }
                    
                    $scope.errorMessage = errorMsg;
                    
                    if (folderNumber === 1) {
                        $scope.isScanning1 = false;
                    } else {
                        $scope.isScanning2 = false;
                    }
                });
            };

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
             * Genera la tabla comparativa - SOLO ARCHIVOS COINCIDENTES
             */
            $scope.generateTable = function() {
                if (!$scope.file1Data || !$scope.file2Data) {
                    $scope.errorMessage = 'Por favor, escanea ambos directorios primero';
                    return;
                }

                $scope.tableData = [];
                $scope.statistics = {
                    total: 0,
                    versionChanged: 0,
                    sizeChanged: 0,
                    noChanges: 0
                };
                
                // Crear mapa de archivos de la versión futura
                const file2Map = new Map();
                $scope.file2Data.forEach(file => {
                    file2Map.set(file.nameNormalized, file);
                });
                
                // Comparar solo archivos que existen en ambas versiones
                $scope.file1Data.forEach(fileActual => {
                    const fileFuturo = file2Map.get(fileActual.nameNormalized);
                    
                    // SOLO agregar si existe en ambas versiones
                    if (fileFuturo) {
                        const versionChanged = fileActual.version !== fileFuturo.version;
                        const sizeChanged = fileActual.sizeBytes !== fileFuturo.sizeBytes;
                        
                        const row = {
                            name: fileActual.name,
                            versionActual: fileActual.version,
                            pesoActual: fileActual.size,
                            versionFutura: fileFuturo.version,
                            pesoFuturo: fileFuturo.size,
                            ruta: fileActual.fullPath,
                            versionChanged: versionChanged,
                            sizeChanged: sizeChanged
                        };
                        
                        $scope.tableData.push(row);
                        
                        // Actualizar estadísticas
                        $scope.statistics.total++;
                        if (versionChanged) $scope.statistics.versionChanged++;
                        if (sizeChanged) $scope.statistics.sizeChanged++;
                        if (!versionChanged && !sizeChanged) $scope.statistics.noChanges++;
                    }
                });
                
                // Ordenar por nombre
                $scope.tableData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

                if ($scope.tableData.length === 0) {
                    $scope.errorMessage = 'No se encontraron archivos coincidentes entre ambas versiones';
                    $scope.showTable = false;
                    return;
                }

                $scope.showTable = true;
                $scope.errorMessage = '';
                $scope.successMessage = `Comparación generada: ${$scope.tableData.length} archivo(s) coincidente(s)`;
                
                $timeout(function() {
                    $scope.successMessage = '';
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
                $scope.statistics = {
                    total: 0,
                    versionChanged: 0,
                    sizeChanged: 0,
                    noChanges: 0
                };
                $scope.showTable = false;
                $scope.errorMessage = '';
                $scope.successMessage = '';
            };
        }
    ]);