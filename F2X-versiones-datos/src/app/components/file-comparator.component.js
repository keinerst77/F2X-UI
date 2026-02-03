angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout', 'PdfStylesService',
function($scope, $http, $timeout, PdfStylesService) {
    
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
    
    // ⭐ NUEVO: Un solo array de equipos remotos
    $scope.equiposRemotos = [];
    $scope.showEquiposRemotos = false;
    $scope.equiposConectados = []; // Equipos con conexión validada
    
    $scope.tableData = [];
    $scope.statistics = {
        total: 0,
        versionChanged: 0,
        sizeChanged: 0,
        noChanges: 0,
        onlyLocal: 0,
        onlyRemote: 0,
        enAmbos: 0
    };
    
    $scope.showTable = false;
    $scope.errorMessage = '';
    $scope.successMessage = '';
    $scope.isScanning = false;

    const API_URL = 'https://localhost:7000/api/versionscanner';
    const MULTI_EQUIPO_API_URL = 'https://localhost:7000/api/multiequiposcan';
    const VALIDATION_API_URL = 'https://localhost:7000/api/powershellremotetest';

    // Detectar si Electron está disponible
    const isElectron = window.electronAPI !== undefined;
    console.log('🖥️ Ejecutando en Electron:', isElectron);


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
        // Remover el equipo del array principal
        const equipoEliminado = $scope.equiposRemotos[index];
        $scope.equiposRemotos.splice(index, 1);
        
        // Si estaba conectado, removerlo también de equiposConectados
        const indexConectado = $scope.equiposConectados.findIndex(
            e => e.ipEquipo === equipoEliminado.ipEquipo
        );
        if (indexConectado !== -1) {
            $scope.equiposConectados.splice(indexConectado, 1);
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

    // Llamar al endpoint de validación simple
    $http.post(VALIDATION_API_URL + '/test-simple', {
        ipEquipo: equipo.ipEquipo,
        usuario: equipo.usuario,
        password: equipo.password
    })
    .then(function(response) {
        console.log('✅ Respuesta de validación:', response.data);
        
        if (response.data.success) {
            // Registrar en Event Log del equipo remoto
            return $http.post(VALIDATION_API_URL + '/log-connection-event', {
                ipEquipo: equipo.ipEquipo,
                usuario: equipo.usuario,
                password: equipo.password
            }).then(function(logResponse) {
                console.log('📝 Event log registrado:', logResponse.data);
                
                equipo.status = 'connected';
                
                // Obtener el hostname del output
                const hostname = response.data.output ? response.data.output.trim() : equipo.ipEquipo;
                
                // Mensaje de confirmación personalizado
                equipo.connectionMessage = `Conectado exitosamente al equipo: ${hostname}`;
                
                $scope.successMessage = `✅ Conexión exitosa con ${equipo.ipEquipo} (${hostname}) - Event Log registrado`;
                
                // Agregar a la lista de equipos conectados si no existe
                const yaExiste = $scope.equiposConectados.some(
                    e => e.ipEquipo === equipo.ipEquipo
                );
                
                if (!yaExiste) {
                    $scope.equiposConectados.push({
                        ipEquipo: equipo.ipEquipo,
                        usuario: equipo.usuario,
                        password: equipo.password
                    });
                }
                
                // Limpiar mensaje de éxito después de 5 segundos
                $timeout(() => {
                    $scope.successMessage = '';
                }, 5000);
                
                console.log('✅ Equipo agregado a lista de conectados:', equipo.ipEquipo);
                
                return response; // Retornar la respuesta original
            }).catch(function(logError) {
                console.warn('⚠️ No se pudo registrar Event Log (no crítico):', logError);
                // Aunque falle el log, la conexión fue exitosa
                equipo.status = 'connected';
                
                const hostname = response.data.output ? response.data.output.trim() : equipo.ipEquipo;
                equipo.connectionMessage = `Conectado exitosamente al equipo: ${hostname}`;
                
                $scope.successMessage = `✅ Conexión exitosa con ${equipo.ipEquipo} (${hostname})`;
                
                const yaExiste = $scope.equiposConectados.some(
                    e => e.ipEquipo === equipo.ipEquipo
                );
                
                if (!yaExiste) {
                    $scope.equiposConectados.push({
                        ipEquipo: equipo.ipEquipo,
                        usuario: equipo.usuario,
                        password: equipo.password
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
    // LIMPIAR DIRECTORIOS
    // ═══════════════════════════════════════════════════

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
    // ⭐ ESCANEAR Y COMPARAR (UNIFICADO)
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

        // Determinar si hay equipos remotos conectados
        const hasRemotes = $scope.equiposConectados.length > 0;

        if (hasRemotes) {
            // Escaneo con equipos remotos
            escanearConEquiposRemotos();
        } else {
            // Escaneo solo local
            escanearSoloLocal();
        }
    };


    // ═══════════════════════════════════════════════════
    // ESCANEO SOLO LOCAL
    // ═══════════════════════════════════════════════════

    function escanearSoloLocal() {
        console.log('🔍 Modo: ESCANEO LOCAL ÚNICAMENTE');

        // Escanear Versión Actual
        const promesa1 = $http.post(API_URL + '/scan', {   
            directory: $scope.directory1,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        });

        // Escanear Versión Futura
        const promesa2 = $http.post(API_URL + '/scan', {   
            directory: $scope.directory2,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        });

        // Esperar ambos escaneos
        Promise.all([promesa1, promesa2])
            .then(function(respuestas) {
                const [resp1, resp2] = respuestas;

                console.log('✅ Escaneo Actual completado:', resp1.data.files?.length || 0, 'archivos');
                console.log('✅ Escaneo Futura completado:', resp2.data.files?.length || 0, 'archivos');

                if (resp1.data.success && resp2.data.success) {
                    $scope.file1Data = resp1.data.files || [];
                    $scope.file2Data = resp2.data.files || [];
                    $scope.file1Count = $scope.file1Data.length;
                    $scope.file2Count = $scope.file2Data.length;

                    // Marcar como LOCAL
                    $scope.file1Data.forEach(f => {
                        f.sourceIp = 'LOCAL';
                        f.equiposIps = ['LOCAL'];
                    });
                    $scope.file2Data.forEach(f => {
                        f.sourceIp = 'LOCAL';
                        f.equiposIps = ['LOCAL'];
                    });

                    // Generar comparación automáticamente
                    $scope.generateTable();
                } else {
                    const error = resp1.data.error || resp2.data.error || 'Error al escanear';
                    $scope.errorMessage = '❌ ' + error;
                }

                $scope.isScanning = false;
            })
            .catch(function(error) {
                console.error('❌ Error en escaneo:', error);
                $scope.errorMessage = '❌ Error al escanear directorios locales';
                $scope.isScanning = false;
            });
    }


    // ═══════════════════════════════════════════════════
    // ESCANEO CON EQUIPOS REMOTOS
    // ═══════════════════════════════════════════════════

    function escanearConEquiposRemotos() {
        console.log('🌐 Modo: ESCANEO MULTI-EQUIPO');
        console.log('   Equipos:', $scope.equiposConectados.length);

        // Escanear Versión Actual (local + remotos)
        const promesa1 = $http.post(MULTI_EQUIPO_API_URL + '/scan', {
            directoryPath: $scope.directory1,
            equiposRemotos: $scope.equiposConectados,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        });

        // Escanear Versión Futura (local + remotos)
        const promesa2 = $http.post(MULTI_EQUIPO_API_URL + '/scan', {
            directoryPath: $scope.directory2,
            equiposRemotos: $scope.equiposConectados,
            includeSubdirectories: true,
            searchPattern: '*.exe'
        });

        // Esperar ambos escaneos
        Promise.all([promesa1, promesa2])
            .then(function(respuestas) {
                const [resp1, resp2] = respuestas;

                console.log('✅ Escaneo Multi-Equipo Actual:', resp1.data.archivosConsolidados?.length || 0, 'archivos');
                console.log('✅ Escaneo Multi-Equipo Futura:', resp2.data.archivosConsolidados?.length || 0, 'archivos');

                if (resp1.data.success && resp2.data.success) {
                    $scope.file1Data = resp1.data.archivosConsolidados || [];
                    $scope.file2Data = resp2.data.archivosConsolidados || [];
                    $scope.file1Count = $scope.file1Data.length;
                    $scope.file2Count = $scope.file2Data.length;

                    // Generar comparación automáticamente
                    $scope.generateTable();
                } else {
                    const error = resp1.data.message || resp2.data.message || 'Error en escaneo multi-equipo';
                    $scope.errorMessage = '❌ ' + error;
                }

                $scope.isScanning = false;
            })
            .catch(function(error) {
                console.error('❌ Error en escaneo multi-equipo:', error);
                $scope.errorMessage = '❌ Error al escanear equipos remotos';
                $scope.isScanning = false;
            });
    }


    // ═══════════════════════════════════════════════════
    // GENERAR TABLA DE COMPARACIÓN
    // ═══════════════════════════════════════════════════

    $scope.generateTable = function() {
        if (!$scope.file1Data || !$scope.file2Data) {
            $scope.errorMessage = '❌ No hay datos para comparar';
            return;
        }

        $scope.tableData = [];
        $scope.statistics = { 
            total: 0, 
            versionChanged: 0, 
            sizeChanged: 0, 
            noChanges: 0,
            onlyLocal: 0,
            onlyRemote: 0,
            enAmbos: 0
        };

        console.log('═══════════════════════════════════════════');
        console.log('📊 GENERANDO COMPARACIÓN');
        console.log('═══════════════════════════════════════════');
        
        // Crear mapas
        const file1Map = new Map();
        const file2Map = new Map();
        
        $scope.file1Data.forEach(f => file1Map.set(f.nameNormalized, f));
        $scope.file2Data.forEach(f => file2Map.set(f.nameNormalized, f));
        
        // Obtener TODOS los nombres únicos
        const allFileNames = new Set([
            ...$scope.file1Data.map(f => f.nameNormalized),
            ...$scope.file2Data.map(f => f.nameNormalized)
        ]);

        console.log('📋 Total nombres únicos:', allFileNames.size);
        
        // Procesar cada archivo
        allFileNames.forEach(normalizedName => {
            const fileActual = file1Map.get(normalizedName);
            const fileFutura = file2Map.get(normalizedName);
            
            const existeEnActual = fileActual !== undefined;
            const existeEnFutura = fileFutura !== undefined;

            // Consolidar equipos de ambas versiones
            let equiposArray = [];

            if (existeEnActual && fileActual.equiposIps) {
                equiposArray.push(...fileActual.equiposIps);
            }

            if (existeEnFutura && fileFutura.equiposIps) {
                fileFutura.equiposIps.forEach(ip => {
                    if (!equiposArray.includes(ip)) {
                        equiposArray.push(ip);
                    }
                });
            }
            
            // Datos de versiones y pesos
            const versionActual = existeEnActual ? fileActual.version : '-';
            const versionFutura = existeEnFutura ? fileFutura.version : '-';
            const pesoActual = existeEnActual ? fileActual.size : '-';
            const pesoFuturo = existeEnFutura ? fileFutura.size : '-';
            
            // Detectar cambios
            let versionChanged = false;
            let sizeChanged = false;

            if (existeEnActual && existeEnFutura) {
                versionChanged = fileActual.version !== fileFutura.version;
                sizeChanged = fileActual.sizeBytes !== fileFutura.sizeBytes;
            }
            
            // Tipo de cambio
            let changeType = 'no-changes';
            if (!existeEnActual && existeEnFutura) {
                changeType = 'only-remote';
            } else if (existeEnActual && !existeEnFutura) {
                changeType = 'only-local';
            } else if (versionChanged || sizeChanged) {
                changeType = 'has-changes';
            }

            const nombre = existeEnActual ? fileActual.name : fileFutura.name;
            const ruta = existeEnActual ? fileActual.fullPath : fileFutura.fullPath;
            
            $scope.tableData.push({
                name: nombre,
                equipos: equiposArray.join(', '),
                equiposArray: equiposArray,
                versionActual: versionActual,
                pesoActual: pesoActual,
                versionFutura: versionFutura,
                pesoFuturo: pesoFuturo,
                ruta: ruta,
                versionChanged: versionChanged,
                sizeChanged: sizeChanged,
                existeEnActual: existeEnActual,
                existeEnFutura: existeEnFutura,
                changeType: changeType
            });
            
            // Estadísticas
            $scope.statistics.total++;

            if (!existeEnActual && existeEnFutura) {
                $scope.statistics.onlyRemote++;
            } else if (existeEnActual && !existeEnFutura) {
                $scope.statistics.onlyLocal++;
            } else {
                $scope.statistics.enAmbos++;
                if (versionChanged) $scope.statistics.versionChanged++;
                if (sizeChanged) $scope.statistics.sizeChanged++;
                if (!versionChanged && !sizeChanged) $scope.statistics.noChanges++;
            }
        });
        
        // Ordenar alfabéticamente
        $scope.tableData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        if ($scope.tableData.length === 0) {
            $scope.errorMessage = '❌ No hay archivos para comparar';
            $scope.showTable = false;
            return;
        }

        $scope.showTable = true;
        $scope.successMessage = `✅ Comparación completada: ${$scope.tableData.length} archivo(s)`;

        console.log('📊 ESTADÍSTICAS:', $scope.statistics);
        console.log('═══════════════════════════════════════════');
        
        $timeout(() => {
            document.querySelector('.table-wrapper')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        $timeout(() => $scope.successMessage = '', 5000);
    };


    // ═══════════════════════════════════════════════════
    // RESET
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
        $scope.equiposRemotos = [];
        $scope.showEquiposRemotos = false;
        $scope.equiposConectados = [];
        $scope.tableData = [];
        $scope.statistics = { total: 0, versionChanged: 0, sizeChanged: 0, noChanges: 0, onlyLocal: 0, onlyRemote: 0, enAmbos: 0 };
        $scope.showTable = false;
        $scope.errorMessage = '';
        $scope.successMessage = '';
    };


    // ═══════════════════════════════════════════════════
    // GENERAR PDF (sin cambios significativos)
    // ═══════════════════════════════════════════════════

    $scope.generatePDF = function() {
        if (!$scope.tableData || $scope.tableData.length === 0) {
            $scope.errorMessage = '❌ No hay datos para exportar';
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

        // ========== ENCABEZADO ==========
        doc.setFillColor(...headerStyles.background.fillColor);
        doc.rect(0, 0, pageWidth, headerStyles.background.height, 'F');
        
        doc.setFillColor(...headerStyles.line.fillColor);
        doc.rect(0, headerStyles.background.height, pageWidth, headerStyles.line.height, 'F');

        doc.setFontSize(headerStyles.logo.fontSize);
        doc.setTextColor(...headerStyles.logo.textColor);
        doc.setFont(undefined, headerStyles.logo.fontStyle);
        doc.text('F2X', headerStyles.logo.position.x, headerStyles.logo.position.y);
        
        doc.setFontSize(headerStyles.logoSubtitle.fontSize);
        doc.setTextColor(...headerStyles.logoSubtitle.textColor);
        doc.setFont(undefined, headerStyles.logoSubtitle.fontStyle);
        doc.text('Flytech Simplexity', headerStyles.logoSubtitle.position.x, headerStyles.logoSubtitle.position.y);

        doc.setFontSize(headerStyles.title.fontSize);
        doc.setTextColor(...headerStyles.title.textColor);
        doc.setFont(undefined, headerStyles.title.fontStyle);
        doc.text('Ficha Técnica', headerStyles.title.position.x, headerStyles.title.position.y);

        doc.setFontSize(headerStyles.date.fontSize);
        doc.setTextColor(...headerStyles.date.textColor);
        doc.setFont(undefined, headerStyles.date.fontStyle);
        doc.text(
            `Fecha de generación: ${PdfStylesService.formatDate()}`, 
            pageWidth - dims.margin, 
            headerStyles.date.position.y, 
            { align: headerStyles.date.align }
        );

        // ========== INFORMACIÓN DE DIRECTORIOS ==========
        let currentY = 55;

        doc.setFillColor(...directoryStyles.fillColor);
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
        doc.setTextColor(...directoryStyles.label.textColor);
        doc.setFont(undefined, directoryStyles.label.fontStyle);
        doc.text('Versión Actual:', 18, currentY + 7);
        
        doc.setFont(undefined, directoryStyles.text.fontStyle);
        doc.setFontSize(directoryStyles.text.fontSize);
        doc.setTextColor(...directoryStyles.text.textColor);
        
        const maxWidth = pageWidth - 80;
        const dir1Lines = doc.splitTextToSize($scope.directory1, maxWidth);
        doc.text(dir1Lines, 18, currentY + 12);

        doc.setFontSize(directoryStyles.label.fontSize);
        doc.setTextColor(...directoryStyles.label.textColor);
        doc.setFont(undefined, directoryStyles.label.fontStyle);
        doc.text('Versión Futura:', 18, currentY + 18);
        
        doc.setFont(undefined, directoryStyles.text.fontStyle);
        doc.setFontSize(directoryStyles.text.fontSize);
        doc.setTextColor(...directoryStyles.text.textColor);
        const dir2Lines = doc.splitTextToSize($scope.directory2, maxWidth);
        doc.text(dir2Lines, 18, currentY + 23);

        currentY += 32;

        doc.setFontSize(PdfStylesService.fontSizes.sectionTitle);
        doc.setTextColor(...colors.F2X_DARK);
        doc.setFont(undefined, 'bold');
        doc.text('Detalle de Archivos Comparados', dims.margin, currentY);
        
        currentY += 3;

        // ========== TABLA ==========
        const headers = [
            ["Archivo", "Equipo / IP", "Versión Actual", "Peso Actual", "Versión Futura", "Peso Futuro", "Ubicación"]
        ];
        
        const body = $scope.tableData.map(item => {
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
            didParseCell: function(data) {
                if (data.section === 'body') {
                    const rowData = $scope.tableData[data.row.index];
                    if (rowData.changeType === 'only-local') {
                        data.cell.styles.fillColor = [227, 242, 253];
                    } else if (rowData.changeType === 'only-remote') {
                        data.cell.styles.fillColor = [255, 243, 224];
                    } else if (rowData.changeType === 'has-changes') {
                        data.cell.styles.fillColor = [255, 248, 225];
                    }
                }
            }
        });

        // ========== PIE DE PÁGINA ==========
        const finalY = doc.lastAutoTable.finalY + 10;
        
        doc.setDrawColor(...footerStyles.line.drawColor);
        doc.setLineWidth(footerStyles.line.lineWidth);
        doc.line(dims.margin, finalY, pageWidth - dims.margin, finalY);
        
        doc.setFontSize(footerStyles.summary.fontSize);
        doc.setTextColor(...footerStyles.summary.textColor);
        doc.setFont(undefined, footerStyles.summary.fontStyle);
        
        const resumenTexto = PdfStylesService.getSummaryText($scope.statistics);
        const resumenLines = doc.splitTextToSize(resumenTexto, pageWidth - (dims.margin * 2));
        doc.text(resumenLines, dims.margin, finalY + 6);
        
        const resumenHeight = resumenLines.length * 4; 
        const footerStartY = finalY + 6 + resumenHeight + 8; 
        const footerY = Math.max(footerStartY, pageHeight - 15);
        
        doc.setFontSize(footerStyles.info.fontSize);
        doc.setTextColor(...footerStyles.info.textColor);
        doc.setFont(undefined, footerStyles.info.fontStyle);
        doc.text('F2X - Ficha Técnica', dims.margin, footerY);
        
        doc.setFontSize(footerStyles.highlight.fontSize);
        doc.setTextColor(...footerStyles.highlight.textColor);
        doc.setFont(undefined, footerStyles.highlight.fontStyle);
        doc.text(`Página 1 de 1`, pageWidth - dims.margin, footerY, { align: 'right' });
        
        doc.setFontSize(footerStyles.info.fontSize);
        doc.setTextColor(...footerStyles.info.textColor);
        doc.setFont(undefined, footerStyles.info.fontStyle);
        doc.text('Desarrollado por Flytech Simplexity', dims.margin, footerY + 4);
        
        doc.setFontSize(footerStyles.copyright.fontSize);
        doc.setTextColor(...footerStyles.copyright.textColor);
        doc.setFont(undefined, footerStyles.copyright.fontStyle);
        doc.text(
            `(c) ${new Date().getFullYear()} Todos los derechos reservados`, 
            pageWidth - dims.margin, 
            footerY + 4, 
            { align: 'right' }
        );

        // ========== GUARDAR ==========
        const nombreArchivo = PdfStylesService.generateFileName($scope.directory1Name, $scope.directory2Name);
        doc.save(nombreArchivo);
        
        $scope.successMessage = `✅ PDF generado: ${nombreArchivo}`;
        $timeout(() => $scope.successMessage = '', 4000);
    };
}]);