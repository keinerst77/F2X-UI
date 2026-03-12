angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout', '$sce', 'PdfStylesService',
function($scope, $http, $timeout, $sce, PdfStylesService) {

    $scope.ipLocal = '10.0.134.108';
    $scope.obtenerIPLocal = function() {
        const pc = new RTCPeerConnection({iceServers: []});
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) return;
            const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
            if (match && match[1] && match[1] !== '127.0.0.1' && !match[1].startsWith('0.')) {
                $scope.$apply(() => { $scope.ipLocal = match[1]; });
                pc.close();
            }
        };
    };
    $scope.obtenerIPLocal();

    $scope.directory1 = ''; $scope.directory2 = '';
    $scope.directory1Name = ''; $scope.directory2Name = '';
    $scope.file1Data = null; $scope.file2Data = null;
    $scope.file1Count = 0;   $scope.file2Count = 0;
    $scope.equiposRemotos = []; $scope.showEquiposRemotos = false;
    $scope.equiposConectados = [];
    $scope.tableData = []; $scope.archivosSinCoincidencia = [];

    $scope.releaseData = {
        tituloFicha: '', sistema: '', caracteristicas: '', equipos: '', fechaFicha: '',
        cambiosAplicativos: '', cambiosBaseDatos: '', cambiosConfiguracion: '', observaciones: ''
    };
    $scope.releaseDataRaw = {
        tituloFicha: '', sistema: '', caracteristicas: '', equipos: '', fechaFicha: '',
        cambiosAplicativos: '', cambiosBaseDatos: '', cambiosConfiguracion: '', observaciones: ''
    };

    $scope.getHtml = function(campo) {
        if (typeof campo === 'string' && campo.startsWith('_img_')) {
            const idx = parseInt(campo.replace('_img_', ''), 10);
            const img = $scope.imagenesAdjuntas[idx];
            return $sce.trustAsHtml((img && img.descripcion) || '');
        }
        return $sce.trustAsHtml($scope.releaseDataRaw[campo] || '');
    };

    const releaseLabels = {
        tituloFicha:          'TÍTULO DEL DOCUMENTO',
        sistema:              'SISTEMA',
        caracteristicas:      'CARACTERÍSTICAS',
        equipos:              'EQUIPOS',
        fechaFicha:           'FECHA DE GENERACIÓN DE FICHA',
        cambiosAplicativos:   'DESCRIPCIÓN DE CAMBIOS DE APLICATIVOS',
        cambiosBaseDatos:     'DESCRIPCIÓN DE CAMBIOS EN BASE DE DATOS',
        cambiosConfiguracion: 'DESCRIPCIÓN DE CAMBIOS EN ARCHIVOS DE CONFIGURACIÓN',
        observaciones:        'OBSERVACIONES'
    };

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    $scope.vigenteDesde = hoy;

    $scope.formatearVigente = function(fecha) {
        if (!fecha) return '';
        const d = (fecha instanceof Date) ? fecha : new Date(fecha);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };

    $scope.statistics = { total: 0, versionChanged: 0, sizeChanged: 0, noChanges: 0 };
    $scope.imagenesAdjuntas = [];
    $scope.firmas = { nombreEnvia: '', nombreAprueba: '' };
    $scope.datos  = { vigenteDesde: hoy };
    $scope.showImageModal = false;
    $scope.showTable = false;
    $scope.errorMessage = ''; $scope.successMessage = '';
    $scope.isScanning = false;

    const API_URL              = 'http://localhost:7001/api/versionscanner';
    const MULTI_EQUIPO_API_URL = 'http://localhost:7001/api/multiequiposcan';
    const VALIDATION_API_URL   = 'http://localhost:7001/api/powershellremotetest';
    const isElectron = window.electronAPI !== undefined;

    // IMÁGENES
    $scope.abrirSelectorImagenes = function() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
        input.onchange = e => { if (e.target.files?.length) $scope.procesarImagenes(e.target.files); };
        input.click();
    };

    $scope.procesarImagenes = function(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) { $scope.$apply(() => $scope.errorMessage = `❌ "${file.name}" no es una imagen válida`); $timeout(() => $scope.errorMessage='',3000); return; }
            if (file.size > 5*1024*1024) { $scope.$apply(() => $scope.errorMessage = `❌ "${file.name}" supera 5MB`); $timeout(() => $scope.errorMessage='',3000); return; }
            const reader = new FileReader();
            reader.onload = e => {
                $scope.$apply(() => {
                    $scope.imagenesAdjuntas.push({ nombre: file.name, tipo: file.type, tamano: formatBytes(file.size), base64: e.target.result, timestamp: new Date().toISOString() });
                    $scope.successMessage = `✅ "${file.name}" agregada`;
                });
                $timeout(() => $scope.successMessage='',3000);
            };
            reader.onerror = () => { $scope.$apply(() => $scope.errorMessage=`❌ Error al leer "${file.name}"`); $timeout(()=>$scope.errorMessage='',3000); };
            reader.readAsDataURL(file);
        });
    };

    $scope.abrirEditorImagen = function(index) {
        if (!window.electronAPI?.openNativeTextarea) { $scope.errorMessage='❌ Función de entrada nativa no disponible'; return; }
        const imagen = $scope.imagenesAdjuntas[index];
        window.electronAPI.openNativeTextarea({
            title:        'DESCRIPCIÓN DE EVIDENCIA',
            placeholder:  'Ingrese la descripción de la evidencia...',
            defaultValue: imagen.descripcion || '',
            fieldLabel:   `Descripción — ${imagen.nombre}`
        }).then(result => {
            if (result !== null) {
                $scope.$apply(() => {
                    $scope.imagenesAdjuntas[index].descripcion = result;
                    $scope.successMessage = '✅ Descripción guardada';
                });
                $timeout(() => $scope.successMessage = '', 3000);
            }
        }).catch(() => { $scope.$apply(() => $scope.errorMessage = '❌ Error al abrir el editor'); });
    };

    $scope.eliminarImagen = function(index) {
        const n = $scope.imagenesAdjuntas[index].nombre;
        $scope.imagenesAdjuntas.splice(index,1);
        $scope.successMessage=`✅ "${n}" eliminada`; $timeout(()=>$scope.successMessage='',3000);
    };

    function formatBytes(bytes) {
        if (!bytes) return '0 Bytes';
        const KB=1024,MB=KB*1024,GB=MB*1024;
        if (bytes<KB) return bytes+' Bytes';
        const kib=Math.floor(bytes/KB);
        if (bytes<MB) { const kb=bytes/KB; if(kb<10){const x=Math.floor(kb*100);return Math.floor(x/100)+','+String(x%100).padStart(2,'0')+' KB';} if(kb<100){const x=Math.floor(kb*10);return Math.floor(x/10)+','+(x%10)+' KB';} return kib+' KB'; }
        if (bytes<GB) { const x1=Math.floor(kib/1024),x10=Math.floor(kib*10/1024),x100=Math.floor(kib*100/1024); if(x1<10)return Math.floor(x100/100)+','+String(x100%100).padStart(2,'0')+' MB'; if(x1<100)return Math.floor(x10/10)+','+(x10%10)+' MB'; return x1+' MB'; }
        const x1=Math.floor(kib/(1024*1024)),x10=Math.floor(kib*10/(1024*1024)),x100=Math.floor(kib*100/(1024*1024)); if(x1<10)return Math.floor(x100/100)+','+String(x100%100).padStart(2,'0')+' GB'; if(x1<100)return Math.floor(x10/10)+','+(x10%10)+' GB'; return x1+' GB';
    }

    $scope.abrirModalImagenes  = () => $scope.showImageModal = true;
    $scope.cerrarModalImagenes = () => $scope.showImageModal = false;

    // EQUIPOS REMOTOS
    $scope.agregarEquipoRemoto = () => $scope.equiposRemotos.push({ ipEquipo:'', usuario:'', password:'', status:null });
    $scope.quitarEquipoRemoto  = function(index) {
        const el = $scope.equiposRemotos[index];
        $scope.equiposRemotos.splice(index,1);
        if (el.ipEquipo) { const i=$scope.equiposConectados.findIndex(e=>e.ipEquipo===el.ipEquipo); if(i!==-1)$scope.equiposConectados.splice(i,1); }
        if (!$scope.equiposRemotos.length) { $scope.errorMessage=''; $scope.successMessage=''; }
    };

    $scope.validarConexion = function(equipo) {
        if (!equipo.ipEquipo||!equipo.usuario||!equipo.password) { $scope.errorMessage='❌ Completa todos los campos del equipo'; return; }
        equipo.status='connecting'; equipo.connectionMessage=null; $scope.errorMessage=''; $scope.successMessage='';
        var payload = { ipEquipo: equipo.ipEquipo, usuario: equipo.usuario, password: equipo.password };
        $http.post(VALIDATION_API_URL+'/test-simple', payload)
        .then(function(r) {
            if (r.data.success) {
                return $http.post(VALIDATION_API_URL+'/log-connection-event', payload)
                .then(function() { setConnected(equipo, r.data.output, 'con Event Log'); })
                .catch(function() { setConnected(equipo, r.data.output, ''); });
            } else {
                equipo.status = 'disconnected';
                var errMsg = r.data.errorMessage || r.data.output || 'Conexión fallida';
                $scope.errorMessage = '❌ ' + equipo.ipEquipo + ': ' + errMsg;
                if (r.data.sugerencias && r.data.sugerencias.length > 0) {
                    $scope.errorMessage += ' — 💡 ' + r.data.sugerencias.join(' | ');
                }
            }
        })
        .catch(function(err) {
            equipo.status = 'disconnected';
            var m = '❌ No se pudo conectar a ' + equipo.ipEquipo;
            if (err.status === -1) m += ': Backend no disponible (¿está corriendo la API en puerto 7001?)';
            else if (err.data && (err.data.errorMessage || err.data.message)) m += ': ' + (err.data.errorMessage || err.data.message);
            else if (err.statusText) m += ': HTTP ' + err.status + ' - ' + err.statusText;
            $scope.errorMessage = m;
        });
    };

    function setConnected(equipo, output, extra) {
        equipo.status='connected';
        const host = output ? output.trim() : equipo.ipEquipo;
        equipo.connectionMessage=`Conectado a: ${host}`;
        $scope.successMessage=`✅ Conexión exitosa con ${equipo.ipEquipo} (${host}) ${extra}`;
        const data={ipEquipo:equipo.ipEquipo,usuario:equipo.usuario,password:equipo.password,rutaActual:equipo.rutaActual,rutaFutura:equipo.rutaFutura};
        const idx=$scope.equiposConectados.findIndex(e=>e.ipEquipo===equipo.ipEquipo);
        if(idx!==-1)$scope.equiposConectados[idx]=data; else $scope.equiposConectados.push(data);
        $timeout(()=>$scope.successMessage='',5000);
    }

    $scope.buscarCarpetasAutomaticamente = function(equipo) {
        if (!equipo.ipEquipo||equipo.status!=='connected') { $scope.errorMessage='❌ Primero conecta el equipo'; return; }
        if (!$scope.directory1Name||!$scope.directory2Name) { $scope.errorMessage='❌ Primero selecciona las carpetas locales'; return; }
        equipo.searchingFolders=true; $scope.errorMessage=''; $scope.successMessage='';
        const b1=$http.post(VALIDATION_API_URL+'/search-directory-by-name',{ipEquipo:equipo.ipEquipo,usuario:equipo.usuario,password:equipo.password,nombreCarpeta:$scope.directory1Name});
        const b2=$http.post(VALIDATION_API_URL+'/search-directory-by-name',{ipEquipo:equipo.ipEquipo,usuario:equipo.usuario,password:equipo.password,nombreCarpeta:$scope.directory2Name});
        Promise.all([b1,b2]).then(([r1,r2])=>{
            equipo.searchingFolders=false;
            if(r1.data.success&&r2.data.success){
                const res1=JSON.parse(r1.data.output),res2=JSON.parse(r2.data.output);
                if(res1.Exists&&res2.Exists){ equipo.rutaActual=res1.Path; equipo.rutaFutura=res2.Path; $scope.successMessage=`✅ Carpetas encontradas en ${equipo.ipEquipo}`; $timeout(()=>$scope.successMessage='',8000); }
                else { const f=[]; if(!res1.Exists)f.push(`"${$scope.directory1Name}"`); if(!res2.Exists)f.push(`"${$scope.directory2Name}"`); $scope.errorMessage=`❌ No se encontraron: ${f.join(', ')}`; }
            } else { $scope.errorMessage='❌ Error al buscar carpetas'; }
        }).catch(()=>{ equipo.searchingFolders=false; $scope.errorMessage='❌ Error al buscar carpetas'; });
    };

    // DIRECTORIOS
    $scope.clearDirectory = function(n) {
        if(n===1){$scope.directory1='';$scope.directory1Name='';$scope.file1Data=null;$scope.file1Count=0;}
        else{$scope.directory2='';$scope.directory2Name='';$scope.file2Data=null;$scope.file2Count=0;}
        if(!$scope.directory1&&!$scope.directory2){$scope.showTable=false;$scope.tableData=[];$scope.archivosSinCoincidencia=[];$scope.statistics={total:0,versionChanged:0,sizeChanged:0,noChanges:0};}
        $scope.errorMessage='';$scope.successMessage='';
    };

    $scope.reset = function() {
        $scope.directory1=$scope.directory2=$scope.directory1Name=$scope.directory2Name='';
        $scope.file1Data=$scope.file2Data=null; $scope.file1Count=$scope.file2Count=0;
        $scope.showTable=false; $scope.tableData=[]; $scope.archivosSinCoincidencia=[];
        $scope.releaseData = { tituloFicha:'', sistema:'', caracteristicas:'', equipos:'', fechaFicha:'', cambiosAplicativos:'', cambiosBaseDatos:'', cambiosConfiguracion:'', observaciones:'' };
        $scope.releaseDataRaw = { tituloFicha:'', sistema:'', caracteristicas:'', equipos:'', fechaFicha:'', cambiosAplicativos:'', cambiosBaseDatos:'', cambiosConfiguracion:'', observaciones:'' };
        const h=new Date(); h.setHours(0,0,0,0); $scope.vigenteDesde=h; $scope.datos.vigenteDesde=h;
        $scope.imagenesAdjuntas=[];
        $scope.statistics={total:0,versionChanged:0,sizeChanged:0,noChanges:0};
        $scope.errorMessage='';$scope.successMessage='';
    };

    $scope.openFolderDialog = async function(folderNumber) {
        if (!isElectron) { $scope.errorMessage='⚠️ Requiere Electron'; return; }
        try {
            const result = await window.electronAPI.selectFolder();
            if (result.success) {
                $scope.$apply(()=>{ if(folderNumber===1){$scope.directory1=result.fullPath;$scope.directory1Name=result.folderName;}else{$scope.directory2=result.fullPath;$scope.directory2Name=result.folderName;} });
            }
        } catch(e) { $scope.$apply(()=>$scope.errorMessage='❌ Error: '+e.message); }
    };

    // ESCANEAR Y COMPARAR
    $scope.escanearYComparar = function() {
        if (!$scope.directory1?.trim()) { $scope.errorMessage='❌ Selecciona la carpeta de Versión Actual'; return; }
        if (!$scope.directory2?.trim()) { $scope.errorMessage='❌ Selecciona la carpeta de Versión Futura'; return; }
        $scope.isScanning=true; $scope.errorMessage=''; $scope.successMessage='';
        if ($scope.equiposConectados.length>0) {
            const sinRutas=$scope.equiposConectados.filter(e=>!e.rutaActual||!e.rutaFutura);
            if(sinRutas.length>0){$scope.errorMessage=`⚠️ ${sinRutas.length} equipo(s) sin rutas. Usa "Buscar Carpetas Automáticamente".`;$scope.isScanning=false;return;}
            escanearConEquiposRemotos($scope.equiposConectados.map(e=>({ipEquipo:e.ipEquipo,usuario:e.usuario,password:e.password,rutaRemota:e.rutaActual,existe:true})));
        } else { escanearSoloLocal(); }
    };

    function escanearSoloLocal() {
        const p1=$http.post(API_URL+'/scan',{directory:$scope.directory1,includeSubdirectories:true,searchPattern:'*.exe'});
        const p2=$http.post(API_URL+'/scan',{directory:$scope.directory2,includeSubdirectories:true,searchPattern:'*.exe'});
        Promise.all([p1,p2]).then(([r1,r2])=>{
            if(r1.data.success&&r2.data.success){
                $scope.file1Data=r1.data.files||[]; $scope.file2Data=r2.data.files||[];
                $scope.file1Count=$scope.file1Data.length; $scope.file2Count=$scope.file2Data.length;
                $scope.file1Data.forEach(f=>{f.sourceIp=$scope.ipLocal;f.equiposIps=[$scope.ipLocal];});
                $scope.file2Data.forEach(f=>{f.sourceIp=$scope.ipLocal;f.equiposIps=[$scope.ipLocal];});
                $scope.successMessage='✅ Escaneo completado';
                $scope.$apply(()=>$scope.generateTableConValidacion());
            } else { $scope.$apply(()=>$scope.errorMessage='❌ Error en el escaneo'); }
            $scope.isScanning=false;
        }).catch(()=>{ $scope.$apply(()=>{$scope.errorMessage='❌ Error al escanear directorios';$scope.isScanning=false;}); });
    }

    function escanearConEquiposRemotos(equiposValidos) {
        const rutasActual=[],rutasFutura=[];
        equiposValidos.forEach(eq=>{
            const orig=$scope.equiposConectados.find(e=>e.ipEquipo===eq.ipEquipo);
            if(orig?.rutaActual)rutasActual.push({ipEquipo:eq.ipEquipo,usuario:eq.usuario,password:eq.password,rutaRemota:orig.rutaActual});
            if(orig?.rutaFutura)rutasFutura.push({ipEquipo:eq.ipEquipo,usuario:eq.usuario,password:eq.password,rutaRemota:orig.rutaFutura});
        });
        const p1=$http.post(MULTI_EQUIPO_API_URL+'/scan',{directoryPath:$scope.directory1,ipLocal:$scope.ipLocal,equiposRemotos:rutasActual,includeSubdirectories:true,searchPattern:'*.exe'}).catch(e=>({data:{success:false,message:e.message}}));
        const p2=$http.post(MULTI_EQUIPO_API_URL+'/scan',{directoryPath:$scope.directory2,ipLocal:$scope.ipLocal,equiposRemotos:rutasFutura,includeSubdirectories:true,searchPattern:'*.exe'}).catch(e=>({data:{success:false,message:e.message}}));
        Promise.all([p1,p2]).then(([r1,r2])=>{
            if(r1.data.success&&r2.data.success){
                $scope.file1Data=r1.data.archivosConsolidados||[]; $scope.file2Data=r2.data.archivosConsolidados||[];
                $scope.file1Count=$scope.file1Data.length; $scope.file2Count=$scope.file2Data.length;
                $scope.generateTableConValidacion();
            } else { $scope.$apply(()=>$scope.errorMessage='❌ '+(r1.data.message||r2.data.message||'Error multi-equipo')); }
            $scope.isScanning=false; $scope.$apply();
        }).catch(err=>{ $scope.$apply(()=>{$scope.errorMessage='❌ Error remotos: '+(err.message||'desconocido');$scope.isScanning=false;}); });
    }

    $scope.generateTableConValidacion = function() {
        const problemas=$scope.validarVersionesMenores();
        if(problemas.length>0){
            $scope.mostrarAlertaVersionesMenores(problemas).then(continuar=>{
                if(continuar){$scope.generateTable();$scope.$apply();}
                else{$scope.errorMessage='⚠️ Generación cancelada por versiones futuras menores';$scope.$apply();}
            });
        } else { $scope.generateTable(); }
    };

    $scope.validarVersionesMenores = function() {
        const result=[];
        if(!$scope.file1Data||!$scope.file2Data) return result;
        $scope.file2Data.forEach(f2=>{ const f1=$scope.file1Data.find(f=>f.nameNormalized===f2.nameNormalized); if(f1&&compararVersiones(f2.version,f1.version)<0)result.push({nombre:f2.name,versionActual:f1.version,versionFutura:f2.version,ruta:f2.relativePath}); });
        return result;
    };

    function compararVersiones(v1,v2) {
        const p1=(v1||'0').split('.').map(Number),p2=(v2||'0').split('.').map(Number);
        for(let i=0;i<Math.max(p1.length,p2.length);i++){const n1=p1[i]||0,n2=p2[i]||0;if(n1<n2)return -1;if(n1>n2)return 1;}return 0;
    }

    $scope.mostrarAlertaVersionesMenores = function(problemas) {
        return new Promise(resolve=>{
            let msg=`⚠️ ${problemas.length} archivo(s) con versión futura MENOR:\n\n`;
            problemas.forEach((a,i)=>{if(i<10)msg+=`📄 ${a.nombre}\n   Actual: ${a.versionActual} → Futura: ${a.versionFutura}\n\n`;});
            if(problemas.length>10)msg+=`...y ${problemas.length-10} más.\n\n`;
            msg+='¿Continuar con la generación?';
            resolve(confirm(msg));
        });
    };

    $scope.generateTable = function() {
        if(!$scope.file1Data||!$scope.file2Data){$scope.errorMessage='❌ No hay datos para comparar';return;}
        const tableData=[],archivosSinCoincidencia=[];
        const statistics={total:0,versionChanged:0,sizeChanged:0,noChanges:0};
        $scope.file2Data.forEach(f2=>{
            const f1=$scope.file1Data.find(f=>f.nameNormalized===f2.nameNormalized);
            if(f1){
                const vC=f1.version!==f2.version,sC=f1.sizeBytes!==f2.sizeBytes;
                tableData.push({name:f2.name,equipos:(f2.equiposIps||[$scope.ipLocal]).join(', '),equiposArray:f2.equiposIps||[$scope.ipLocal],versionActual:f1.version,pesoActual:f1.size,versionFutura:f2.version,pesoFuturo:f2.size,ruta:f2.fullPath||f2.relativePath,changeType:(vC||sC)?'has-changes':'no-changes',existeEnActual:true,existeEnFutura:true,versionChanged:vC,sizeChanged:sC,versionMenor:compararVersiones(f2.version,f1.version)<0});
                if(vC)statistics.versionChanged++; if(sC)statistics.sizeChanged++; if(!vC&&!sC)statistics.noChanges++;
            } else {
                archivosSinCoincidencia.push({name:f2.name,equipos:(f2.equiposIps||[$scope.ipLocal]).join(', '),equiposArray:f2.equiposIps||[$scope.ipLocal],version:f2.version,peso:f2.size,ubicacion:f2.fullPath||f2.relativePath,ubicacionUsuario:''});
            }
        });
        statistics.total=tableData.length;
        $scope.tableData=tableData; $scope.archivosSinCoincidencia=archivosSinCoincidencia;
        $scope.statistics=statistics; $scope.showTable=true;
    };

    // EDITOR NATIVO
    $scope.abrirEditorCampo = function(campo) {
        if (!window.electronAPI?.openNativeTextarea) { $scope.errorMessage='❌ Función de entrada nativa no disponible'; return; }
        const titulo = releaseLabels[campo] || campo;
        window.electronAPI.openNativeTextarea({
            title: titulo, placeholder: `Ingrese ${titulo.toLowerCase()}...`,
            defaultValue: $scope.releaseDataRaw[campo] || '', fieldLabel: titulo
        }).then(result=>{
            if (result !== null) {
                $scope.$apply(()=>{ $scope.releaseDataRaw[campo]=result; $scope.releaseData[campo]=result; $scope.successMessage=`✅ "${titulo}" guardado`; });
                $timeout(()=>$scope.successMessage='',3000);
            }
        }).catch(()=>{ $scope.$apply(()=>$scope.errorMessage='❌ Error al abrir el editor'); });
    };

    // MOTOR DE RENDERIZADO HTML
    function _hexToRgb(hex) {
        if (!hex) return null;
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex, 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    function _cssColorToRgb(css) {
        if (!css || css === 'inherit' || css === 'initial' || css === 'transparent') return null;
        if (css.startsWith('#')) return _hexToRgb(css);
        const m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m) return [+m[1], +m[2], +m[3]];
        return null;
    }
    const _fontSizeMap = { '1': 8, '2': 10, '3': 12, '4': 14, '5': 18, '6': 24, '7': 36 };
    function _extractFontSize(el) {
        if (el.tagName === 'FONT' && el.getAttribute('size')) return _fontSizeMap[el.getAttribute('size')] || 11;
        const fs = el.style && el.style.fontSize;
        if (fs) { if (fs.endsWith('px')) return Math.round(parseFloat(fs) * 0.75); if (fs.endsWith('pt')) return parseFloat(fs); }
        return null;
    }
    function _extractColor(el) {
        if (el.tagName === 'FONT' && el.getAttribute('color')) return _hexToRgb(el.getAttribute('color'));
        if (el.style && el.style.color) return _cssColorToRgb(el.style.color);
        return null;
    }
    function _extractHighlight(el) {
        if (el.style && el.style.backgroundColor) return _cssColorToRgb(el.style.backgroundColor);
        return null;
    }
    function _getAlign(el) {
        if (!el) return null;
        if (el.style && el.style.textAlign) return el.style.textAlign;
        const attr = el.getAttribute && el.getAttribute('align');
        if (attr) return attr;
        return null;
    }

    function parseHtmlToLines(html) {
        if (!html || html.trim() === '') return [];
        const container = document.createElement('div');
        container.innerHTML = html;
        const lines = [];
        let currentSegments = [];
        let currentAlign = 'left';
        function pushLine(align) { lines.push({ align: align || currentAlign, segments: currentSegments }); currentSegments = []; }
        const BLOCK_TAGS = ['P','DIV','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','LI','TR'];
        function walkNode(node, ctx) {
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent;
                if (txt) currentSegments.push({ ...ctx, text: txt });
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toUpperCase();
            const newCtx = { ...ctx };
            if (tag === 'B' || tag === 'STRONG') newCtx.bold = true;
            if (tag === 'I' || tag === 'EM')     newCtx.italic = true;
            if (tag === 'U' || tag === 'INS')    newCtx.underline = true;
            if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') newCtx.strikethrough = true;
            if (node.style) {
                const fw = node.style.fontWeight;
                if (fw === 'bold' || fw === 'bolder' || (+fw >= 600)) newCtx.bold = true;
                const fi = node.style.fontStyle;
                if (fi === 'italic' || fi === 'oblique') newCtx.italic = true;
                const td  = node.style.textDecoration || '';
                const tdl = node.style.textDecorationLine || '';
                if (td.includes('underline') || tdl.includes('underline')) newCtx.underline = true;
                if (td.includes('line-through') || tdl.includes('line-through')) newCtx.strikethrough = true;
            }
            const col = _extractColor(node);     if (col) newCtx.color     = col;
            const hl  = _extractHighlight(node); if (hl)  newCtx.highlight = hl;
            const fs  = _extractFontSize(node);  if (fs)  newCtx.fontSize  = fs;
            const align   = _getAlign(node);
            const isBlock = BLOCK_TAGS.includes(tag);
            const isBr    = tag === 'BR';
            const isLi    = tag === 'LI';
            if (isBr) { pushLine(currentAlign); return; }
            if (isBlock) {
                if (currentSegments.length > 0) pushLine(currentAlign);
                if (align) currentAlign = align;
            }
            if (isLi) currentSegments.push({ ...newCtx, text: '• ' });
            node.childNodes.forEach(child => walkNode(child, newCtx));
            if (isBlock) { pushLine(align || currentAlign); currentAlign = 'left'; }
        }
        const defaultCtx = { bold: false, italic: false, underline: false, color: null, highlight: null, fontSize: 11 };
        container.childNodes.forEach(child => walkNode(child, defaultCtx));
        if (currentSegments.length > 0) pushLine(currentAlign);
        return lines;
    }

    function drawHtmlInPdf(doc, html, x, startY, maxW, pageH, marginBot, marginLeft) {
        if (!html || html.trim() === '') return startY;
        const parsedLines = parseHtmlToLines(html);
        if (!parsedLines.length) return startY;
        const DEFAULT_FS   = 9;
        const LINE_SPACING = 1.35;
        const SAFE_PAD     = 1;
        let curY = startY;
        function ensurePage(neededH) { if (curY + neededH > pageH - marginBot) { doc.addPage(); curY = 18; } }
        function applyStyle(seg) {
            const fs = seg.fontSize || DEFAULT_FS;
            let style = 'normal';
            if (seg.bold && seg.italic) style = 'bolditalic';
            else if (seg.bold)   style = 'bold';
            else if (seg.italic) style = 'italic';
            doc.setFontSize(fs);
            try { doc.setFont(undefined, style); } catch(e) {}
            if (seg.color) doc.setTextColor(seg.color[0], seg.color[1], seg.color[2]);
            else           doc.setTextColor(20, 20, 20);
            return fs * 0.352778;
        }
        for (const line of parsedLines) {
            if (!line.segments || line.segments.length === 0) {
                const fsMm = DEFAULT_FS * 0.352778;
                curY += fsMm * LINE_SPACING;
                ensurePage(fsMm * LINE_SPACING * 2);
                continue;
            }
            const tokens = [];
            for (const seg of line.segments) {
                const parts = seg.text.split(/(\s+)/);
                for (const part of parts) { if (part !== '') tokens.push({ text: part, seg }); }
            }
            const subLines  = [];
            let currentSub  = [];
            let currentSubW = 0;
            const rightLimit = maxW - SAFE_PAD;
            for (const tok of tokens) {
                applyStyle(tok.seg);
                const tokW = doc.getTextWidth(tok.text);
                const isWS = /^\s+$/.test(tok.text);
                if (currentSubW + tokW > rightLimit && currentSubW > 0 && !isWS) { subLines.push(currentSub); currentSub = []; currentSubW = 0; }
                if (!isWS || currentSubW > 0) { currentSub.push(tok); currentSubW += tokW; }
            }
            if (currentSub.length > 0) subLines.push(currentSub);
            const lineAlign = line.align || 'left';
            for (const subLine of subLines) {
                let lineH = 0;
                for (const tok of subLine) { const fsMm = (tok.seg.fontSize || DEFAULT_FS) * 0.352778; lineH = Math.max(lineH, fsMm * LINE_SPACING); }
                if (lineH === 0) lineH = DEFAULT_FS * 0.352778 * LINE_SPACING;
                ensurePage(lineH * 2);
                let totalW = 0;
                for (const tok of subLine) { applyStyle(tok.seg); totalW += doc.getTextWidth(tok.text); }
                totalW = Math.min(totalW, rightLimit);
                let lineStartX;
                if      (lineAlign === 'center') lineStartX = x + (maxW - totalW) / 2;
                else if (lineAlign === 'right')  lineStartX = x + maxW - totalW - SAFE_PAD;
                else                             lineStartX = x;
                let curX = lineStartX;
                const rightEdge = x + maxW - SAFE_PAD;
                for (const tok of subLine) {
                    const fsMm = applyStyle(tok.seg);
                    const tokW = doc.getTextWidth(tok.text);
                    if (tok.seg.highlight) {
                        const hl = tok.seg.highlight;
                        doc.setFillColor(hl[0], hl[1], hl[2]);
                        doc.rect(curX, curY - fsMm + 0.5, Math.min(tokW, rightEdge - curX), fsMm + 1, 'F');
                        if (tok.seg.color) doc.setTextColor(tok.seg.color[0], tok.seg.color[1], tok.seg.color[2]);
                        else               doc.setTextColor(20, 20, 20);
                    }
                    if (curX < rightEdge && tok.text.trim() !== '') doc.text(tok.text, curX, curY);
                    if (tok.seg.underline && curX < rightEdge) {
                        const uc = tok.seg.color || [20, 20, 20];
                        doc.setDrawColor(uc[0], uc[1], uc[2]); doc.setLineWidth(0.2);
                        doc.line(curX, curY + 0.6, Math.min(curX + tokW, rightEdge), curY + 0.6);
                    }
                    if (tok.seg.strikethrough && curX < rightEdge) {
                        const sc = tok.seg.color || [20, 20, 20];
                        doc.setDrawColor(sc[0], sc[1], sc[2]); doc.setLineWidth(0.2);
                        doc.line(curX, curY - fsMm * 0.3, Math.min(curX + tokW, rightEdge), curY - fsMm * 0.3);
                    }
                    curX += tokW;
                    if (curX >= rightEdge) break;
                }
                curY += lineH;
            }
        }
        return curY;
    }

    function normalizeToHtml(input) {
        if (!input) return '';
        if (/<[a-z][\s\S]*>/i.test(input)) return input;
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    function drawDescripcionReleaseBlock(doc, htmlCaract, htmlEquipos, startY, pageW, margin, pageH) {
        const blockW    = pageW - margin * 2;
        const padX      = 5;
        const padTop    = 11;
        const padBot    = 6;
        const minBodyH  = 24;
        const BOT_LIMIT = 20;
        const titleH    = 7;
        const GAP       = 6;
        const labelColW = 38;
        const {jsPDF: jsPDFClass} = window.jspdf;

        function measureRow(html) {
            if (!html || html.replace(/<[^>]+>/g, '').trim() === '') return minBodyH;
            const innerW = blockW - labelColW - padX * 2;
            const temp   = new jsPDFClass('l', 'mm', 'a4');
            const endY   = drawHtmlInPdf(temp, normalizeToHtml(html), margin + labelColW + padX, 30, innerW, 9999, 0, margin + labelColW + padX);
            return Math.max(minBodyH, (endY - 30) + padTop + padBot);
        }

        const rowHCaract = measureRow(htmlCaract);
        const rowHEquip  = measureRow(htmlEquipos);
        const totalBodyH = rowHCaract + rowHEquip;

        if (startY + titleH + totalBodyH > pageH - BOT_LIMIT) { doc.addPage(); startY = 15; }

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('DESCRIPCIÓN RELEASE', margin, startY + titleH - 1);

        const bodyY = startY + titleH + 5;
        const sepX  = margin + labelColW;
        const CR    = 2;

        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, bodyY, blockW, totalBodyH, CR, CR, 'F');

        doc.setFillColor(235, 235, 235);
        doc.roundedRect(margin, bodyY, labelColW, totalBodyH, CR, CR, 'F');
        doc.rect(margin + labelColW - CR, bodyY, CR, totalBodyH, 'F');

        const sepY = bodyY + rowHCaract;
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(margin, sepY, margin + blockW, sepY);

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(sepX, bodyY, sepX, bodyY + totalBodyH);

        function drawRow(label, html, rowY, rowH) {
            const isEmptyContent = !html || html.replace(/<[^>]+>/g, '').trim() === '';
            const innerW   = blockW - labelColW - padX * 2;
            const contentX = sepX + padX;

            doc.setFontSize(7.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 30, 30);
            doc.text(label, margin + labelColW / 2, rowY + rowH / 2, { align: 'center', baseline: 'middle' });

            if (isEmptyContent) {
                doc.setFontSize(8);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(155, 155, 155);
                doc.text('N/A', contentX, rowY + rowH / 2, { baseline: 'middle' });
            } else {
                drawHtmlInPdf(doc, normalizeToHtml(html), contentX, rowY + padTop, innerW, pageH, BOT_LIMIT, contentX);
            }
        }

        drawRow('CARACTERÍSTICAS', htmlCaract,  bodyY,              rowHCaract);
        drawRow('EQUIPOS',         htmlEquipos, bodyY + rowHCaract, rowHEquip);

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, bodyY, blockW, totalBodyH, CR, CR, 'S');

        return bodyY + totalBodyH + GAP;
    }

    function drawCompactBlock(doc, label, rawContent, startY, pageW, margin, pageH) {
        const html      = normalizeToHtml(rawContent);
        const blockW    = pageW - margin * 2;
        const padX      = 5;
        const padTop    = 11;
        const padBot    = 6;
        const minBodyH  = 24;
        const BOT_LIMIT = 20;
        const titleH    = 7;
        const GAP       = 6;
        const innerX    = margin + padX;
        const innerW    = blockW - padX * 2;

        const plainText = html.replace(/<[^>]+>/g, '').trim();
        const isEmpty   = !plainText;

        let realBodyH = minBodyH;
        if (!isEmpty) {
            const {jsPDF: jsPDFClass} = window.jspdf;
            const tempDoc = new jsPDFClass('l', 'mm', 'a4');
            const dryEndY = drawHtmlInPdf(tempDoc, html, innerX, 30, innerW, 9999, 0, innerX);
            realBodyH = Math.max(minBodyH, (dryEndY - 30) + padTop + padBot);
        }

        if (startY + titleH + realBodyH > pageH - BOT_LIMIT) { doc.addPage(); startY = 15; }

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(label, margin, startY + titleH - 1);

        const bodyY = startY + titleH + 5;
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, bodyY, blockW, realBodyH, 2, 2, 'FD');

        if (isEmpty) {
            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(155, 155, 155);
            doc.text('N/A', innerX, bodyY + realBodyH / 2, { baseline: 'middle' });
        } else {
            drawHtmlInPdf(doc, html, innerX, bodyY + padTop, innerW, pageH, BOT_LIMIT, innerX);
        }

        return bodyY + realBodyH + GAP;
    }

    function loadImageAsBase64(src, removeBlackBg) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                if (removeBlackBg) {
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const r = d[i], g = d[i+1], b = d[i+2];
                        const lum = (r + g + b) / 3;
                        if (lum < 40) { d[i+3] = 0; }
                        else if (lum < 80) { d[i+3] = Math.round((lum - 40) / 40 * 255); }
                    }
                    ctx.putImageData(imgData, 0, 0);
                }
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    // GENERAR PDF
    $scope.generatePDF = function() {
        $scope.errorMessage = '';
        $scope._generatePDFAsync().catch(function(err) {
            $scope.$apply(function() {
                $scope.errorMessage = '❌ Error al generar el PDF: ' + (err && err.message ? err.message : String(err));
            });
            console.error('Error generatePDF:', err);
        });
    };

    $scope._generatePDFAsync = async function() {

        if(!$scope.tableData?.length && !$scope.archivosSinCoincidencia?.length){
            $scope.errorMessage='❌ No hay datos para exportar'; return;
        }

        const archivosConCambios = $scope.tableData || [];

        const capFirmaNombreEnvia   = ($scope.firmas.nombreEnvia   || '').trim();
        const capFirmaNombreAprueba = ($scope.firmas.nombreAprueba || '').trim();
        const capVigenteDesde       = $scope.datos.vigenteDesde || $scope.vigenteDesde;
        const {jsPDF} = window.jspdf;
        const doc     = new jsPDF('l', 'mm', 'a4');
        let logoBase64 = null;
        try {
            logoBase64 = await loadImageAsBase64('./assets/images/f2x-logo.png', true);
        } catch(e) { console.warn('No se pudo cargar el logo:', e); }
        const pageW   = doc.internal.pageSize.getWidth();
        const pageH   = doc.internal.pageSize.getHeight();
        const M       = 12;
        const tableStyles  = PdfStylesService.getTableStyles();
        const footerStyles = PdfStylesService.getFooterStyles();

        const htmlTitulo     = $scope.releaseDataRaw.tituloFicha         || '';
        const htmlSistema    = $scope.releaseDataRaw.sistema             || '';
        const htmlCaract     = $scope.releaseDataRaw.caracteristicas     || '';
        const htmlEquipos    = $scope.releaseDataRaw.equipos             || '';
        const htmlCambios    = $scope.releaseDataRaw.cambiosAplicativos  || '';
        const htmlCambiosBD  = $scope.releaseDataRaw.cambiosBaseDatos    || '';
        const htmlCambiosCfg = $scope.releaseDataRaw.cambiosConfiguracion|| '';
        const htmlObs        = $scope.releaseDataRaw.observaciones       || '';
        const fechaFmt       = (capVigenteDesde instanceof Date && !isNaN(capVigenteDesde.getTime()))
            ? $scope.formatearVigente(capVigenteDesde)
            : (typeof capVigenteDesde === 'string' && capVigenteDesde)
                ? $scope.formatearVigente(new Date(capVigenteDesde))
                : '';

        const fullW = pageW - M * 2;
        const LH    = 7;
        const GAP   = 3;

        // HEADER
        const topZoneH        = 26;
        const sistemaTexto = decodeHtmlEntities(htmlSistema.replace(/<[^>]+>/g, '')).trim() || '';
        const sistemaLabelH   = 5;
        const sistemaGap      = 4;
        const sistemaContentH = 6;
        const headerPadBot    = 2;
        const headerH = topZoneH + sistemaLabelH + sistemaGap + sistemaContentH + headerPadBot;

        doc.setFillColor(70, 70, 70);
        doc.rect(0, 0, pageW, headerH, 'F');

        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.3);
        doc.line(M, topZoneH, pageW - M, topZoneH);

        doc.setFillColor(221, 244, 52);
        doc.rect(0, headerH, pageW, 2, 'F');

        const logoH = 25;
        const logoW = 40;
        const logoX = M;
        const logoY = (topZoneH - logoH) / 2 + 2;
        try { doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH); } catch(e) {}

        function decodeHtmlEntities(str) {
        const el = document.createElement('textarea');
        el.innerHTML = str;
        return el.value;
    }
        const tituloTexto  = decodeHtmlEntities(htmlTitulo.replace(/<[^>]+>/g, '')).trim() || 'FICHA TÉCNICA DE ACTUALIZACIÓN';
        const tituloFooter = decodeHtmlEntities(htmlTitulo.replace(/<[^>]+>/g, '')).trim() || 'FICHA TÉCNICA DE ACTUALIZACIÓN';
        doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
        doc.text(tituloTexto, pageW / 2, topZoneH / 2, { align: 'center', baseline: 'middle' });

        const _hoy = new Date();
        const _fechaGen = `${String(_hoy.getDate()).padStart(2,'0')}/${String(_hoy.getMonth()+1).padStart(2,'0')}/${_hoy.getFullYear()}`;
        doc.setFontSize(7.5); doc.setTextColor(200,200,200); doc.setFont(undefined,'normal');
        doc.text(`Fecha de generación: ${_fechaGen}`, pageW - M, topZoneH / 2 - 2.5, { align: 'right' });
        doc.text(`Vigente a partir de: ${fechaFmt || 'N/A'}`,  pageW - M, topZoneH / 2 + 4, { align: 'right' });

        const sisY = topZoneH + 1;
        doc.setFontSize(7.5); doc.setFont(undefined, 'bold'); doc.setTextColor(190, 214, 47);
        doc.text('SISTEMA', pageW / 2, sisY + sistemaLabelH - 1, { align: 'center' });

        if (sistemaTexto) {
            doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(240, 240, 240);
            doc.text(sistemaTexto, pageW / 2, sisY + sistemaLabelH + sistemaGap, { align: 'center' });
        }

        let Y = headerH + 6;

        Y = drawDescripcionReleaseBlock(doc, htmlCaract, htmlEquipos, Y, pageW, M, pageH);
        Y = drawCompactBlock(doc, 'DESCRIPCIÓN DE CAMBIOS DE APLICATIVOS', htmlCambios, Y, pageW, M, pageH);

        // TABLA UNIFICADA
       if (Y + 40 > pageH - 20) { doc.addPage(); Y = 15; }
       else { Y += 8; }
        doc.setFontSize(14); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
        doc.text('Detalle del Software Versionado', M, Y + 8);
        Y += 14;

        const filasCombinadas = [
            ...archivosConCambios.map(item => ({
                nombre:          item.name,
                equipos:         item.equipos || '-',
                versionActual:   item.versionActual || '-',
                pesoActual:      item.pesoActual || '-',
                versionFutura:   item.versionFutura || '-',
                pesoFuturo:      item.pesoFuturo || '-',
                ubicacion:       item.ruta || '',
                sinCoincidencia: false,
                versionChanged:  item.versionChanged || false,
                sizeChanged:     item.sizeChanged    || false,
                versionMenor:    item.versionMenor   || false
            })),
            ...$scope.archivosSinCoincidencia.map(item => ({
                nombre:          item.name,
                equipos:         item.equipos || '-',
                versionActual:   'N/A',
                pesoActual:      'N/A',
                versionFutura:   item.version || '-',
                pesoFuturo:      item.peso || '-',
                ubicacion:       item.ubicacionUsuario || 'N/A',
                sinCoincidencia: true,
                versionChanged:  false,
                sizeChanged:     false,
                versionMenor:    false
            }))
        ];

        doc.autoTable({
            startY: Y,
            head: [['Software','Equipo / IP','Versión Actual','Peso Actual','Versión Futura','Peso Futuro','Ubicación']],
            body: filasCombinadas.map(f => [
                f.nombre, f.equipos, f.versionActual, f.pesoActual,
                f.versionFutura, f.pesoFuturo, f.ubicacion
            ]),
            theme: 'plain',
            showHead: 'firstPage',
            rowPageBreak: 'avoid',
            headStyles: {
                fillColor: [245,245,245], textColor: [50,50,50],
                fontSize: 7.5, fontStyle: 'bold',
                halign: 'center', valign: 'middle', cellPadding: 4,
                lineWidth: 0
            },
            styles: {
                fontSize: 7.5, cellPadding: { top:4, bottom:4, left:3, right:3 },
                textColor: [40,40,40],
                lineColor: [220,220,220], lineWidth: 0,
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 48, fontStyle: 'bold' },
                1: { cellWidth: 26, halign: 'center' },
                2: { cellWidth: 26, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 26, halign: 'center' },
                5: { cellWidth: 20, halign: 'center' },
                6: { cellWidth: 'auto', fontSize: 6.5 }
            },
            alternateRowStyles: { fillColor: [248,250,245] },
            margin: { left: M, right: M, bottom: 20 },
            didDrawRow: function(data) {
                if (data.section === 'body' && data.row.index === filasCombinadas.length - 1) return;
                const x1 = data.settings.margin.left;
                const x2 = doc.internal.pageSize.getWidth() - data.settings.margin.right;
                const y  = data.row.y + data.row.height;
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(data.section === 'head' ? 0.5 : 0.2);
                doc.line(x1, y, x2, y);
            },
            didParseCell: function(data) {
                if (data.section !== 'body') return;
                const fila = filasCombinadas[data.row.index];
                if (!fila) return;
                if (!fila.sinCoincidencia && (fila.versionChanged || fila.sizeChanged)) {
                    data.cell.styles.fillColor = [230, 248, 220];
                }
                if (!fila.sinCoincidencia && fila.versionChanged && data.column.index === 4) {
                    data.cell.styles.textColor = [30, 100, 0];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (!fila.sinCoincidencia && fila.sizeChanged && data.column.index === 5) {
                    data.cell.styles.fontStyle = 'bold';
                }
                if (fila.sinCoincidencia) {
                    data.cell.styles.fillColor = [255, 252, 230];
                    if (data.column.index === 2 || data.column.index === 3) {
                        data.cell.styles.textColor = [180,180,180];
                        data.cell.styles.fontStyle = 'italic';
                        data.cell.styles.halign    = 'center';
                    }
                    if (data.column.index === 6) {
                        data.cell.styles.textColor = [180,180,180];
                        data.cell.styles.fontStyle = 'italic';
                        data.cell.styles.halign    = 'center';
                    }
                }
            }
        });

        Y = doc.lastAutoTable.finalY + 3;
        doc.setDrawColor(180,180,180); doc.setLineWidth(0.3);
        doc.line(M, Y, pageW-M, Y); Y += 4;

        const archivosModificados = $scope.tableData.filter(item => item.versionChanged || item.sizeChanged);
        const totalInstalado   = filasCombinadas.length;
        const totalActualizado = archivosModificados.length;
        const totalNuevos      = $scope.archivosSinCoincidencia.length;

        // LEYENDA DE COLORES
        const legendItems = [
            { color: null,            label: `Total Software Instalado: ${totalInstalado}` },
            { color: [230, 248, 220], label: `Total Software Actualizado: ${totalActualizado}` },
            { color: [255, 252, 230], label: `Total Software Nuevos: ${totalNuevos}`, show: totalNuevos > 0 },
        ];

        const boxSize = 4;
        const boxGap  = 2.5;
        const itemGap = 10;
        let legendX   = M;
        const legendY = Y + 3;

        legendItems.forEach(item => {
            if (item.show === false) return;
            const offsetX = item.color ? boxSize + boxGap : 0;
            if (item.color) {
                doc.setFillColor(item.color[0], item.color[1], item.color[2]);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.2);
                doc.roundedRect(legendX, legendY - boxSize / 2, boxSize, boxSize, 0.8, 0.8, 'FD');
            }
            doc.setFontSize(7.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(item.label, legendX + offsetX, legendY, { baseline: 'middle' });
            const textW = doc.getTextWidth(item.label);
            legendX += offsetX + textW + itemGap;
            if (legendX < pageW - M) {
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.3);
                doc.line(legendX - itemGap / 2, legendY - 2.5, legendX - itemGap / 2, legendY + 2.5);
            }
        });

        Y += 8;

        // EVIDENCIAS
        if ($scope.imagenesAdjuntas.length > 0) {
            const {jsPDF: jsPDFClass} = window.jspdf;
            const BOT_LIMIT  = 20;
            const imgW       = 110;
            const imgH       = 75;          
            const descX      = M + imgW + 4;
            const descW      = fullW - imgW - 4;
            const titleOffY  = 5;           
            const bodyOffY   = 8;           
            const bodyPadTop = 5;           
            const bodyPadX   = 3;
            const minDescH   = imgH - 10;   

            $scope.imagenesAdjuntas.forEach((img, idx) => {
                try {
                    let descTextH = 0;
                    if (img.descripcion) {
                        const tempDoc = new jsPDFClass('l', 'mm', 'a4');
                        const endY    = drawHtmlInPdf(
                            tempDoc,
                            normalizeToHtml(img.descripcion),
                            descX + bodyPadX,
                            30,
                            descW - bodyPadX * 2,
                            9999, 0,
                            descX + bodyPadX
                        );
                        descTextH = endY - 30;
                    }

                    const descBoxH = Math.max(minDescH, bodyOffY + bodyPadTop + descTextH + 3);
                    const rowH = Math.max(imgH, descBoxH);

                    const spaceNeeded = (idx === 0 ? 14 : 0) + rowH + 5;

                    if (Y + spaceNeeded > pageH - BOT_LIMIT) { doc.addPage(); Y = 15; }

                    if (idx === 0) {
                        doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 30, 30);
                        doc.text('EVIDENCIAS DE PRUEBAS', M, Y + 6);
                        doc.setDrawColor(190, 214, 47); doc.setLineWidth(0.8);
                        doc.line(M, Y + 9, pageW - M, Y + 9);
                        Y += 14;
                    }

                    const imgOffsetY = (rowH - imgH) / 2;
                    doc.addImage(img.base64, 'JPEG', M, Y + imgOffsetY, imgW, imgH);

                    doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 30, 30);
                    doc.text('DESCRIPCIÓN', descX, Y + titleOffY);

                    doc.setFillColor(252, 252, 252);
                    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
                    doc.roundedRect(descX, Y + bodyOffY, descW, descBoxH, 2, 2, 'FD');

                    if (img.descripcion) {
                        doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
                        drawHtmlInPdf(
                            doc,
                            normalizeToHtml(img.descripcion),
                            descX + bodyPadX,
                            Y + bodyOffY + bodyPadTop,
                            descW - bodyPadX * 2,
                            pageH, BOT_LIMIT,
                            descX + bodyPadX
                        );
                    } else {
                        doc.setFontSize(8); doc.setFont(undefined, 'italic'); doc.setTextColor(160, 160, 160);
                        doc.text('N/A', descX + descW / 2, Y + bodyOffY + descBoxH / 2, { align: 'center', baseline: 'middle' });
                    }

                    Y += rowH + GAP;
                } catch(e) { console.error('Error imagen:', e); }
            });

            Y += 10;
        }

        // BLOQUES FINALES
        Y = drawCompactBlock(doc, 'DESCRIPCIÓN DE CAMBIOS EN BASE DE DATOS',             htmlCambiosBD,  Y, pageW, M, pageH);
        Y = drawCompactBlock(doc, 'DESCRIPCIÓN DE CAMBIOS EN ARCHIVOS DE CONFIGURACIÓN', htmlCambiosCfg, Y, pageW, M, pageH);
        Y = drawCompactBlock(doc, 'OBSERVACIONES',                                        htmlObs,        Y, pageW, M, pageH);

        // FIRMAS
        const firmaNeededH = 22;
        if (Y + firmaNeededH > pageH - 20) { doc.addPage(); Y = 15; }
        const firmaYDynamic = Math.max(Y + 10, pageH - 50);
        const firmaY = (firmaYDynamic + firmaNeededH < pageH - 18) ? firmaYDynamic : Y + 10;
        const sigColGap = 20;
        const sigColW   = (fullW - sigColGap) / 2;
        const lineLen   = sigColW * 0.75;
        const firmas    = [
            { label: 'Firma de quien envía',   nombre: capFirmaNombreEnvia,   x: M + sigColW * 0.5 },
            { label: 'Firma de quien aprueba', nombre: capFirmaNombreAprueba, x: M + sigColW + sigColGap + sigColW * 0.5 }
        ];
        firmas.forEach(f => {
            const lineX = f.x - lineLen / 2;
            doc.setDrawColor(100,100,100); doc.setLineWidth(0.4);
            doc.line(lineX, firmaY, lineX + lineLen, firmaY);
            doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
            doc.text(f.label, f.x, firmaY + 5, { align: 'center' });
            doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(40,40,40);
            doc.text('Nombre:', lineX, firmaY + 11);
            if (f.nombre) {
                const nombreLabelW = doc.getTextWidth('Nombre: ');
                doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40);
                doc.text(f.nombre, lineX + nombreLabelW, firmaY + 11);
            }
        });

        // FOOTER EN TODAS LAS PÁGINAS
        const totalPages = doc.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const footerY = pageH - 8;
            doc.setDrawColor(180,180,180); doc.setLineWidth(0.3);
            doc.line(M, footerY - 5, pageW - M, footerY - 5);
            doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(60,60,60);
            doc.text(`F2X - ${tituloFooter}`, M, footerY);
            doc.setFontSize(7.5); doc.setFont(undefined,'italic'); doc.setTextColor(100,100,100);
            doc.text(`© ${new Date().getFullYear()} Todos los derechos reservados`, pageW / 2, footerY, { align: 'center' });
            doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(60,60,60);
            doc.text(`Página ${p} de ${totalPages}`, pageW - M, footerY, { align: 'right' });
        }

        // GUARDAR
        const nombre = PdfStylesService.generateFileName($scope.directory1Name, $scope.directory2Name);
        doc.save(nombre);
    };

}]);