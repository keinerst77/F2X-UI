angular.module('fileComparatorApp')
.service('PdfStylesService', function() {
    
    // ═══════════════════════════════════════════════════
    // COLORES
    // ═══════════════════════════════════════════════════
    
    this.colors = {
        F2X_GREEN: [190, 214, 47],
        F2X_DARK: [56, 56, 56],
        WHITE: [255, 255, 255],
        BLACK: [0, 0, 0],
        GRAY_LIGHT: [245, 247, 250],
        GRAY_TEXT: [102, 102, 102],
        BLUE_LIGHT: [227, 242, 253],
        ORANGE_LIGHT: [255, 243, 224],
        YELLOW_LIGHT: [255, 248, 225]
    };
    
    // ═══════════════════════════════════════════════════
    // DIMENSIONES
    // ═══════════════════════════════════════════════════
    
    this.dimensions = {
        margin: 15,
        headerHeight: 40,
        lineHeight: 4,
        sectionGap: 10
    };
    
    // ═══════════════════════════════════════════════════
    // TAMAÑOS DE FUENTE
    // ═══════════════════════════════════════════════════
    
    this.fontSizes = {
        title: 24,
        subtitle: 14,
        sectionTitle: 16,
        normal: 11,
        small: 9,
        tiny: 8
    };
    
    // ═══════════════════════════════════════════════════
    // ESTILOS DE ENCABEZADO
    // ═══════════════════════════════════════════════════
    
    this.getHeaderStyles = function() {
    return {
        background: {
            fillColor: this.colors.F2X_DARK,
            height: 40
        },
        line: {
            fillColor: this.colors.F2X_GREEN,
            height: 3
        },
        logo: {
            fontSize: 28,
            textColor: this.colors.WHITE,
            fontStyle: 'bold',
            position: { x: 20, y: 28 }
        },
        logoSubtitle: {
            fontSize: 10,
            textColor: this.colors.F2X_GREEN,
            fontStyle: 'normal',
            position: { x: 20, y: 34 }
        },
        title: {
            fontSize: 18, 
            textColor: this.colors.WHITE,
            fontStyle: 'bold',
            position: { x: 148, y: 25 }  
        },
        date: {
            fontSize: 9,
            textColor: [200, 200, 200],
            fontStyle: 'normal',
            position: { y: 35 },
            align: 'right'
        }
    };
};
    
    // ═══════════════════════════════════════════════════
    // ESTILOS DE TARJETAS DE DIRECTORIO
    // ═══════════════════════════════════════════════════
    
    this.getDirectoryCardStyles = function() {
        return {
            fillColor: this.colors.GRAY_LIGHT,
            height: 28,
            borderRadius: 3,
            label: {
                fontSize: 10,
                textColor: this.colors.GRAY_TEXT,
                fontStyle: 'bold'
            },
            text: {
                fontSize: 9,
                textColor: this.colors.F2X_DARK,
                fontStyle: 'normal'
            }
        };
    };
    
    // ═══════════════════════════════════════════════════
    // ESTILOS DE TABLA
    // ═══════════════════════════════════════════════════
    
    this.getTableStyles = function() {
        return {
            theme: 'grid',
            headStyles: {
                fillColor: this.colors.F2X_DARK,
                textColor: this.colors.WHITE,
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                cellPadding: 4
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: this.colors.F2X_DARK,
                lineColor: [224, 224, 224],
                lineWidth: 0.1
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            }
        };
    };
    
    // ═══════════════════════════════════════════════════
    // ESTILOS DE PIE DE PÁGINA
    // ═══════════════════════════════════════════════════
    
    this.getFooterStyles = function() {
        return {
            line: {
                drawColor: [200, 200, 200],
                lineWidth: 0.5
            },
            summary: {
                fontSize: 10,
                textColor: this.colors.GRAY_TEXT,
                fontStyle: 'normal'
            },
            info: {
                fontSize: 9,
                textColor: this.colors.GRAY_TEXT,
                fontStyle: 'normal'
            },
            highlight: {
                fontSize: 9,
                textColor: this.colors.F2X_DARK,
                fontStyle: 'bold'
            },
            copyright: {
                fontSize: 8,
                textColor: [150, 150, 150],
                fontStyle: 'italic'
            }
        };
    };
    
    // ═══════════════════════════════════════════════════
    // UTILIDADES
    // ═══════════════════════════════════════════════════
    
    /**
     * Formatea la fecha actual
     */
    this.formatDate = function() {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };
    
    /**
     * Genera el texto de resumen de estadísticas
     */
    this.getSummaryText = function(statistics) {
        return `Resumen: ${statistics.total} archivo(s) total | ` +
               `${statistics.enAmbos} en ambas versiones | ` +
               `${statistics.onlyLocal} solo en actual | ` +
               `${statistics.onlyRemote} solo en futura | ` +
               `${statistics.versionChanged} con cambios de versión | ` +
               `${statistics.sizeChanged} con cambios de tamaño | ` +
               `${statistics.noChanges} sin cambios`;
    };
    
    /**
     * Genera el nombre del archivo PDF
     */
    this.generateFileName = function(dir1Name, dir2Name) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const name1 = dir1Name ? dir1Name.replace(/[^a-z0-9]/gi, '_') : 'VersionActual';
        const name2 = dir2Name ? dir2Name.replace(/[^a-z0-9]/gi, '_') : 'VersionFutura';
        
        return `FichaTecnica_${name1}_vs_${name2}_${timestamp}.pdf`;
    };
});