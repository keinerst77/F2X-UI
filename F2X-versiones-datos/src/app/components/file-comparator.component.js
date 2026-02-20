angular.module('fileComparatorApp')
.controller('FileComparatorController', ['$scope', '$http', '$timeout', 'PdfStylesService',
function($scope, $http, $timeout, PdfStylesService) {

    $scope.ipLocal = '10.0.134.153';
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

    // Datos de Descripción Release
    $scope.releaseData = {
        caracteristicas:    '',
        equipos:            '',
        fechaFicha:         '',
        cambiosAplicativos: '',
        cambiosBaseDatos: '',
        cambiosConfiguracion: '',
        observaciones: ''
    };

    const releaseLabels = {
        caracteristicas:    'CARACTERÍSTICAS',
        equipos:            'EQUIPOS',
        fechaFicha:         'FECHA DE GENERACIÓN DE FICHA',
        cambiosAplicativos: 'DESCRIPCIÓN DE CAMBIOS DE APLICATIVOS',
        cambiosBaseDatos:    'DESCRIPCIÓN DE CAMBIOS EN BASE DE DATOS',
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

    const API_URL            = 'https://localhost:7001/api/versionscanner';
    const MULTI_EQUIPO_API_URL = 'https://localhost:7001/api/multiequiposcan';
    const VALIDATION_API_URL = 'https://localhost:7001/api/powershellremotetest';
    const isElectron = window.electronAPI !== undefined;
    console.log('🖥️ Ejecutando en Electron:', isElectron);

    // Imágenes
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

    // Equipos remotos
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
        $http.post(VALIDATION_API_URL+'/test-simple',{ipEquipo:equipo.ipEquipo,usuario:equipo.usuario,password:equipo.password})
        .then(r => {
            if (r.data.success) {
                return $http.post(VALIDATION_API_URL+'/log-connection-event',{ipEquipo:equipo.ipEquipo,usuario:equipo.usuario,password:equipo.password})
                .then(()=>{ setConnected(equipo,r.data.output,'con Event Log'); }).catch(()=>{ setConnected(equipo,r.data.output,''); });
            } else { equipo.status='disconnected'; $scope.errorMessage=`❌ Error con ${equipo.ipEquipo}: ${r.data.errorMessage||'Conexión fallida'}`; }
        }).catch(err => { equipo.status='disconnected'; let m=`❌ No se pudo conectar a ${equipo.ipEquipo}`; if(err.status===-1)m+=': Backend no disponible'; else if(err.data?.errorMessage)m+=': '+err.data.errorMessage; $scope.errorMessage=m; });
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

    // Directorios
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
        $scope.releaseData = { caracteristicas:'', equipos:'', fechaFicha:'', cambiosAplicativos:'', cambiosBaseDatos:'', cambiosConfiguracion:'', observaciones:'' };
        const h=new Date(); h.setHours(0,0,0,0); $scope.vigenteDesde=h;
        $scope.imagenesAdjuntas=[];
        $scope.statistics={total:0,versionChanged:0,sizeChanged:0,noChanges:0};
        $scope.errorMessage='';$scope.successMessage='';
    };

    // Selector de carpetas
    $scope.openFolderDialog = async function(folderNumber) {
        if (!isElectron) { $scope.errorMessage='⚠️ Requiere Electron'; return; }
        try {
            const result = await window.electronAPI.selectFolder();
            if (result.success) {
                $scope.$apply(()=>{ if(folderNumber===1){$scope.directory1=result.fullPath;$scope.directory1Name=result.folderName;}else{$scope.directory2=result.fullPath;$scope.directory2Name=result.folderName;} });
            }
        } catch(e) { $scope.$apply(()=>$scope.errorMessage='❌ Error: '+e.message); }
    };

    // Escanear y comparar
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
        const p1=$http.post(MULTI_EQUIPO_API_URL+'/scan',{directoryPath:$scope.directory1,equiposRemotos:rutasActual,includeSubdirectories:true,searchPattern:'*.exe'}).catch(e=>({data:{success:false,message:e.message}}));
        const p2=$http.post(MULTI_EQUIPO_API_URL+'/scan',{directoryPath:$scope.directory2,equiposRemotos:rutasFutura,includeSubdirectories:true,searchPattern:'*.exe'}).catch(e=>({data:{success:false,message:e.message}}));
        Promise.all([p1,p2]).then(([r1,r2])=>{
            if(r1.data.success&&r2.data.success){
                $scope.file1Data=r1.data.archivosConsolidados||[]; $scope.file2Data=r2.data.archivosConsolidados||[];
                $scope.file1Count=$scope.file1Data.length; $scope.file2Count=$scope.file2Data.length;
                $scope.generateTableConValidacion();
            } else { $scope.$apply(()=>$scope.errorMessage='❌ '+(r1.data.message||r2.data.message||'Error multi-equipo')); }
            $scope.isScanning=false; $scope.$apply();
        }).catch(err=>{ $scope.$apply(()=>{$scope.errorMessage='❌ Error remotos: '+(err.message||'desconocido');$scope.isScanning=false;}); });
    }

    // Validar y generar tabla
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
                    name:             f2.name,
                    equipos:          (f2.equiposIps || [$scope.ipLocal]).join(', '),
                    equiposArray:     f2.equiposIps  || [$scope.ipLocal],
                    version:          f2.version,
                    peso:             f2.size,
                    ubicacion:        f2.fullPath || f2.relativePath,
                    ubicacionUsuario: '' 
                });
            }
        });
        statistics.total=tableData.length;
        $scope.tableData=tableData; $scope.archivosSinCoincidencia=archivosSinCoincidencia;
        $scope.statistics=statistics; $scope.showTable=true;
    };

    // Editor nativo
    $scope.abrirEditorCampo = function(campo) {
        if (!window.electronAPI?.openNativeTextarea) { $scope.errorMessage='❌ Función de entrada nativa no disponible'; return; }
        const titulo = releaseLabels[campo] || campo;
        window.electronAPI.openNativeTextarea({
            title:        titulo,
            placeholder:  `Ingrese ${titulo.toLowerCase()}...`,
            defaultValue: $scope.releaseData[campo] || '',
            fieldLabel:   titulo
        }).then(result=>{
            if (result !== null) {
                $scope.$apply(()=>{ $scope.releaseData[campo]=result; $scope.successMessage=`✅ "${titulo}" guardado`; });
                $timeout(()=>$scope.successMessage='',3000);
            }
        }).catch(()=>{ $scope.$apply(()=>$scope.errorMessage='❌ Error al abrir el editor'); });
    };

    // Generar PDF
    $scope.generatePDF = function() {
        if(!$scope.tableData?.length){$scope.errorMessage='❌ No hay datos para exportar';return;}
        const archivosConCambios=$scope.tableData.filter(item=>(!item.existeEnActual||!item.existeEnFutura||item.versionChanged||item.sizeChanged));
        if(!archivosConCambios.length){$scope.errorMessage='❌ No hay archivos con cambios';return;}

        const {jsPDF}=window.jspdf;
        const doc=new jsPDF('l','mm','a4');
        const pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight();
        const colors=PdfStylesService.colors,headerStyles=PdfStylesService.getHeaderStyles(),directoryStyles=PdfStylesService.getDirectoryCardStyles(),tableStyles=PdfStylesService.getTableStyles(),footerStyles=PdfStylesService.getFooterStyles(),dims=PdfStylesService.dimensions;
        const applyColor=c=>(Array.isArray(c)&&c.length===3)?c:[0,0,0];



        const bg=applyColor(headerStyles.background.fillColor);
        doc.setFillColor(29,33,28);doc.rect(0,0,pageWidth,headerStyles.background.height,'F');
        const lc2=applyColor(headerStyles.line.fillColor);
        doc.setFillColor(221,244,52);doc.rect(0,headerStyles.background.height,pageWidth,headerStyles.line.height,'F');
        doc.setFontSize(28);doc.setTextColor(255,255,255);doc.setFont(undefined,'bold');doc.text('F2X',20,22);
        doc.setFontSize(9);doc.setTextColor(221,244,52);doc.setFont(undefined,'normal');doc.text('Flytech Simplexity',20,29);
        doc.setFontSize(14);doc.setTextColor(255,255,255);doc.setFont(undefined,'bold');doc.text('Ficha Técnica - Reporte de Cambios',20,37);
        doc.setFontSize(9);doc.setTextColor(200,200,200);doc.setFont(undefined,'normal');
        const now=new Date(),h12=now.getHours()%12||12,mins=String(now.getMinutes()).padStart(2,'0'),ampm=now.getHours()>=12?'PM':'AM';
        const d=String(now.getDate()).padStart(2,'0'),mo=String(now.getMonth()+1).padStart(2,'0'),yr=now.getFullYear();
        doc.text(`Fecha de generación: ${d}/${mo}/${yr} ${h12}:${mins} ${ampm}`,pageWidth-15,15,{align:'right'});

        let currentY=55;


        // Descripción Release
        const txtCaracteristicas=$scope.releaseData.caracteristicas||'';
        const txtEquipos=$scope.releaseData.equipos||'';
        const txtFechaFicha=$scope.releaseData.fechaFicha||'';
        const txtCambios=$scope.releaseData.cambiosAplicativos||'';
        const txtCambiosBD=$scope.releaseData.cambiosBaseDatos||'';
        const txtCambiosCfg=$scope.releaseData.cambiosConfiguracion||'';
        const txtObservaciones=$scope.releaseData.observaciones||'';
        const tieneVigente=$scope.vigenteDesde instanceof Date&&!isNaN($scope.vigenteDesde.getTime());

        const releaseRows=[
            {label:'CARACTERÍSTICAS',              texto:txtCaracteristicas},
            {label:'EQUIPOS',                      texto:txtEquipos},
            {label:'FECHA DE GENERACIÓN DE FICHA', texto:txtFechaFicha}
        ];

        const hayContenido=releaseRows.some(r=>r.texto.trim()!=='')||tieneVigente;
        if(hayContenido){
            const vigenteW=tieneVigente?60:0,gapW=tieneVigente?5:0,tablaW=pageWidth-(dims.margin*2)-vigenteW-gapW,labelW=65;
            doc.setFillColor(150,150,150);doc.rect(dims.margin,currentY,tablaW,9,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,currentY,tablaW,9,'S');
            doc.setFontSize(9);doc.setTextColor(20,20,20);doc.setFont(undefined,'bold');doc.text('DESCRIPCIÓN RELEASE',dims.margin+6,currentY+6);
            let filaY=currentY+9;
            releaseRows.forEach(row=>{
                const isEmpty=!row.texto||row.texto.trim()==='';
                const displayText=isEmpty?'N/A':row.texto;
                const contentW=tablaW-labelW,lines=doc.splitTextToSize(displayText,contentW-4),rowH=Math.max(12,lines.length*5+6);
                doc.setFillColor(240,240,240);doc.rect(dims.margin,filaY,labelW,rowH,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,filaY,tablaW,rowH,'S');doc.line(dims.margin+labelW,filaY,dims.margin+labelW,filaY+rowH);
                doc.setFontSize(8);doc.setTextColor(50,50,50);doc.setFont(undefined,'bold');doc.text(row.label,dims.margin+labelW/2,filaY+rowH/2+1,{align:'center',baseline:'middle'});
                doc.setFont(undefined,isEmpty?'italic':'normal');doc.setFontSize(9);doc.setTextColor(isEmpty?160:20,isEmpty?160:20,isEmpty?160:20);
                if(isEmpty){
                    doc.text('N/A',dims.margin+labelW+contentW/2,filaY+rowH/2+1,{align:'center',baseline:'middle'});
                } else {
                    doc.text(lines,dims.margin+labelW+3,filaY+5);
                }
                filaY+=rowH;
            });
            if(tieneVigente){
                const vigenteX=dims.margin+tablaW+gapW,totalH=filaY-currentY,cuerpoH=totalH-9,fechaFmt=$scope.formatearVigente($scope.vigenteDesde);
                doc.setFillColor(150,150,150);doc.rect(vigenteX,currentY,vigenteW,9,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(vigenteX,currentY,vigenteW,9,'S');
                doc.setFontSize(8);doc.setTextColor(20,20,20);doc.setFont(undefined,'bold');doc.text('VIGENTE A PARTIR DE',vigenteX+vigenteW/2,currentY+6,{align:'center'});
                doc.setFillColor(255,255,255);doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(vigenteX,currentY+9,vigenteW,cuerpoH,'FD');
                doc.setFontSize(12);doc.setFont(undefined,'bold');doc.setTextColor(20,20,20);doc.text(fechaFmt,vigenteX+vigenteW/2,currentY+9+cuerpoH/2,{align:'center',baseline:'middle'});
            }
            currentY=filaY+6;
        }

        // Descripción de Cambios de Aplicativos en el PDF
        {
            const cambiosW=pageWidth-(dims.margin*2),labelH=9;
            const bodyTxt=txtCambios.trim()!=='' ? txtCambios : 'N/A';
            const cambiosLines=doc.splitTextToSize(bodyTxt,cambiosW-8);
            const cambiosBodyH=Math.max(14,cambiosLines.length*5+8);
            doc.setFillColor(150,150,150);doc.rect(dims.margin,currentY,cambiosW,labelH,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,currentY,cambiosW,labelH,'S');
            doc.setFontSize(9);doc.setTextColor(20,20,20);doc.setFont(undefined,'bold');doc.text('DESCRIPCIÓN DE CAMBIOS DE APLICATIVOS',dims.margin+6,currentY+6);
            doc.setFillColor(255,255,255);doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,currentY+labelH,cambiosW,cambiosBodyH,'FD');
            const isNA=bodyTxt==='N/A';
            doc.setFont(undefined,isNA?'italic':'normal');doc.setFontSize(9);doc.setTextColor(isNA?160:20,isNA?160:20,isNA?160:20);
            const naY=isNA ? currentY+labelH+cambiosBodyH/2+1 : currentY+labelH+6;
            doc.text(cambiosLines,isNA?dims.margin+cambiosW/2:dims.margin+4,naY,isNA?{align:'center',baseline:'middle'}:{});
            currentY+=labelH+cambiosBodyH+8;
        }

        // Siempre empezar página nueva para Detalle de Archivos
        doc.addPage();
        currentY = 20;
        const dk=applyColor(colors.F2X_DARK);
        // Header con mismo estilo que descripción de cambios
        const detalleW=pageWidth-(dims.margin*2),detalleLabelH=9;
        doc.setFillColor(150,150,150);doc.rect(dims.margin,currentY,detalleW,detalleLabelH,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,currentY,detalleW,detalleLabelH,'S');
        doc.setFontSize(9);doc.setTextColor(20,20,20);doc.setFont(undefined,'bold');doc.text('DETALLE DE ARCHIVOS CON CAMBIOS',dims.margin+6,currentY+6);
        currentY+=detalleLabelH+3;

        doc.autoTable({
            startY:currentY,
            head:[["Archivo","Equipo / IP","Versión Actual","Peso Actual","Versión Futura","Peso Futuro","Ubicación"]],
            body:archivosConCambios.map(item=>[item.name,item.equipos||'-',item.versionActual||'-',item.pesoActual||'-',item.versionFutura||'-',item.pesoFuturo||'-',item.ruta||'']),
            theme:tableStyles.theme,headStyles:{...tableStyles.headStyles, fillColor:[29,33,28], textColor:[255,255,255], lineColor:[20,20,20], lineWidth:0.4},styles:{...tableStyles.bodyStyles, lineColor:[20,20,20], lineWidth:0.3},
            columnStyles:{0:{cellWidth:50,fontStyle:'bold',textColor:colors.F2X_DARK},1:{cellWidth:30,halign:'center',fontSize:7},2:{cellWidth:22,halign:'center'},3:{cellWidth:20,halign:'center'},4:{cellWidth:22,halign:'center'},5:{cellWidth:20,halign:'center'},6:{cellWidth:'auto',fontSize:7,textColor:colors.GRAY_TEXT}},
            alternateRowStyles:tableStyles.alternateRowStyles,margin:{bottom:25},
            didParseCell:data=>{if(data.section==='body'){const r=archivosConCambios[data.row.index];if(r.changeType==='only-local')data.cell.styles.fillColor=[235,235,235];else if(r.changeType==='only-remote')data.cell.styles.fillColor=[225,225,225];else if(r.changeType==='has-changes')data.cell.styles.fillColor=[240,240,240];}},
        });

        let finalY=doc.lastAutoTable.finalY+5;
        const ld=applyColor(footerStyles.line.drawColor);doc.setDrawColor(ld[0],ld[1],ld[2]);doc.setLineWidth(footerStyles.line.lineWidth);doc.line(dims.margin,finalY,pageWidth-dims.margin,finalY);
        const sc=applyColor(footerStyles.summary.textColor);doc.setFontSize(footerStyles.summary.fontSize);doc.setTextColor(sc[0],sc[1],sc[2]);doc.setFont(undefined,footerStyles.summary.fontStyle);
        doc.text(doc.splitTextToSize(`Total comparados: ${$scope.tableData.length} | Con cambios: ${archivosConCambios.length} | Cambios versión: ${$scope.statistics.versionChanged} | Cambios tamaño: ${$scope.statistics.sizeChanged} | Sin cambios: ${$scope.statistics.noChanges}`,pageWidth-(dims.margin*2)),dims.margin,finalY+6);


        // IMÁGENES ADJUNTADAS
        if($scope.imagenesAdjuntas.length>0){
            doc.addPage();
            let imgY = 25;


            // Título sección con fondo oscuro
            doc.setFillColor(29,33,28);
            doc.rect(dims.margin, imgY, pageWidth-(dims.margin*2), 12, 'F');
            doc.setFontSize(12);
            doc.setTextColor(255,255,255);
            doc.setFont(undefined,'bold');
            doc.text('EVIDENCIAS DE PRUEBAS', dims.margin + (pageWidth-(dims.margin*2))/2, imgY+8, {align:'center'});
            imgY += 20;

            $scope.imagenesAdjuntas.forEach((img,idx)=>{
                try{
                    const descLines = img.descripcion ? doc.splitTextToSize(img.descripcion, pageWidth-(dims.margin*2)-130) : [];
                    const descH = descLines.length > 0 ? descLines.length*5 + 4 : 0;
                    const blockH = 14 + 90 + descH + 12;
                    if(imgY + blockH > pageHeight - 30){ doc.addPage(); imgY = 20; }

                    // Número y nombre del archivo con fondo sutil
                    doc.setFillColor(245,245,245);
                    doc.rect(dims.margin, imgY, pageWidth-(dims.margin*2), 10, 'F');
                    doc.setDrawColor(220,220,220);
                    doc.setLineWidth(0.3);
                    doc.rect(dims.margin, imgY, pageWidth-(dims.margin*2), 10, 'S');
                    doc.setFontSize(9);
                    doc.setTextColor(56,56,56);
                    doc.setFont(undefined,'bold');
                    doc.text(`${idx+1}.  ${img.nombre}`, dims.margin+4, imgY+7);
                    imgY += 12;

                    // Imagen
                    doc.addImage(img.base64, 'JPEG', dims.margin, imgY, 120, 90);

                    // Descripción al lado derecho
                    {
                        const descX = dims.margin + 125;
                        const descW = pageWidth - dims.margin - 125 - 5;
                        // Borde verde
                        doc.setFillColor(252,252,252);
                        doc.setDrawColor(190,214,47);
                        doc.setLineWidth(0.5);
                        doc.rect(descX, imgY, descW, 90, 'FD');
                        // Cabecera verde con título
                        doc.setFillColor(221,244,52);
                        doc.rect(descX, imgY, descW, 11, 'F');
                        doc.setFontSize(10);
                        doc.setTextColor(38,50,56);
                        doc.setFont(undefined,'bold');
                        doc.text('DESCRIPCIÓN', descX + descW/2, imgY + 7.5, {align:'center', baseline:'middle'});
                        // Contenido
                        if(descLines.length > 0){
                            doc.setFontSize(9);
                            doc.setFont(undefined,'normal');
                            doc.setTextColor(40,40,40);
                            doc.text(descLines, descX+4, imgY+17);
                        } else {
                            doc.setFontSize(9);
                            doc.setFont(undefined,'italic');
                            doc.setTextColor(160,160,160);
                            doc.text('N/A', descX+descW/2, imgY+52, {align:'center', baseline:'middle'});
                        }
                    }

                    imgY += 94;
                    // Separador entre imágenes
                    doc.setDrawColor(220,220,220);
                    doc.setLineWidth(0.2);
                    doc.line(dims.margin, imgY, pageWidth-dims.margin, imgY);
                    imgY += 8;


                }catch(e){console.error(`❌ Error imagen ${idx+1}:`,e);}
            });
        }

        // ARCHIVOS SIN COINCIDENCIAS
        if($scope.archivosSinCoincidencia.length>0){
            doc.addPage();
            let scY = 25;

            const scW=pageWidth-(dims.margin*2),scLabelH=9;
            doc.setFillColor(150,150,150);doc.rect(dims.margin,scY,scW,scLabelH,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,scY,scW,scLabelH,'S');
            doc.setFontSize(9);doc.setTextColor(20,20,20);doc.setFont(undefined,'bold');doc.text('ARCHIVOS SIN COINCIDENCIAS',dims.margin+6,scY+6);
            scY+=scLabelH+3;

            doc.autoTable({
                startY: scY,
                head:[["Archivo","Equipo / IP","Versión Actual","Peso Actual","Versión Futura","Peso Futuro","Ubicación"]],
                body:$scope.archivosSinCoincidencia.map(item=>[
                    item.name,
                    item.equipos||'-',
                    'N/A',
                    'N/A',
                    item.version||'-',
                    item.peso||'-',
                    item.ubicacionUsuario||'N/A'
                ]),
                theme:tableStyles.theme,headStyles:{...tableStyles.headStyles, fillColor:[29,33,28], textColor:[255,255,255], lineColor:[20,20,20], lineWidth:0.4},
                styles:{...tableStyles.bodyStyles, lineColor:[20,20,20], lineWidth:0.3},
                columnStyles:{
                    0:{cellWidth:50,fontStyle:'bold',textColor:colors.F2X_DARK},
                    1:{cellWidth:30,halign:'center',fontSize:7},
                    2:{cellWidth:22,halign:'center',textColor:[189,189,189],fontStyle:'italic'},
                    3:{cellWidth:20,halign:'center',textColor:[189,189,189],fontStyle:'italic'},
                    4:{cellWidth:22,halign:'center'},
                    5:{cellWidth:20,halign:'center'},
                    6:{cellWidth:'auto',fontSize:7,textColor:colors.GRAY_TEXT,halign:'center'}
                },
                alternateRowStyles:tableStyles.alternateRowStyles,
                margin:{bottom:25},
                didParseCell:data=>{
                    if(data.section==='body' && data.column.index===6){
                        const val=data.cell.raw;
                        if(val==='N/A'){data.cell.styles.fontStyle='italic';data.cell.styles.textColor=[180,180,180];data.cell.styles.halign='center';}
                    }
                },
            });

            // Bloques adicionales después de archivos sin coincidencias
            let extraY = doc.lastAutoTable.finalY + 15;

            // Helper para renderizar bloque con N/A si es vacío
            const drawBloque=(label,texto,y)=>{
                const w=pageWidth-(dims.margin*2),lH=9;
                const t=texto.trim()!=='' ? texto : 'N/A';
                const lines=doc.splitTextToSize(t,w-8);
                const bodyH=Math.max(14,lines.length*5+8);
                doc.setFillColor(150,150,150);doc.rect(dims.margin,y,w,lH,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,y,w,lH,'S');
                doc.setFontSize(9);doc.setTextColor(20,20,20);doc.setFont(undefined,'bold');doc.text(label,dims.margin+6,y+6);
                doc.setFillColor(255,255,255);doc.setDrawColor(20,20,20);doc.setLineWidth(0.4);doc.rect(dims.margin,y+lH,w,bodyH,'FD');
                const na=t==='N/A';
                doc.setFont(undefined,na?'italic':'normal');doc.setFontSize(9);doc.setTextColor(na?160:20,na?160:20,na?160:20);
                const textY=na ? y+lH+bodyH/2+1 : y+lH+6;
                doc.text(lines,na?dims.margin+w/2:dims.margin+4,textY,na?{align:'center',baseline:'middle'}:{});
                return y+lH+bodyH+10;
            };

            extraY=drawBloque('DESCRIPCIÓN DE CAMBIOS EN BASE DE DATOS',txtCambiosBD,extraY);
            extraY=drawBloque('DESCRIPCIÓN DE CAMBIOS EN ARCHIVOS DE CONFIGURACIÓN',txtCambiosCfg,extraY);
            drawBloque('OBSERVACIONES',txtObservaciones,extraY);
        }

        // SECCIÓN DE FIRMAS
        doc.addPage();
        let firmasY = 20;

        //  Columnas de APROBADO POR y ENTREGADO A
        const firmasW = pageWidth - (dims.margin * 2);
        const colCount = 2;
        const colGap = 8;
        const colW = (firmasW - colGap * (colCount - 1)) / colCount;
        const firmaH = 40;

        const cols = [
            { label: 'APROBADO POR', x: dims.margin },
            { label: 'ENTREGADO A',  x: dims.margin + colW + colGap }
        ];

        // Dibujar cabeceras de cada columna
        cols.forEach(col => {
            doc.setFillColor(230,230,230);
            doc.rect(col.x, firmasY, colW, 8, 'F');
            doc.setDrawColor(20,20,20); doc.setLineWidth(0.3);
            doc.rect(col.x, firmasY, colW, 8, 'S');
            doc.setFontSize(7); doc.setTextColor(20,20,20); doc.setFont(undefined,'bold');
            doc.text(col.label, col.x + colW/2, firmasY + 5.5, {align:'center'});
        });
        firmasY += 8;

        // Dibujar cuerpo de firma con campos de nombre y firma
        cols.forEach(col => {
            const bodyH = firmaH + 20;
            doc.setFillColor(255,255,255);
            doc.setDrawColor(20,20,20); doc.setLineWidth(0.3);
            doc.rect(col.x, firmasY, colW, bodyH, 'FD');

            const innerMargin = colW * 0.08;
            const fieldW = colW - innerMargin * 2;

            // Campo NOMBRE
            const nombreY = firmasY + 12;
            doc.setFontSize(6.5); doc.setTextColor(100,100,100); doc.setFont(undefined,'bold');
            doc.text('NOMBRE:', col.x + innerMargin, nombreY);
            doc.setDrawColor(80,80,80); doc.setLineWidth(0.4);
            doc.line(col.x + innerMargin, nombreY + 5, col.x + innerMargin + fieldW, nombreY + 5);

            // Campo FIRMA
            const firmaLineY = firmasY + bodyH - 14;
            doc.setFontSize(6.5); doc.setTextColor(100,100,100); doc.setFont(undefined,'bold');
            doc.text('FIRMA:', col.x + innerMargin, firmaLineY - 2);
            doc.setDrawColor(80,80,80); doc.setLineWidth(0.4);
            doc.line(col.x + innerMargin, firmaLineY + 4, col.x + innerMargin + fieldW, firmaLineY + 4);
        });

        const nombre=PdfStylesService.generateFileName($scope.directory1Name,$scope.directory2Name);
        doc.save(nombre);
        $scope.successMessage=`✅ PDF generado: ${nombre}`;
        $timeout(()=>$scope.successMessage='',4000);
    };
}]);