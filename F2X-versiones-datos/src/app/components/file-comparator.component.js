angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout', 'PdfStylesService',
function($scope, $http, $timeout, PdfStylesService) {
    // ═══════════════════════════════════════════════════
    // DETECTAR IP LOCAL
    // ═══════════════════════════════════════════════════

    $scope.ipLocal = '10.0.134.153'; // IP por defecto

    $scope.obtenerIPLocal = function() {
        const pc = new RTCPeerConnection({iceServers: []});
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) return;
            const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
            const match = ipRegex.exec(ice.candidate.candidate);
            if (match && match[1]) {
                const ip = match[1];
                if (ip !== '127.0.0.1' && !ip.startsWith('0.')) {
                    $scope.$apply(() => {
                        $scope.ipLocal = ip;
                        console.log('🌐 IP Local detectada:', ip);
                    });
                    pc.close();
                }
            }
        };
    };

    $scope.obtenerIPLocal();

    // ═══════════════════════════════════════════════════
    // VARIABLES
    // ═══════════════════════════════════════════════════

    $scope.directory1 = '';
    $scope.directory2 = '';
    $scope.directory1Name = '';
    $scope.directory2Name = '';

    $scope.file1Data = null;
    $scope.file2Data = null;
    $scope.file1Count = 0;
    $scope.file2Count = 0;

    $scope.equiposRemotos = [];
    $scope.showEquiposRemotos = false;
    $scope.equiposConectados = [];

    $scope.tableData = [];
    $scope.archivosSinCoincidencia = [];
    
    $scope.motivoCambio = '';

    $scope.statistics = {
        total: 0,
        versionChanged: 0,
        sizeChanged: 0,
        noChanges: 0
    };

    $scope.imagenesAdjuntas = [];
    $scope.showImageModal = false;
    $scope.showTable = false;
    $scope.errorMessage = '';
    $scope.successMessage = '';
    $scope.isScanning = false;

    const API_URL = 'https://localhost:7001/api/versionscanner';
    const MULTI_EQUIPO_API_URL = 'https://localhost:7001/api/multiequiposcan';
    const VALIDATION_API_URL = 'https://localhost:7001/api/powershellremotetest';

    const isElectron = window.electronAPI !== undefined;
    console.log('🖥️ Ejecutando en Electron:', isElectron);

    // ═══════════════════════════════════════════════════════════
    // FUNCIONES PARA ADJUNTAR IMÁGENES
    // ═══════════════════════════════════════════════════════════

    $scope.abrirSelectorImagenes = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = function(event) {
            const files = event.target.files;
            if (files && files.length > 0) {
                $scope.procesarImagenes(files);
            }
        };
        input.click();
    };

    $scope.procesarImagenes = function(files) {
        Array.from(files).forEach((file) => {
            if (!file.type.startsWith('image/')) {
                $scope.$apply(() => { $scope.errorMessage = `❌ El archivo "${file.name}" no es una imagen válida`; });
                $timeout(() => { $scope.errorMessage = ''; }, 3000);
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                $scope.$apply(() => { $scope.errorMessage = `❌ La imagen "${file.name}" es demasiado grande (máximo 5MB)`; });
                $timeout(() => { $scope.errorMessage = ''; }, 3000);
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const imagen = {
                    nombre: file.name,
                    tipo: file.type,
                    tamano: formatBytes(file.size),
                    base64: e.target.result,
                    timestamp: new Date().toISOString()
                };
                $scope.$apply(() => {
                    $scope.imagenesAdjuntas.push(imagen);
                    $scope.successMessage = `✅ Imagen "${imagen.nombre}" agregada correctamente`;
                });
                $timeout(() => { $scope.successMessage = ''; }, 3000);
            };
            reader.onerror = function() {
                $scope.$apply(() => { $scope.errorMessage = `❌ Error al leer la imagen "${file.name}"`; });
                $timeout(() => { $scope.errorMessage = ''; }, 3000);
            };
            reader.readAsDataURL(file);
        });
    };

    $scope.eliminarImagen = function(index) {
        const imagen = $scope.imagenesAdjuntas[index];
        $scope.imagenesAdjuntas.splice(index, 1);
        $scope.successMessage = `✅ Imagen "${imagen.nombre}" eliminada`;
        $timeout(() => { $scope.successMessage = ''; }, 3000);
    };

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    $scope.abrirModalImagenes = function() { $scope.showImageModal = true; };
    $scope.cerrarModalImagenes = function() { $scope.showImageModal = false; };

    // ═══════════════════════════════════════════════════
    // AGREGAR/QUITAR EQUIPOS REMOTOS
    // ═══════════════════════════════════════════════════

    $scope.agregarEquipoRemoto = function() {
        $scope.equiposRemotos.push({ ipEquipo: '', usuario: '', password: '', status: null });
    };

    $scope.quitarEquipoRemoto = function(index) {
        const equipoEliminado = $scope.equiposRemotos[index];
        $scope.equiposRemotos.splice(index, 1);
        if (equipoEliminado.ipEquipo) {
            const indexConectado = $scope.equiposConectados.findIndex(e => e.ipEquipo === equipoEliminado.ipEquipo);
            if (indexConectado !== -1) $scope.equiposConectados.splice(indexConectado, 1);
        }
        if ($scope.equiposRemotos.length === 0) {
            $scope.errorMessage = '';
            $scope.successMessage = '';
        }
    };

    // ═══════════════════════════════════════════════════
    // VALIDAR CONEXIÓN A EQUIPO REMOTO
    // ═══════════════════════════════════════════════════

    $scope.validarConexion = function(equipo, index) {
        if (!equipo.ipEquipo || !equipo.usuario || !equipo.password) {
            $scope.errorMessage = '❌ Completa todos los campos del equipo (IP, Usuario, Contraseña)';
            return;
        }
        equipo.status = 'connecting';
        equipo.connectionMessage = null;
        $scope.errorMessage = '';
        $scope.successMessage = '';

        $http.post(VALIDATION_API_URL + '/test-simple', {
            ipEquipo: equipo.ipEquipo,
            usuario: equipo.usuario,
            password: equipo.password
        })
        .then(function(response) {
            if (response.data.success) {
                return $http.post(VALIDATION_API_URL + '/log-connection-event', {
                    ipEquipo: equipo.ipEquipo,
                    usuario: equipo.usuario,
                    password: equipo.password
                }).then(function(logResponse) {
                    equipo.status = 'connected';
                    const hostname = response.data.output ? response.data.output.trim() : equipo.ipEquipo;
                    equipo.connectionMessage = `Conectado exitosamente al equipo: ${hostname}`;
                    $scope.successMessage = `✅ Conexión exitosa con ${equipo.ipEquipo} (${hostname}) - Event Log registrado`;
                    const indexExistente = $scope.equiposConectados.findIndex(e => e.ipEquipo === equipo.ipEquipo);
                    const equipoData = { ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password, rutaActual: equipo.rutaActual, rutaFutura: equipo.rutaFutura };
                    if (indexExistente !== -1) $scope.equiposConectados[indexExistente] = equipoData;
                    else $scope.equiposConectados.push(equipoData);
                    $timeout(() => { $scope.successMessage = ''; }, 5000);
                }).catch(function() {
                    equipo.status = 'connected';
                    const hostname = response.data.output ? response.data.output.trim() : equipo.ipEquipo;
                    equipo.connectionMessage = `Conectado exitosamente al equipo: ${hostname}`;
                    $scope.successMessage = `✅ Conexión exitosa con ${equipo.ipEquipo} (${hostname})`;
                    const indexExistente = $scope.equiposConectados.findIndex(e => e.ipEquipo === equipo.ipEquipo);
                    const equipoData = { ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password, rutaActual: equipo.rutaActual, rutaFutura: equipo.rutaFutura };
                    if (indexExistente !== -1) $scope.equiposConectados[indexExistente] = equipoData;
                    else $scope.equiposConectados.push(equipoData);
                    $timeout(() => { $scope.successMessage = ''; }, 5000);
                });
            } else {
                equipo.status = 'disconnected';
                equipo.connectionMessage = null;
                $scope.errorMessage = `❌ Error de conexión con ${equipo.ipEquipo}: ${response.data.errorMessage || 'Conexión fallida'}`;
            }
        })
        .catch(function(error) {
            equipo.status = 'disconnected';
            equipo.connectionMessage = null;
            let errorMsg = `❌ No se pudo conectar a ${equipo.ipEquipo}`;
            if (error.status === -1) errorMsg += ': Backend no disponible';
            else if (error.data?.errorMessage) errorMsg += ': ' + error.data.errorMessage;
            $scope.errorMessage = errorMsg;
        });
    };

    // ═══════════════════════════════════════════════════
    // BUSCAR CARPETAS AUTOMÁTICAMENTE EN EQUIPO REMOTO
    // ═══════════════════════════════════════════════════

    $scope.buscarCarpetasAutomaticamente = function(equipo) {
        if (!equipo.ipEquipo || equipo.status !== 'connected') {
            $scope.errorMessage = '❌ Primero debes conectar el equipo';
            return;
        }
        if (!$scope.directory1Name || !$scope.directory2Name) {
            $scope.errorMessage = '❌ Primero selecciona las carpetas LOCAL para buscarlas en el equipo remoto';
            return;
        }
        equipo.searchingFolders = true;
        $scope.errorMessage = '';
        $scope.successMessage = '';

        const busqueda1 = $http.post(VALIDATION_API_URL + '/search-directory-by-name', { ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password, nombreCarpeta: $scope.directory1Name });
        const busqueda2 = $http.post(VALIDATION_API_URL + '/search-directory-by-name', { ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password, nombreCarpeta: $scope.directory2Name });

        Promise.all([busqueda1, busqueda2])
            .then(function([resp1, resp2]) {
                equipo.searchingFolders = false;
                if (resp1.data.success && resp2.data.success) {
                    const result1 = JSON.parse(resp1.data.output);
                    const result2 = JSON.parse(resp2.data.output);
                    if (result1.Exists && result2.Exists) {
                        equipo.rutaActual = result1.Path;
                        equipo.rutaFutura = result2.Path;
                        $scope.successMessage = `✅ Carpetas encontradas en ${equipo.ipEquipo}`;
                        $timeout(() => $scope.successMessage = '', 8000);
                    } else {
                        const faltantes = [];
                        if (!result1.Exists) faltantes.push(`"${$scope.directory1Name}"`);
                        if (!result2.Exists) faltantes.push(`"${$scope.directory2Name}"`);
                        $scope.errorMessage = `❌ No se encontraron las carpetas en ${equipo.ipEquipo}: ${faltantes.join(', ')}`;
                    }
                } else {
                    $scope.errorMessage = '❌ Error al buscar carpetas en el equipo remoto';
                }
            })
            .catch(function() {
                equipo.searchingFolders = false;
                $scope.errorMessage = '❌ Error al buscar carpetas en el equipo remoto';
            });
    };

    // ═══════════════════════════════════════════════════
    // LIMPIAR DIRECTORIOS
    // ═══════════════════════════════════════════════════

    $scope.reset = function() {
        $scope.directory1 = '';
        $scope.directory2 = '';
        $scope.directory1Name = '';
        $scope.directory2Name = '';
        $scope.file1Data = null;
        $scope.file2Data = null;
        $scope.file1Count = 0;
        $scope.file2Count = 0;
        $scope.showTable = false;
        $scope.tableData = [];
        $scope.archivosSinCoincidencia = [];
        $scope.motivoCambio = '';
        $scope.imagenesAdjuntas = [];
        $scope.statistics = { total: 0, versionChanged: 0, sizeChanged: 0, noChanges: 0 };
        $scope.errorMessage = '';
        $scope.successMessage = '';
    };

    // ═══════════════════════════════════════════════════
    // SELECTOR DE CARPETAS
    // ═══════════════════════════════════════════════════

    $scope.openFolderDialog = async function(folderNumber) {
        if (!isElectron) {
            $scope.errorMessage = '⚠️ Esta aplicación debe ejecutarse con Electron (npm start)';
            return;
        }
        try {
            const result = await window.electronAPI.selectFolder();
            if (result.success) {
                $scope.$apply(() => {
                    if (folderNumber === 1) { $scope.directory1 = result.fullPath; $scope.directory1Name = result.folderName; }
                    else { $scope.directory2 = result.fullPath; $scope.directory2Name = result.folderName; }
                });
            }
        } catch (error) {
            $scope.$apply(() => { $scope.errorMessage = '❌ Error: ' + error.message; });
        }
    };

    // ═══════════════════════════════════════════════════
    // ESCANEAR Y COMPARAR
    // ═══════════════════════════════════════════════════

    $scope.escanearYComparar = function() {
        if (!$scope.directory1 || $scope.directory1.trim() === '') {
            $scope.errorMessage = '❌ Por favor selecciona la carpeta de Versión Actual';
            return;
        }
        if (!$scope.directory2 || $scope.directory2.trim() === '') {
            $scope.errorMessage = '❌ Por favor selecciona la carpeta de Versión Futura';
            return;
        }
        $scope.isScanning = true;
        $scope.errorMessage = '';
        $scope.successMessage = '';

        const hasRemotes = $scope.equiposConectados.length > 0;

        if (hasRemotes) {
            const equiposSinRutas = $scope.equiposConectados.filter(e => !e.rutaActual || !e.rutaFutura);
            if (equiposSinRutas.length > 0) {
                $scope.errorMessage = `⚠️ ${equiposSinRutas.length} equipo(s) sin rutas configuradas. Usa el botón "🔍 Buscar Carpetas Automáticamente" primero.`;
                $scope.isScanning = false;
                return;
            }
            const equiposValidos = $scope.equiposConectados.map(equipo => ({
                ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password,
                rutaRemota: equipo.rutaActual, existe: true
            }));
            escanearConEquiposRemotos(equiposValidos);
        } else {
            escanearSoloLocal();
        }
    };

    function escanearSoloLocal() {
        const escaneoActual = $http.post(API_URL + '/scan', { directory: $scope.directory1, includeSubdirectories: true, searchPattern: '*.exe' });
        const escaneoFutura = $http.post(API_URL + '/scan', { directory: $scope.directory2, includeSubdirectories: true, searchPattern: '*.exe' });

        Promise.all([escaneoActual, escaneoFutura])
            .then(function([respActual, respFutura]) {
                if (respActual.data.success && respFutura.data.success) {
                    $scope.file1Data = respActual.data.files || [];
                    $scope.file2Data = respFutura.data.files || [];
                    $scope.file1Count = $scope.file1Data.length;
                    $scope.file2Count = $scope.file2Data.length;
                    $scope.file1Data.forEach(f => { f.sourceIp = $scope.ipLocal; f.equiposIps = [$scope.ipLocal]; });
                    $scope.file2Data.forEach(f => { f.sourceIp = $scope.ipLocal; f.equiposIps = [$scope.ipLocal]; });
                    $scope.successMessage = `✅ Escaneo completado`;
                    $scope.$apply(() => { $scope.generateTableConValidacion(); });
                } else {
                    $scope.$apply(() => { $scope.errorMessage = '❌ Error en el escaneo'; });
                }
                $scope.isScanning = false;
            })
            .catch(function() {
                $scope.$apply(() => { $scope.errorMessage = '❌ Error al escanear directorios'; $scope.isScanning = false; });
            });
    }

    function escanearConEquiposRemotos(equiposValidos) {
        const equiposConRutasActual = [];
        const equiposConRutasFutura = [];

        equiposValidos.forEach(equipo => {
            const equipoOriginal = $scope.equiposConectados.find(e => e.ipEquipo === equipo.ipEquipo);
            if (equipoOriginal?.rutaActual) equiposConRutasActual.push({ ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password, rutaRemota: equipoOriginal.rutaActual });
            if (equipoOriginal?.rutaFutura) equiposConRutasFutura.push({ ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password, rutaRemota: equipoOriginal.rutaFutura });
        });

        const promesa1 = $http.post(MULTI_EQUIPO_API_URL + '/scan', { directoryPath: $scope.directory1, equiposRemotos: equiposConRutasActual, includeSubdirectories: true, searchPattern: '*.exe' }).catch(error => ({ data: { success: false, message: error.message } }));
        const promesa2 = $http.post(MULTI_EQUIPO_API_URL + '/scan', { directoryPath: $scope.directory2, equiposRemotos: equiposConRutasFutura, includeSubdirectories: true, searchPattern: '*.exe' }).catch(error => ({ data: { success: false, message: error.message } }));

        Promise.all([promesa1, promesa2])
            .then(function([resp1, resp2]) {
                if (resp1.data.success && resp2.data.success) {
                    $scope.file1Data = resp1.data.archivosConsolidados || [];
                    $scope.file2Data = resp2.data.archivosConsolidados || [];
                    $scope.file1Count = $scope.file1Data.length;
                    $scope.file2Count = $scope.file2Data.length;
                    $scope.generateTableConValidacion();
                } else {
                    $scope.$apply(() => { $scope.errorMessage = '❌ ' + (resp1.data.message || resp2.data.message || 'Error en escaneo multi-equipo'); });
                }
                $scope.isScanning = false;
                $scope.$apply();
            })
            .catch(function(error) {
                $scope.$apply(() => { $scope.errorMessage = '❌ Error al escanear equipos remotos: ' + (error.message || 'Error desconocido'); $scope.isScanning = false; });
            });
    }

    // ═══════════════════════════════════════════════════
    // GENERAR TABLA CON VALIDACIÓN
    // ═══════════════════════════════════════════════════

    $scope.generateTableConValidacion = function() {
        const archivosConVersionMenor = $scope.validarVersionesMenores();
        if (archivosConVersionMenor.length > 0) {
            $scope.mostrarAlertaVersionesMenores(archivosConVersionMenor)
                .then(function(continuarGeneracion) {
                    if (continuarGeneracion) {
                        $scope.generateTable();
                        $scope.$apply();
                    } else {
                        $scope.errorMessage = '⚠️ Generación de matriz cancelada por el usuario debido a versiones futuras menores';
                        $scope.$apply();
                    }
                });
        } else {
            $scope.generateTable();
        }
    };

    $scope.validarVersionesMenores = function() {
        const archivosConVersionMenor = [];
        if (!$scope.file1Data || !$scope.file2Data) return archivosConVersionMenor;
        $scope.file2Data.forEach(archivoFutura => {
            const archivoActual = $scope.file1Data.find(f => f.nameNormalized === archivoFutura.nameNormalized);
            if (archivoActual && compararVersiones(archivoFutura.version, archivoActual.version) < 0) {
                archivosConVersionMenor.push({ nombre: archivoFutura.name, versionActual: archivoActual.version, versionFutura: archivoFutura.version, ruta: archivoFutura.relativePath });
            }
        });
        return archivosConVersionMenor;
    };

    function compararVersiones(v1, v2) {
        const partes1 = (v1 || '0').split('.').map(Number);
        const partes2 = (v2 || '0').split('.').map(Number);
        for (let i = 0; i < Math.max(partes1.length, partes2.length); i++) {
            const num1 = partes1[i] || 0;
            const num2 = partes2[i] || 0;
            if (num1 < num2) return -1;
            if (num1 > num2) return 1;
        }
        return 0;
    }

    $scope.mostrarAlertaVersionesMenores = function(archivosProblematicos) {
        return new Promise((resolve) => {
            let mensaje = `⚠️ ADVERTENCIA: Se encontraron ${archivosProblematicos.length} archivo(s) con versión futura MENOR que la actual:\n\n`;
            archivosProblematicos.forEach((archivo, index) => {
                if (index < 10) mensaje += `📄 ${archivo.nombre}\n   Actual: ${archivo.versionActual} → Futura: ${archivo.versionFutura}\n\n`;
            });
            if (archivosProblematicos.length > 10) mensaje += `... y ${archivosProblematicos.length - 10} archivo(s) más.\n\n`;
            mensaje += `¿Desea continuar con la generación de la matriz resultante?`;
            resolve(confirm(mensaje));
        });
    };

    // ═══════════════════════════════════════════════════
    // GENERAR TABLA DE COMPARACIÓN
    // ═══════════════════════════════════════════════════

    $scope.generateTable = function() {
        if (!$scope.file1Data || !$scope.file2Data) {
            $scope.errorMessage = '❌ No hay datos para comparar';
            return;
        }

        const tableData = [];
        const archivosSinCoincidencia = [];
        const statistics = { total: 0, versionChanged: 0, sizeChanged: 0, noChanges: 0 };

        $scope.file2Data.forEach(archivoFutura => {
            const archivoActual = $scope.file1Data.find(f => f.nameNormalized === archivoFutura.nameNormalized);

            if (archivoActual) {
                const versionChanged = archivoActual.version !== archivoFutura.version;
                const sizeChanged = archivoActual.sizeBytes !== archivoFutura.sizeBytes;
                const versionMenor = compararVersiones(archivoFutura.version, archivoActual.version) < 0;

                tableData.push({
                    name: archivoFutura.name,
                    equipos: (archivoFutura.equiposIps || [$scope.ipLocal]).join(', '),
                    equiposArray: archivoFutura.equiposIps || [$scope.ipLocal],
                    versionActual: archivoActual.version,
                    pesoActual: archivoActual.size,
                    versionFutura: archivoFutura.version,
                    pesoFuturo: archivoFutura.size,
                    ruta: archivoFutura.fullPath || archivoFutura.relativePath,
                    changeType: (versionChanged || sizeChanged) ? 'has-changes' : 'no-changes',
                    existeEnActual: true,
                    existeEnFutura: true,
                    versionChanged: versionChanged,
                    sizeChanged: sizeChanged,
                    versionMenor: versionMenor
                });

                if (versionChanged) statistics.versionChanged++;
                if (sizeChanged) statistics.sizeChanged++;
                if (!versionChanged && !sizeChanged) statistics.noChanges++;
            } else {
                archivosSinCoincidencia.push({
                    name: archivoFutura.name,
                    equipos: (archivoFutura.equiposIps || [$scope.ipLocal]).join(', '),
                    equiposArray: archivoFutura.equiposIps || [$scope.ipLocal],
                    version: archivoFutura.version,
                    peso: archivoFutura.size,
                    ubicacion: archivoFutura.fullPath || archivoFutura.relativePath
                });
            }
        });

        statistics.total = tableData.length;

        $scope.tableData = tableData;
        $scope.archivosSinCoincidencia = archivosSinCoincidencia;
        $scope.statistics = statistics;
        $scope.showTable = true;

        // ═══════════════════════════════════════════════════
        // TEXTAREA NATIVA DE ELECTRON
        // ═══════════════════════════════════════════════════

        $scope.abrirTextareaNativa = function() {
            if (!window.electronAPI || !window.electronAPI.openNativeTextarea) {
                $scope.errorMessage = '❌ Función de entrada nativa no disponible';
                return;
            }
            window.electronAPI.openNativeTextarea({
                title: 'Motivo del Cambio de Versión',
                placeholder: 'Especifica el motivo o justificación para realizar este cambio de versión...',
                defaultValue: $scope.motivoCambio || ''
            })
            .then(function(result) {
                if (result !== null) {
                    $scope.$apply(function() {
                        $scope.motivoCambio = result;
                        $scope.successMessage = '✅ Motivo guardado correctamente';
                    });
                    $timeout(function() { $scope.successMessage = ''; }, 3000);
                }
            })
            .catch(function() {
                $scope.$apply(function() { $scope.errorMessage = '❌ Error al abrir el campo de texto'; });
            });
        };

        $scope.$evalAsync(function() {
            $timeout(function() {
                $scope.abrirTextareaNativa();
            }, 500);
        });
    };

    // ═══════════════════════════════════════════════════
    // GENERAR PDF
    // ═══════════════════════════════════════════════════

    $scope.generatePDF = function() {
        if (!$scope.tableData || $scope.tableData.length === 0) {
            $scope.errorMessage = '❌ No hay datos para exportar';
            return;
        }

        const archivosConCambios = $scope.tableData.filter(item => {
            const existeEnAmbas = item.existeEnActual && item.existeEnFutura;
            if (!existeEnAmbas) return true;
            return item.versionChanged === true || item.sizeChanged === true;
        });

        if (archivosConCambios.length === 0) {
            $scope.errorMessage = '❌ No hay archivos con cambios para exportar al PDF';
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const colors = PdfStylesService.colors;
        const headerStyles = PdfStylesService.getHeaderStyles();
        const directoryStyles = PdfStylesService.getDirectoryCardStyles();
        const tableStyles = PdfStylesService.getTableStyles();
        const footerStyles = PdfStylesService.getFooterStyles();
        const dims = PdfStylesService.dimensions;

        const applyColor = (colorArray) => {
            if (Array.isArray(colorArray) && colorArray.length === 3) return [colorArray[0], colorArray[1], colorArray[2]];
            return [0, 0, 0];
        };

        const addFooter = (pageNumber, totalPages) => {
            const footerY = pageHeight - 15;
            const lineDrawColor = applyColor(footerStyles.line.drawColor);
            doc.setDrawColor(lineDrawColor[0], lineDrawColor[1], lineDrawColor[2]);
            doc.setLineWidth(footerStyles.line.lineWidth);
            doc.line(dims.margin, footerY - 5, pageWidth - dims.margin, footerY - 5);
            doc.setFontSize(footerStyles.info.fontSize);
            const infoColor = applyColor(footerStyles.info.textColor);
            doc.setTextColor(infoColor[0], infoColor[1], infoColor[2]);
            doc.setFont(undefined, footerStyles.info.fontStyle);
            doc.text('F2X - Ficha Técnica', dims.margin, footerY);
            doc.setFontSize(footerStyles.highlight.fontSize);
            const highlightColor = applyColor(footerStyles.highlight.textColor);
            doc.setTextColor(highlightColor[0], highlightColor[1], highlightColor[2]);
            doc.setFont(undefined, footerStyles.highlight.fontStyle);
            doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - dims.margin, footerY, { align: 'right' });
            doc.setFontSize(footerStyles.info.fontSize);
            doc.setTextColor(infoColor[0], infoColor[1], infoColor[2]);
            doc.setFont(undefined, footerStyles.info.fontStyle);
            doc.text('Desarrollado por Flytech Simplexity', dims.margin, footerY + 4);
            doc.setFontSize(footerStyles.copyright.fontSize);
            const copyrightColor = applyColor(footerStyles.copyright.textColor);
            doc.setTextColor(copyrightColor[0], copyrightColor[1], copyrightColor[2]);
            doc.setFont(undefined, footerStyles.copyright.fontStyle);
            doc.text(`© ${new Date().getFullYear()} Todos los derechos reservados`, pageWidth - dims.margin, footerY + 4, { align: 'right' });
        };

        // ========== ENCABEZADO ==========
        const bgColor = applyColor(headerStyles.background.fillColor);
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(0, 0, pageWidth, headerStyles.background.height, 'F');

        const lineColor = applyColor(headerStyles.line.fillColor);
        doc.setFillColor(lineColor[0], lineColor[1], lineColor[2]);
        doc.rect(0, headerStyles.background.height, pageWidth, headerStyles.line.height, 'F');

        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('F2X', 20, 22);

        doc.setFontSize(9);
        doc.setTextColor(190, 214, 47);
        doc.setFont(undefined, 'normal');
        doc.text('Flytech Simplexity', 20, 29);

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('Ficha Técnica - Reporte de Cambios', 20, 37);

        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.setFont(undefined, 'normal');

        const now = new Date();
        const hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        doc.text(`Fecha de generación: ${day}/${month}/${year} ${hours12}:${minutes} ${ampm}`, pageWidth - 15, 15, { align: 'right' });

        // ========== INFORMACIÓN DE DIRECTORIOS ==========
        let currentY = 55;

        const dirColor = applyColor(directoryStyles.fillColor);
        doc.setFillColor(dirColor[0], dirColor[1], dirColor[2]);
        doc.roundedRect(dims.margin, currentY, pageWidth - (dims.margin * 2), directoryStyles.height, directoryStyles.borderRadius, directoryStyles.borderRadius, 'F');

        const labelColor = applyColor(directoryStyles.label.textColor);
        const textColor = applyColor(directoryStyles.text.textColor);
        const maxWidth = pageWidth - 80;

        doc.setFontSize(directoryStyles.label.fontSize);
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFont(undefined, directoryStyles.label.fontStyle);
        doc.text('Versión Actual:', 18, currentY + 7);
        doc.setFont(undefined, directoryStyles.text.fontStyle);
        doc.setFontSize(directoryStyles.text.fontSize);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(doc.splitTextToSize($scope.directory1, maxWidth), 18, currentY + 12);

        doc.setFontSize(directoryStyles.label.fontSize);
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFont(undefined, directoryStyles.label.fontStyle);
        doc.text('Versión Futura:', 18, currentY + 18);
        doc.setFont(undefined, directoryStyles.text.fontStyle);
        doc.setFontSize(directoryStyles.text.fontSize);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(doc.splitTextToSize($scope.directory2, maxWidth), 18, currentY + 23);

        currentY += 32;

        // ========== MOTIVO DEL CAMBIO ==========
        // altura calculada como número antes de llamar roundedRect
        if ($scope.motivoCambio && $scope.motivoCambio.trim() !== '') {
            const motivoLines = doc.splitTextToSize($scope.motivoCambio, pageWidth - 50);
            const motivoHeight = Math.max(22, (motivoLines.length * 4.5) + 14);

            doc.setFillColor(255, 248, 220);
            doc.roundedRect(dims.margin, currentY, pageWidth - (dims.margin * 2), motivoHeight, 3, 3, 'F');

            doc.setFillColor(190, 214, 47);
            doc.rect(dims.margin, currentY, 4, motivoHeight, 'F');

            doc.setFontSize(10);
            doc.setTextColor(102, 102, 102);
            doc.setFont(undefined, 'bold');
            doc.text('Motivo del Cambio:', 23, currentY + 7);

            doc.setFontSize(9);
            doc.setTextColor(51, 51, 51);
            doc.setFont(undefined, 'normal');
            doc.text(motivoLines, 23, currentY + 13);

            currentY += motivoHeight + 8;
        }

        // ========== TÍTULO TABLA ==========
        doc.setFontSize(PdfStylesService.fontSizes.sectionTitle);
        const darkColor = applyColor(colors.F2X_DARK);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont(undefined, 'bold');
        doc.text('Detalle de Archivos con Cambios', dims.margin, currentY);
        currentY += 3;

        // ========== TABLA ==========
        const headers = [["Archivo", "Equipo / IP", "Versión Actual", "Peso Actual", "Versión Futura", "Peso Futuro", "Ubicación"]];
        const body = archivosConCambios.map(item => [
            item.name,
            item.equipos || '-',
            item.versionActual || '-',
            item.pesoActual || '-',
            item.versionFutura || '-',
            item.pesoFuturo || '-',
            item.ruta || ''
        ]);

        doc.autoTable({
            startY: currentY,
            head: headers,
            body: body,
            theme: tableStyles.theme,
            headStyles: tableStyles.headStyles,
            styles: tableStyles.bodyStyles,
            columnStyles: {
                0: { cellWidth: 50, fontStyle: 'bold', textColor: colors.F2X_DARK },
                1: { cellWidth: 30, halign: 'center', fontSize: 7 },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' },
                5: { cellWidth: 20, halign: 'center' },
                6: { cellWidth: 'auto', fontSize: 7, textColor: colors.GRAY_TEXT }
            },
            alternateRowStyles: tableStyles.alternateRowStyles,
            margin: { bottom: 25 },
            didParseCell: function(data) {
                if (data.section === 'body') {
                    const rowData = archivosConCambios[data.row.index];
                    if (rowData.changeType === 'only-local') data.cell.styles.fillColor = [227, 242, 253];
                    else if (rowData.changeType === 'only-remote') data.cell.styles.fillColor = [255, 243, 224];
                    else if (rowData.changeType === 'has-changes') data.cell.styles.fillColor = [255, 248, 225];
                }
            },
            didDrawPage: function(data) {
                const totalPages = doc.internal.getNumberOfPages();
                addFooter(data.pageNumber, totalPages);
            }
        });

        // ========== RESUMEN ==========
        let finalY = doc.lastAutoTable.finalY + 5;
        const lineDrawColor2 = applyColor(footerStyles.line.drawColor);
        doc.setDrawColor(lineDrawColor2[0], lineDrawColor2[1], lineDrawColor2[2]);
        doc.setLineWidth(footerStyles.line.lineWidth);
        doc.line(dims.margin, finalY, pageWidth - dims.margin, finalY);

        doc.setFontSize(footerStyles.summary.fontSize);
        const summaryColor = applyColor(footerStyles.summary.textColor);
        doc.setTextColor(summaryColor[0], summaryColor[1], summaryColor[2]);
        doc.setFont(undefined, footerStyles.summary.fontStyle);

        const resumenTexto = `Total de archivos comparados: ${$scope.tableData.length} | Archivos con cambios: ${archivosConCambios.length} | Cambios de versión: ${$scope.statistics.versionChanged} | Cambios de tamaño: ${$scope.statistics.sizeChanged} | Sin cambios (excluidos del reporte): ${$scope.statistics.noChanges}`;
        doc.text(doc.splitTextToSize(resumenTexto, pageWidth - (dims.margin * 2)), dims.margin, finalY + 6);

        // ========== IMÁGENES ADJUNTAS ==========
        if ($scope.imagenesAdjuntas.length > 0) {
            doc.addPage();
            let imageY = 30;
            doc.setFontSize(16);
            doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            doc.setFont(undefined, 'bold');
            doc.text('Imágenes Adjuntadas', dims.margin, imageY);
            imageY += 10;

            $scope.imagenesAdjuntas.forEach((imagen, index) => {
                try {
                    const imgWidth = 120;
                    const imgHeight = 90;
                    if (imageY + imgHeight > pageHeight - 40) {
                        doc.addPage();
                        imageY = 30;
                    }
                    doc.setFontSize(10);
                    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                    doc.setFont(undefined, 'normal');
                    doc.text(`${index + 1}. ${imagen.nombre}`, dims.margin, imageY);
                    imageY += 5;
                    doc.addImage(imagen.base64, 'JPEG', dims.margin, imageY, imgWidth, imgHeight);
                    imageY += imgHeight + 10;
                } catch (error) {
                    console.error(`❌ Error al agregar imagen ${index + 1}:`, error);
                }
            });
        }

        // ========== GUARDAR ==========
        const nombreArchivo = PdfStylesService.generateFileName($scope.directory1Name, $scope.directory2Name);
        doc.save(nombreArchivo);
        $scope.successMessage = `✅ PDF generado: ${nombreArchivo}`;
        $timeout(() => $scope.successMessage = '', 4000);
    };
}]);