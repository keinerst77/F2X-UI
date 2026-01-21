angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout',
function($scope, $http, $timeout) {
    
    // Variables
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

    // Detectar si Electron (framework) está disponible
    const isElectron = window.electronAPI !== undefined;
    console.log('🖥️ Ejecutando en Electron:', isElectron);
    
    if (!isElectron) {
        console.warn('⚠️ electronAPI no disponible. Ejecuta con: npm start');
    }


    // Limpiar todo
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


    // Selector de las carpetas Automatico
    $scope.openFolderDialog = async function(folderNumber) {
        
        if (!isElectron) {
            $scope.errorMessage = '⚠️ Esta aplicación debe ejecutarse con Electron (npm start)';
            console.error('❌ window.electronAPI no está disponible');
            console.log('💡 Ejecuta: npm start');
            return;
        }
        
        try {
            console.log('📁 Abriendo selector de carpetas...');
            
            // Llamar a Electron para abrir el diálogo NATIVO de Windows
            const result = await window.electronAPI.selectFolder();
            
            if (result.success) {
                const fullPath = result.fullPath;
                const folderName = result.folderName;
                
                console.log('✅ ¡Carpeta seleccionada Automaticamente!');
                console.log('   📂 Nombre:', folderName);
                console.log('   📍 Ruta completa:', fullPath);
                
                // Asignar valores en Angular
                $scope.$apply(() => {
                    if (folderNumber === 1) {
                        $scope.directory1 = fullPath;
                        $scope.directory1Name = folderName;
                    } else {
                        $scope.directory2 = fullPath;
                        $scope.directory2Name = folderName;
                    }
                });
                
                // Escanear automáticamente
                $timeout(() => {
                    $scope.scanDirectory(folderNumber);
                }, 100);
                
            } else {
                console.log('ℹ️ Usuario canceló la selección');
            }
            
        } catch (error) {
            console.error('❌ Error al seleccionar carpeta:', error);
            $scope.$apply(() => {
                $scope.errorMessage = '❌ Error: ' + error.message;
            });
        }
    };


    // Escanear Directorio
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
                    $scope.successMessage = `✅ ${folderName}: ${files.length} archivo(s)`;
                } else {
                    $scope.file2Data = files;
                    $scope.file2Count = files.length;
                    $scope.isScanning2 = false;
                    $scope.successMessage = `✅ ${folderName}: ${files.length} archivo(s)`;
                }

                $timeout(() => $scope.successMessage = '', 3000);
            } else {
                $scope.errorMessage = response.data.error || 'Error al escanear';
                if (folderNumber === 1) $scope.isScanning1 = false;
                else $scope.isScanning2 = false;
            }
        })
        .catch(function(error) {
            console.error('❌ Error:', error);
            
            let errorMsg = '❌ Error al escanear';
            if (error.status === -1) {
                errorMsg = '❌ Backend no disponible en https://localhost:7000';
            } else if (error.data?.error) {
                errorMsg = '❌ ' + error.data.error;
            }
            
            $scope.errorMessage = errorMsg;
            if (folderNumber === 1) $scope.isScanning1 = false;
            else $scope.isScanning2 = false;
        });
    };


    // Generar Comparación
    $scope.generateTable = function() {
        if (!$scope.file1Data || !$scope.file2Data) {
            $scope.errorMessage = '❌ Escanea ambos directorios primero';
            return;
        }

        $scope.tableData = [];
        $scope.statistics = { total: 0, versionChanged: 0, sizeChanged: 0, noChanges: 0 };
        
        const file2Map = new Map();
        $scope.file2Data.forEach(f => file2Map.set(f.nameNormalized, f));
        
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
                    versionChanged,
                    sizeChanged
                });
                
                $scope.statistics.total++;
                if (versionChanged) $scope.statistics.versionChanged++;
                if (sizeChanged) $scope.statistics.sizeChanged++;
                if (!versionChanged && !sizeChanged) $scope.statistics.noChanges++;
            }
        });
        
        $scope.tableData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        if ($scope.tableData.length === 0) {
            $scope.errorMessage = '❌ No hay archivos coincidentes';
            $scope.showTable = false;
            return;
        }

        $scope.showTable = true;
        $scope.successMessage = `✅ Comparación: ${$scope.tableData.length} archivo(s)`;
        
        console.log('═══════════════════════════════════════════');
        console.log('📊 COMPARACIÓN GENERADA');
        console.log('📁 Dir 1:', $scope.directory1);
        console.log('📁 Dir 2:', $scope.directory2);
        console.log('═══════════════════════════════════════════');
        
        $timeout(() => {
            document.querySelector('.table-wrapper')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        $timeout(() => $scope.successMessage = '', 5000);
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
        $scope.statistics = { total: 0, versionChanged: 0, sizeChanged: 0, noChanges: 0 };
        $scope.showTable = false;
        $scope.errorMessage = '';
        $scope.successMessage = '';
    };
}]);