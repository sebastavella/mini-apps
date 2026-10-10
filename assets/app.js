(function(){
'use strict';
var MA=window.MA={};
MA.$=function(s,r){return (r||document).querySelector(s)};
MA.$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var cache={};
MA.nf=function(d,min){var k=d+'|'+(min||0);return cache[k]||(cache[k]=new Intl.NumberFormat('es-AR',{maximumFractionDigits:d,minimumFractionDigits:min||0}))};
MA.fmt=function(n,d){if(n==null||!isFinite(n))return '\u2014';return MA.nf(d==null?2:d).format(n)};
var cur;
MA.money=function(n){if(n==null||!isFinite(n))return '\u2014';cur=cur||new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});return cur.format(n)};
MA.num=function(el){if(!el)return null;var v=String(el.value).trim().replace(',','.');if(v==='')return null;var n=Number(v);return isFinite(n)?n:null};
MA.randInt=function(max){
  if(max<=1)return 0;
  var a=new Uint32Array(1),lim=Math.floor(4294967296/max)*max,x;
  do{crypto.getRandomValues(a);x=a[0]}while(x>=lim);
  return x%max;
};
MA.shuffle=function(arr){for(var i=arr.length-1;i>0;i--){var j=MA.randInt(i+1),t=arr[i];arr[i]=arr[j];arr[j]=t}return arr};
MA.today=function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
MA.copy=function(text,btn){
  function done(){if(!btn)return;var o=btn.getAttribute('data-label')||btn.textContent;btn.setAttribute('data-label',o);btn.textContent='Copiado';setTimeout(function(){btn.textContent=o},1400)}
  function fallback(){var t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(t);done()}
  if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done,fallback)}else{fallback()}
};
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-copy]');if(!b)return;
  var el=document.querySelector(b.getAttribute('data-copy'));if(!el)return;
  MA.copy('value' in el?el.value:el.textContent,b);
});
var f=MA.$('#filter');
if(f){
  var norm=function(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()};
  f.addEventListener('input',function(){
    var q=norm(f.value.trim()),shown=0;
    MA.$$('.tile[data-s]').forEach(function(t){var ok=!q||norm(t.getAttribute('data-s')).indexOf(q)>-1;t.style.display=ok?'':'none';if(ok)shown++});
    MA.$$('section[data-cat]').forEach(function(s){var any=MA.$$('.tile',s).some(function(t){return t.style.display!=='none'});s.style.display=any?'':'none'});
    MA.$('#none').style.display=shown?'none':'block';
  });
}
})();
