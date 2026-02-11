angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout', 'PdfStylesService',
function($scope, $http, $timeout, PdfStylesService) {
    // ═══════════════════════════════════════════════════
    // DETECTAR IP LOCAL
    // ═══════════════════════════════════════════════════

    $scope.ipLocal = '10.0.134.153'; // IP por defecto

    // Función para obtener la IP local
    $scope.obtenerIPLocal = function() {
        const pc = new RTCPeerConnection({iceServers: []});
        pc.createDataChannel('');
        
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) {
                return;
            }
            
            const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
            const match = ipRegex.exec(ice.candidate.candidate);
            
            if (match && match[1]) {
                const ip = match[1];
                
                // Filtrar IPs locales válidas (evitar 127.0.0.1)
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

    // Ejecutar al cargar el controlador
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

    // Variables para imagenes
    $scope.imagenesAdjuntas = [];
    $scope.showImageModal = false;
        
    $scope.showTable = false;
    $scope.errorMessage = '';
    $scope.successMessage = '';
    $scope.isScanning = false;

    const API_URL = 'https://localhost:7001/api/versionscanner';
    const MULTI_EQUIPO_API_URL = 'https://localhost:7001/api/multiequiposcan';
    const VALIDATION_API_URL = 'https://localhost:7001/api/powershellremotetest';

    // Detectar si Electron está disponible
    const isElectron = window.electronAPI !== undefined;
    console.log('🖥️ Ejecutando en Electron:', isElectron);

    // ═══════════════════════════════════════════════════════════
    // FUNCIONES PARA ADJUNTAR IMÁGENES
    // ═══════════════════════════════════════════════════════════

    /**
     * Abre el selector de imágenes
     */
    $scope.abrirSelectorImagenes = function() {
        console.log('📸 Abriendo selector de imágenes...');
        
        // Crear input file dinámicamente
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true; // Permitir múltiples imágenes
        
        input.onchange = function(event) {
            const files = event.target.files;
            if (files && files.length > 0) {
                console.log(`📸 ${files.length} imagen(es) seleccionada(s)`);
                $scope.procesarImagenes(files);
            } else {
                console.log('⚠️ No se seleccionaron archivos');
            }
        };
        
        // Simular click
        input.click();
    };

    /**
     * Procesa las imágenes seleccionadas
     */
    $scope.procesarImagenes = function(files) {
        console.log('📸 Procesando', files.length, 'imagen(es)...');
        
        Array.from(files).forEach((file, index) => {
            // Validar que sea una imagen
            if (!file.type.startsWith('image/')) {
                console.warn('⚠️ Archivo no es una imagen:', file.name);
                $scope.$apply(() => {
                    $scope.errorMessage = `❌ El archivo "${file.name}" no es una imagen válida`;
                });
                $timeout(() => {
                    $scope.errorMessage = '';
                }, 3000);
                return;
            }
            
            // Validar tamaño (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
                console.warn('⚠️ Archivo muy grande:', file.name);
                $scope.$apply(() => {
                    $scope.errorMessage = `❌ La imagen "${file.name}" es demasiado grande (máximo 5MB)`;
                });
                $timeout(() => {
                    $scope.errorMessage = '';
                }, 3000);
                return;
            }
            
            console.log('✅ Procesando imagen válida:', file.name);
            
            // Leer la imagen como base64
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const base64String = e.target.result;
                
                console.log('✅ Imagen leída como base64');
                console.log('   Nombre:', file.name);
                console.log('   Tipo:', file.type);
                console.log('   Base64 length:', base64String.length);
                
                const imagen = {
                    nombre: file.name,
                    tipo: file.type,
                    tamano: formatBytes(file.size),
                    base64: base64String,
                    timestamp: new Date().toISOString()
                };
                
                $scope.$apply(() => {
                    $scope.imagenesAdjuntas.push(imagen);
                    
                    console.log('✅ Imagen agregada al array');
                    console.log('📊 Total imágenes adjuntas:', $scope.imagenesAdjuntas.length);
                    
                    $scope.successMessage = `✅ Imagen "${imagen.nombre}" agregada correctamente`;
                });
                
                $timeout(() => {
                    $scope.successMessage = '';
                }, 3000);
            };
            
            reader.onerror = function(error) {
                console.error('❌ Error al leer la imagen:', error);
                $scope.$apply(() => {
                    $scope.errorMessage = `❌ Error al leer la imagen "${file.name}"`;
                });
                $timeout(() => {
                    $scope.errorMessage = '';
                }, 3000);
            };
            
            // Leer como Data URL
            reader.readAsDataURL(file);
        });
    };

    /**
     * Elimina una imagen adjunta
     */
    $scope.eliminarImagen = function(index) {
        const imagen = $scope.imagenesAdjuntas[index];
        console.log('🗑️ Eliminando imagen:', imagen.nombre);
        
        $scope.imagenesAdjuntas.splice(index, 1);
        $scope.successMessage = `✅ Imagen "${imagen.nombre}" eliminada`;
        
        $timeout(() => {
            $scope.successMessage = '';
        }, 3000);
    };

    /**
     * Formatea bytes a tamaño legible
     */
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Abre el modal de vista previa de imágenes
     */
    $scope.abrirModalImagenes = function() {
        console.log('👁️ Abriendo modal de imágenes');
        $scope.showImageModal = true;
    };

    /**
     * Cierra el modal de imágenes
     */
    $scope.cerrarModalImagenes = function() {
        console.log('❌ Cerrando modal de imágenes');
        $scope.showImageModal = false;
    };

    // ═══════════════════════════════════════════════════
    // AGREGAR/QUITAR EQUIPOS REMOTOS
    // ═══════════════════════════════════════════════════

    $scope.agregarEquipoRemoto = function() {
        const nuevoEquipo = {
            ipEquipo: '',
            usuario: '',
            password: '',
            status: null // null, 'connecting', 'connected', 'disconnected'
        };

        $scope.equiposRemotos.push(nuevoEquipo);
    };

    $scope.quitarEquipoRemoto = function(index) {
        // Obtener el equipo antes de eliminarlo
        const equipoEliminado = $scope.equiposRemotos[index];
        
        // Remover el equipo del array principal
        $scope.equiposRemotos.splice(index, 1);
        
        // Si estaba conectado, removerlo también de equiposConectados
        if (equipoEliminado.ipEquipo) {
            const indexConectado = $scope.equiposConectados.findIndex(
                e => e.ipEquipo === equipoEliminado.ipEquipo
            );
            if (indexConectado !== -1) {
                $scope.equiposConectados.splice(indexConectado, 1);
                console.log('🗑️ Equipo eliminado de conectados:', equipoEliminado.ipEquipo);
            }
        }
        
        // Limpiar mensajes si no quedan equipos
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

        console.log('🔌 Validando conexión a:', equipo.ipEquipo);
        
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
            console.log('✅ Respuesta de validación:', response.data);
            
            if (response.data.success) {
                return $http.post(VALIDATION_API_URL + '/log-connection-event', {
                    ipEquipo: equipo.ipEquipo,
                    usuario: equipo.usuario,
                    password: equipo.password
                }).then(function(logResponse) {
                    console.log('📝 Event log registrado:', logResponse.data);
                    
                    equipo.status = 'connected';
                    
                    const hostname = response.data.output ? response.data.output.trim() : equipo.ipEquipo;
                    equipo.connectionMessage = `Conectado exitosamente al equipo: ${hostname}`;
                    
                    $scope.successMessage = `✅ Conexión exitosa con ${equipo.ipEquipo} (${hostname}) - Event Log registrado`;
                    
                    // Buscar si ya existe a conectados
                    const indexExistente = $scope.equiposConectados.findIndex(
                        e => e.ipEquipo === equipo.ipEquipo
                    );
                    
                    if (indexExistente !== -1) {
                        // Si esta existe, actualizar con las rutas más recientes
                        console.log('🔄 Actualizando equipo existente en conectados');
                        $scope.equiposConectados[indexExistente] = {
                            ipEquipo: equipo.ipEquipo,
                            usuario: equipo.usuario,
                            password: equipo.password,
                            rutaActual: equipo.rutaActual, 
                            rutaFutura: equipo.rutaFutura  
                        };
                    } else {
                        // Si no existe, agregar nuevo
                        console.log('➕ Agregando nuevo equipo a conectados');
                        $scope.equiposConectados.push({
                            ipEquipo: equipo.ipEquipo,
                            usuario: equipo.usuario,
                            password: equipo.password,
                            rutaActual: equipo.rutaActual, 
                            rutaFutura: equipo.rutaFutura   
                        });
                    }
                    
                    console.log('📋 Equipos conectados actuales:', $scope.equiposConectados);
                    
                    $timeout(() => {
                        $scope.successMessage = '';
                    }, 5000);
                    
                    return response;
                }).catch(function(logError) {
                    console.warn('⚠️ No se pudo registrar Event Log (no crítico):', logError);
                    equipo.status = 'connected';
                    
                    const hostname = response.data.output ? response.data.output.trim() : equipo.ipEquipo;
                    equipo.connectionMessage = `Conectado exitosamente al equipo: ${hostname}`;
                    
                    $scope.successMessage = `✅ Conexión exitosa con ${equipo.ipEquipo} (${hostname})`;
                    
                    // AGREGAR/ACTUALIZAR
                    const indexExistente = $scope.equiposConectados.findIndex(
                        e => e.ipEquipo === equipo.ipEquipo
                    );
                    
                    if (indexExistente !== -1) {
                        $scope.equiposConectados[indexExistente] = {
                            ipEquipo: equipo.ipEquipo,
                            usuario: equipo.usuario,
                            password: equipo.password,
                            rutaActual: equipo.rutaActual,
                            rutaFutura: equipo.rutaFutura
                        };
                    } else {
                        $scope.equiposConectados.push({
                            ipEquipo: equipo.ipEquipo,
                            usuario: equipo.usuario,
                            password: equipo.password,
                            rutaActual: equipo.rutaActual,
                            rutaFutura: equipo.rutaFutura
                        });
                    }
                    
                    $timeout(() => {
                        $scope.successMessage = '';
                    }, 5000);
                    
                    return response;
                });
            } else {
                equipo.status = 'disconnected';
                equipo.connectionMessage = null;
                $scope.errorMessage = `❌ Error de conexión con ${equipo.ipEquipo}: ${response.data.errorMessage || 'Conexión fallida'}`;
            }
        })
        .catch(function(error) {
            console.error('❌ Error en validación:', error);
            equipo.status = 'disconnected';
            equipo.connectionMessage = null;
            
            let errorMsg = `❌ No se pudo conectar a ${equipo.ipEquipo}`;
            if (error.status === -1) {
                errorMsg += ': Backend no disponible';
            } else if (error.data?.errorMessage) {
                errorMsg += ': ' + error.data.errorMessage;
            }
            
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

        // Extraer nombres de carpetas de las rutas locales
        const nombreActual = $scope.directory1Name;
        const nombreFutura = $scope.directory2Name;

        console.log('🔍 Buscando carpetas automáticamente en', equipo.ipEquipo);
        console.log('   📁 Buscando:', nombreActual);
        console.log('   📁 Buscando:', nombreFutura);

        equipo.searchingFolders = true;
        $scope.errorMessage = '';
        $scope.successMessage = '';

        // Buscar Versión Actual
        const busqueda1 = $http.post(VALIDATION_API_URL + '/search-directory-by-name', {
            ipEquipo: equipo.ipEquipo,
            usuario: equipo.usuario,
            password: equipo.password,
            nombreCarpeta: nombreActual
        });

        // Buscar Versión Futura
        const busqueda2 = $http.post(VALIDATION_API_URL + '/search-directory-by-name', {
            ipEquipo: equipo.ipEquipo,
            usuario: equipo.usuario,
            password: equipo.password,
            nombreCarpeta: nombreFutura
        });

        Promise.all([busqueda1, busqueda2])
            .then(function([resp1, resp2]) {
                equipo.searchingFolders = false;

                if (resp1.data.success && resp2.data.success) {
                    const result1 = JSON.parse(resp1.data.output);
                    const result2 = JSON.parse(resp2.data.output);

                    if (result1.Exists && result2.Exists) {
                        equipo.rutaActual = result1.Path;
                        equipo.rutaFutura = result2.Path;

                        $scope.successMessage = `✅ Carpetas encontradas en ${equipo.ipEquipo}:\n` +
                                              `📁 Actual: ${result1.Path} (${result1.ExeCount} archivos .exe)\n` +
                                              `📁 Futura: ${result2.Path} (${result2.ExeCount} archivos .exe)`;

                        console.log('✅ Rutas encontradas:');
                        console.log('   📁 Actual:', result1.Path);
                        console.log('   📁 Futura:', result2.Path);

                        $timeout(() => $scope.successMessage = '', 8000);
                    } else {
                        const faltantes = [];
                        if (!result1.Exists) faltantes.push(`"${nombreActual}"`);
                        if (!result2.Exists) faltantes.push(`"${nombreFutura}"`);

                        $scope.errorMessage = `❌ No se encontraron las carpetas en ${equipo.ipEquipo}: ${faltantes.join(', ')}`;
                        
                        console.warn('❌ Carpetas no encontradas:', faltantes);
                    }
                } else {
                    $scope.errorMessage = '❌ Error al buscar carpetas en el equipo remoto';
                }
            })
            .catch(function(error) {
                equipo.searchingFolders = false;
                console.error('❌ Error en búsqueda automática:', error);
                $scope.errorMessage = '❌ Error al buscar carpetas en el equipo remoto';
            });
    };


    // ═══════════════════════════════════════════════════
    // VALIDAR DIRECTORIO EN EQUIPOS REMOTOS
    // ═══════════════════════════════════════════════════

    $scope.validarDirectoriosRemotos = function(directorioLocal, tipoVersion) {
        if ($scope.equiposConectados.length === 0) {
            return Promise.resolve([]);
        }

        console.log('🔍 Validando directorio en equipos remotos:', directorioLocal);

        const promesasValidacion = $scope.equiposConectados.map(equipo => {
            // Priorizar rutas específicas del equipo
            let rutaRemota = null;
            
            if (tipoVersion === 'actual' && equipo.rutaActual) {
                rutaRemota = equipo.rutaActual;
            } else if (tipoVersion === 'futura' && equipo.rutaFutura) {
                rutaRemota = equipo.rutaFutura;
            }

            // Si no hay ruta específica, no validar (retornar como no existente)
            if (!rutaRemota) {
                console.warn(`⚠️ Equipo ${equipo.ipEquipo}: No tiene ruta configurada para "${tipoVersion}"`);
                console.warn(`   Usa el botón "🔍 Buscar Carpetas Automáticamente" para encontrarlas`);
                
                return Promise.resolve({
                    ipEquipo: equipo.ipEquipo,
                    existe: false,
                    exeCount: 0,
                    sinRutaConfigurada: true
                });
            }

            console.log(`   Validando en ${equipo.ipEquipo}: ${rutaRemota}`);

            return $http.post(VALIDATION_API_URL + '/validate-directory', {
                ipEquipo: equipo.ipEquipo,
                usuario: equipo.usuario,
                password: equipo.password,
                rutaDirectorio: rutaRemota
            })
            .then(response => {
                if (response.data.success) {
                    try {
                        const result = JSON.parse(response.data.output);
                        
                        if (result.Exists) {
                            console.log(`✅ Directorio existe en ${equipo.ipEquipo} (${result.ExeCount} archivos .exe)`);
                            return {
                                ipEquipo: equipo.ipEquipo,
                                usuario: equipo.usuario,
                                password: equipo.password,
                                rutaRemota: rutaRemota,
                                existe: true,
                                exeCount: result.ExeCount
                            };
                        } else {
                            console.log(`❌ Directorio NO existe en ${equipo.ipEquipo}: ${rutaRemota}`);
                            return {
                                ipEquipo: equipo.ipEquipo,
                                existe: false,
                                exeCount: 0
                            };
                        }
                    } catch (e) {
                        console.error(`Error parseando respuesta de ${equipo.ipEquipo}:`, e);
                        return { ipEquipo: equipo.ipEquipo, existe: false, error: true };
                    }
                }
                return { ipEquipo: equipo.ipEquipo, existe: false, exeCount: 0 };
            })
            .catch(error => {
                console.error(`❌ Error validando en ${equipo.ipEquipo}:`, error);
                return { ipEquipo: equipo.ipEquipo, existe: false, error: true };
            });
        });

        return Promise.all(promesasValidacion);
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
        
        // Limpiar motivo del cambio
        $scope.motivoCambio = '';
        
        $scope.imagenesAdjuntas = [];
        
        $scope.statistics = {
            total: 0,
            versionChanged: 0,
            sizeChanged: 0,
            noChanges: 0
        };
        
        $scope.errorMessage = '';
        $scope.successMessage = '';
        
        console.log('✅ Todo limpiado');
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
                const fullPath = result.fullPath;
                const folderName = result.folderName;
                
                $scope.$apply(() => {
                    if (folderNumber === 1) {
                        $scope.directory1 = fullPath;
                        $scope.directory1Name = folderName;
                    } else {
                        $scope.directory2 = fullPath;
                        $scope.directory2Name = folderName;
                    }
                });
            }
            
        } catch (error) {
            $scope.$apply(() => {
                $scope.errorMessage = '❌ Error: ' + error.message;
            });
        }
    };

    // ═══════════════════════════════════════════════════
    // BUSCAR Y VALIDAR CARPETAS REMOTAS AUTOMÁTICAMENTE
    // ═══════════════════════════════════════════════════

    $scope.buscarYValidarCarpetasRemotas = function() {
        if (!$scope.directory1Name || !$scope.directory2Name) {
            console.warn('⚠️ No hay nombres de carpetas locales definidos');
            return Promise.resolve();
        }

        const nombreActual = $scope.directory1Name;
        const nombreFutura = $scope.directory2Name;

        console.log('🔍 Buscando carpetas automáticamente:');
        console.log('   📁 Actual:', nombreActual);
        console.log('   📁 Futura:', nombreFutura);

        // Buscar en cada equipo conectado que NO tenga rutas configuradas
        const promesas = $scope.equiposConectados.map(equipo => {
            // Solo buscar si no tiene ambas rutas configuradas
            if (equipo.rutaActual && equipo.rutaFutura) {
                console.log(`✓ Equipo ${equipo.ipEquipo} ya tiene rutas configuradas`);
                return Promise.resolve();
            }

            console.log(`🔍 Buscando en ${equipo.ipEquipo}...`);

            // Buscar Versión Actual
            const busqueda1 = $http.post(VALIDATION_API_URL + '/search-directory-by-name', {
                ipEquipo: equipo.ipEquipo,
                usuario: equipo.usuario,
                password: equipo.password,
                nombreCarpeta: nombreActual
            });

            // Buscar Versión Futura
            const busqueda2 = $http.post(VALIDATION_API_URL + '/search-directory-by-name', {
                ipEquipo: equipo.ipEquipo,
                usuario: equipo.usuario,
                password: equipo.password,
                nombreCarpeta: nombreFutura
            });

            return Promise.all([busqueda1, busqueda2])
                .then(function([resp1, resp2]) {
                    if (resp1.data.success && resp2.data.success) {
                        try {
                            const result1 = JSON.parse(resp1.data.output);
                            const result2 = JSON.parse(resp2.data.output);

                            if (result1.Exists) {
                                equipo.rutaActual = result1.Path;
                                console.log(`   ✅ Actual encontrada: ${result1.Path}`);
                            } else {
                                console.warn(`   ❌ No se encontró: ${nombreActual}`);
                            }

                            if (result2.Exists) {
                                equipo.rutaFutura = result2.Path;
                                console.log(`   ✅ Futura encontrada: ${result2.Path}`);
                            } else {
                                console.warn(`   ❌ No se encontró: ${nombreFutura}`);
                            }

                            // Si encontró ambas, marcarlas visualmente
                            if (result1.Exists && result2.Exists) {
                                equipo.carpetasEncontradas = true;
                            }
                        } catch (e) {
                            console.error(`Error parseando respuesta de ${equipo.ipEquipo}:`, e);
                        }
                    }
                })
                .catch(function(error) {
                    console.error(`❌ Error buscando en ${equipo.ipEquipo}:`, error);
                });
        });

        return Promise.all(promesas);
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

        console.log('═══════════════════════════════════════════');
        console.log('🔍 INICIANDO ESCANEO Y COMPARACIÓN');
        console.log('═══════════════════════════════════════════');
        console.log('📁 Versión Actual:', $scope.directory1);
        console.log('📁 Versión Futura:', $scope.directory2);
        console.log('🖥️ Equipos conectados:', $scope.equiposConectados.length);

        const hasRemotes = $scope.equiposConectados.length > 0;

        if (hasRemotes) {
            console.log('🔍 Modo: ESCANEO CON EQUIPOS REMOTOS');
            
            const equiposSinRutas = $scope.equiposConectados.filter(e => !e.rutaActual || !e.rutaFutura);
            
            if (equiposSinRutas.length > 0) {
                console.warn('⚠️ Algunos equipos no tienen rutas configuradas:', equiposSinRutas);
                $scope.errorMessage = `⚠️ ${equiposSinRutas.length} equipo(s) sin rutas configuradas. Usa el botón "🔍 Buscar Carpetas Automáticamente" primero.`;
                $scope.isScanning = false;
                return;
            }

            console.log('✅ Todos los equipos tienen rutas configuradas');
            
            const equiposValidos = $scope.equiposConectados.map(equipo => ({
                ipEquipo: equipo.ipEquipo,
                usuario: equipo.usuario,
                password: equipo.password,
                rutaRemota: equipo.rutaActual,
                existe: true
            }));

            console.log('📋 Equipos válidos preparados:', equiposValidos.length);
            
            escanearConEquiposRemotos(equiposValidos);
        } else {
            console.log('🔍 Modo: ESCANEO LOCAL ÚNICAMENTE');
            escanearSoloLocal();
        }
    };

    /// ═══════════════════════════════════════════════════
    // ESCANEO SOLO LOCAL (PARA CAPTURAR TODOS LOS ARCHIVOS)
    // ═══════════════════════════════════════════════════

    function escanearSoloLocal() {
        console.log('🔍 Modo: ESCANEO COMPLETO (incluyendo carpetas sin coincidencia)');

        // Hacer dos escaneos separados en lugar de usar compare-smart
        const escaneoActual = $http.post(API_URL + '/scan', {
            directory: $scope.directory1,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        });

        const escaneoFutura = $http.post(API_URL + '/scan', {
            directory: $scope.directory2,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        });

        Promise.all([escaneoActual, escaneoFutura])
            .then(function([respActual, respFutura]) {
                console.log('✅ Escaneo completado');

                if (respActual.data.success && respFutura.data.success) {
                    $scope.file1Data = respActual.data.files || [];
                    $scope.file2Data = respFutura.data.files || [];
                    $scope.file1Count = $scope.file1Data.length;
                    $scope.file2Count = $scope.file2Data.length;

                    // Marcar con IP local
                    $scope.file1Data.forEach(f => {
                        f.sourceIp = $scope.ipLocal;
                        f.equiposIps = [$scope.ipLocal];
                    });
                    $scope.file2Data.forEach(f => {
                        f.sourceIp = $scope.ipLocal;
                        f.equiposIps = [$scope.ipLocal];
                    });

                    console.log(`📊 Archivos en Actual: ${$scope.file1Count}`);
                    console.log(`📊 Archivos en Futura: ${$scope.file2Count}`);

                    $scope.successMessage = `✅ Escaneo completado`;

                    // Generar tabla con validación
                    $scope.$apply(() => {
                        $scope.generateTableConValidacion();
                    });
                } else {
                    $scope.$apply(() => {
                        $scope.errorMessage = '❌ Error en el escaneo';
                    });
                }

                $scope.isScanning = false;
            })
            .catch(function(error) {
                console.error('❌ Error en escaneo:', error);
                
                $scope.$apply(() => {
                    $scope.errorMessage = '❌ Error al escanear directorios';
                    $scope.isScanning = false;
                });
            });
    }

    // ═══════════════════════════════════════════════════
    // ESCANEO CON EQUIPOS REMOTOS
    // ═══════════════════════════════════════════════════

    function escanearConEquiposRemotos(equiposValidos) {
        console.log('🌐 Modo: ESCANEO MULTI-EQUIPO');
        console.log('   Equipos válidos:', equiposValidos.length);

        const equiposConRutasActual = [];
        const equiposConRutasFutura = [];

        equiposValidos.forEach(equipo => {
            const equipoOriginal = $scope.equiposConectados.find(e => e.ipEquipo === equipo.ipEquipo);
            
            console.log(`📋 Equipo ${equipo.ipEquipo}:`, {
                rutaActual: equipoOriginal?.rutaActual,
                rutaFutura: equipoOriginal?.rutaFutura
            });
            
            if (equipoOriginal?.rutaActual) {
                equiposConRutasActual.push({
                    ipEquipo: equipo.ipEquipo,
                    usuario: equipo.usuario,
                    password: equipo.password,
                    rutaRemota: equipoOriginal.rutaActual  
                });
                console.log(`   ✅ Agregado a escaneo ACTUAL con ruta: ${equipoOriginal.rutaActual}`);
            } else {
                console.warn(`   ⚠️ No tiene ruta ACTUAL configurada`);
            }
            
            if (equipoOriginal?.rutaFutura) {
                equiposConRutasFutura.push({
                    ipEquipo: equipo.ipEquipo,
                    usuario: equipo.usuario,
                    password: equipo.password,
                    rutaRemota: equipoOriginal.rutaFutura
                });
                console.log(`   ✅ Agregado a escaneo FUTURA con ruta: ${equipoOriginal.rutaFutura}`);
            } else {
                console.warn(`   ⚠️ No tiene ruta FUTURA configurada`);
            }
        });

        console.log('📤 Equipos con ruta ACTUAL:', equiposConRutasActual.length);
        console.log('📤 Equipos con ruta FUTURA:', equiposConRutasFutura.length);

        if (equiposConRutasActual.length === 0 && equiposConRutasFutura.length === 0) {
            console.error('❌ No hay equipos remotos con rutas configuradas');
            $scope.errorMessage = '❌ Los equipos remotos no tienen rutas configuradas.';
            $scope.isScanning = false;
            $scope.$apply();
            return;
        }

        const promesa1 = $http.post(MULTI_EQUIPO_API_URL + '/scan', {
            directoryPath: $scope.directory1,
            equiposRemotos: equiposConRutasActual,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        }).catch(error => {
            console.error('❌ Error en escaneo Actual:', error);
            return { data: { success: false, message: error.message || 'Error desconocido' } };
        });

        const promesa2 = $http.post(MULTI_EQUIPO_API_URL + '/scan', {
            directoryPath: $scope.directory2,
            equiposRemotos: equiposConRutasFutura,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        }).catch(error => {
            console.error('❌ Error en escaneo Futura:', error);
            return { data: { success: false, message: error.message || 'Error desconocido' } };
        });

        Promise.all([promesa1, promesa2])
            .then(function(respuestas) {
                const [resp1, resp2] = respuestas;

                console.log('✅ Respuesta Actual:', resp1.data);
                console.log('✅ Respuesta Futura:', resp2.data);

                if (resp1.data.success && resp2.data.success) {
                    $scope.file1Data = resp1.data.archivosConsolidados || [];
                    $scope.file2Data = resp2.data.archivosConsolidados || [];
                    $scope.file1Count = $scope.file1Data.length;
                    $scope.file2Count = $scope.file2Data.length;

                    console.log('📊 Archivos Actual:', $scope.file1Count);
                    console.log('📊 Archivos Futura:', $scope.file2Count);

                    // GENERAR TABLA CON VALIDACIÓN
                    $scope.generateTableConValidacion();
                } else {
                    const error = resp1.data.message || resp2.data.message || 'Error en escaneo multi-equipo';
                    console.error('❌ Error:', error);
                    
                    $scope.$apply(() => {
                        $scope.errorMessage = '❌ ' + error;
                    });
                }

                $scope.isScanning = false;
                $scope.$apply();
            })
            .catch(function(error) {
                console.error('❌ Error en escaneo multi-equipo:', error);
                
                $scope.$apply(() => {
                    $scope.errorMessage = '❌ Error al escanear equipos remotos: ' + (error.message || 'Error desconocido');
                    $scope.isScanning = false;
                });
            });
    }

    // ═══════════════════════════════════════════════════
    // GENERAR TABLA CON VALIDACIÓN
    // ═══════════════════════════════════════════════════

    $scope.generateTableConValidacion = function() {
        console.log('🔍 Iniciando generación de tabla con validación...');
        
        // Validación de versiones menores
        const archivosConVersionMenor = $scope.validarVersionesMenores();
        
        if (archivosConVersionMenor.length > 0) {
            console.warn('⚠️ Se encontraron versiones futuras menores que las actuales');
            
            // Mostrar alerta y esperar respuesta del usuario
            $scope.mostrarAlertaVersionesMenores(archivosConVersionMenor)
                .then(function(continuarGeneracion) {
                    if (continuarGeneracion) {
                        console.log('✅ Usuario confirmó continuar a pesar de las versiones menores');
                        $scope.generateTable();
                        $scope.$apply();
                    } else {
                        console.log('❌ Usuario canceló la generación de la matriz');
                        $scope.errorMessage = '⚠️ Generación de matriz cancelada por el usuario debido a versiones futuras menores';
                        $scope.$apply();
                    }
                });
        } else {
            // No hay versiones menores, generar tabla directamente
            console.log('✅ No se encontraron versiones menores, generando tabla...');
            $scope.generateTable();
        }
    };

    /**
     * Valida si hay versiones futuras menores que las actuales
     * @returns {Array} Array de archivos con versiones problemáticas
     */
    $scope.validarVersionesMenores = function() {
        const archivosConVersionMenor = [];
        
        if (!$scope.file1Data || !$scope.file2Data) {
            return archivosConVersionMenor;
        }
        
        console.log('🔍 Validando versiones futuras menores que actuales...');
        
        $scope.file2Data.forEach(archivoFutura => {
            const nombreNormalizado = archivoFutura.nameNormalized;
            
            const archivoActual = $scope.file1Data.find(f => 
                f.nameNormalized === nombreNormalizado
            );
            
            if (archivoActual) {
                const versionActual = archivoActual.version;
                const versionFutura = archivoFutura.version;
                
                if (compararVersiones(versionFutura, versionActual) < 0) {
                    archivosConVersionMenor.push({
                        nombre: archivoFutura.name,
                        versionActual: versionActual,
                        versionFutura: versionFutura,
                        ruta: archivoFutura.relativePath
                    });
                    
                    console.warn(`⚠️ ${archivoFutura.name}: Futura (${versionFutura}) < Actual (${versionActual})`);
                }
            }
        });
        
        return archivosConVersionMenor;
    };

    /**
     * Compara dos versiones en formato "X.Y.Z.W"
     * @param {string} v1 - Primera versión
     * @param {string} v2 - Segunda versión
     * @returns {number} -1 si v1 < v2, 0 si son iguales, 1 si v1 > v2
     */
    function compararVersiones(v1, v2) {
        const partes1 = v1.split('.').map(Number);
        const partes2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(partes1.length, partes2.length); i++) {
            const num1 = partes1[i] || 0;
            const num2 = partes2[i] || 0;
            
            if (num1 < num2) return -1;
            if (num1 > num2) return 1;
        }
        
        return 0;
    }

    /**
     * Muestra el modal de confirmación de versiones menores
     * @param {Array} archivosProblematicos - Lista de archivos con versiones menores
     * @returns {Promise<boolean>} true si el usuario acepta continuar
     */
    $scope.mostrarAlertaVersionesMenores = function(archivosProblematicos) {
        return new Promise((resolve) => {
            let mensaje = `⚠️ ADVERTENCIA: Se encontraron ${archivosProblematicos.length} archivo(s) con versión futura MENOR que la actual:\n\n`;
            
            archivosProblematicos.forEach((archivo, index) => {
                if (index < 10) {
                    mensaje += `📄 ${archivo.nombre}\n`;
                    mensaje += `   Actual: ${archivo.versionActual} → Futura: ${archivo.versionFutura}\n\n`;
                }
            });
            
            if (archivosProblematicos.length > 10) {
                mensaje += `... y ${archivosProblematicos.length - 10} archivo(s) más.\n\n`;
            }
            
            mensaje += `¿Desea continuar con la generación de la matriz resultante?`;
            
            const continuar = confirm(mensaje);
            resolve(continuar);
        });
    };

    // ═══════════════════════════════════════════════════
// GENERAR TABLA DE COMPARACIÓN
// ═══════════════════════════════════════════════════

$scope.generateTable = function() {
    console.log('═══════════════════════════════════════════');
    console.log('📊 GENERANDO MATRIZ DE COMPARACIÓN');
    console.log('═══════════════════════════════════════════');
    console.log('📁 Archivos en Versión Actual:', $scope.file1Data.length);
    console.log('📁 Archivos en Versión Futura:', $scope.file2Data.length);

    if (!$scope.file1Data || !$scope.file2Data) {
        console.error('❌ Datos insuficientes para generar la tabla');
        $scope.errorMessage = '❌ No hay datos para comparar';
        return;
    }

    const tableData = [];
    const archivosSinCoincidencia = [];
    const statistics = {
        total: 0,
        versionChanged: 0,
        sizeChanged: 0,
        noChanges: 0
    };

    console.log('\n🔍 Procesando archivos de Versión Futura...\n');

    // Procesar cada archivo de la Versión Futura
    $scope.file2Data.forEach(archivoFutura => {
        const nombreNormalizado = archivoFutura.nameNormalized;

        const archivoActual = $scope.file1Data.find(f => 
            f.nameNormalized === nombreNormalizado
        );

        if (archivoActual) {
            const versionChanged = archivoActual.version !== archivoFutura.version;
            const sizeChanged = archivoActual.sizeBytes !== archivoFutura.sizeBytes;
            const versionMenor = compararVersiones(archivoFutura.version, archivoActual.version) < 0;

            const row = {
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
            };

            tableData.push(row);
            
            if (versionChanged) statistics.versionChanged++;
            if (sizeChanged) statistics.sizeChanged++;
            if (!versionChanged && !sizeChanged) statistics.noChanges++;

            console.log(`✅ ${archivoFutura.name} - CON COINCIDENCIA`);
        } else {
            const archivoSinCoincidencia = {
                name: archivoFutura.name,
                equipos: (archivoFutura.equiposIps || [$scope.ipLocal]).join(', '),
                equiposArray: archivoFutura.equiposIps || [$scope.ipLocal],
                version: archivoFutura.version,
                peso: archivoFutura.size,
                ubicacion: archivoFutura.fullPath || archivoFutura.relativePath
            };

            archivosSinCoincidencia.push(archivoSinCoincidencia);
            console.log(`🆕 ${archivoFutura.name} - SIN COINCIDENCIA`);
        }
    });

    statistics.total = tableData.length;

    // Asignar a las variables del scope
    $scope.tableData = tableData;
    $scope.archivosSinCoincidencia = archivosSinCoincidencia;
    $scope.statistics = statistics;
    $scope.showTable = true;
    
    
    // HABILITAR TEXTAREA 
    // USAR TEXTAREA NATIVA DE ELECTRON
$scope.abrirTextareaNativa = function() {
    console.log('🪟 Abriendo textarea nativa de Electron');
    
    if (!window.electronAPI || !window.electronAPI.openNativeTextarea) {
        console.error('❌ electronAPI.openNativeTextarea no está disponible');
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
            console.log('✅ Texto capturado:', result);
            
            $scope.$apply(function() {
                $scope.motivoCambio = result;
                $scope.successMessage = '✅ Motivo guardado correctamente';
            });
            
            $timeout(function() {
                $scope.successMessage = '';
            }, 3000);
        } else {
            console.log('❌ Usuario canceló la entrada');
        }
    })
    .catch(function(error) {
        console.error('❌ Error al abrir textarea nativa:', error);
        $scope.$apply(function() {
            $scope.errorMessage = '❌ Error al abrir el campo de texto';
        });
    });
};

// ABRIR AUTOMÁTICAMENTE AL GENERAR TABLA
$scope.$evalAsync(function() {
    $timeout(function() {
        console.log('🎯 Auto-abriendo textarea nativa después de generar tabla');
        $scope.abrirTextareaNativa();
    }, 500);
});
    
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ MATRIZ GENERADA');
    console.log('═══════════════════════════════════════════');
    console.log('📊 Estadísticas:');
    console.log(`   Total en matriz principal: ${statistics.total}`);
    console.log(`   🆕 Archivos sin coincidencia: ${archivosSinCoincidencia.length}`);
    console.log(`   Con cambios: ${statistics.versionChanged}`);
    console.log(`   Sin cambios: ${statistics.noChanges}`);
    console.log('═══════════════════════════════════════════\n');

    if (archivosSinCoincidencia.length > 0) {
        console.log('\n📋 ARCHIVOS SIN COINCIDENCIA:');
        archivosSinCoincidencia.forEach((archivo, index) => {
            console.log(`   ${index + 1}. ${archivo.name} - v${archivo.version} - ${archivo.peso}`);
            console.log(`      Ubicación: ${archivo.ubicacion}`);
        });
    }
};



    // ═══════════════════════════════════════════════════
    // GENERAR PDF CON LOGO E IMÁGENES ADJUNTAS
    // ═══════════════════════════════════════════════════

    $scope.generatePDF = function() {
        if (!$scope.tableData || $scope.tableData.length === 0) {
            $scope.errorMessage = '❌ No hay datos para exportar';
            return;
        }

        // Filtrar solo archivos con cambios
        const archivosConCambios = $scope.tableData.filter(item => {
            const existeEnAmbas = item.existeEnActual && item.existeEnFutura;
            if (!existeEnAmbas) return true;
            return item.versionChanged === true || item.sizeChanged === true;
        });

        console.log('═══════════════════════════════════════════');
        console.log('📄 GENERANDO PDF CON CAMBIOS ÚNICAMENTE');
        console.log(`✅ Archivos con cambios: ${archivosConCambios.length}`);
        console.log(`📸 Imágenes adjuntas: ${$scope.imagenesAdjuntas.length}`);

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

        // HELPER PARA COLORES
        const applyColor = (colorArray) => {
            if (Array.isArray(colorArray) && colorArray.length === 3) {
                return [colorArray[0], colorArray[1], colorArray[2]];
            }
            return [0, 0, 0];
        };

        // FUNCIÓN PARA AGREGAR FOOTER EN CADA PÁGINA
        const addFooter = (pageNumber, totalPages) => {
            const footerY = pageHeight - 15;
            
            // Línea separadora
            const lineDrawColor = applyColor(footerStyles.line.drawColor);
            doc.setDrawColor(lineDrawColor[0], lineDrawColor[1], lineDrawColor[2]);
            doc.setLineWidth(footerStyles.line.lineWidth);
            doc.line(dims.margin, footerY - 5, pageWidth - dims.margin, footerY - 5);
            
            // Texto izquierdo
            doc.setFontSize(footerStyles.info.fontSize);
            const infoColor = applyColor(footerStyles.info.textColor);
            doc.setTextColor(infoColor[0], infoColor[1], infoColor[2]);
            doc.setFont(undefined, footerStyles.info.fontStyle);
            doc.text('F2X - Ficha Técnica', dims.margin, footerY);
            
            // Número de página
            doc.setFontSize(footerStyles.highlight.fontSize);
            const highlightColor = applyColor(footerStyles.highlight.textColor);
            doc.setTextColor(highlightColor[0], highlightColor[1], highlightColor[2]);
            doc.setFont(undefined, footerStyles.highlight.fontStyle);
            doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - dims.margin, footerY, { align: 'right' });
            
            // Texto secundario
            doc.setFontSize(footerStyles.info.fontSize);
            doc.setTextColor(infoColor[0], infoColor[1], infoColor[2]);
            doc.setFont(undefined, footerStyles.info.fontStyle);
            doc.text('Desarrollado por Flytech Simplexity', dims.margin, footerY + 4);
            
            // Copyright
            doc.setFontSize(footerStyles.copyright.fontSize);
            const copyrightColor = applyColor(footerStyles.copyright.textColor);
            doc.setTextColor(copyrightColor[0], copyrightColor[1], copyrightColor[2]);
            doc.setFont(undefined, footerStyles.copyright.fontStyle);
            doc.text(
                `© ${new Date().getFullYear()} Todos los derechos reservados`, 
                pageWidth - dims.margin, 
                footerY + 4, 
                { align: 'right' }
            );
        };

        // ========== ENCABEZADO ==========
        const bgColor = applyColor(headerStyles.background.fillColor);
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(0, 0, pageWidth, headerStyles.background.height, 'F');

        const lineColor = applyColor(headerStyles.line.fillColor);
        doc.setFillColor(lineColor[0], lineColor[1], lineColor[2]);
        doc.rect(0, headerStyles.background.height, pageWidth, headerStyles.line.height, 'F');

        const logoX = 20;
        const logoY = 12;

        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('F2X', logoX, logoY + 10);

        doc.setFontSize(9);
        doc.setTextColor(190, 214, 47);
        doc.setFont(undefined, 'normal');
        doc.text('Flytech Simplexity', logoX, logoY + 17);

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('Ficha Técnica - Reporte de Cambios', logoX, logoY + 25);

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

        const fechaGeneracion = `Fecha de generación: ${day}/${month}/${year} ${hours12}:${minutes} ${ampm}`;

        doc.text(fechaGeneracion, pageWidth - 15, 15, { align: 'right' });


        // ========== INFORMACIÓN DE DIRECTORIOS ==========
        let currentY = 55;

        const dirColor = applyColor(directoryStyles.fillColor);
        doc.setFillColor(dirColor[0], dirColor[1], dirColor[2]);
        doc.roundedRect(
            dims.margin, 
            currentY, 
            pageWidth - (dims.margin * 2), 
            directoryStyles.height, 
            directoryStyles.borderRadius, 
            directoryStyles.borderRadius, 
            'F'
        );

        doc.setFontSize(directoryStyles.label.fontSize);
        const labelColor = applyColor(directoryStyles.label.textColor);
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFont(undefined, directoryStyles.label.fontStyle);
        doc.text('Versión Actual:', 18, currentY + 7);
        
        doc.setFont(undefined, directoryStyles.text.fontStyle);
        doc.setFontSize(directoryStyles.text.fontSize);
        const textColor = applyColor(directoryStyles.text.textColor);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        
        const maxWidth = pageWidth - 80;
        const dir1Lines = doc.splitTextToSize($scope.directory1, maxWidth);
        doc.text(dir1Lines, 18, currentY + 12);

        doc.setFontSize(directoryStyles.label.fontSize);
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFont(undefined, directoryStyles.label.fontStyle);
        doc.text('Versión Futura:', 18, currentY + 18);
        
        doc.setFont(undefined, directoryStyles.text.fontStyle);
        doc.setFontSize(directoryStyles.text.fontSize);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        const dir2Lines = doc.splitTextToSize($scope.directory2, maxWidth);
        doc.text(dir2Lines, 18, currentY + 23);

        currentY += 32;

        // ========== MOTIVO DEL CAMBIO ==========
        if ($scope.motivoCambio && $scope.motivoCambio.trim() !== '') {
            doc.setFillColor(255, 248, 220);
            doc.roundedRect(
                dims.margin, 
                currentY, 
                pageWidth - (dims.margin * 2), 
                'auto',
                3, 
                3, 
                'F'
            );

            doc.setFillColor(190, 214, 47);
            doc.rect(dims.margin, currentY, 4, 20, 'F');

            doc.setFontSize(10);
            doc.setTextColor(102, 102, 102);
            doc.setFont(undefined, 'bold');
            doc.text('📝 Motivo del Cambio:', 23, currentY + 7);

            doc.setFontSize(9);
            doc.setTextColor(51, 51, 51);
            doc.setFont(undefined, 'normal');
            const motivoLines = doc.splitTextToSize($scope.motivoCambio, pageWidth - 50);
            doc.text(motivoLines, 23, currentY + 13);

            const motivoHeight = Math.max(20, (motivoLines.length * 4.5) + 10);
            
            doc.setFillColor(255, 248, 220);
            doc.roundedRect(
                dims.margin, 
                currentY, 
                pageWidth - (dims.margin * 2), 
                motivoHeight, 
                3, 
                3, 
                'F'
            );
            
            doc.setFillColor(190, 214, 47);
            doc.rect(dims.margin, currentY, 4, motivoHeight, 'F');
            
            doc.setFontSize(10);
            doc.setTextColor(102, 102, 102);
            doc.setFont(undefined, 'bold');
            doc.text('📝 Motivo del Cambio:', 23, currentY + 7);
            
            doc.setFontSize(9);
            doc.setTextColor(51, 51, 51);
            doc.setFont(undefined, 'normal');
            doc.text(motivoLines, 23, currentY + 13);

            currentY += motivoHeight + 8;
        }

        // ========== CONTINÚA CON LA TABLA ==========
        doc.setFontSize(PdfStylesService.fontSizes.sectionTitle);
        const darkColor = applyColor(colors.F2X_DARK);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont(undefined, 'bold');
        doc.text('Detalle de Archivos con Cambios', dims.margin, currentY);
        
        currentY += 3;

        // ========== TABLA ==========
        const headers = [
            ["Archivo", "Equipo / IP", "Versión Actual", "Peso Actual", "Versión Futura", "Peso Futuro", "Ubicación"]
        ];
        
        const body = archivosConCambios.map(item => {
            return [
                item.name,
                item.equipos || '-',
                item.versionActual || '-',
                item.pesoActual || '-',
                item.versionFutura || '-',
                item.pesoFuturo || '-',
                item.ruta || ''
            ];
        });

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
                    if (rowData.changeType === 'only-local') {
                        data.cell.styles.fillColor = [227, 242, 253];
                    } else if (rowData.changeType === 'only-remote') {
                        data.cell.styles.fillColor = [255, 243, 224];
                    } else if (rowData.changeType === 'has-changes') {
                        data.cell.styles.fillColor = [255, 248, 225];
                    }
                }
            },
            didDrawPage: function(data) {
                const totalPages = doc.internal.getNumberOfPages();
                addFooter(data.pageNumber, totalPages);
            }
        });

        // ========== RESUMEN EN LA ÚLTIMA PÁGINA ==========
        let finalY = doc.lastAutoTable.finalY + 5;
        
        const lineDrawColor = applyColor(footerStyles.line.drawColor);
        doc.setDrawColor(lineDrawColor[0], lineDrawColor[1], lineDrawColor[2]);
        doc.setLineWidth(footerStyles.line.lineWidth);
        doc.line(dims.margin, finalY, pageWidth - dims.margin, finalY);
        
        doc.setFontSize(footerStyles.summary.fontSize);
        const summaryColor = applyColor(footerStyles.summary.textColor);
        doc.setTextColor(summaryColor[0], summaryColor[1], summaryColor[2]);
        doc.setFont(undefined, footerStyles.summary.fontStyle);
        
        const resumenTexto = `Total de archivos comparados: ${$scope.tableData.length} | ` +
                            `Archivos con cambios: ${archivosConCambios.length} | ` +
                            `Cambios de versión: ${$scope.statistics.versionChanged} | ` +
                            `Cambios de tamaño: ${$scope.statistics.sizeChanged} | ` +
                            `Sin cambios (excluidos del reporte): ${$scope.statistics.noChanges}`;
        
        const resumenLines = doc.splitTextToSize(resumenTexto, pageWidth - (dims.margin * 2));
        doc.text(resumenLines, dims.margin, finalY + 6);
        
        finalY += 15;

        // ========== SECCIÓN DE IMÁGENES ADJUNTAS ==========
        if ($scope.imagenesAdjuntas.length > 0) {
            console.log(`📸 Agregando ${$scope.imagenesAdjuntas.length} imagen(es) al PDF`);
            
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
                    
                    console.log(`✅ Imagen ${index + 1} agregada: ${imagen.nombre}`);
                } catch (error) {
                    console.error(`❌ Error al agregar imagen ${index + 1}:`, error);
                }
            });
        }

        // ========== GUARDAR ==========
        const nombreArchivo = PdfStylesService.generateFileName($scope.directory1Name, $scope.directory2Name);
        doc.save(nombreArchivo);
        
        $scope.successMessage = `✅ PDF generado: ${nombreArchivo} (${archivosConCambios.length} archivos${$scope.imagenesAdjuntas.length > 0 ? `, ${$scope.imagenesAdjuntas.length} imagen(es)` : ''})`;
        console.log(`✅ PDF generado exitosamente`);
        
        $timeout(() => $scope.successMessage = '', 4000);
    };
}]);