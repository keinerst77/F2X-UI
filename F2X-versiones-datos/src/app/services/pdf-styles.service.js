angular.module('fileComparatorApp')
.service('PdfStylesService', function() {
    
    // ═══════════════════════════════════════════════════
    // COLORES
    // ═══════════════════════════════════════════════════
    
    this.colors = {
        // Encabezado
        F2X_GREEN:      [190, 214, 47],   
        F2X_DARK:       [56, 56, 56],     
        WHITE:          [255, 255, 255],

        // Paleta monocromática para el resto del documento
        BLACK:          [20, 20, 20],     
        GRAY_900:       [70, 70, 70],     
        GRAY_700:       [80, 80, 80],     
        GRAY_500:       [120, 120, 120],  
        GRAY_200:       [220, 220, 220],  
        GRAY_100:       [245, 245, 245],  
        GRAY_50:        [250, 250, 250],  
        GRAY_TEXT:      [100, 100, 100], 

        // Colores de estado de fila
        BLUE_LIGHT:     [235, 235, 235],  
        ORANGE_LIGHT:   [225, 225, 225],  
        YELLOW_LIGHT:   [240, 240, 240]   
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
            fillColor: this.colors.GRAY_100,       
            height: 28,
            borderRadius: 3,
            label: {
                fontSize: 10,
                textColor: this.colors.GRAY_700,   
                fontStyle: 'bold'
            },
            text: {
                fontSize: 9,
                textColor: this.colors.BLACK,      
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
                fillColor: this.colors.GRAY_900,   
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
                textColor: this.colors.BLACK,      
                lineColor: this.colors.GRAY_200,   
                lineWidth: 0.1
            },
            alternateRowStyles: {
                fillColor: this.colors.GRAY_50     
            }
        };
    };
    
    // ═══════════════════════════════════════════════════
    // ESTILOS DE PIE DE PÁGINA 
    // ═══════════════════════════════════════════════════
    
    this.getFooterStyles = function() {
        return {
            line: {
                drawColor: this.colors.GRAY_200,  
                lineWidth: 0.5
            },
            summary: {
                fontSize: 10,
                textColor: this.colors.GRAY_700,
                fontStyle: 'normal'
            },
            info: {
                fontSize: 9,
                textColor: this.colors.GRAY_700,
                fontStyle: 'normal'
            },
            highlight: {
                fontSize: 9,
                textColor: this.colors.BLACK,      
                fontStyle: 'bold'
            },
            copyright: {
                fontSize: 8,
                textColor: this.colors.GRAY_500,
                fontStyle: 'italic'
            }
        };
    };
    
    // ═══════════════════════════════════════════════════
    // UTILIDADES
    // ═══════════════════════════════════════════════════
    
    this.formatDate = function() {
        const now = new Date();
        const day   = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year  = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const mins  = String(now.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
    };
    
    this.getSummaryText = function(statistics) {
        return `Resumen: ${statistics.total} archivo(s) total | ` +
               `${statistics.enAmbos} en ambas versiones | ` +
               `${statistics.onlyLocal} solo en actual | ` +
               `${statistics.onlyRemote} solo en futura | ` +
               `${statistics.versionChanged} con cambios de versión | ` +
               `${statistics.sizeChanged} con cambios de tamaño | ` +
               `${statistics.noChanges} sin cambios`;
    };
    
    this.generateFileName = function(dir1Name, dir2Name) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const name1 = dir1Name ? dir1Name.replace(/[^a-z0-9]/gi, '_') : 'VersionActual';
        const name2 = dir2Name ? dir2Name.replace(/[^a-z0-9]/gi, '_') : 'VersionFutura';
        return `FichaTecnica_${name1}_vs_${name2}_${timestamp}.pdf`;
    };
});