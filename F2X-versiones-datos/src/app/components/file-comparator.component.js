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


    // CAMPOS DEL RELEASE
    $scope.releaseData = {
        sistema: '',
        caracteristicas: '', equipos: '', fechaFicha: '',
        cambiosAplicativos: '', cambiosBaseDatos: '', cambiosConfiguracion: '', observaciones: ''
    };
    $scope.releaseDataRaw = {
        sistema: '',
        caracteristicas: '', equipos: '', fechaFicha: '',
        cambiosAplicativos: '', cambiosBaseDatos: '', cambiosConfiguracion: '', observaciones: ''
    };

    $scope.getHtml = function(campo) {
        return $sce.trustAsHtml($scope.releaseDataRaw[campo] || '');
    };

    const releaseLabels = {
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
    $scope.showImageModal = false;
    $scope.showTable = false;
    $scope.errorMessage = ''; $scope.successMessage = '';
    $scope.isScanning = false;

    const API_URL              = 'https://localhost:7001/api/versionscanner';
    const MULTI_EQUIPO_API_URL = 'https://localhost:7001/api/multiequiposcan';
    const VALIDATION_API_URL   = 'https://localhost:7001/api/powershellremotetest';
    const isElectron = window.electronAPI !== undefined;


    // IMAGENES
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
            if (err.status === -1) {
                m += ': Backend no disponible (¿está corriendo la API en puerto 7001?)';
            } else if (err.data && (err.data.errorMessage || err.data.message)) {
                m += ': ' + (err.data.errorMessage || err.data.message);
            } else if (err.statusText) {
                m += ': HTTP ' + err.status + ' - ' + err.statusText;
            }
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
        $scope.releaseData = {
            sistema: '',
            caracteristicas:'', equipos:'', fechaFicha:'',
            cambiosAplicativos:'', cambiosBaseDatos:'', cambiosConfiguracion:'', observaciones:''
        };
        $scope.releaseDataRaw = {
            sistema: '',
            caracteristicas:'', equipos:'', fechaFicha:'',
            cambiosAplicativos:'', cambiosBaseDatos:'', cambiosConfiguracion:'', observaciones:''
        };
        const h=new Date(); h.setHours(0,0,0,0); $scope.vigenteDesde=h;
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

        const p1=$http.post(MULTI_EQUIPO_API_URL+'/scan',{
            directoryPath:$scope.directory1,
            ipLocal:$scope.ipLocal,
            equiposRemotos:rutasActual,
            includeSubdirectories:true,
            searchPattern:'*.exe'
        }).catch(e=>({data:{success:false,message:e.message}}));

        const p2=$http.post(MULTI_EQUIPO_API_URL+'/scan',{
            directoryPath:$scope.directory2,
            ipLocal:$scope.ipLocal,
            equiposRemotos:rutasFutura,
            includeSubdirectories:true,
            searchPattern:'*.exe'
        }).catch(e=>({data:{success:false,message:e.message}}));

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
                archivosSinCoincidencia.push({
                    name:f2.name, equipos:(f2.equiposIps||[$scope.ipLocal]).join(', '),
                    equiposArray:f2.equiposIps||[$scope.ipLocal], version:f2.version, peso:f2.size,
                    ubicacion:f2.fullPath||f2.relativePath, ubicacionUsuario:''
                });
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
            title:        titulo,
            placeholder:  `Ingrese ${titulo.toLowerCase()}...`,
            defaultValue: $scope.releaseDataRaw[campo] || '',
            fieldLabel:   titulo
        }).then(result=>{
            if (result !== null) {
                $scope.$apply(()=>{
                    $scope.releaseDataRaw[campo] = result;
                    $scope.releaseData[campo]    = result;
                    $scope.successMessage=`✅ "${titulo}" guardado`;
                });
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

        function pushLine(align) {
            lines.push({ align: align || currentAlign, segments: currentSegments });
            currentSegments = [];
        }

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
            if (tag === 'U')                      newCtx.underline = true;

            if (node.style) {
                if (node.style.fontWeight === 'bold' || +node.style.fontWeight >= 700) newCtx.bold = true;
                if (node.style.fontStyle === 'italic') newCtx.italic = true;
                if (node.style.textDecoration && node.style.textDecoration.includes('underline')) newCtx.underline = true;
            }

            const col = _extractColor(node);   if (col) newCtx.color = col;
            const hl  = _extractHighlight(node); if (hl) newCtx.highlight = hl;
            const fs  = _extractFontSize(node);  if (fs) newCtx.fontSize = fs;

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

            if (isBlock) {
                pushLine(align || currentAlign);
                currentAlign = 'left';
            }
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

        const DEFAULT_FS   = 11;
        const LINE_SPACING = 1.45;
        const SAFE_PAD     = 1;
        let curY = startY;

        function ensurePage(neededH) {
            if (curY + neededH > pageH - marginBot) { doc.addPage(); curY = 20; }
        }

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
                if (currentSubW + tokW > rightLimit && currentSubW > 0 && !isWS) {
                    subLines.push(currentSub); currentSub = []; currentSubW = 0;
                }
                if (!isWS || currentSubW > 0) { currentSub.push(tok); currentSubW += tokW; }
            }
            if (currentSub.length > 0) subLines.push(currentSub);

            const lineAlign = line.align || 'left';

            for (const subLine of subLines) {
                let lineH = 0;
                for (const tok of subLine) {
                    const fsMm = (tok.seg.fontSize || DEFAULT_FS) * 0.352778;
                    lineH = Math.max(lineH, fsMm * LINE_SPACING);
                }
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
                        doc.setDrawColor(uc[0], uc[1], uc[2]);
                        doc.setLineWidth(0.2);
                        doc.line(curX, curY + 0.6, Math.min(curX + tokW, rightEdge), curY + 0.6);
                    }

                    curX += tokW;
                    if (curX >= rightEdge) break;
                }
                curY += lineH;
            }
        }
        return curY;
    }

 
    function drawHtmlBlock(doc, label, html, startY, pageW, margin, pageH) {
        const blockW    = pageW - margin * 2;
        const labelH    = 9;
        const padX      = 6;
        const padTop    = 10;
        const padBot    = 10;
        const minBodyH  = 18;
        const BOT_LIMIT = 25;
        const innerX    = margin + padX;
        const innerW    = blockW - padX * 2;

        const isEmpty = !html || html.replace(/<[^>]+>/g, '').trim() === '';

        if (isEmpty) {
            if (startY + labelH + minBodyH > pageH - BOT_LIMIT) { doc.addPage(); startY = 20; }
            doc.setFillColor(150, 150, 150); doc.rect(margin, startY, blockW, labelH, 'F');
            doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.4); doc.rect(margin, startY, blockW, labelH, 'S');
            doc.setFontSize(9); doc.setTextColor(20, 20, 20); doc.setFont(undefined, 'bold');
            doc.text(label, margin + 6, startY + 6);
            const bodyY0 = startY + labelH;
            doc.setFillColor(255, 255, 255); doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.4);
            doc.rect(margin, bodyY0, blockW, minBodyH, 'FD');
            doc.setFontSize(9); doc.setFont(undefined, 'italic'); doc.setTextColor(160, 160, 160);
            doc.text('N/A', margin + blockW / 2, bodyY0 + minBodyH / 2 + 1, { align: 'center', baseline: 'middle' });
            return bodyY0 + minBodyH + 10;
        }

        const {jsPDF: jsPDFClass} = window.jspdf;
        const tempDoc = new jsPDFClass('l', 'mm', 'a4');
        const dryEndY = drawHtmlInPdf(tempDoc, html, innerX, 30, innerW, 9999, 0, innerX);
        const measuredH = dryEndY - 30;
        const realBodyH = Math.max(minBodyH, measuredH + padTop + padBot);

        if (startY + labelH + realBodyH > pageH - BOT_LIMIT) { doc.addPage(); startY = 20; }

        doc.setFillColor(150, 150, 150); doc.rect(margin, startY, blockW, labelH, 'F');
        doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.4); doc.rect(margin, startY, blockW, labelH, 'S');
        doc.setFontSize(9); doc.setTextColor(20, 20, 20); doc.setFont(undefined, 'bold');
        doc.text(label, margin + 6, startY + 6);

        const bodyY = startY + labelH;
        doc.setFillColor(255, 255, 255); doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.4);
        doc.rect(margin, bodyY, blockW, realBodyH, 'FD');
        drawHtmlInPdf(doc, html, innerX, bodyY + padTop, innerW, pageH, BOT_LIMIT, innerX);

        return bodyY + realBodyH + 10;
    }



    // GENERAR PDF
    $scope.generatePDF = function() {
        if(!$scope.tableData?.length){$scope.errorMessage='❌ No hay datos para exportar';return;}
        const archivosConCambios=$scope.tableData.filter(item=>(!item.existeEnActual||!item.existeEnFutura||item.versionChanged||item.sizeChanged));
        if(!archivosConCambios.length){$scope.errorMessage='❌ No hay archivos con cambios';return;}

        const {jsPDF}=window.jspdf;
        const doc=new jsPDF('l','mm','a4');
        const pageWidth=doc.internal.pageSize.getWidth(), pageHeight=doc.internal.pageSize.getHeight();
        const tableStyles=PdfStylesService.getTableStyles(),
              footerStyles=PdfStylesService.getFooterStyles(), dims=PdfStylesService.dimensions;
        const applyColor=c=>(Array.isArray(c)&&c.length===3)?c:[0,0,0];



        // PÁGINA 1: HEADER
        doc.setFillColor(29,33,28); doc.rect(0,0,pageWidth,42,'F');
        doc.setFillColor(221,244,52); doc.rect(0,42,pageWidth,2,'F');

        doc.setFontSize(28); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.text('F2X',20,20);
        doc.setFontSize(9);  doc.setTextColor(221,244,52);  doc.setFont(undefined,'normal'); doc.text('Flytech Simplexity',20,25);

        doc.setFontSize(13); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
        doc.text('F2X S.A.S', pageWidth/2, 17, {align:'center'});
        doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
        doc.text('FICHA TÉCNICA DE ACTUALIZACIÓN', pageWidth/2, 27, {align:'center'});

        const now=new Date();
        const d=String(now.getDate()).padStart(2,'0'), mo=String(now.getMonth()+1).padStart(2,'0'), yr=now.getFullYear();
        const fechaGeneracion = `${d}/${mo}/${yr}`;

        let currentY = 55;

        // CONTENIDO HTML DE CADA CAMPO
        const htmlSistema    = $scope.releaseDataRaw.sistema             || '';
        const htmlCaract     = $scope.releaseDataRaw.caracteristicas     || '';
        const htmlEquipos    = $scope.releaseDataRaw.equipos              || '';
        const htmlFecha      = $scope.releaseDataRaw.fechaFicha           || fechaGeneracion;
        const htmlCambios    = $scope.releaseDataRaw.cambiosAplicativos   || '';
        const htmlCambiosBD  = $scope.releaseDataRaw.cambiosBaseDatos     || '';
        const htmlCambiosCfg = $scope.releaseDataRaw.cambiosConfiguracion || '';
        const htmlObs        = $scope.releaseDataRaw.observaciones        || '';

        const tieneVigente = $scope.vigenteDesde instanceof Date && !isNaN($scope.vigenteDesde.getTime());
        const fechaFmt     = tieneVigente ? $scope.formatearVigente($scope.vigenteDesde) : '';


        // SISTEMA + VIGENTE A PARTIR DE
        const vigenteW  = 65;
        const gapW      = 5;
        const sistemaW  = pageWidth - dims.margin * 2 - vigenteW - gapW;
        const vigenteX  = dims.margin + sistemaW + gapW;
        const labelH    = 9;

        // Cabecera SISTEMA
        doc.setFillColor(150,150,150);
        doc.rect(dims.margin, currentY, sistemaW, labelH, 'F');
        doc.setDrawColor(20,20,20); doc.setLineWidth(0.4);
        doc.rect(dims.margin, currentY, sistemaW, labelH, 'S');
        doc.setFontSize(9); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
        doc.text('SISTEMA', dims.margin + sistemaW/2, currentY + 6, {align:'center'});

        // Cabecera VIGENTE A PARTIR DE
        doc.setFillColor(150,150,150);
        doc.rect(vigenteX, currentY, vigenteW, labelH, 'F');
        doc.setDrawColor(20,20,20); doc.setLineWidth(0.4);
        doc.rect(vigenteX, currentY, vigenteW, labelH, 'S');
        doc.setFontSize(8); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
        doc.text('VIGENTE A PARTIR DE', vigenteX + vigenteW/2, currentY + 6, {align:'center'});

        const sistemaHeaderY = currentY + labelH;

        let sistemaBodyH = 18;
        if (htmlSistema && htmlSistema.replace(/<[^>]+>/g,'').trim() !== '') {
            const {jsPDF: jsPDFClass} = window.jspdf;
            const tempDoc = new jsPDFClass('l','mm','a4');
            const dryEnd  = drawHtmlInPdf(tempDoc, htmlSistema, dims.margin+3, 30, sistemaW-6, 9999, 0, dims.margin+3);
            sistemaBodyH  = Math.max(18, (dryEnd - 30) + 12);
        }

        // Cuerpo SISTEMA
        doc.setFillColor(255,255,255); doc.setDrawColor(20,20,20); doc.setLineWidth(0.4);
        doc.rect(dims.margin, sistemaHeaderY, sistemaW, sistemaBodyH, 'FD');
        const sistemaTexto = htmlSistema ? htmlSistema.replace(/<[^>]+>/g,'').trim() : '';
        if (sistemaTexto !== '') {
            doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
            const sistemaLines = doc.splitTextToSize(sistemaTexto, sistemaW - 10);
            doc.text(sistemaLines, dims.margin + sistemaW / 2, sistemaHeaderY + sistemaBodyH / 2, {align:'center', baseline:'middle'});
        } else {
            doc.setFontSize(9); doc.setFont(undefined,'italic'); doc.setTextColor(160,160,160);
            doc.text('N/A', dims.margin + sistemaW/2, sistemaHeaderY + sistemaBodyH/2 + 1, {align:'center', baseline:'middle'});
        }


        // Cuerpo VIGENTE A PARTIR DE
        doc.setFillColor(255,255,255); doc.setDrawColor(20,20,20); doc.setLineWidth(0.4);
        doc.rect(vigenteX, sistemaHeaderY, vigenteW, sistemaBodyH, 'FD');
        doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
        doc.text(fechaFmt || 'N/A', vigenteX + vigenteW/2, sistemaHeaderY + sistemaBodyH/2, {align:'center', baseline:'middle'});

        currentY = sistemaHeaderY + sistemaBodyH + 8;



        // DESCRIPCIÓN RELEASE
        const tablaW  = pageWidth - dims.margin * 2;
        const labelW  = 65;

        // CABECERA DESCRIPCION RELEASE
        doc.setFillColor(150,150,150); doc.rect(dims.margin, currentY, tablaW, labelH, 'F');
        doc.setDrawColor(20,20,20); doc.setLineWidth(0.4); doc.rect(dims.margin, currentY, tablaW, labelH, 'S');
        doc.setFontSize(9); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
        doc.text('DESCRIPCIÓN RELEASE', dims.margin + tablaW/2, currentY + 6, {align:'center'});

        let filaY = currentY + labelH;

        const releaseRows = [
            { label:'CARACTERÍSTICAS',              html: htmlCaract  },
            { label:'EQUIPOS',                      html: htmlEquipos },
            { label:'FECHA DE GENERACIÓN DE FICHA', html: htmlFecha   }
        ];

        // Pre-calcular alturas
        const rowHeights = releaseRows.map(row => {
            const isEmpty = !row.html || row.html.replace(/<[^>]+>/g,'').trim() === '';
            if (isEmpty) return 18;
            const td = document.createElement('div');
            td.innerHTML = row.html;
            const lc = (td.innerText||'').split('\n').filter(l=>l.trim()).length;
            return Math.max(18, lc * 7 + 12);
        });

        releaseRows.forEach((row, rowIndex) => {
            const contentW = tablaW - labelW;
            const isEmpty  = !row.html || row.html.replace(/<[^>]+>/g,'').trim() === '';
            let rowH = rowHeights[rowIndex];

            doc.setFillColor(220,228,232); doc.rect(dims.margin, filaY, labelW, rowH, 'F');
            doc.setDrawColor(20,20,20); doc.setLineWidth(0.4);
            doc.rect(dims.margin, filaY, tablaW, rowH, 'S');
            doc.line(dims.margin+labelW, filaY, dims.margin+labelW, filaY+rowH);
            doc.setFontSize(8); doc.setTextColor(50,50,50); doc.setFont(undefined,'bold');
            doc.text(row.label, dims.margin+labelW/2, filaY+rowH/2+1, {align:'center', baseline:'middle'});

            if (isEmpty) {
                doc.setFont(undefined,'italic'); doc.setFontSize(9); doc.setTextColor(160,160,160);
                doc.text('N/A', dims.margin+labelW+contentW/2, filaY+rowH/2+1, {align:'center', baseline:'middle'});
            } else {
                const cellX = dims.margin + labelW + 3;
                const cellW = contentW - 6;
                const isFechaRow = row.label === 'FECHA DE GENERACIÓN DE FICHA';
                let endY, realRowH;
                if (isFechaRow) {
                    const fechaX = cellX + 4;
                    const fechaY = filaY + rowH / 2 + 1;
                    doc.setFontSize(11); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
                    doc.text(row.html.replace(/<[^>]+>/g,'').trim(), fechaX, fechaY, {baseline:'middle'});
                    endY = fechaY + 4;
                    realRowH = rowH;
                } else {
                    const cellTopY = filaY + 8;
                    endY     = drawHtmlInPdf(doc, row.html, cellX, cellTopY, cellW, pageHeight, 25, cellX);
                    realRowH = Math.max(rowH, endY - filaY + 8);
                }
                if (realRowH > rowH) {
                    doc.setFillColor(255,255,255); doc.rect(dims.margin+labelW, filaY+rowH-0.5, contentW, realRowH-rowH+1, 'F');
                    doc.setFillColor(220,228,232); doc.rect(dims.margin, filaY, labelW, realRowH, 'F');
                    doc.setDrawColor(20,20,20); doc.setLineWidth(0.4);
                    doc.rect(dims.margin, filaY, tablaW, realRowH, 'S');
                    doc.line(dims.margin+labelW, filaY, dims.margin+labelW, filaY+realRowH);
                    doc.setFontSize(8); doc.setTextColor(50,50,50); doc.setFont(undefined,'bold');
                    doc.text(row.label, dims.margin+labelW/2, filaY+realRowH/2+1, {align:'center', baseline:'middle'});
                    rowH = realRowH;
                }
            }
            filaY += rowH;
        });

        currentY = filaY + 8;

        // DESCRIPCION DE CAMBIOS DE APLICATIVOS
        currentY = drawHtmlBlock(doc, 'DESCRIPCIÓN DE CAMBIOS DE APLICATIVOS', htmlCambios, currentY, pageWidth, dims.margin, pageHeight);


        // DETALLE DE ARCHIVOS
        doc.addPage(); currentY = 20;
        const detalleW = pageWidth - dims.margin*2;
        doc.setFillColor(150,150,150); doc.rect(dims.margin, currentY, detalleW, 9, 'F');
        doc.setDrawColor(20,20,20); doc.setLineWidth(0.4); doc.rect(dims.margin, currentY, detalleW, 9, 'S');
        doc.setFontSize(9); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
        doc.text('DETALLE DE ARCHIVOS CON CAMBIOS', dims.margin+6, currentY+6);
        currentY += 12;

        doc.autoTable({
            startY: currentY,
            head:[["Archivo","Equipo / IP","Versión Actual","Peso Actual","Versión Futura","Peso Futuro","Ubicación"]],
            body:archivosConCambios.map(item=>[item.name,item.equipos||'-',item.versionActual||'-',item.pesoActual||'-',item.versionFutura||'-',item.pesoFuturo||'-',item.ruta||'']),
            theme:tableStyles.theme,
            headStyles:{...tableStyles.headStyles, fillColor:[29,33,28], textColor:[255,255,255], lineColor:[20,20,20], lineWidth:0.4},
            styles:{...tableStyles.bodyStyles, lineColor:[20,20,20], lineWidth:0.3},
            columnStyles:{
                0:{cellWidth:45,fontStyle:'bold'},
                1:{cellWidth:28,halign:'center',fontSize:7},
                2:{cellWidth:28,halign:'center',fontSize:7,overflow:'linebreak'},
                3:{cellWidth:20,halign:'center',fontSize:7},
                4:{cellWidth:28,halign:'center',fontSize:7,overflow:'linebreak'},
                5:{cellWidth:20,halign:'center',fontSize:7},
                6:{cellWidth:'auto',fontSize:7}
            },
            alternateRowStyles:tableStyles.alternateRowStyles, margin:{bottom:25},
            didParseCell: data => {
                if (data.section === 'body') {
                    const r = archivosConCambios[data.row.index];
                    if (r.changeType === 'has-changes') data.cell.styles.fillColor = [240,240,240];
                    if ((data.column.index === 2 || data.column.index === 4) && typeof data.cell.raw === 'string' && data.cell.raw.length > 12) {
                        data.cell.styles.fontSize = 6;
                    }
                }
            },
        });

        let finalY = doc.lastAutoTable.finalY + 5;
        const ld=applyColor(footerStyles.line.drawColor);
        doc.setDrawColor(ld[0],ld[1],ld[2]); doc.setLineWidth(footerStyles.line.lineWidth);
        doc.line(dims.margin, finalY, pageWidth-dims.margin, finalY);
        const sc=applyColor(footerStyles.summary.textColor);
        doc.setFontSize(footerStyles.summary.fontSize); doc.setTextColor(sc[0],sc[1],sc[2]); doc.setFont(undefined,footerStyles.summary.fontStyle);
        doc.text(doc.splitTextToSize(`Total comparados: ${$scope.tableData.length} | Con cambios: ${archivosConCambios.length} | Cambios versión: ${$scope.statistics.versionChanged} | Cambios tamaño: ${$scope.statistics.sizeChanged} | Sin cambios: ${$scope.statistics.noChanges}`, pageWidth-dims.margin*2), dims.margin, finalY+6);


        // IMAGENES
        if ($scope.imagenesAdjuntas.length > 0) {
            doc.addPage();
            let imgY = 25;
            doc.setFillColor(29,33,28); doc.rect(dims.margin, imgY, pageWidth-dims.margin*2, 12, 'F');
            doc.setFontSize(12); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
            doc.text('EVIDENCIAS DE PRUEBAS', dims.margin+(pageWidth-dims.margin*2)/2, imgY+8, {align:'center'});
            imgY += 20;

            $scope.imagenesAdjuntas.forEach((img,idx)=>{
                try {
                    const descLines = img.descripcion ? doc.splitTextToSize(img.descripcion, pageWidth-dims.margin*2-130) : [];
                    const blockH = 11 + 90 + 8;
                    if (imgY + blockH > pageHeight - 30) { doc.addPage(); imgY = 20; }
                    const imgW    = 120;
                    const descX   = dims.margin + imgW + 5;
                    const descW   = pageWidth - dims.margin - imgW - 5 - dims.margin;
                    const headerH = 11;

                    doc.setFillColor(245,245,245); doc.rect(dims.margin, imgY, imgW, headerH, 'F');
                    doc.setDrawColor(220,220,220); doc.setLineWidth(0.3); doc.rect(dims.margin, imgY, imgW, headerH, 'S');
                    doc.setFontSize(8); doc.setTextColor(56,56,56); doc.setFont(undefined,'bold');
                    const nombreLines = doc.splitTextToSize(`${idx+1}.  ${img.nombre}`, imgW-8);
                    doc.text(nombreLines[0], dims.margin+4, imgY + headerH/2 + 1, {baseline:'middle'});

                    doc.setFillColor(20,20,20); doc.rect(descX, imgY, descW, headerH, 'F');
                    doc.setDrawColor(20,20,20); doc.setLineWidth(0.5); doc.rect(descX, imgY, descW, headerH, 'S');
                    doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
                    doc.text('DESCRIPCIÓN', descX+descW/2, imgY + headerH/2, {align:'center', baseline:'middle'});

                    imgY += headerH;

                    doc.addImage(img.base64, 'JPEG', dims.margin, imgY, imgW, 90);
                    doc.setFillColor(252,252,252); doc.setDrawColor(20,20,20); doc.setLineWidth(0.5);
                    doc.rect(descX, imgY, descW, 90, 'FD');
                    if (descLines.length > 0) {
                        doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
                        doc.text(descLines, descX+4, imgY+7);
                    } else {
                        doc.setFontSize(9); doc.setFont(undefined,'italic'); doc.setTextColor(160,160,160);
                        doc.text('N/A', descX+descW/2, imgY+45, {align:'center', baseline:'middle'});
                    }
                    imgY += 90;
                    doc.setDrawColor(220,220,220); doc.setLineWidth(0.2); doc.line(dims.margin, imgY, pageWidth-dims.margin, imgY);
                    imgY += 8;
                } catch(e) { console.error(`❌ Error imagen ${idx+1}:`,e); }
            });
        }


        // ARCHIVOS SIN COINCIDENCIA
        doc.addPage();
        let finalPageY = 25;

        if ($scope.archivosSinCoincidencia.length > 0) {
            const scW = pageWidth - dims.margin*2;
            doc.setFillColor(150,150,150); doc.rect(dims.margin,finalPageY,scW,9,'F');
            doc.setDrawColor(20,20,20); doc.setLineWidth(0.4); doc.rect(dims.margin,finalPageY,scW,9,'S');
            doc.setFontSize(9); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
            doc.text('ARCHIVOS SIN COINCIDENCIAS', dims.margin+6, finalPageY+6);
            finalPageY += 12;

            doc.autoTable({
                startY: finalPageY,
                head:[["Archivo","Equipo / IP","Versión Actual","Peso Actual","Versión Futura","Peso Futuro","Ubicación"]],
                body:$scope.archivosSinCoincidencia.map(item=>[item.name,item.equipos||'-','N/A','N/A',item.version||'-',item.peso||'-',item.ubicacionUsuario||'N/A']),
                theme:tableStyles.theme,
                headStyles:{...tableStyles.headStyles, fillColor:[29,33,28], textColor:[255,255,255], lineColor:[20,20,20], lineWidth:0.4},
                styles:{...tableStyles.bodyStyles, lineColor:[20,20,20], lineWidth:0.3},
                columnStyles:{0:{cellWidth:50,fontStyle:'bold'},1:{cellWidth:28,halign:'center',fontSize:7},2:{cellWidth:24,halign:'center',fontSize:8,textColor:[189,189,189],fontStyle:'italic'},3:{cellWidth:20,halign:'center',fontSize:8,textColor:[189,189,189],fontStyle:'italic'},4:{cellWidth:38,halign:'center',fontSize:8},5:{cellWidth:20,halign:'center',fontSize:8},6:{cellWidth:'auto',fontSize:7,halign:'center'}},
                alternateRowStyles:tableStyles.alternateRowStyles, margin:{bottom:25},
                didParseCell: data => {
                    if (data.section === 'body' && data.column.index === 6 && data.cell.raw === 'N/A') {
                        data.cell.styles.textColor = [189,189,189];
                        data.cell.styles.fontStyle = 'italic';
                    }
                },
            });
            finalPageY = doc.lastAutoTable.finalY + 15;
        }

        finalPageY = drawHtmlBlock(doc, 'DESCRIPCIÓN DE CAMBIOS EN BASE DE DATOS',             htmlCambiosBD,  finalPageY, pageWidth, dims.margin, pageHeight);
        finalPageY = drawHtmlBlock(doc, 'DESCRIPCIÓN DE CAMBIOS EN ARCHIVOS DE CONFIGURACIÓN', htmlCambiosCfg, finalPageY, pageWidth, dims.margin, pageHeight);
                     drawHtmlBlock(doc, 'OBSERVACIONES',                                        htmlObs,        finalPageY, pageWidth, dims.margin, pageHeight);

        // FIRMAS
        doc.addPage();
        let firmasY = 20;
        const firmasW = pageWidth - dims.margin*2;
        const colGap=8, colW=(firmasW-colGap)/2;
        const cols=[{label:'APROBADO POR',x:dims.margin},{label:'ENTREGADO A',x:dims.margin+colW+colGap}];

        cols.forEach(col=>{
            doc.setFillColor(230,230,230); doc.rect(col.x,firmasY,colW,8,'F');
            doc.setDrawColor(20,20,20); doc.setLineWidth(0.3); doc.rect(col.x,firmasY,colW,8,'S');
            doc.setFontSize(7); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
            doc.text(col.label, col.x+colW/2, firmasY+5.5, {align:'center'});
        });
        firmasY += 8;
        cols.forEach(col=>{
            const bodyH=60;
            doc.setFillColor(255,255,255); doc.setDrawColor(20,20,20); doc.setLineWidth(0.3);
            doc.rect(col.x,firmasY,colW,bodyH,'FD');
            const innerMargin=colW*0.08, fieldW=colW-innerMargin*2;
            const nombreY=firmasY+12;
            doc.setFontSize(6.5); doc.setTextColor(100,100,100); doc.setFont(undefined,'bold');
            doc.text('NOMBRE:', col.x+innerMargin, nombreY);
            doc.setDrawColor(80,80,80); doc.setLineWidth(0.4);
            doc.line(col.x+innerMargin, nombreY+5, col.x+innerMargin+fieldW, nombreY+5);
            const firmaLineY=firmasY+bodyH-14;
            doc.setFontSize(6.5); doc.setTextColor(100,100,100); doc.setFont(undefined,'bold');
            doc.text('FIRMA:', col.x+innerMargin, firmaLineY-2);
            doc.setDrawColor(80,80,80); doc.setLineWidth(0.4);
            doc.line(col.x+innerMargin, firmaLineY+4, col.x+innerMargin+fieldW, firmaLineY+4);
        });

        const nombre = PdfStylesService.generateFileName($scope.directory1Name, $scope.directory2Name);
        doc.save(nombre);
        $scope.successMessage=`✅ PDF generado: ${nombre}`;
        $timeout(()=>$scope.successMessage='',4000);
    };
}]);