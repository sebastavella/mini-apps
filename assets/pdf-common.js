(function(){
'use strict';
var P=window.PDFX={},loaded={};
function load(src){
  return loaded[src]||(loaded[src]=new Promise(function(res,rej){
    var s=document.createElement('script');s.src=src;s.onload=res;
    s.onerror=function(){delete loaded[src];rej(new Error('No se pudo cargar un componente de la página. Recargá e intentá de nuevo.'))};
    document.head.appendChild(s);
  }));
}
P.need=function(n){
  if(n==='pdflib')return load('/assets/vendor/pdf-lib.min.js');
  if(n==='jszip')return load('/assets/vendor/jszip-3.10.2.min.js');
  if(n==='pdfjs')return load('/assets/vendor/pdfjs/pdf.min.js').then(function(){
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='/assets/vendor/pdfjs/pdf.worker.min.js';
  });
  return Promise.reject(new Error('componente desconocido'));
};
P.size=function(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(b<10240?1:0).replace('.',',')+' KB';
  return (b/1048576).toFixed(b<10485760?2:1).replace('.',',')+' MB';
};
P.esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
P.stem=function(name){return String(name||'documento').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'').trim().slice(0,80)||'documento'};
P.ext=function(name){var m=/\.([^.]+)$/.exec(name||'');return m?m[1].toLowerCase():''};
P.download=function(blob,name){
  var a=document.createElement('a'),u=URL.createObjectURL(blob);
  a.href=u;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(u)},4000);
};
P.msg=function(el,text,kind){
  el.className='msg'+(kind?' '+kind:'');el.textContent=text||'';el.hidden=!text;
};
P.readBuffer=function(file){
  return new Promise(function(res,rej){
    if(file.arrayBuffer)return file.arrayBuffer().then(res,rej);
    var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=function(){rej(r.error)};r.readAsArrayBuffer(file);
  });
};
/* Zona de arrastre: label.drop con un input[type=file] adentro */
P.dropzone=function(zone,opts){
  var input=zone.querySelector('input[type=file]');
  function take(list){
    var files=Array.prototype.slice.call(list||[]);
    if(!files.length)return;
    var ok=files.filter(function(f){return !opts.accept||opts.accept.indexOf(P.ext(f.name))>-1});
    var bad=files.length-ok.length;
    if(!opts.multiple)ok=ok.slice(0,1);
    opts.onFiles(ok,bad);
  }
  input.addEventListener('change',function(){take(input.files);input.value=''});
  ['dragenter','dragover'].forEach(function(t){zone.addEventListener(t,function(e){e.preventDefault();zone.classList.add('over')})});
  ['dragleave','drop'].forEach(function(t){zone.addEventListener(t,function(e){e.preventDefault();zone.classList.remove('over')})});
  zone.addEventListener('drop',function(e){take(e.dataTransfer&&e.dataTransfer.files)});
};
/* "1-3, 5, 8-10" -> [1,2,3,5,8,9,10]. Devuelve {pages} o {error} */
P.parseRanges=function(str,max){
  str=String(str||'').replace(/\s+/g,'');
  if(!str)return {error:'Escribí las páginas que querés, por ejemplo 1-3,5.'};
  var out=[],parts=str.split(',');
  for(var i=0;i<parts.length;i++){
    var p=parts[i];if(!p)continue;
    var m=/^(\d+)(?:-(\d+))?$/.exec(p);
    if(!m)return {error:'No entendí "'+p+'". Usá números y guiones, por ejemplo 1-3,5.'};
    var a=+m[1],b=m[2]?+m[2]:a;
    if(a<1||b<1||a>max||b>max)return {error:'Las páginas deben estar entre 1 y '+max+'.'};
    if(a>b){var t=a;a=b;b=t}
    for(var k=a;k<=b;k++)out.push(k);
  }
  if(!out.length)return {error:'Escribí las páginas que querés, por ejemplo 1-3,5.'};
  return {pages:out};
};
P.toRanges=function(pages){
  var s=pages.slice().sort(function(a,b){return a-b}),out=[],i=0;
  while(i<s.length){var j=i;while(j+1<s.length&&s[j+1]===s[j]+1)j++;out.push(j>i?s[i]+'-'+s[j]:String(s[i]));i=j+1}
  return out.join(',');
};
/* Envío a la API con progreso. Resuelve {blob,orig,size,note} */
P.api=function(path,fd,onProgress){
  return new Promise(function(res,rej){
    var x=new XMLHttpRequest();
    x.open('POST',(window.MA_API||'')+path);x.responseType='blob';x.timeout=170000;
    if(x.upload)x.upload.onprogress=function(e){if(e.lengthComputable&&onProgress)onProgress(e.loaded/e.total)};
    x.upload&&(x.upload.onload=function(){if(onProgress)onProgress(1)});
    x.onload=function(){
      if(x.status===200){
        var h=function(n){return x.getResponseHeader(n)};
        return res({blob:x.response,orig:+h('X-Original-Size')||0,size:+h('X-Result-Size')||x.response.size,note:h('X-Result-Note')||''});
      }
      var r=new FileReader();
      r.onload=function(){
        var m='No pudimos completar la operación. Probá de nuevo en un momento.';
        try{var j=JSON.parse(r.result);if(j&&j.error)m=j.error}catch(e){}
        rej(new Error(m));
      };
      r.readAsText(x.response||new Blob());
    };
    x.onerror=function(){rej(new Error('No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.'))};
    x.ontimeout=function(){rej(new Error('La operación tardó demasiado. Probá con un archivo más liviano.'))};
    x.send(fd);
  });
};
/* Herramienta tipo "subir un archivo, convertir en el servidor, descargar" */
P.serverTool=function(c){
  var $=function(s){return document.querySelector(s)};
  var zone=$('#drop'),info=$('#fileinfo'),go=$('#go'),st=$('#status'),res=$('#result'),bar=$('#bar'),file=null,busy=false;
  var maxMB=window.MA_MAX_MB||25;
  function reset(){res.innerHTML='';res.hidden=true}
  function setFile(f){
    file=f;reset();P.msg(st,'');
    if(!f){info.hidden=true;go.disabled=true;return}
    info.hidden=false;
    info.innerHTML='<span class="fname">'+P.esc(f.name)+'</span><span class="fsize">'+P.size(f.size)+'</span><button type="button" class="btn ghost sm" id="clear">Quitar</button>';
    $('#clear').onclick=function(){if(!busy)setFile(null)};
    go.disabled=false;
  }
  P.dropzone(zone,{accept:c.accept,multiple:false,onFiles:function(files,bad){
    if(busy)return;
    if(!files.length){P.msg(st,'Ese formato no es compatible. Probá con: '+c.accept.map(function(e){return '.'+e}).join(', ')+'.','err');return}
    if(files[0].size>maxMB*1048576){P.msg(st,'El archivo pesa '+P.size(files[0].size)+' y el límite es de '+maxMB+' MB.','err');return}
    setFile(files[0]);
  }});
  go.addEventListener('click',function(){
    if(!file||busy)return;
    busy=true;go.disabled=true;reset();bar.hidden=false;bar.firstElementChild.style.width='0%';
    P.msg(st,'Subiendo el archivo…','info');
    var fd=new FormData();fd.append('file',file);if(c.extra)c.extra(fd);
    P.api(c.endpoint,fd,function(p){
      bar.firstElementChild.style.width=Math.round(p*100)+'%';
      P.msg(st,p>=1?'Procesando en el servidor…':'Subiendo el archivo… '+Math.round(p*100)+' %','info');
    }).then(function(r){
      var name=c.outName(file.name);
      P.msg(st,'');
      res.hidden=false;
      res.innerHTML=c.resultHtml(r,file);
      var b=res.querySelector('[data-dl]');
      if(b)b.onclick=function(){P.download(r.blob,name)};
      if(!(c.skipAuto&&c.skipAuto(r)))P.download(r.blob,name);
    }).catch(function(e){P.msg(st,e.message,'err')}).then(function(){
      busy=false;go.disabled=!file;bar.hidden=true;
    });
  });
};
})();
