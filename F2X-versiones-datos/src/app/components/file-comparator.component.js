angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout', 'PdfStylesService',
function($scope, $http, $timeout, PdfStylesService) {
    
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

// Función para Generar el Reporte PDF (versión refactorizada)
$scope.generatePDF = function() {
    if (!$scope.tableData || $scope.tableData.length === 0) {
        $scope.errorMessage = '❌ No hay datos para exportar';
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Obtener estilos del servicio
    const colors = PdfStylesService.colors;
    const headerStyles = PdfStylesService.getHeaderStyles();
    const directoryStyles = PdfStylesService.getDirectoryCardStyles();
    const statsCards = PdfStylesService.getStatsCardStyles();
    const tableStyles = PdfStylesService.getTableStyles();
    const footerStyles = PdfStylesService.getFooterStyles();
    const dims = PdfStylesService.dimensions;

    // ========== ENCABEZADO CON LOGO Y DISEÑO MODERNO ==========
    
    // Fondo superior
    doc.setFillColor(...headerStyles.background.fillColor);
    doc.rect(0, 0, pageWidth, headerStyles.background.height, 'F');
    
    // Línea verde
    doc.setFillColor(...headerStyles.line.fillColor);
    doc.rect(0, headerStyles.background.height, pageWidth, headerStyles.line.height, 'F');

    // Logo F2X (texto estilizado)
    doc.setFontSize(headerStyles.logo.fontSize);
    doc.setTextColor(...headerStyles.logo.textColor);
    doc.setFont(undefined, headerStyles.logo.fontStyle);
    doc.text('F2X', headerStyles.logo.position.x, headerStyles.logo.position.y);
    
    // Subtítulo del logo
    doc.setFontSize(headerStyles.logoSubtitle.fontSize);
    doc.setTextColor(...headerStyles.logoSubtitle.textColor);
    doc.setFont(undefined, headerStyles.logoSubtitle.fontStyle);
    doc.text('Flytech Simplexity', headerStyles.logoSubtitle.position.x, headerStyles.logoSubtitle.position.y);

    // Título del reporte
    doc.setFontSize(headerStyles.title.fontSize);
    doc.setTextColor(...headerStyles.title.textColor);
    doc.setFont(undefined, headerStyles.title.fontStyle);
    doc.text('Reporte de Comparación de Versiones', headerStyles.title.position.x, headerStyles.title.position.y);

    // Fecha de generación
    doc.setFontSize(headerStyles.date.fontSize);
    doc.setTextColor(...headerStyles.date.textColor);
    doc.setFont(undefined, headerStyles.date.fontStyle);
    doc.text(
        `Fecha de generación: ${PdfStylesService.formatDate()}`, 
        pageWidth - dims.margin, 
        headerStyles.date.position.y, 
        { align: headerStyles.date.align }
    );

    // ========== SECCIÓN DE INFORMACIÓN ==========
    
    let currentY = 55;

    // Tarjeta de información de directorios
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

    // Versión Actual
    doc.setFontSize(directoryStyles.label.fontSize);
    doc.setTextColor(...directoryStyles.label.textColor);
    doc.setFont(undefined, directoryStyles.label.fontStyle);
    doc.text('Version Actual:', 18, currentY + 7);
    
    doc.setFont(undefined, directoryStyles.text.fontStyle);
    doc.setFontSize(directoryStyles.text.fontSize);
    doc.setTextColor(...directoryStyles.text.textColor);
    
    const maxWidth = pageWidth - 80;
    const dir1Lines = doc.splitTextToSize($scope.directory1, maxWidth);
    doc.text(dir1Lines, 18, currentY + 12);

    // Versión Futura
    doc.setFontSize(directoryStyles.label.fontSize);
    doc.setTextColor(...directoryStyles.label.textColor);
    doc.setFont(undefined, directoryStyles.label.fontStyle);
    doc.text('Version Futura:', 18, currentY + 18);
    
    doc.setFont(undefined, directoryStyles.text.fontStyle);
    doc.setFontSize(directoryStyles.text.fontSize);
    doc.setTextColor(...directoryStyles.text.textColor);
    const dir2Lines = doc.splitTextToSize($scope.directory2, maxWidth);
    doc.text(dir2Lines, 18, currentY + 23);

    currentY += 32;

    // ========== ESTADÍSTICAS DESTACADAS ==========
    
    const statsY = currentY;

    statsCards.forEach((stat, index) => {
        const x = dims.margin + (dims.cardWidth + dims.cardSpacing) * index;
        
        // Tarjeta con fondo blanco
        doc.setFillColor(...colors.WHITE);
        doc.roundedRect(x, statsY, dims.cardWidth, dims.cardHeight, dims.borderRadius, dims.borderRadius, 'F');
        
        // Borde de color
        doc.setDrawColor(...stat.color);
        doc.setLineWidth(1);
        doc.roundedRect(x, statsY, dims.cardWidth, dims.cardHeight, dims.borderRadius, dims.borderRadius, 'S');
        
        // Etiqueta
        doc.setFontSize(PdfStylesService.fontSizes.cardLabel);
        doc.setTextColor(...colors.GRAY_TEXT);
        doc.setFont(undefined, 'normal');
        doc.text(stat.label, x + dims.cardWidth/2, statsY + 7, { align: 'center' });
        
        // Valor
        doc.setFontSize(PdfStylesService.fontSizes.cardValue);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...stat.color);
        
        const value = index === 0 ? $scope.statistics.total :
                      index === 1 ? $scope.statistics.versionChanged :
                      index === 2 ? $scope.statistics.sizeChanged :
                      $scope.statistics.noChanges;
        
        doc.text(String(value), x + dims.cardWidth/2, statsY + 14, { align: 'center' });
    });

    currentY = statsY + 25;

    // ========== TÍTULO DE TABLA ==========
    
    doc.setFontSize(PdfStylesService.fontSizes.sectionTitle);
    doc.setTextColor(...colors.F2X_DARK);
    doc.setFont(undefined, 'bold');
    doc.text('Detalle de Archivos Comparados', dims.margin, currentY);
    
    currentY += 3;

    // ========== TABLA DE DATOS ==========
    
    const headers = PdfStylesService.getTableHeaders();
    
    const body = $scope.tableData.map(item => {
        const changeType = PdfStylesService.getChangeType(item.versionChanged, item.sizeChanged);
        const estado = PdfStylesService.getStatusText(changeType);
        
        return [
            item.name,
            item.versionActual || 'N/A',
            item.pesoActual,
            item.versionFutura || 'N/A',
            item.pesoFuturo,
            estado,
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
        columnStyles: tableStyles.columnStyles,
        alternateRowStyles: tableStyles.alternateRowStyles,
        didParseCell: function(data) {
            // Colorear la columna de estado según el tipo de cambio
            if (data.section === 'body' && data.column.index === 5) {
                const cellText = data.cell.raw;
                let changeType = 'no_change';
                
                if (cellText.includes('Version y Peso')) {
                    changeType = 'version_and_size';
                } else if (cellText === 'Version') {
                    changeType = 'version';
                } else if (cellText === 'Peso') {
                    changeType = 'size';
                }
                
                data.cell.styles.textColor = PdfStylesService.getChangeColor(changeType);
            }
            
            // Resaltar filas con cambios
            if (data.section === 'body') {
                const estado = body[data.row.index][5];
                let changeType = 'no_change';
                
                if (estado.includes('Version y Peso')) {
                    changeType = 'version_and_size';
                } else if (estado === 'Version') {
                    changeType = 'version';
                } else if (estado === 'Peso') {
                    changeType = 'size';
                }
                
                const bgColor = PdfStylesService.getChangeBgColor(changeType);
                if (bgColor) {
                    data.cell.styles.fillColor = bgColor;
                }
            }
        }
    });

    // ========== PIE DE PÁGINA ==========
    
    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Línea decorativa
    doc.setDrawColor(...footerStyles.line.drawColor);
    doc.setLineWidth(footerStyles.line.lineWidth);
    doc.line(dims.margin, finalY, pageWidth - dims.margin, finalY);
    
    // Resumen textual
    doc.setFontSize(footerStyles.summary.fontSize);
    doc.setTextColor(...footerStyles.summary.textColor);
    doc.setFont(undefined, footerStyles.summary.fontStyle);
    
    const resumenTexto = PdfStylesService.getSummaryText($scope.statistics);
    const resumenLines = doc.splitTextToSize(resumenTexto, pageWidth - (dims.margin * 2));
    doc.text(resumenLines, dims.margin, finalY + 6);
    
    // Información adicional en el pie
    const footerY = pageHeight - 12;
    
    doc.setFontSize(footerStyles.info.fontSize);
    doc.setTextColor(...footerStyles.info.textColor);
    doc.setFont(undefined, footerStyles.info.fontStyle);
    doc.text('F2X - Versión de Datos v1.2.0', dims.margin, footerY);
    doc.text('Desarrollado por Flytech Simplexity', dims.margin, footerY + 4);
    
    doc.setFontSize(footerStyles.highlight.fontSize);
    doc.setTextColor(...footerStyles.highlight.textColor);
    doc.setFont(undefined, footerStyles.highlight.fontStyle);
    doc.text(`Pagina 1 de 1`, pageWidth - dims.margin, footerY, { align: 'right' });
    
    doc.setFontSize(footerStyles.copyright.fontSize);
    doc.setTextColor(...footerStyles.copyright.textColor);
    doc.setFont(undefined, footerStyles.copyright.fontStyle);
    doc.text(
        `(c) ${new Date().getFullYear()} Todos los derechos reservados`, 
        pageWidth - dims.margin, 
        footerY + 4, 
        { align: 'right' }
    );

    // ========== GUARDAR ARCHIVO ==========
    
    const nombreArchivo = PdfStylesService.generateFileName($scope.directory1Name, $scope.directory2Name);
    doc.save(nombreArchivo);
    
    $scope.successMessage = `✅ PDF generado: ${nombreArchivo}`;
    $timeout(() => $scope.successMessage = '', 4000);
};
}]);