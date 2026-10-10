
(function(){
const RWH = {'1:1':[1,1],'4:5':[4,5],'9:16':[9,16],'1.91:1':[1.91,1],'16:9':[16,9],'4:1':[4,1],'IAB':[300,250]};
const RATIOS = ['1:1','4:5','9:16','1.91:1','16:9','4:1','IAB'];
const PLAT = {meta:'Meta Ads', google:'Google Ads', kit:'Kit de producción'};

const GROUPS = {
  meta:[
    {id:'feed', name:'Feed', desc:'El feed de Facebook e Instagram admite imagen o video, cuadrado o vertical. Es la ubicación más versátil: el mismo archivo sirve para feed, Marketplace y buena parte de las ubicaciones automáticas.'},
    {id:'vertical', name:'Stories y Reels', desc:'Stories y Reels de Facebook e Instagram comparten desde 2026 una única zona segura 9:16, así que un mismo archivo vertical sirve en las cuatro ubicaciones. Activá <b>Mostrar zonas seguras</b> para ver las franjas que tapa la interfaz.'},
    {id:'multi', name:'Carrusel y Colección', desc:'Formatos de varias piezas dentro de un mismo anuncio: tarjetas deslizables o una portada con catálogo debajo.'},
    {id:'otras', name:'Otras ubicaciones', desc:'Ubicaciones de menor volumen, todavía disponibles cuando configurás las ubicaciones de forma manual.'}
  ],
  google:[
    {id:'busqueda', name:'Búsqueda', desc:'Los anuncios de búsqueda responsivos son <b>solo texto</b>: no admiten imagen ni video. Google combina los títulos y descripciones que cargás para armar la mejor versión en cada búsqueda.', extra:'serp', search:'rsa responsive search texto titulos descripciones sitelinks rutas url'},
    {id:'display', name:'Display', desc:'La Red de Display llega a millones de sitios y apps. Hay dos caminos: <b>anuncios responsivos</b>, donde Google arma el anuncio combinando tus recursos, o <b>banners subidos</b> en tamaños fijos IAB con control total del diseño.'},
    {id:'video', name:'Video y YouTube', short:'YouTube', desc:'Todo el inventario de video corre sobre YouTube y los sitios del programa de socios de video. El formato define cuánto interrumpe y dónde aparece.'},
    {id:'shopping', name:'Shopping', desc:'Shopping no usa creatividades armadas a mano: imagen, título, precio y disponibilidad salen del <b>feed de productos de Merchant Center</b>. Lo que se optimiza es la calidad del feed, no un archivo de diseño.', extra:'shopping', extraPos:'after', search:'merchant center feed ecommerce producto'},
    {id:'demandgen', name:'Demand Gen', short:'Demand Gen', desc:'Demand Gen reemplazó a Discovery y muestra creatividad visual en YouTube (Shorts e in-feed), Discover y Gmail. Pensado para descubrimiento y consideración, no para intención de búsqueda activa.'},
    {id:'pmax', name:'Performance Max', short:'PMax', desc:'Performance Max no elige una ubicación: combina los recursos que cargás y los distribuye entre Búsqueda, Display, YouTube, Gmail, Maps y Discover según la señal de conversión. Cuantos más formatos cargues, más inventario cubre.', extra:'pmax', extraPos:'after', search:'pmax titulos largos descripciones texto'},
    {id:'app', name:'App', desc:'Las campañas de App funcionan como Performance Max pero orientadas a instalaciones o acciones dentro de la app. Google arma y distribuye los anuncios entre Búsqueda, Google Play, YouTube, Discover y Display.', extra:'app', search:'aplicacion instalaciones google play html5 titulos descripciones'}
  ]
};

const ITEMS = [
  // META — feed
  {plat:'meta',group:'feed',name:'Feed cuadrado',ratios:['1:1'],short:'1080×1080',dims:'1080 × 1080 px',min:'600 × 600 px',weight:'30 MB / 4 GB',media:'Imagen y video',use:'El más predecible para probar creatividades entre feed, Marketplace y ubicaciones automáticas sin recortes agresivos.'},
  {plat:'meta',group:'feed',name:'Feed vertical',ratios:['4:5'],short:'1080×1350',dims:'1080 × 1350 px',min:'600 × 750 px',weight:'30 MB / 4 GB',media:'Imagen y video',use:'Ocupa más pantalla en mobile que el cuadrado; suele mejorar el CTR en feed sin sentirse recortado.'},
  {plat:'meta',group:'feed',name:'Link horizontal',ratios:['1.91:1'],short:'1200×628',dims:'1200 × 628 px',min:'600 × 314 px',weight:'30 MB',media:'Imagen',use:'Anuncios de tráfico con imagen apaisada. Formato legado, todavía válido para desktop y como portada de Colección.'},
  // META — vertical
  {plat:'meta',group:'vertical',name:'Stories',ratios:['9:16'],short:'1080×1920',dims:'1080 × 1920 px',weight:'30 MB / 4 GB',media:'Imagen y video',safe:true,specs:[['Zona segura','centro 1080 × 1420'],['Duración','hasta 15 s por tarjeta']],use:'Mensaje corto e inmersivo entre stories orgánicas. Dejá libres 250 px arriba y abajo para no chocar con la interfaz.'},
  {plat:'meta',group:'vertical',name:'Reels',ratios:['9:16'],short:'1080×1920',dims:'1080 × 1920 px',weight:'30 MB / 4 GB',media:'Imagen y video',safe:true,specs:[['Duración','hasta 90 s (15–30 s ideal)'],['Audio','se consume con sonido']],use:'La ubicación con más volumen de impresiones en Meta; conviene pensar el creativo en video primero.'},
  // META — multi
  {plat:'meta',group:'multi',name:'Carrusel',ratios:['1:1'],short:'por tarjeta',dims:'1080 × 1080 px por tarjeta',weight:'30 MB por tarjeta',media:'Imagen y video',specs:[['Tarjetas','de 2 a 10'],['Regla','no mezclar 4:5 y 1:1']],use:'Varios productos, beneficios o pasos en un solo anuncio deslizable. Meta recorta el 4:5 a 1:1, así que conviene diseñar en cuadrado.'},
  {plat:'meta',group:'multi',name:'Colección (portada)',ratios:['1.91:1'],short:'1200×628',dims:'1200 × 628 px',weight:'30 MB / 4 GB',media:'Imagen o video',specs:[['Debajo','grilla de productos 1:1'],['Al tocar','abre Instant Experience']],use:'Vidriera tipo catálogo que abre una experiencia a pantalla completa. Pensado para e-commerce con catálogo conectado.'},
  // META — otras
  {plat:'meta',group:'otras',name:'In-stream video',ratios:['16:9'],short:'1920×1080',dims:'1920 × 1080 px',weight:'4 GB',media:'Video',specs:[['Alternativa','1:1'],['Contexto','dentro de videos de Facebook']],use:'Anuncios de 5 a 15 s que aparecen dentro de videos de otros creadores en Facebook.'},
  {plat:'meta',group:'otras',name:'Columna derecha',ratios:['1:1'],short:'1080×1080',dims:'1080 × 1080 px',min:'254 × 254 px',weight:'30 MB',media:'Imagen',specs:[['Alcance','solo desktop']],use:'Inventario chico y de bajo costo al costado del feed de escritorio; sirve más para volumen que para impacto creativo.'},
  {plat:'meta',group:'otras',name:'Messenger inbox',ratios:['1:1'],short:'1080×1080',dims:'1080 × 1080 px',weight:'30 MB',media:'Imagen y video',specs:[['Alternativa','4:5']],use:'Reutiliza el asset del feed cuadrado; útil para campañas de mensajes o retargeting liviano.'},
  {plat:'meta',group:'otras',name:'Marketplace',ratios:['1:1','4:5'],short:'1080×1080',dims:'1080 × 1080 px',weight:'30 MB / 4 GB',media:'Imagen y video',specs:[['Alternativa','1080 × 1350 px']],use:'Aparece entre publicaciones de compraventa; no necesita arte propio, hereda el set de feed.'},

  // GOOGLE — display responsivo
  {plat:'google',group:'display',sub:'Anuncios responsivos (RDA)',name:'Imagen horizontal',ratios:['1.91:1'],short:'1200×628',dims:'1200 × 628 px',min:'600 × 314 px',weight:'5.120 KB',media:'Imagen',specs:[['Carga','requerida']],use:'Imagen principal para la mayoría de los espacios de Display.'},
  {plat:'google',group:'display',sub:'Anuncios responsivos (RDA)',name:'Imagen cuadrada',ratios:['1:1'],short:'1200×1200',dims:'1200 × 1200 px',min:'300 × 300 px',weight:'5.120 KB',media:'Imagen',specs:[['Carga','requerida']],use:'Espacios chicos o cuadrados dentro de apps y sitios.'},
  {plat:'google',group:'display',sub:'Anuncios responsivos (RDA)',name:'Logo horizontal',ratios:['4:1'],short:'512×128',dims:'512 × 128 px',weight:'5.120 KB',media:'Imagen',specs:[['Carga','recomendada']],use:'Branding dentro del anuncio que Google ensambla automáticamente.'},
  {plat:'google',group:'display',sub:'Anuncios responsivos (RDA)',name:'Logo cuadrado',ratios:['1:1'],short:'128×128',dims:'128 × 128 px',weight:'5.120 KB',media:'Imagen',specs:[['Carga','requerida']],use:'Identifica la marca en espacios chicos y formatos nativos.'},
  // GOOGLE — display banners
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Rectángulo mediano',ratios:['IAB'],box:[300,250],short:'300×250',dims:'300 × 250 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'El tamaño con más inventario; funciona en desktop y mobile.'},
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Rectángulo grande',ratios:['IAB'],box:[336,280],short:'336×280',dims:'336 × 280 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'Dentro del contenido, entre párrafos de artículos.'},
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Leaderboard',ratios:['IAB'],box:[728,90],short:'728×90',dims:'728 × 90 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'Franja horizontal arriba del contenido en desktop.'},
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Leaderboard grande',ratios:['IAB'],box:[970,90],short:'970×90',dims:'970 × 90 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'Ocupa el ancho completo; suele ir al tope de la página o entre bloques.'},
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Rascacielos ancho',ratios:['IAB'],box:[160,600],short:'160×600',dims:'160 × 600 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'Columnas laterales en desktop.'},
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Media página',ratios:['IAB'],box:[300,600],short:'300×600',dims:'300 × 600 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'Alto impacto visual; útil para campañas de marca.'},
  {plat:'google',group:'display',sub:'Banners subidos, tamaños fijos IAB',name:'Banner móvil',ratios:['IAB'],box:[320,50],short:'320×50',dims:'320 × 50 px',weight:'150 KB',media:'JPG, PNG, GIF o HTML5',use:'Franja arriba o abajo de la pantalla en mobile.'},
  // GOOGLE — video
  {plat:'google',group:'video',name:'In-stream saltable',ratios:['16:9'],short:'1920×1080',dims:'1920 × 1080 px',media:'Video en YouTube',specs:[['Duración','sin máximo (ideal < 3 min)'],['Salto','después de 5 s'],['Cobro','por vista o interacción']],use:'El más flexible: se paga cuando el usuario mira 30 s o interactúa.'},
  {plat:'google',group:'video',name:'In-stream no saltable',ratios:['16:9'],short:'1920×1080',dims:'1920 × 1080 px',media:'Video en YouTube',specs:[['Duración','hasta 15 s (30 s en TV)'],['Salto','no permite'],['Cobro','por CPM']],use:'Garantiza el mensaje completo; ideal para awareness con un guion corto y cerrado.'},
  {plat:'google',group:'video',name:'Bumper',ratios:['16:9','9:16'],short:'6 s',dims:'1920 × 1080 o 1080 × 1920 px',media:'Video en YouTube',specs:[['Duración','hasta 6 s'],['Salto','no permite'],['Cobro','por CPM']],use:'Refuerzo de marca ultra corto, pensado como complemento de una campaña más larga.'},
  {plat:'google',group:'video',name:'In-feed',ratios:['16:9'],short:'miniatura',dims:'miniatura + texto',media:'Video en YouTube',specs:[['Aparece en','resultados, inicio, relacionados'],['Reproducción','la elige el usuario']],use:'Se ve como un resultado orgánico; el usuario decide hacer clic para reproducir.'},
  {plat:'google',group:'video',name:'YouTube Shorts',ratios:['9:16'],short:'1080×1920',dims:'1080 × 1920 px',media:'Video en YouTube',specs:[['Duración','hasta 60 s']],use:'Aparece entre Shorts orgánicos; necesita diseño vertical nativo, no un recorte de un 16:9.'},
  // GOOGLE — shopping
  {plat:'google',group:'shopping',name:'Imagen de producto',ratios:['1:1'],short:'800×800',dims:'800 × 800 px o más',min:'100 × 100 px (250 × 250 en indumentaria)',media:'Imagen desde el feed',specs:[['Fondo','neutro, sin texto superpuesto']],use:'Se muestra tal cual la sube el feed: producto centrado, sin marcas de agua ni promociones incrustadas.'},
  {plat:'google',group:'shopping',kind:'info',name:'Datos requeridos del feed',ratios:[],specs:[['Título','hasta 150 caracteres'],['Precio y disponibilidad','siempre actualizados'],['ID, marca y GTIN','requeridos'],['Categoría','taxonomía de Google']],use:'La calidad y frescura del feed decide si el producto es elegible para mostrarse.'},
  // GOOGLE — demand gen
  {plat:'google',group:'demandgen',name:'Imagen horizontal',ratios:['1.91:1'],short:'1200×628',dims:'1200 × 628 px',min:'600 × 314 px',weight:'5.120 KB',media:'Imagen',use:'Discover y Gmail, principalmente.'},
  {plat:'google',group:'demandgen',name:'Imagen cuadrada',ratios:['1:1'],short:'1200×1200',dims:'1200 × 1200 px',min:'300 × 300 px',weight:'5.120 KB',media:'Imagen',use:'Feeds mixtos y tarjetas de carrusel.'},
  {plat:'google',group:'demandgen',name:'Imagen vertical',ratios:['4:5'],short:'960×1200',dims:'960 × 1200 px',min:'480 × 600 px',weight:'5.120 KB',media:'Imagen',use:'Feeds mobile, con más presencia en pantalla.'},
  {plat:'google',group:'demandgen',name:'Video horizontal',ratios:['16:9'],short:'1920×1080',dims:'1920 × 1080 px',media:'Video en YouTube',use:'Ubicaciones in-feed dentro de YouTube y Discover.'},
  {plat:'google',group:'demandgen',name:'Video vertical',ratios:['9:16'],short:'1080×1920',dims:'1080 × 1920 px',media:'Video en YouTube',specs:[['Duración','hasta 60 s en Shorts']],use:'Cargar ambas orientaciones amplía dónde puede aparecer el anuncio.'},
  {plat:'google',group:'demandgen',name:'Carrusel',ratios:['1:1','1.91:1'],short:'por tarjeta',dims:'1200 × 1200 o 1200 × 628 px',weight:'5.120 KB',media:'Imagen',specs:[['Tarjetas','de 2 a 10'],['Título por tarjeta','40 caracteres']],use:'Catálogo o secuencia narrativa dentro del feed.'},
  // GOOGLE — pmax
  {plat:'google',group:'pmax',name:'Imagen horizontal',ratios:['1.91:1'],short:'1200×628',dims:'1200 × 628 px',min:'600 × 314 px',weight:'5.120 KB',media:'Imagen',specs:[['Cantidad','hasta 20 (3 recomendadas)']],use:'Base para Display, Discover y Gmail.'},
  {plat:'google',group:'pmax',name:'Imagen cuadrada',ratios:['1:1'],short:'1200×1200',dims:'1200 × 1200 px',min:'300 × 300 px',weight:'5.120 KB',media:'Imagen',specs:[['Cantidad','hasta 20 (3 recomendadas)']],use:'Espacios cuadrados y feeds.'},
  {plat:'google',group:'pmax',name:'Imagen vertical',ratios:['4:5'],short:'960×1200',dims:'960 × 1200 px',min:'480 × 600 px',weight:'5.120 KB',media:'Imagen',specs:[['Cantidad','1 recomendada']],use:'Suma presencia en feeds mobile.'},
  {plat:'google',group:'pmax',name:'Logo cuadrado',ratios:['1:1'],short:'128×128',dims:'128 × 128 px',weight:'5.120 KB',media:'Imagen',specs:[['Carga','requerida']],use:'Aparece en casi todas las combinaciones.'},
  {plat:'google',group:'pmax',name:'Logo horizontal',ratios:['4:1'],short:'512×128',dims:'512 × 128 px',weight:'5.120 KB',media:'Imagen',specs:[['Carga','recomendada']],use:'Espacios apaisados de marca.'},
  {plat:'google',group:'pmax',name:'Video',ratios:['16:9','9:16'],short:'YouTube',dims:'video subido a YouTube',media:'Video en YouTube',specs:[['Si falta','Google puede generar uno']],use:'Cargar video propio evita que Google arme uno automático con tus imágenes.'}
];

const KIT = [
  {r:'9:16', px:[[1080,1920]], master:'1080 × 1920 px', short:'1080×1920', note:'Stories, Reels, Shorts y video vertical. Conviene diseñar primero acá: un vertical se recorta bien a cuadrado, al revés no.'},
  {r:'4:5', px:[[1080,1350]], master:'1080 × 1350 px', short:'1080×1350', note:'Feed mobile en Meta e imagen vertical en Demand Gen y Performance Max (Google acepta desde 480 × 600).'},
  {r:'1:1', px:[[1200,1200],[128,128]], master:'1200 × 1200 px', short:'1200×1200', note:'Cubre el recomendado de Google y supera el de Meta, así que un solo archivo sirve en ambas. Sumá el logo de 128 × 128 para Google.'},
  {r:'1.91:1', px:[[1200,628]], master:'1200 × 628 px', short:'1200×628', note:'El mismo archivo sirve para link en Meta y horizontal en Display, Demand Gen y Performance Max.'},
  {r:'16:9', px:[[1920,1080]], master:'1920 × 1080 px', short:'1920×1080', note:'Video horizontal para in-stream de Meta y YouTube.'},
  {r:'4:1', px:[[512,128]], master:'512 × 128 px', short:'512×128', note:'Solo Google: logo horizontal para Display y Performance Max.'},
  {r:'IAB', px:[[300,250],[336,280],[728,90],[970,90],[160,600],[300,600],[320,50]], master:'300×250, 336×280, 728×90, 970×90, 160×600, 300×600, 320×50', short:'IAB', note:'Solo si vas con banners subidos en Display. Tope de 150 KB por pieza.'}
];

// --- helpers
const $ = s => document.querySelector(s);
const store = {
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/×/g,'x').replace(/\s+/g,'');
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const f = n => Math.round(n*10)/10;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const groupName = (p,g) => (GROUPS[p]||[]).find(x=>x.id===g)?.name || '';
const groupShort = (p,g) => { const x=(GROUPS[p]||[]).find(x=>x.id===g); return x ? (x.short||x.name) : ''; };
const plural = (n,a,b) => n+' '+(n===1?a:b);

ITEMS.forEach(i=>{
  i.kind = i.kind || 'card';
  i.id = i.plat+'-'+i.group+'-'+slug(i.name);
  if(!i.box && i.ratios.length) i.box = RWH[i.ratios[0]];
  i.hay = norm([i.name,i.dims,i.short,i.min,i.media,i.use,i.sub,groupName(i.plat,i.group),i.ratios.join(' '),(i.specs||[]).flat().join(' ')].join(' '));
});

// --- state
const validPlat = p => ['meta','google','kit'].includes(p);
const hash = location.hash.slice(1);
const state = {
  plat: validPlat(hash.split('-')[0]) ? hash.split('-')[0] : store.get('fmt-plat','meta'),
  q:'', ratio:null,
  safe: store.get('fmt-safe', true),
  sel: new Set(store.get('fmt-kit-sel', [])),
  theme: store.get('fmt-theme','auto')
};
if(!validPlat(state.plat)) state.plat='meta';
let pendingAnchor = hash.includes('-') ? hash : null;

// --- swatch svg
function swatch(item, label){
  const W=200,H=150,P=18;
  const [bw,bh] = item.box;
  let s = Math.min((W-P*2)/bw,(H-P*2)/bh);
  if(item.ratios && item.ratios[0]==='IAB') s = Math.min(s, 0.17);
  const rw=bw*s, rh=bh*s, x=(W-rw)/2, y=(H-rh)/2;
  const g=3,l=7;
  let o=`<svg class="sw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label||item.short||'proporción')}">`;
  o+=`<rect class="art" x="${f(x)}" y="${f(y)}" width="${f(rw)}" height="${f(rh)}"/>`;
  if(item.safe && state.safe){
    const b = rh*250/1920;
    o+=`<rect class="sz" x="${f(x)}" y="${f(y)}" width="${f(rw)}" height="${f(b)}"/><rect class="sz" x="${f(x)}" y="${f(y+rh-b)}" width="${f(rw)}" height="${f(b)}"/>`;
    o+=`<line class="szl" x1="${f(x)}" y1="${f(y+b)}" x2="${f(x+rw)}" y2="${f(y+b)}"/><line class="szl" x1="${f(x)}" y1="${f(y+rh-b)}" x2="${f(x+rw)}" y2="${f(y+rh-b)}"/>`;
  }
  [[x,y,-1,-1],[x+rw,y,1,-1],[x,y+rh,-1,1],[x+rw,y+rh,1,1]].forEach(([cx,cy,dx,dy])=>{
    o+=`<line class="mk" x1="${f(cx+dx*g)}" y1="${f(cy)}" x2="${f(cx+dx*(g+l))}" y2="${f(cy)}"/>`;
    o+=`<line class="mk" x1="${f(cx)}" y1="${f(cy+dy*g)}" x2="${f(cx)}" y2="${f(cy+dy*(g+l))}"/>`;
  });
  const t = label===undefined ? (item.short||'') : label;
  if(t){
    const inside = rh>=30 && rw>=62;
    const ty = inside ? y+rh/2+4 : Math.min(y+rh+g+l+11, H-3);
    o+=`<text class="sl" x="${W/2}" y="${f(ty)}">${esc(t)}</text>`;
  }
  return o+'</svg>';
}

// --- stack hero
function renderStack(){
  const order=['1:1','4:5','16:9','1.91:1','9:16','4:1'];
  const L=196, x0=34, yb=228;
  const dims = r => { const [w,h]=RWH[r]; return [w>=h?L:L*w/h, w>=h?L*h/w:L]; };
  let o='';
  order.forEach(r=>{
    const [rw,rh]=dims(r); const y=yb-rh;
    o+=`<rect class="hit" data-ratio="${r}" x="${x0}" y="${f(y)}" width="${f(rw)}" height="${f(rh)}"><title>${r}</title></rect>`;
    o+=`<rect class="st${state.ratio===r?' on':''}" x="${x0}" y="${f(y)}" width="${f(rw)}" height="${f(rh)}"/>`;
  });
  const lab = {'1:1':[L+6,-L+4,'start'],'16:9':[L+6,-L*9/16-2,'start'],'1.91:1':[L+6,-L/1.91+12,'start'],'4:1':[L+6,-L/4+4,'start'],'4:5':[L*4/5,-L-6,'middle'],'9:16':[L*9/16,-L-6,'middle']};
  Object.entries(lab).forEach(([r,[dx,dy,a]])=>{
    o+=`<text class="lbl${state.ratio===r?' on':''}" data-ratio="${r}" x="${f(x0+dx)}" y="${f(yb+dy)}" text-anchor="${a}">${r}</text>`;
  });
  if(state.ratio && state.ratio!=='IAB'){
    const [rw,rh]=dims(state.ratio); const x=x0, y=yb-rh, g=4, l=9;
    [[x,y,-1,-1],[x+rw,y,1,-1],[x,y+rh,-1,1],[x+rw,y+rh,1,1]].forEach(([px,py,dx,dy])=>{
      o+=`<line class="mk" x1="${f(px+dx*g)}" y1="${f(py)}" x2="${f(px+dx*(g+l))}" y2="${f(py)}"/><line class="mk" x1="${f(px)}" y1="${f(py+dy*g)}" x2="${f(px)}" y2="${f(py+dy*(g+l))}"/>`;
    });
  }
  $('#stack').innerHTML=o;
  const cap=$('#stackCap');
  if(state.ratio){
    const pool = ITEMS.filter(i=>i.kind==='card' && i.ratios.includes(state.ratio) && (state.plat==='kit' || i.plat===state.plat));
    cap.innerHTML = `<b>${state.ratio}</b>: ${plural(pool.length,'formato','formatos')} en ${state.plat==='kit'?'ambas plataformas':PLAT[state.plat]}`;
  } else cap.textContent = 'Tocá un contorno para filtrar por proporción';
}

// --- chips
function renderChips(){
  const pool = ITEMS.filter(i=>i.kind==='card' && (state.plat==='kit' || i.plat===state.plat));
  const avail = RATIOS.filter(r => state.plat==='kit' ? KIT.some(k=>k.r===r) : pool.some(i=>i.ratios.includes(r)));
  if(state.ratio && !avail.includes(state.ratio)) state.ratio=null;
  let o=`<button class="fchip" type="button" data-ratio="" aria-pressed="${!state.ratio}">Todas</button>`;
  avail.forEach(r=>{
    const n = state.plat==='kit' ? '' : `<small>${pool.filter(i=>i.ratios.includes(r)).length}</small>`;
    o+=`<button class="fchip" type="button" data-ratio="${r}" aria-pressed="${state.ratio===r}">${r==='IAB'?'Banners IAB':r}${n}</button>`;
  });
  $('#chips').innerHTML=o;
  $('#safeWrap').hidden = state.plat!=='meta';
  $('#safeToggle').checked = state.safe;
}

// --- cards
function specList(rows){
  return `<dl class="spec">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
function card(i){
  if(i.kind==='info'){
    return `<article class="card info" id="${i.id}"><div class="cb"><h3>${i.name}</h3>${specList(i.specs)}<p class="use">${i.use}</p></div></article>`;
  }
  const rows=[];
  if(i.dims) rows.push(['Medida',i.dims]);
  if(i.min) rows.push(['Mínimo',i.min]);
  if(i.weight) rows.push(['Peso máx.',i.weight]);
  if(i.media) rows.push(['Tipo',i.media]);
  (i.specs||[]).forEach(r=>rows.push(r));
  const copyTxt = `${PLAT[i.plat]}, ${groupName(i.plat,i.group)}: ${i.name}. ${i.dims} (${i.ratios.join(' / ')})`;
  return `<article class="card" id="${i.id}">
    <div class="mat"><span class="rb">${i.ratios.map(r=>r==='IAB'?'IAB':r).join(' / ')}</span>${swatch(i)}</div>
    <div class="cb"><h3>${i.name}</h3>${specList(rows)}<p class="use">${i.use}</p>
    <button class="copy" type="button" data-copy="${esc(copyTxt)}">Copiar medidas</button></div>
  </article>`;
}
function cardsBlock(items){
  const subs=[]; items.forEach(i=>{const s=i.sub||''; if(!subs.includes(s)) subs.push(s);});
  return subs.map(s=>{
    const list=items.filter(i=>(i.sub||'')===s);
    return (s?`<h3 class="sub">${s}</h3>`:'')+`<div class="cards">${list.map(card).join('')}</div>`;
  }).join('');
}

// --- extras
function chars(cells){
  return `<div class="chars">${cells.map(([k,v,s])=>`<div><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}</div>`;
}
const EXTRAS = {
  serp: ()=>`<div class="serp" aria-label="Vista previa de anuncio de búsqueda">
      <div class="serp-top"><span class="serp-tag">Patrocinado</span><span>www.tusitio.com.ar › producto</span></div>
      <div class="serp-h">Título 1 | Título 2 | Título 3</div>
      <div class="serp-d">Descripción con el beneficio principal y un llamado a la acción claro, combinada según la búsqueda del usuario.</div>
      <div class="serp-links"><span>Sitelink 1</span><span>Sitelink 2</span><span>Sitelink 3</span><span>Sitelink 4</span></div>
    </div>`+chars([['Títulos','30 car.','hasta 15, mínimo 3'],['Descripciones','90 car.','hasta 4, mínimo 2'],['Rutas visibles','15 car.','2 campos opcionales'],['URL final','—','requerida']])
    +`<p class="fnote"><b>Uso:</b> captar intención de búsqueda activa, cuando el usuario ya escribió lo que busca. Los recursos (sitelinks, llamada, ubicación, precios, promociones) suman espacio sin necesitar creatividad visual.</p>`,
  shopping: ()=>`<p class="fnote"><b>Uso:</b> captura de demanda de e-commerce cuando el usuario ya está comparando producto, precio y disponibilidad.</p>`,
  pmax: ()=>`<h3 class="sub">Recursos de texto</h3>`+chars([['Títulos','30 car.','hasta 15'],['Títulos largos','90 car.','hasta 5'],['Descripciones','90 car.','hasta 5, una de hasta 60']])
    +`<p class="fnote"><b>Uso:</b> campañas de conversión entre canales cuando el objetivo es resultado (ventas, leads) y podés darle al algoritmo variedad de recursos y una señal de conversión limpia.</p>`,
  app: ()=>chars([['Títulos','30 car.','hasta 5'],['Descripciones','90 car.','hasta 5'],['Imágenes y video','—','opcionales'],['HTML5','—','admitido']])
    +`<p class="fnote"><b>Uso:</b> no exige un set de medidas propio. Cuanto más completo el conjunto de recursos, mejores combinaciones arma Google para cada red.</p>`
};

// --- matching
function match(i){
  if(state.ratio && !i.ratios.includes(state.ratio)) return false;
  if(state.q && !i.hay.includes(norm(state.q))) return false;
  return true;
}

// --- platform view
function renderPlat(){
  const p=state.plat;
  let html='', jump='', total=0;
  const matchedAll=[];
  GROUPS[p].forEach(g=>{
    const its = ITEMS.filter(i=>i.plat===p && i.group===g.id);
    const m = its.filter(match);
    const gq = !state.q || norm(g.name+' '+g.desc+' '+(g.search||'')).includes(norm(state.q));
    const showExtra = g.extra && !state.ratio && gq;
    if(!m.length && !showExtra) return;
    total += m.filter(i=>i.kind==='card').length;
    matchedAll.push(...m.filter(i=>i.kind==='card'));
    const sid = p+'-'+g.id;
    const cnt = m.filter(i=>i.kind==='card').length;
    html += `<section class="grp" id="${sid}" data-sec>
      <div class="grp-head"><h2>${g.name}</h2>${cnt?`<span class="grp-count">${plural(cnt,'formato','formatos')}</span>`:'<span class="grp-count">solo texto</span>'}</div>
      <p class="grp-desc">${g.desc}</p>
      ${showExtra && g.extraPos!=='after' ? EXTRAS[g.extra]() : ''}
      ${m.length ? cardsBlock(m) : ''}
      ${showExtra && g.extraPos==='after' ? EXTRAS[g.extra]() : ''}
    </section>`;
    jump += `<button class="jl" type="button" data-jump="${sid}">${g.name}</button>`;
  });
  if(matchedAll.length){
    const sid=p+'-resumen';
    html += `<section class="grp" id="${sid}" data-sec>
      <div class="grp-head"><h2>Cuadro resumen</h2><span class="grp-count">${plural(matchedAll.length,'formato','formatos')}</span></div>
      <div class="tbl-bar"><p>Tocá una fila para ir al formato. Copiá la tabla para pegarla en una hoja de cálculo.</p><button class="copy" type="button" data-copytable>Copiar tabla</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Formato</th><th>Sección</th><th>Proporción</th><th>Medida</th><th>Peso máx.</th><th>Tipo</th></tr></thead><tbody>
      ${matchedAll.map(i=>`<tr data-goto="${i.id}"><td>${i.name}</td><td>${groupName(p,i.group)}</td><td>${i.ratios.join(' / ')}</td><td>${i.dims}</td><td>${i.weight||'—'}</td><td>${i.media||'—'}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    jump += `<button class="jl" type="button" data-jump="${sid}">Resumen</button>`;
  }
  if(!html){
    html = emptyState();
    jump = '';
  }
  $('#view').innerHTML=html;
  $('#jump').innerHTML=jump;
  spy();
}
function emptyState(){
  const parts=[]; if(state.q) parts.push(`“${esc(state.q)}”`); if(state.ratio) parts.push(state.ratio==='IAB'?'banners IAB':state.ratio);
  return `<div class="empty"><b>Sin resultados</b>No hay formatos de ${PLAT[state.plat]} que coincidan con ${parts.join(' en ')}.<br><button type="button" data-clear>Limpiar filtros</button></div>`;
}

// --- kit view
function renderKit(){
  const rows = KIT.filter(k=>{
    if(state.ratio && k.r!==state.ratio) return false;
    if(state.q){
      const uses = ITEMS.filter(i=>i.ratios.includes(k.r)).map(i=>i.name+' '+groupName(i.plat,i.group)).join(' ');
      if(!norm(k.r+' '+k.master+' '+k.note+' '+uses).includes(norm(state.q))) return false;
    }
    return true;
  });
  const selK = KIT.filter(k=>state.sel.has(k.r));
  const nFiles = selK.reduce((a,k)=>a+k.px.length,0);
  const allSel = selK.length===KIT.length;
  let html = `<div class="kit-head">
    <div><h2>Kit de producción</h2><p>Los archivos maestros que conviene producir para cubrir Meta Ads y Google Ads con la menor cantidad de piezas. Seleccioná las proporciones que necesitás y descargá las plantillas PNG en la medida exacta, con márgenes, centro y zonas seguras marcadas. Exportá tus piezas finales por debajo de 5 MB: Google corta en 5.120 KB y Meta en 30 MB, así el mismo archivo sirve en ambas.</p></div>
    <div class="dl-box">
      <div class="pt"><span><b>${selK.length}</b> de ${KIT.length} seleccionadas</span><button class="reset" type="button" data-selall>${allSel?'Quitar todas':'Seleccionar todas'}</button></div>
      <button class="cta" type="button" data-download ${nFiles?'':'disabled'}>${nFiles?`Descargar ${plural(nFiles,'plantilla','plantillas')} PNG`:'Seleccioná al menos una'}</button>
    </div>
  </div>`;
  if(!rows.length){ $('#view').innerHTML = html+emptyState(); $('#jump').innerHTML=''; return; }
  html += '<div class="kit">';
  rows.forEach(k=>{
    const uses = p => ITEMS.filter(i=>i.plat===p && i.kind==='card' && i.ratios.includes(k.r));
    const tags = (p) => {
      const u=uses(p);
      if(!u.length) return '<span class="fnone">No aplica</span>';
      return u.map(i=>`<button class="tag" type="button" data-goto="${i.id}">${p==='google'?groupShort(p,i.group)+': ':''}${i.name}</button>`).join('');
    };
    const isSel = state.sel.has(k.r);
    html += `<div class="kr${isSel?' sel':''}">
      <div class="mat">${swatch({box:RWH[k.r]}, '')}</div>
      <div class="km"><div class="kratio">${k.r==='IAB'?'Banners IAB':k.r}</div><div class="kmaster">${k.master}</div><p>${k.note}</p></div>
      <div class="ku c-meta"><div class="kl">Meta Ads</div><div class="tags">${tags('meta')}</div></div>
      <div class="ku c-google"><div class="kl">Google Ads</div><div class="tags">${tags('google')}</div></div>
      <div class="kc"><label><input type="checkbox" data-sel="${k.r}"${isSel?' checked':''}> ${k.px.length>1?plural(k.px.length,'plantilla','plantillas'):'Incluir'}</label></div>
    </div>`;
  });
  html += '</div>';
  $('#view').innerHTML=html;
  $('#jump').innerHTML='';
}

// --- counts
function renderCounts(){
  $('#cnt-meta').textContent = plural(ITEMS.filter(i=>i.plat==='meta'&&i.kind==='card').length,'formato','formatos');
  $('#cnt-google').textContent = plural(ITEMS.filter(i=>i.plat==='google'&&i.kind==='card').length,'formato','formatos');
  $('#cnt-kit').textContent = KIT.length+' archivos maestros';
}

function render(){
  document.querySelector('.fmt').dataset.plat = state.plat;
  document.querySelectorAll('.plat-btn').forEach(b=>b.setAttribute('aria-selected', b.dataset.plat===state.plat));
  renderChips();
  renderStack();
  if(state.plat==='kit') renderKit(); else renderPlat();
}

// --- scroll spy
let observer;
function spy(){
  if(observer) observer.disconnect();
  if(!('IntersectionObserver' in window)) return;
  const nav=$('#jump');
  observer = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        nav.querySelectorAll('.jl').forEach(b=>{
          const on=b.dataset.jump===e.target.id;
          b.classList.toggle('on',on);
          if(on) nav.scrollTo({left: b.offsetLeft - 16, behavior:'smooth'});
        });
      }
    });
  },{rootMargin:'-35% 0px -60% 0px'});
  document.querySelectorAll('[data-sec]').forEach(s=>observer.observe(s));
}

// --- toast + clipboard
let tt;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),1800);
}
async function copyText(txt){
  try{ await navigator.clipboard.writeText(txt); return true; }
  catch(e){
    try{
      const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok;
    }catch(e2){ return false; }
  }
}

// --- templates
function drawTemplate(w,h,ratio){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d');
  x.fillStyle='#eceeed'; x.fillRect(0,0,w,h);
  const u=Math.max(1,Math.round(Math.min(w,h)/400));
  // zonas seguras 9:16
  if(ratio==='9:16'){
    const b=Math.round(h*250/1920);
    x.fillStyle='rgba(31,95,168,.13)'; x.fillRect(0,0,w,b); x.fillRect(0,h-b,w,b);
    x.strokeStyle='rgba(31,95,168,.8)'; x.lineWidth=2*u; x.setLineDash([12*u,8*u]);
    x.beginPath(); x.moveTo(0,b); x.lineTo(w,b); x.moveTo(0,h-b); x.lineTo(w,h-b); x.stroke();
    x.setLineDash([]); x.fillStyle='rgba(31,95,168,.85)';
    x.font=`600 ${Math.round(w*0.026)}px Figtree, Arial, sans-serif`; x.textAlign='center'; x.textBaseline='middle';
    x.fillText('Zona cubierta por la interfaz: sin texto ni logos',w/2,b/2);
    x.fillText('Zona cubierta por la interfaz: sin texto ni logos',w/2,h-b/2);
  }
  // margen 5%
  const m=Math.round(Math.min(w,h)*0.05);
  if(m>=4){
    x.strokeStyle='rgba(20,24,22,.35)'; x.lineWidth=u; x.setLineDash([6*u,5*u]);
    x.strokeRect(m+.5,m+.5,w-2*m-1,h-2*m-1); x.setLineDash([]);
  }
  // guías centrales
  x.strokeStyle='rgba(20,24,22,.14)'; x.lineWidth=u;
  x.beginPath(); x.moveTo(w/2,0); x.lineTo(w/2,h); x.moveTo(0,h/2); x.lineTo(w,h/2); x.stroke();
  // borde
  x.strokeStyle='rgba(20,24,22,.5)'; x.lineWidth=Math.max(1,u); x.strokeRect(.5,.5,w-1,h-1);
  // rótulo
  x.fillStyle='rgba(20,24,22,.75)'; x.textAlign='center'; x.textBaseline='middle';
  const label=`${w} × ${h} px`;
  if(h>=140 && w>=140){
    const fs=Math.min(96,Math.round(Math.min(w,h)*0.07));
    x.font=`700 ${fs}px Figtree, Arial, sans-serif`; x.fillText(label,w/2,h/2-fs*0.7);
    x.font=`500 ${Math.round(fs*0.6)}px Figtree, Arial, sans-serif`; x.fillStyle='rgba(20,24,22,.5)';
    x.fillText(ratio==='IAB'?'Banner IAB':'Proporción '+ratio,w/2,h/2+fs*0.6);
  } else {
    const fs=Math.max(10,Math.min(24,Math.round(h*0.32)));
    x.font=`700 ${fs}px Figtree, Arial, sans-serif`; x.fillText(label,w/2,h/2);
  }
  return new Promise(res=>c.toBlob(res,'image/png'));
}
function saveBlob(blob,name){
  const a=document.createElement('a'); const url=URL.createObjectURL(blob);
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
async function downloadTemplates(btn){
  const list=[];
  KIT.filter(k=>state.sel.has(k.r)).forEach(k=>k.px.forEach(([w,h])=>list.push({w,h,r:k.r})));
  if(!list.length) return;
  const orig=btn.textContent; btn.disabled=true; btn.textContent='Generando…';
  try{
    const files=[];
    for(const it of list){
      const tag = it.r==='IAB' ? 'iab' : it.r.replace(':','x');
      files.push({name:`plantilla-${tag}-${it.w}x${it.h}.png`, blob:await drawTemplate(it.w,it.h,it.r)});
    }
    if(files.length===1){ saveBlob(files[0].blob,files[0].name); }
    else if(window.JSZip){
      const zip=new JSZip();
      files.forEach(f=>zip.file(f.name,f.blob));
      saveBlob(await zip.generateAsync({type:'blob'}),'plantillas-meta-google-ads.zip');
    } else {
      for(const f of files){ saveBlob(f.blob,f.name); await new Promise(r=>setTimeout(r,350)); }
    }
    toast(files.length===1?'Plantilla descargada':`${files.length} plantillas descargadas`);
  }catch(err){ toast('No se pudo generar la descarga'); }
  btn.disabled=false; btn.textContent=orig;
}

// --- navigation
const smooth = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
function setPlat(p){
  if(state.plat===p) return;
  state.plat=p; store.set('fmt-plat',p);
  try{ history.replaceState(null,'','#'+p); }catch(e){}
  render();
}
function goto(id){
  const item = ITEMS.find(i=>i.id===id); if(!item) return;
  state.q=''; $('#q').value=''; state.ratio=null;
  state.plat=item.plat; store.set('fmt-plat',item.plat);
  try{ history.replaceState(null,'','#'+item.plat); }catch(e){}
  render();
  requestAnimationFrame(()=>{
    const el=document.getElementById(id); if(!el) return;
    el.scrollIntoView({behavior:smooth(), block:'center'});
    el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1600);
  });
}

// --- theme
const THEMES={auto:'automático',light:'claro',dark:'oscuro'};
function applyTheme(){}

// --- events
document.addEventListener('click', async e=>{
  const t=e.target.closest('button, [data-goto], rect.hit, text.lbl');
  if(!t) return;
  if(t.matches('.plat-btn')) return setPlat(t.dataset.plat);
  if(t.hasAttribute('data-ratio')){
    const r=t.dataset.ratio||null;
    state.ratio = (state.ratio===r) ? null : r;
    return render();
  }
  if(t.dataset.jump){
    const s=document.getElementById(t.dataset.jump);
    if(s) s.scrollIntoView({behavior:smooth(), block:'start'});
    return;
  }
  if(t.dataset.goto) return goto(t.dataset.goto);
  if(t.hasAttribute('data-copy')){
    const ok=await copyText(t.dataset.copy);
    return toast(ok?'Medidas copiadas':'No se pudo copiar');
  }
  if(t.hasAttribute('data-copytable')){
    const rows=[['Formato','Sección','Proporción','Medida','Peso máx.','Tipo']];
    document.querySelectorAll('#view tbody tr').forEach(tr=>rows.push([...tr.children].map(td=>td.textContent)));
    const ok=await copyText(rows.map(r=>r.join('\t')).join('\n'));
    return toast(ok?'Tabla copiada, lista para pegar':'No se pudo copiar');
  }
  if(t.hasAttribute('data-clear')){ state.q=''; $('#q').value=''; state.ratio=null; return render(); }
  if(t.hasAttribute('data-selall')){
    if(state.sel.size===KIT.length) state.sel.clear(); else KIT.forEach(k=>state.sel.add(k.r));
    store.set('fmt-kit-sel',[...state.sel]); return render();
  }
  if(t.hasAttribute('data-download')) return downloadTemplates(t);
  if(t.id==='themeBtn'){
    const order=['auto','light','dark'];
    state.theme=order[(order.indexOf(state.theme)+1)%3]; store.set('fmt-theme',state.theme); applyTheme();
  }
});
document.addEventListener('change', e=>{
  if(e.target.id==='safeToggle'){ state.safe=e.target.checked; store.set('fmt-safe',state.safe); render(); }
  if(e.target.dataset.sel){
    const r=e.target.dataset.sel;
    e.target.checked ? state.sel.add(r) : state.sel.delete(r);
    store.set('fmt-kit-sel',[...state.sel]); render();
  }
});
$('#q').addEventListener('input', e=>{ state.q=e.target.value.trim(); renderStack(); state.plat==='kit'?renderKit():renderPlat(); });
document.querySelector('.plat-tabs').addEventListener('keydown', e=>{
  if(!['ArrowLeft','ArrowRight'].includes(e.key)) return;
  const order=['meta','google','kit']; const i=order.indexOf(state.plat);
  const n=order[(i+(e.key==='ArrowRight'?1:2))%3]; setPlat(n);
  document.querySelector(`.plat-btn[data-plat="${n}"]`).focus();
});

// --- init
applyTheme();
renderCounts();
render();
if(pendingAnchor){
  requestAnimationFrame(()=>{ const el=document.getElementById(pendingAnchor); if(el) el.scrollIntoView({block:'start'}); });
}
})();
