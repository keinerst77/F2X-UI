angular.module('fileComparatorApp')
    .service('PdfStylesService', [function() {
        
        // ========== COLORES F2X ==========
        this.colors = {
            F2X_GREEN: [190, 214, 47],
            F2X_DARK: [56, 56, 56],
            F2X_LIGHT_GREEN: [249, 251, 231],
            WHITE: [255, 255, 255],
            GRAY_TEXT: [102, 102, 102],
            GRAY_LIGHT: [224, 224, 224],
            ORANGE: [255, 152, 0],
            BLUE: [33, 150, 243],
            RED: [255, 87, 34],
            ORANGE_LIGHT: [255, 248, 225],
            BLUE_LIGHT: [227, 242, 253],
            ORANGE_LIGHTER: [255, 243, 224]
        };

        // ========== TAMAÑOS DE FUENTE ==========
        this.fontSizes = {
            logoTitle: 36,
            logoSubtitle: 10,
            reportTitle: 22,
            headerInfo: 9,
            sectionTitle: 12,
            cardLabel: 8,
            cardValue: 18,
            tableHeader: 9,
            tableBody: 8,
            tableFooter: 7,
            footer: 7,
            footerSmall: 6,
            directoryLabel: 10,
            directoryText: 9
        };

        // ========== DIMENSIONES ==========
        this.dimensions = {
            headerHeight: 45,
            headerLineHeight: 3,
            cardWidth: 65,
            cardHeight: 18,
            cardSpacing: 5,
            directoryCardHeight: 24,
            margin: 14,
            borderRadius: 2
        };

        // ========== ESTILOS DE ENCABEZADO ==========
        this.getHeaderStyles = function() {
            return {
                background: {
                    fillColor: this.colors.F2X_DARK,
                    height: this.dimensions.headerHeight
                },
                line: {
                    fillColor: this.colors.F2X_GREEN,
                    height: this.dimensions.headerLineHeight
                },
                logo: {
                    fontSize: this.fontSizes.logoTitle,
                    textColor: this.colors.WHITE,
                    fontStyle: 'bold',
                    position: { x: 14, y: 20 }
                },
                logoSubtitle: {
                    fontSize: this.fontSizes.logoSubtitle,
                    textColor: this.colors.F2X_GREEN,
                    fontStyle: 'normal',
                    position: { x: 14, y: 27 }
                },
                title: {
                    fontSize: this.fontSizes.reportTitle,
                    textColor: this.colors.WHITE,
                    fontStyle: 'bold',
                    position: { x: 14, y: 40 }
                },
                date: {
                    fontSize: this.fontSizes.headerInfo,
                    textColor: this.colors.F2X_LIGHT_GREEN,
                    fontStyle: 'normal',
                    align: 'right',
                    position: { y: 15 }
                }
            };
        };

        // ========== ESTILOS DE TARJETA DE DIRECTORIOS ==========
        this.getDirectoryCardStyles = function() {
            return {
                fillColor: this.colors.F2X_LIGHT_GREEN,
                height: this.dimensions.directoryCardHeight,
                borderRadius: this.dimensions.borderRadius,
                label: {
                    fontSize: this.fontSizes.directoryLabel,
                    textColor: this.colors.F2X_DARK,
                    fontStyle: 'bold'
                },
                text: {
                    fontSize: this.fontSizes.directoryText,
                    textColor: this.colors.GRAY_TEXT,
                    fontStyle: 'normal'
                }
            };
        };

        // ========== ESTILOS DE TARJETAS DE ESTADÍSTICAS ==========
        this.getStatsCardStyles = function() {
            return [
                { 
                    label: 'Total Archivos', 
                    color: this.colors.F2X_DARK
                },
                { 
                    label: 'Cambios Version', 
                    color: this.colors.ORANGE
                },
                { 
                    label: 'Cambios Peso', 
                    color: this.colors.BLUE
                },
                { 
                    label: 'Sin Cambios', 
                    color: this.colors.F2X_GREEN
                }
            ];
        };

        // ========== ESTILOS DE TABLA ==========
        this.getTableStyles = function() {
            return {
                theme: 'grid',
                headStyles: { 
                    fillColor: this.colors.F2X_DARK,
                    textColor: this.colors.WHITE,
                    fontSize: this.fontSizes.tableHeader,
                    fontStyle: 'bold',
                    halign: 'center',
                    cellPadding: 3
                },
                bodyStyles: { 
                    fontSize: this.fontSizes.tableBody,
                    cellPadding: 2.5,
                    lineColor: this.colors.GRAY_LIGHT,
                    lineWidth: 0.1,
                    overflow: 'linebreak',
                    fillColor: this.colors.WHITE  // Color por defecto (filas impares)
                },
                columnStyles: {
                    0: { 
                        cellWidth: 50, 
                        fontStyle: 'bold', 
                        textColor: this.colors.F2X_DARK 
                    },
                    1: { 
                        halign: 'center', 
                        cellWidth: 25 
                    },
                    2: { 
                        halign: 'center', 
                        cellWidth: 22 
                    },
                    3: { 
                        halign: 'center', 
                        cellWidth: 20 
                    },
                    4: { 
                        halign: 'center', 
                        cellWidth: 22 
                    },
                    5: { 
                        halign: 'center', 
                        cellWidth: 20 
                    },
                    6: { 
                        cellWidth: 'auto', 
                        fontSize: this.fontSizes.tableFooter, 
                        textColor: this.colors.GRAY_TEXT 
                    }
                },
                alternateRowStyles: {
                    fillColor: [235, 235, 235]  // Gris más oscuro para mayor contraste
                }
            };
        };

        // ========== ESTILOS DE PIE DE PÁGINA ==========
        this.getFooterStyles = function() {
            return {
                line: {
                    drawColor: this.colors.F2X_GREEN,
                    lineWidth: 0.5
                },
                summary: {
                    fontSize: this.fontSizes.tableBody + 1,
                    textColor: this.colors.F2X_DARK,
                    fontStyle: 'normal'
                },
                info: {
                    fontSize: this.fontSizes.footer,
                    textColor: this.colors.GRAY_TEXT,
                    fontStyle: 'normal'
                },
                highlight: {
                    fontSize: this.fontSizes.footer,
                    textColor: this.colors.F2X_GREEN,
                    fontStyle: 'normal'
                },
                copyright: {
                    fontSize: this.fontSizes.footerSmall,
                    textColor: this.colors.GRAY_TEXT,
                    fontStyle: 'normal'
                }
            };
        };

        // ========== OBTENER COLOR SEGÚN TIPO DE CAMBIO ==========
        this.getChangeColor = function(changeType) {
            switch(changeType) {
                case 'version_and_size':
                    return this.colors.RED;
                case 'version':
                    return this.colors.ORANGE;
                case 'size':
                    return this.colors.BLUE;
                default:
                    return this.colors.F2X_GREEN;
            }
        };

        // ========== OBTENER COLOR DE FONDO SEGÚN TIPO DE CAMBIO ==========
        this.getChangeBgColor = function(changeType) {
            switch(changeType) {
                case 'version_and_size':
                    return this.colors.ORANGE_LIGHTER;
                case 'version':
                    return this.colors.ORANGE_LIGHT;
                case 'size':
                    return this.colors.BLUE_LIGHT;
                default:
                    return null;
            }
        };

        // ========== GENERAR ENCABEZADOS DE TABLA ==========
        this.getTableHeaders = function() {
            return [
                ["Archivo", "Equipo", "Versión Actual", "Peso Actual", "Versión Futura", "Peso Futuro", "Ubicación"]
            ];
        };

        // ========== FORMATEAR FECHA ==========
        this.formatDate = function() {
            return new Date().toLocaleString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // ========== GENERAR NOMBRE DE ARCHIVO ==========
        this.generateFileName = function(dir1Name, dir2Name) {
            const timestamp = new Date().toISOString().slice(0, 10);
            return `F2X_Comparacion_${dir1Name}_vs_${dir2Name}_${timestamp}.pdf`;
        };

        // ========== GENERAR TEXTO DE RESUMEN ==========
        this.getSummaryText = function(statistics) {
            return `Se analizaron ${statistics.total} archivos ejecutables. ` +
                   `Se detectaron ${statistics.versionChanged} cambios de version y ` +
                   `${statistics.sizeChanged} cambios de tamano. ` +
                   `${statistics.noChanges} archivos permanecen sin modificaciones.`;
        };

        // ========== DETERMINAR TIPO DE CAMBIO ==========
        this.getChangeType = function(versionChanged, sizeChanged) {
            if (versionChanged && sizeChanged) {
                return 'version_and_size';
            } else if (versionChanged) {
                return 'version';
            } else if (sizeChanged) {
                return 'size';
            } else {
                return 'no_change';
            }
        };

        // ========== OBTENER TEXTO DE ESTADO ==========
        this.getStatusText = function(changeType) {
            switch(changeType) {
                case 'version_and_size':
                    return 'Version y Peso';
                case 'version':
                    return 'Version';
                case 'size':
                    return 'Peso';
                default:
                    return 'Sin cambios';
            }
        };

    }]);