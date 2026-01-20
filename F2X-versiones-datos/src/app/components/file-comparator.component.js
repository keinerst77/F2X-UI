angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout',
function($scope, $http, $timeout) {
    
    // ===== VARIABLES =====
    $scope.directory1 = '';
    $scope.directory2 = '';
    $scope.directory1Name = '';
    $scope.directory2Name = '';
    
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

    const API_URL = 'https://localhost:7000/api/versionscanner/scan';

    // ===== DETECTAR SI EL NAVEGADOR SOPORTA FILE SYSTEM ACCESS API =====
    const supportsFileSystemAccess = 'showDirectoryPicker' in window;
    
    console.log('🌐 Navegador:', navigator.userAgent);
    console.log('✅ Soporta File System Access API:', supportsFileSystemAccess);


    // ===== LIMPIAR =====
    $scope.clearDirectory = function(folderNumber) {
        if (folderNumber === 1) {
            $scope.directory1 = '';
            $scope.directory1Name = '';
            $scope.file1Data = null;
            $scope.file1Count = 0;
        } else {
            $scope.directory2 = '';
            $scope.directory2Name = '';
            $scope.file2Data = null;
            $scope.file2Count = 0;
        }
        
        if (!$scope.file1Data && !$scope.file2Data) {
            $scope.showTable = false;
            $scope.tableData = [];
        }
        
        $scope.errorMessage = '';
        $scope.successMessage = '';
    };


    // ===== SELECTOR DE CARPETAS CON FILE SYSTEM ACCESS API =====
    $scope.openFolderDialog = async function(folderNumber) {
        
        // MÉTODO 1: File System Access API (NAVEGADORES MODERNOS - EDGE, CHROME)
        if (supportsFileSystemAccess) {
            try {
                console.log('📁 Usando File System Access API (método moderno)...');
                
                // Abrir el selector de carpetas nativo de Windows
                const directoryHandle = await window.showDirectoryPicker({
                    mode: 'read',
                    startIn: 'desktop'
                });
                
                console.log('✅ Carpeta seleccionada:', directoryHandle.name);
                
                // INTENTAR obtener la ruta completa
                let fullPath = '';
                let folderName = directoryHandle.name;
                
                // TRUCO: Obtener la ruta usando getFile() en un archivo interno
                try {
                    // Buscar el primer archivo para obtener su path
                    for await (const entry of directoryHandle.values()) {
                        if (entry.kind === 'file') {
                            const file = await entry.getFile();
                            
                            // En Edge/Chrome, file.path NO está disponible por seguridad
                            // Pero podemos usar File System Access API para construir la ruta
                            
                            // ALTERNATIVA: Usar resolve() para obtener la ruta relativa
                            // (esto tampoco da ruta absoluta en navegadores web)
                            
                            console.log('📄 Archivo encontrado:', entry.name);
                            console.log('📄 File object:', file);
                            
                            // Intentar diferentes métodos para obtener la ruta
                            if (file.path) {
                                fullPath = file.path.replace(/\\/g, '/').split('/').slice(0, -1).join('\\');
                                console.log('✅ Ruta obtenida desde file.path:', fullPath);
                            } else if (file.webkitRelativePath) {
                                console.log('⚠️ Solo webkitRelativePath disponible:', file.webkitRelativePath);
                            }
                            
                            break; // Solo necesitamos un archivo
                        }
                    }
                } catch (err) {
                    console.log('⚠️ No se pudo obtener ruta desde archivos:', err);
                }
                
                // Si NO logramos obtener la ruta completa automáticamente
                if (!fullPath || !fullPath.includes(':')) {
                    console.log('⚠️ Ruta automática no disponible. Pidiendo al usuario...');
                    
                    $scope.$apply(function() {
                        $scope.errorMessage = '';
                    });
                    
                    // PEDIR AL USUARIO que pegue la ruta manualmente
                    const userPath = prompt(
                        '📁 CARPETA SELECCIONADA: "' + folderName + '"\n\n' +
                        '🔹 CÓMO OBTENER LA RUTA COMPLETA:\n\n' +
                        '1️⃣ Abre esta carpeta en el Explorador de Windows\n' +
                        '2️⃣ Haz clic en la BARRA DE DIRECCIONES (arriba)\n' +
                        '3️⃣ La ruta se seleccionará automáticamente\n' +
                        '4️⃣ Copia (Ctrl+C) y pega aquí (Ctrl+V)\n\n' +
                        '💡 Ejemplo: C:\\Users\\TuUsuario\\Desktop\\' + folderName + '\n\n' +
                        '✏️ Pega la ruta completa:',
                        ''
                    );
                    
                    if (userPath && userPath.trim() !== '') {
                        fullPath = userPath.trim().replace(/^["']|["']$/g, '').replace(/\//g, '\\');
                        
                        // Validar formato
                        if (!fullPath.includes(':') && !fullPath.startsWith('\\\\')) {
                            alert('❌ RUTA INVÁLIDA\n\nLa ruta debe incluir la letra de unidad.\n\n' +
                                  '✅ Correcto: C:\\Users\\...\n' +
                                  '❌ Incorrecto: ' + fullPath);
                            return;
                        }
                    } else {
                        alert('❌ Operación cancelada');
                        return;
                    }
                }
                
                // Asignar valores
                if (folderNumber === 1) {
                    $scope.directory1 = fullPath;
                    $scope.directory1Name = folderName;
                } else {
                    $scope.directory2 = fullPath;
                    $scope.directory2Name = folderName;
                }
                
                console.log('📁 Carpeta:', folderName);
                console.log('📍 Ruta completa:', fullPath);
                
                // Aplicar cambios en Angular
                $scope.$apply();
                
                // Escanear automáticamente
                $timeout(function() {
                    $scope.scanDirectory(folderNumber);
                }, 100);
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('ℹ️ Usuario canceló la selección');
                    return;
                }
                
                console.error('❌ Error al seleccionar carpeta:', error);
                $scope.$apply(function() {
                    $scope.errorMessage = '❌ Error al seleccionar carpeta: ' + error.message;
                });
            }
        } 
        // MÉTODO 2: FALLBACK - webkitdirectory (MÉTODO ANTIGUO)
        else {
            console.log('⚠️ File System Access API no disponible, usando webkitdirectory...');
            
            const folderInput = document.getElementById('folder' + folderNumber);
            folderInput.value = '';
            folderInput.click();
            
            folderInput.onchange = function(e) {
                const files = e.target.files;
                
                if (files && files.length > 0) {
                    const firstFile = files[0];
                    let folderName = '';
                    
                    if (firstFile.webkitRelativePath) {
                        const parts = firstFile.webkitRelativePath.split('/');
                        folderName = parts[0];
                    } else {
                        folderName = 'carpeta seleccionada';
                    }
                    
                    // Pedir ruta manual ya que no hay acceso automático
                    $timeout(function() {
                        const userPath = prompt(
                            '📁 CARPETA SELECCIONADA: "' + folderName + '"\n\n' +
                            'Pega la ruta completa de esta carpeta:\n' +
                            '(Abre la carpeta en Windows Explorer y copia la ruta de la barra de direcciones)',
                            ''
                        );
                        
                        if (userPath && userPath.trim() !== '') {
                            const fullPath = userPath.trim().replace(/^["']|["']$/g, '').replace(/\//g, '\\');
                            
                            if (folderNumber === 1) {
                                $scope.directory1 = fullPath;
                                $scope.directory1Name = folderName;
                            } else {
                                $scope.directory2 = fullPath;
                                $scope.directory2Name = folderName;
                            }
                            
                            $scope.scanDirectory(folderNumber);
                        }
                    }, 100);
                }
            };
        }
    };


    // ===== ESCANEAR DIRECTORIO =====
    $scope.scanDirectory = function(folderNumber) {
        const directory = (folderNumber === 1) ? $scope.directory1 : $scope.directory2;
        const folderName = (folderNumber === 1) ? $scope.directory1Name : $scope.directory2Name;
        
        if (!directory || directory.trim() === '') {
            $scope.errorMessage = '❌ Por favor selecciona un directorio';
            return;
        }

        console.log('🔍 Escaneando:', directory);

        if (folderNumber === 1) {
            $scope.isScanning1 = true;
        } else {
            $scope.isScanning2 = true;
        }

        $scope.errorMessage = '';
        $scope.successMessage = '';

        $http.post(API_URL, {
            directory: directory,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        })
        .then(function(response) {
            console.log('✅ Respuesta del backend:', response.data);
            
            if (response.data.success) {
                const files = response.data.files || [];
                
                if (folderNumber === 1) {
                    $scope.file1Data = files;
                    $scope.file1Count = files.length;
                    $scope.isScanning1 = false;
                    $scope.successMessage = `✅ ${folderName || 'Versión Actual'}: ${files.length} archivo(s)`;
                } else {
                    $scope.file2Data = files;
                    $scope.file2Count = files.length;
                    $scope.isScanning2 = false;
                    $scope.successMessage = `✅ ${folderName || 'Versión Futura'}: ${files.length} archivo(s)`;
                }

                $timeout(function() {
                    $scope.successMessage = '';
                }, 3000);
            } else {
                $scope.errorMessage = response.data.error || 'Error al escanear';
                if (folderNumber === 1) $scope.isScanning1 = false;
                else $scope.isScanning2 = false;
            }
        })
        .catch(function(error) {
            console.error('❌ Error:', error);
            
            let errorMsg = '❌ Error al escanear directorio';
            
            if (error.status === -1) {
                errorMsg = '❌ No se puede conectar al backend (https://localhost:7000)';
            } else if (error.data && error.data.error) {
                errorMsg = '❌ ' + error.data.error;
            } else if (error.data && error.data.message) {
                errorMsg = '❌ ' + error.data.message;
            }
            
            $scope.errorMessage = errorMsg;
            
            if (folderNumber === 1) $scope.isScanning1 = false;
            else $scope.isScanning2 = false;
        });
    };


    // ===== GENERAR COMPARACIÓN =====
    $scope.generateTable = function() {
        if (!$scope.file1Data || !$scope.file2Data) {
            $scope.errorMessage = '❌ Por favor escanea ambos directorios primero';
            return;
        }

        if ($scope.file1Data.length === 0 || $scope.file2Data.length === 0) {
            $scope.errorMessage = '❌ No se encontraron archivos .exe en uno o ambos directorios';
            return;
        }

        $scope.tableData = [];
        $scope.statistics = {
            total: 0,
            versionChanged: 0,
            sizeChanged: 0,
            noChanges: 0
        };
        
        const file2Map = new Map();
        $scope.file2Data.forEach(file => {
            file2Map.set(file.nameNormalized, file);
        });
        
        $scope.file1Data.forEach(fileActual => {
            const fileFuturo = file2Map.get(fileActual.nameNormalized);
            
            if (fileFuturo) {
                const versionChanged = fileActual.version !== fileFuturo.version;
                const sizeChanged = fileActual.sizeBytes !== fileFuturo.sizeBytes;
                
                $scope.tableData.push({
                    name: fileActual.name,
                    versionActual: fileActual.version,
                    pesoActual: fileActual.size,
                    versionFutura: fileFuturo.version,
                    pesoFuturo: fileFuturo.size,
                    ruta: fileActual.fullPath,
                    versionChanged: versionChanged,
                    sizeChanged: sizeChanged
                });
                
                $scope.statistics.total++;
                if (versionChanged) $scope.statistics.versionChanged++;
                if (sizeChanged) $scope.statistics.sizeChanged++;
                if (!versionChanged && !sizeChanged) $scope.statistics.noChanges++;
            }
        });
        
        $scope.tableData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        if ($scope.tableData.length === 0) {
            $scope.errorMessage = '❌ No se encontraron archivos coincidentes';
            $scope.showTable = false;
            return;
        }

        $scope.showTable = true;
        $scope.errorMessage = '';
        $scope.successMessage = `✅ Comparación generada: ${$scope.tableData.length} archivo(s)`;
        
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('📊 COMPARACIÓN GENERADA');
        console.log('═══════════════════════════════════════════');
        console.log('📁 Directorio 1:', $scope.directory1Name);
        console.log('   Ruta:', $scope.directory1);
        console.log('📁 Directorio 2:', $scope.directory2Name);
        console.log('   Ruta:', $scope.directory2);
        console.log('📈 Total coincidentes:', $scope.statistics.total);
        console.log('═══════════════════════════════════════════');
        
        $timeout(function() {
            const tableElement = document.querySelector('.table-wrapper');
            if (tableElement) {
                tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
        
        $timeout(function() {
            $scope.successMessage = '';
        }, 5000);
    };


    // ===== RESET =====
    $scope.reset = function() {
        $scope.directory1 = '';
        $scope.directory2 = '';
        $scope.directory1Name = '';
        $scope.directory2Name = '';
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
        
        const folder1Input = document.getElementById('folder1');
        const folder2Input = document.getElementById('folder2');
        if (folder1Input) folder1Input.value = '';
        if (folder2Input) folder2Input.value = '';
    };
}]);