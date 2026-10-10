
(() => {
'use strict';
const $ = s => document.querySelector(s);
const AD5X = { w:220, h:220, z:220, nozzleMax:300, bedMax:110 };
const S = { plate:0, view:'2d', arrCache:null, ev:null, buf:null, name:'', size:0, info:null, base:null, busy:false,
            opts:{ recenter:true, strip:true, generic:true, nozzle:'0.4', keep:true, arrange:'off' } };

const DESIGN_KEYS = ['layer_height','initial_layer_print_height','wall_loops','top_shell_layers','bottom_shell_layers',
  'sparse_infill_density','sparse_infill_pattern','enable_support','support_type','support_style',
  'support_threshold_angle','brim_type','brim_width','raft_layers','ironing_type'];
const NOZZLE_TEMP_KEYS = ['nozzle_temperature','nozzle_temperature_initial_layer','nozzle_temperature_range_high'];
const BED_TEMP_KEYS = ['hot_plate_temp','hot_plate_temp_initial_layer','cool_plate_temp','cool_plate_temp_initial_layer',
  'eng_plate_temp','eng_plate_temp_initial_layer','textured_plate_temp','textured_plate_temp_initial_layer',
  'supertack_plate_temp','supertack_plate_temp_initial_layer'];
const GCODE_KEYS = ['machine_start_gcode','machine_end_gcode','change_filament_gcode','layer_change_gcode',
  'before_layer_change_gcode','time_lapse_gcode','machine_pause_gcode','template_custom_gcode',
  'filament_start_gcode','filament_end_gcode'];
const SPEED_KEYS = ['outer_wall_speed','inner_wall_speed','sparse_infill_speed','internal_solid_infill_speed','top_surface_speed',
  'gap_infill_speed','initial_layer_speed','initial_layer_infill_speed','travel_speed','initial_layer_travel_speed','support_speed',
  'support_interface_speed','bridge_speed','small_perimeter_speed','overhang_1_4_speed','overhang_2_4_speed','overhang_3_4_speed',
  'overhang_4_4_speed','default_acceleration','outer_wall_acceleration','inner_wall_acceleration','initial_layer_acceleration',
  'top_surface_acceleration','travel_acceleration','sparse_infill_acceleration','internal_solid_infill_acceleration','bridge_acceleration',
  'default_jerk','outer_wall_jerk','inner_wall_jerk','infill_jerk','top_surface_jerk','initial_layer_jerk','travel_jerk',
  'accel_to_decel_enable','accel_to_decel_factor'];
const INVALID_KEYS = ['tree_support_wall_count','raft_expansion'];
const addKeys = (s, keys) => [...new Set(String(s||'').split(';').filter(Boolean).concat(keys))].join(';');
const STRIP_RE = /^Metadata\/plate_\d+\.(gcode(\.md5)?|json)$/i;
/* Bloque de impresora AD5X tomado de un proyecto real guardado con Flash Studio (boquilla 0,4) */
const AD5X_BLOCK = {"printer_model": "Flashforge AD5X", "printer_variant": "0.4", "printer_settings_id": "Flashforge AD5X 0.4 nozzle", "default_print_profile": "0.20mm Standard @Flashforge AD5M Pro 0.4 Nozzle", "printable_area": ["0x0", "220x0", "220x220", "0x220"], "printable_height": "220", "bed_exclude_area": ["0x0"], "gcode_flavor": "klipper", "printer_structure": "undefine", "thumbnails": "140x110/PNG", "thumbnails_format": "PNG", "use_relative_e_distances": "1", "machine_start_gcode": "M190 S[bed_temperature_initial_layer_single]\nM109 S[nozzle_temperature_initial_layer]\nG90\nM83\nG1 Z2 F6000\nG1 X50 Y-1 Z0.25 F9000\nG1 X70 E3 F900\nG1 X200 E10 F1800\nG0 Y-1.4\nG1 X130 E5 F1800\nG92 E0\nT[initial_no_support_extruder]", "machine_end_gcode": "G1 E-3 F3600\nG0 X50 Y50 F30000\nM104 S0 ; turn off temperature", "change_filament_gcode": "", "layer_change_gcode": ";AFTER_LAYER_CHANGE\n;[layer_z]", "before_layer_change_gcode": ";BEFORE_LAYER_CHANGE\n;[layer_z]", "time_lapse_gcode": "", "machine_pause_gcode": "M25", "template_custom_gcode": "", "file_start_gcode": "", "change_extrusion_role_gcode": "", "emit_machine_limits_to_gcode": "1", "extruder_type": ["Direct Drive"], "nozzle_type": ["stainless_steel"], "machine_min_extruding_rate": ["0", "0"], "machine_min_travel_rate": ["0", "0"], "machine_max_acceleration_e": ["5000", "5000"], "machine_max_acceleration_extruding": ["20000", "20000"], "machine_max_acceleration_retracting": ["5000", "5000"], "machine_max_acceleration_travel": ["20000", "20000"], "machine_max_acceleration_x": ["20000", "20000"], "machine_max_acceleration_y": ["20000", "20000"], "machine_max_acceleration_z": ["500", "500"], "machine_max_jerk_e": ["2.5", "2.5"], "machine_max_jerk_x": ["9", "9"], "machine_max_jerk_y": ["9", "9"], "machine_max_jerk_z": ["3", "3"], "machine_max_junction_deviation": ["0.01"], "machine_max_speed_e": ["30", "30"], "machine_max_speed_x": ["600", "600"], "machine_max_speed_y": ["600", "600"], "machine_max_speed_z": ["20", "20"], "machine_load_filament_time": "50", "machine_unload_filament_time": "50", "machine_tool_change_time": "0"};

/* ---------- utilidades ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => Number(n.toFixed(1)).toString().replace('.', ',');
const fmtSize = b => b > 1048576 ? fmt(b/1048576)+' MB' : Math.max(1,Math.round(b/1024))+' KB';
const signed = n => (n>0?'+':n<0?'−':'') + fmt(Math.abs(n));
function parseAttrs(s){ const o={}; const re=/([\w:.-]+)="([^"]*)"/g; let m; while((m=re.exec(s))) o[m[1]]=m[2]; return o; }
const IDENT = [1,0,0,0,1,0,0,0,1,0,0,0];
function parseTr(s){ if(!s) return IDENT.slice(); const a=s.trim().split(/\s+/).map(Number); return (a.length===12 && a.every(Number.isFinite)) ? a : IDENT.slice(); }
function applyTr(m,x,y,z){ return [x*m[0]+y*m[3]+z*m[6]+m[9], x*m[1]+y*m[4]+z*m[7]+m[10], x*m[2]+y*m[5]+z*m[8]+m[11]]; }
function trBounds(b,m){
  const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
  for(const x of [b[0],b[3]]) for(const y of [b[1],b[4]]) for(const z of [b[2],b[5]]){
    const p=applyTr(m,x,y,z); for(let i=0;i<3;i++){ if(p[i]<mn[i])mn[i]=p[i]; if(p[i]>mx[i])mx[i]=p[i]; }
  }
  return [...mn,...mx];
}
function unionB(a,b){ if(!a) return b; return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.min(a[2],b[2]),Math.max(a[3],b[3]),Math.max(a[4],b[4]),Math.max(a[5],b[5])]; }

/* ---------- lectura del 3MF ---------- */
function parseModel(txt){
  const objs = new Map();
  const re = /<object\b([^>]*?)>([\s\S]*?)<\/object>/g;
  const vre = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g;
  let m;
  while((m = re.exec(txt))){
    const a = parseAttrs(m[1]); const body = m[2];
    if(!a.id) continue;
    if(body.indexOf('<mesh') >= 0){
      /* guarda los vértices (reduce a la mitad cuando pasan de 1 M para no agotar memoria) y siempre conserva los extremos por eje */
      let arr = [], stride = 1, idx = 0, v;
      const ext = [null,null,null,null,null,null]; vre.lastIndex = 0;
      while((v = vre.exec(body))){
        const x=+v[1], y=+v[2], z=+v[3], p=[x,y,z];
        for(let ax=0; ax<3; ax++){
          if(!ext[ax] || p[ax] < ext[ax][ax]) ext[ax] = p;
          if(!ext[ax+3] || p[ax] > ext[ax+3][ax]) ext[ax+3] = p;
        }
        if(idx % stride === 0) arr.push(x,y,z);
        idx++;
        if(arr.length > 3000000){ const half = []; for(let i=0;i<arr.length;i+=6) half.push(arr[i],arr[i+1],arr[i+2]); arr = half; stride *= 2; }
      }
      if(ext[0]){
        const nreal = arr.length/3; let tris = null;
        if(stride===1){
          const tre = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g, ta = []; let tt;
          while((tt = tre.exec(body))) ta.push(+tt[1], +tt[2], +tt[3]);
          if(ta.length && ta.length/3 <= 2000000) tris = Uint32Array.from(ta);
        }
        ext.forEach(p => arr.push(p[0],p[1],p[2]));
        objs.set(a.id, { verts: Float32Array.from(arr), nreal, tris });
      }
    } else {
      const comps = []; const cre = /<component\b([^>]*)>/g; let c;
      while((c = cre.exec(body))){
        const ca = parseAttrs(c[1]);
        comps.push({ id:ca.objectid, path: ca['p:path'] ? ca['p:path'].replace(/^\//,'') : null, tr: parseTr(ca.transform) });
      }
      objs.set(a.id, {comps});
    }
  }
  return objs;
}
/* aplica a y después b (convención 3MF: punto fila × matriz + traslación) */
function composeTr(a,b){
  const r = new Array(12);
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) r[3*i+j] = a[3*i]*b[j] + a[3*i+1]*b[3+j] + a[3*i+2]*b[6+j];
  for(let j=0;j<3;j++) r[9+j] = a[9]*b[j] + a[10]*b[3+j] + a[11]*b[6+j] + b[9+j];
  return r;
}
function worldBounds(models, path, id, M, depth, acc, parts){
  const top = !acc;
  acc = acc || [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  if(depth > 6) return top ? null : acc;
  const mm = models.get(path), o = mm && mm.get(id);
  if(o && o.verts){
    const v = o.verts;
    for(let i=0;i<v.length;i+=3){
      const x=v[i], y=v[i+1], z=v[i+2];
      const X=x*M[0]+y*M[3]+z*M[6]+M[9], Y=x*M[1]+y*M[4]+z*M[7]+M[10], Z=x*M[2]+y*M[5]+z*M[8]+M[11];
      if(X<acc[0])acc[0]=X; if(Y<acc[1])acc[1]=Y; if(Z<acc[2])acc[2]=Z;
      if(X>acc[3])acc[3]=X; if(Y>acc[4])acc[4]=Y; if(Z>acc[5])acc[5]=Z;
    }
  } else if(o && o.comps){
    for(const c of o.comps){
      if(depth===0 && parts){ const p = parts[c.id]; if(p && p.subtype!=='normal_part') continue; }
      worldBounds(models, c.path || path, c.id, composeTr(c.tr, M), depth+1, acc, null);
    }
  }
  return top ? (isFinite(acc[0]) ? acc : null) : acc;
}
function readBed(cfg){
  if(!cfg || !cfg.printable_area) return null;
  const raw = Array.isArray(cfg.printable_area) ? cfg.printable_area : String(cfg.printable_area).split(',');
  const pts = raw.map(s => String(s).split('x').map(Number)).filter(p => p.length===2 && p.every(Number.isFinite));
  if(pts.length < 3) return null;
  const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
  const bed = { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
  bed.w = bed.maxX-bed.minX; bed.h = bed.maxY-bed.minY;
  return bed;
}
async function readCfg(zip){
  const n = Object.keys(zip.files).find(x => /^Metadata\/project_settings\.config$/i.test(x));
  if(!n) return {name:null, cfg:null};
  try { return {name:n, cfg: JSON.parse(await zip.file(n).async('string'))}; }
  catch(e){ return {name:n, cfg:null}; }
}
async function analyze(buf){
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files);
  const mainPath = names.find(n => /^3D\/3dmodel\.model$/i.test(n));
  if(!mainPath) throw new Error('No encontré 3D/3dmodel.model. No parece un 3MF válido.');
  const mainTxt = await zip.file(mainPath).async('string');
  const models = new Map([[mainPath, parseModel(mainTxt)]]);
  for(const n of names){
    if(n!==mainPath && /^3D\/.+\.model$/i.test(n) && !zip.files[n].dir){
      models.set(n, parseModel(await zip.file(n).async('string')));
    }
  }
  const app = ((mainTxt.match(/<metadata\s+name="Application"[^>]*>([^<]*)</i)||[])[1]||'').trim();
  const {name:cfgName, cfg} = await readCfg(zip);
  const msName = names.find(n => /^Metadata\/model_settings\.config$/i.test(n));
  let plates = 1; const plateOf = {}, objInfo = {};
  if(msName){
    const t = await zip.file(msName).async('string');
    const pb = t.match(/<plate>[\s\S]*?<\/plate>/g) || [];
    plates = Math.max(1, pb.length); parseObjInfo(t, objInfo);
    pb.forEach((blk, idx) => {
      const pid = Number((blk.match(/key="plater_id"\s+value="(\d+)"/)||[])[1]) || (idx+1);
      (blk.match(/key="object_id"\s+value="(\d+)"/g)||[]).forEach(m => { plateOf[m.match(/value="(\d+)"/)[1]] = pid-1; });
    });
  }
  const items = [];
  const bm = mainTxt.match(/<build\b[\s\S]*?<\/build>/);
  if(bm){
    const ire = /<item\b([^>]*)>/g; let it;
    while((it = ire.exec(bm[0]))){
      const a = parseAttrs(it[1]); const tr = parseTr(a.transform);
      items.push({ id:a.objectid, tr, plate: plateOf[a.objectid]||0, bounds: worldBounds(models, mainPath, a.objectid, tr, 0, null, objInfo[a.objectid] && objInfo[a.objectid].parts) });
    }
  }
  const nozzles = cfg && Array.isArray(cfg.nozzle_diameter) ? cfg.nozzle_diameter.length : 1;
  return {
    mainPath, cfgName, cfg, app, plates, plateOf, objInfo, models, items, bed: readBed(cfg), nozzles,
    filaments: (cfg && Array.isArray(cfg.filament_colour) && cfg.filament_colour.length) || 1,
    printerName: cfg ? (cfg.printer_settings_id || cfg.printer_model || '') : ''
  };
}

/* ---------- configuración ---------- */
const fitArr = (arr,n) => arr.length>=n ? arr.slice(0,n) : arr.concat(Array(n-arr.length).fill(arr[arr.length-1]));
function shiftFor(info, o){
  if(!info.bed || !o.recenter) return [0,0];
  return [ AD5X.w/2 - (info.bed.minX + info.bed.w/2), AD5X.h/2 - (info.bed.minY + info.bed.h/2) ];
}
function buildConfigBase(){
  const info = S.info, o = S.opts, src = info.cfg;
  const fixTower = c => ['wipe_tower_x','wipe_tower_y'].forEach(k => { if(Array.isArray(c[k]) && c[k].length) c[k] = fitArr(c[k], info.plates); });
  if(S.base){
    const b = structuredClone(S.base.cfg);
    const N = info.filaments;
    const bN = (Array.isArray(b.filament_colour) && b.filament_colour.length) || 1;
    if(N !== bN){
      for(const k of Object.keys(b)){
        if(k==='printable_area' || k==='bed_exclude_area') continue;
        if(Array.isArray(b[k]) && b[k].length===bN &&
           ((src && Array.isArray(src[k]) && src[k].length===N) || k.indexOf('filament_')===0)){
          b[k] = fitArr(b[k], N);
        }
      }
      if(Array.isArray(b.flush_volumes_matrix)){
        const pos = b.flush_volumes_matrix.map(Number).filter(v=>v>0);
        const v = String(pos.length ? pos[0] : 280); const mat = [];
        for(let i=0;i<N;i++) for(let j=0;j<N;j++) mat.push(i===j ? '0' : v);
        b.flush_volumes_matrix = mat;
        if(Array.isArray(b.flush_volumes_vector) && b.flush_volumes_vector.length) b.flush_volumes_vector = Array(2*N).fill(b.flush_volumes_vector[0]);
      }
      if(Array.isArray(b.different_settings_to_system) && b.different_settings_to_system.length===bN+2){
        const d = b.different_settings_to_system;
        b.different_settings_to_system = [d[0], ...fitArr(d.slice(1,-1), N), d[d.length-1]];
      }
    }
    fixTower(b);
    if(src && Array.isArray(src.filament_colour)) b.filament_colour = src.filament_colour.slice();
    const copied = [];
    if(o.keep && src) DESIGN_KEYS.forEach(k => {
      if(k in src && k in b && Array.isArray(src[k])===Array.isArray(b[k])){ b[k] = structuredClone(src[k]); copied.push(k); }
    });
    const d = b.different_settings_to_system;
    if(Array.isArray(d) && d.length>=2){
      if(copied.length) d[0] = addKeys(d[0], copied);
      for(let i=1;i<d.length-1;i++) d[i] = addKeys(d[i], ['filament_colour']);
    }
    return { cfg:b, clamps:0, baseFilaments:bN, copied };
  }
  if(!src) return { cfg:null, clamps:0 };
  const c = structuredClone(src); let clamps = 0, invalid = 0; const dropped = [];
  Object.keys(AD5X_BLOCK).forEach(k => { c[k] = structuredClone(AD5X_BLOCK[k]); });
  c.nozzle_diameter = [o.nozzle];
  c.printer_variant = o.nozzle;
  c.printer_settings_id = 'Flashforge AD5X ' + o.nozzle + ' nozzle';
  if(o.nozzle === '0.4') c.print_settings_id = '0.20mm Standard @FF AD5X';
  if('printer_notes' in c) c.printer_notes = '';
  if('compatible_printers' in c) c.compatible_printers = Array.isArray(c.compatible_printers) ? [] : '';
  if('compatible_printers_condition' in c) c.compatible_printers_condition = Array.isArray(c.compatible_printers_condition) ? c.compatible_printers_condition.map(()=> '') : '';
  const cap = (keys, limit) => keys.forEach(k => {
    if(!Array.isArray(c[k])) return;
    c[k] = c[k].map(v => { const n = Number(v); if(Number.isFinite(n) && n>limit){ clamps++; return String(limit); } return v; });
  });
  cap(NOZZLE_TEMP_KEYS, AD5X.nozzleMax); cap(BED_TEMP_KEYS, AD5X.bedMax);
  SPEED_KEYS.forEach(k => { if(k in c){ delete c[k]; dropped.push(k); } });
  INVALID_KEYS.forEach(k => {
    const f = v => { if(Number(v)===-1){ invalid++; return '0'; } return v; };
    if(Array.isArray(c[k])) c[k] = c[k].map(f); else if(k in c) c[k] = f(c[k]);
  });
  let filaments = null;
  if(o.generic && Array.isArray(c.filament_settings_id) && c.filament_settings_id.length){
    const types = Array.isArray(c.filament_type) ? c.filament_type : [];
    c.filament_settings_id = c.filament_settings_id.map((n,i) => { const t = String(types[i] || types[0] || '').trim(); return t ? 'Generic '+t : n; });
    if(Array.isArray(c.filament_vendor)) c.filament_vendor = c.filament_vendor.map(() => 'Generic');
    filaments = c.filament_settings_id.slice();
  }
  if(Array.isArray(c.wipe_tower_x)) c.wipe_tower_x = Array(info.plates).fill('165');
  if(Array.isArray(c.wipe_tower_y)) c.wipe_tower_y = Array(info.plates).fill('192.777');
  if('different_settings_to_system' in c){
    const orig = Array.isArray(src.different_settings_to_system) ? String(src.different_settings_to_system[0]||'').split(';') : [];
    const proc = [...new Set(orig.concat(DESIGN_KEYS))].filter(k => k && k in c && SPEED_KEYS.indexOf(k)<0).join(';');
    const tk = [...NOZZLE_TEMP_KEYS, ...BED_TEMP_KEYS].filter(k => k in c).concat('filament_colour').join(';');
    c.different_settings_to_system = [ proc, ...Array(info.filaments).fill(tk), '' ];
  }
  return { cfg:c, clamps, invalid, dropped, filaments };
}

function buildConfig(){
  const r = buildConfigBase();
  if(r.cfg && PG.apply && S.info && PG.n===S.info.filaments && PG.n>=2){
    r.cfg.flush_volumes_matrix = PG.mat.reduce((a,row) => a.concat(row), []).map(v => String(Math.round(v)));
    r.cfg.flush_multiplier = Array.isArray(r.cfg.flush_multiplier) ? r.cfg.flush_multiplier.map(() => String(PG.mult)) : String(PG.mult);
  }
  return r;
}

/* ---------- acomodo automático ---------- */
function parseObjInfo(t, out){
  const re = /<object\s+id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g; let m;
  while((m = re.exec(t))){
    const body = m[2], head = body.split('<part')[0];
    const oe = Number((head.match(/key="extruder"\s+value="(\d+)"/)||[])[1]) || 1;
    const parts = {}; const pre = /<part\s+id="(\d+)"(?:\s+subtype="([^"]*)")?[^>]*>([\s\S]*?)<\/part>/g; let p;
    while((p = pre.exec(body))){
      parts[p[1]] = { subtype: p[2] || 'normal_part', extruder: Number((p[3].match(/key="extruder"\s+value="(\d+)"/)||[])[1]) || oe };
    }
    out[m[1]] = { extruder: oe, parts };
  }
}
function collectXY(models, path, id, M, depth, out, parts){
  const mm = models.get(path), o = mm && mm.get(id); if(!o) return;
  if(o.verts){
    const v = o.verts, n = o.nreal || v.length/3, step = Math.max(1, Math.floor(n/150000));
    for(let i=0;i<n;i+=step){
      const x=v[3*i], y=v[3*i+1], z=v[3*i+2];
      out.push(x*M[0]+y*M[3]+z*M[6]+M[9], x*M[1]+y*M[4]+z*M[7]+M[10]);
    }
  } else if(o.comps){
    for(const c of o.comps){
      if(depth===0 && parts){ const p = parts[c.id]; if(p && p.subtype!=='normal_part') continue; }
      collectXY(models, c.path || path, c.id, composeTr(c.tr, M), depth+1, out, null);
    }
  }
}
function reduceBins(pts){
  const n = pts.length/2; if(!n) return [];
  let cx=0, cy=0; for(let i=0;i<pts.length;i+=2){ cx+=pts[i]; cy+=pts[i+1]; } cx/=n; cy/=n;
  const NB = 1440, br = new Float64Array(NB).fill(-1), bx = new Float64Array(NB), by = new Float64Array(NB), ex = [null,null,null,null];
  for(let i=0;i<pts.length;i+=2){
    const x=pts[i], y=pts[i+1], dx=x-cx, dy=y-cy, r=dx*dx+dy*dy;
    const b = Math.min(NB-1, Math.floor((Math.atan2(dy,dx)+Math.PI)/(2*Math.PI)*NB));
    if(r>br[b]){ br[b]=r; bx[b]=x; by[b]=y; }
    if(!ex[0] || x<ex[0][0]) ex[0]=[x,y]; if(!ex[1] || x>ex[1][0]) ex[1]=[x,y];
    if(!ex[2] || y<ex[2][1]) ex[2]=[x,y]; if(!ex[3] || y>ex[3][1]) ex[3]=[x,y];
  }
  const out = []; for(let b=0;b<NB;b++) if(br[b]>=0) out.push([bx[b],by[b]]);
  return out.concat(ex.filter(Boolean));
}
function convexHull(P){
  const pts = P.slice().sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  if(pts.length < 3) return pts;
  const cross = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = []; for(const p of pts){ while(lo.length>=2 && cross(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); }
  const up = []; for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(up.length>=2 && cross(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function rotBounds(hull, phi){
  const c = Math.cos(phi), s = Math.sin(phi); let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const p of hull){ const x=p[0]*c-p[1]*s, y=p[0]*s+p[1]*c; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  return {x0,y0,x1,y1};
}
function minRect(hull){
  let best = null;
  for(let i=0;i<hull.length;i++){
    const a = hull[i], b = hull[(i+1)%hull.length], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
    if(len<1e-9) continue;
    const ux=dx/len, uy=dy/len; let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
    for(const p of hull){ const u=p[0]*ux+p[1]*uy, v=-p[0]*uy+p[1]*ux; if(u<u0)u0=u; if(u>u1)u1=u; if(v<v0)v0=v; if(v>v1)v1=v; }
    const area = (u1-u0)*(v1-v0);
    if(!best || area<best.area-1e-9) best = { area, theta:Math.atan2(dy,dx) };
  }
  return best || { area:0, theta:0 };
}
function hullOf(info, it){
  if(it.hull) return it.hull;
  const pts = []; collectXY(info.models, info.mainPath, it.id, it.tr, 0, pts, info.objInfo[it.id] && info.objInfo[it.id].parts);
  return (it.hull = convexHull(reduceBins(pts)));
}
function MaxRectsBin(w,h){ this.free = [{x:0,y:0,w,h}]; }
MaxRectsBin.prototype.find = function(w,h){
  let best = null;
  for(const f of this.free){
    if(w<=f.w+1e-9 && h<=f.h+1e-9){
      const s1 = Math.min(f.w-w,f.h-h), s2 = Math.max(f.w-w,f.h-h);
      if(!best || s1<best.s1-1e-9 || (Math.abs(s1-best.s1)<1e-9 && s2<best.s2)) best = {x:f.x,y:f.y,s1,s2};
    }
  }
  return best;
};
MaxRectsBin.prototype.place = function(x,y,w,h){
  const nf = [];
  for(const f of this.free){
    if(x>=f.x+f.w || x+w<=f.x || y>=f.y+f.h || y+h<=f.y){ nf.push(f); continue; }
    if(x>f.x) nf.push({x:f.x,y:f.y,w:x-f.x,h:f.h});
    if(x+w<f.x+f.w) nf.push({x:x+w,y:f.y,w:f.x+f.w-(x+w),h:f.h});
    if(y>f.y) nf.push({x:f.x,y:f.y,w:f.w,h:y-f.y});
    if(y+h<f.y+f.h) nf.push({x:f.x,y:y+h,w:f.w,h:f.y+f.h-(y+h)});
  }
  const inside = (a,b) => a.x>=b.x-1e-9 && a.y>=b.y-1e-9 && a.x+a.w<=b.x+b.w+1e-9 && a.y+a.h<=b.y+b.h+1e-9;
  this.free = nf.filter((a,i) => !nf.some((b,j) => j!==i && inside(a,b) && (j<i || !inside(b,a))));
};
const ARR_EDGE = 4, ARR_GAP = 6;
function arrange(info, mode){
  const W = AD5X.w, H = AD5X.h, list = [];
  info.items.forEach((it,idx) => {
    if(!it.bounds) return;
    const hull = hullOf(info, it); if(hull.length < 3) return;
    let cands = [];
    if(mode==='move') cands.push({ phi:0, b:rotBounds(hull,0) });
    else { const r = minRect(hull); [0, Math.PI/2].forEach(add => { const phi = -r.theta+add; cands.push({ phi, b:rotBounds(hull,phi) }); }); }
    cands = cands.map(c => ({ phi:c.phi, w:c.b.x1-c.b.x0, h:c.b.y1-c.b.y0, rx0:c.b.x0, ry0:c.b.y0 }));
    list.push({ idx, it, cands, area:cands[0].w*cands[0].h });
  });
  list.sort((a,b) => b.area-a.area);
  const bins = [];
  for(let p=0;p<info.plates;p++){
    const bn = new MaxRectsBin(W-2*ARR_EDGE+ARR_GAP, H-2*ARR_EDGE+ARR_GAP);
    if(info.filaments>1) bn.place(160-ARR_EDGE, 188-ARR_EDGE, 80, 60);   /* reserva la torre de purga */
    bins.push(bn);
  }
  const map = new Map(), unplaced = [];
  list.forEach(e => {
    const order = [e.it.plate, ...bins.map((_,i)=>i).filter(i => i!==e.it.plate)];
    for(const p of order){
      let best = null;
      for(const c of e.cands){ const f = bins[p].find(c.w+ARR_GAP, c.h+ARR_GAP); if(f && (!best || f.s1<best.f.s1)) best = {c,f}; }
      if(best){
        const {c,f} = best; bins[p].place(f.x, f.y, c.w+ARR_GAP, c.h+ARR_GAP);
        const ot = plateOrigin(p, info.plates, W, H), x0 = ARR_EDGE+f.x, y0 = ARR_EDGE+f.y;
        map.set(e.idx, { plate:p, phi:c.phi, c:Math.cos(c.phi), s:Math.sin(c.phi), tx:ot[0]+x0-c.rx0, ty:ot[1]+y0-c.ry0,
                         b:[x0,y0,e.it.bounds[2],x0+c.w,y0+c.h,e.it.bounds[5]] });
        return;
      }
    }
    unplaced.push(e.idx);
  });
  return { map, unplaced, mode };
}
function canArrange(info){ return info.items.some(i => i.bounds) && (info.plates===1 || !!info.bed); }
function getArrangement(){
  const key = S.opts.arrange+'|'+S.info.filaments;
  if(S.arrCache && S.arrCache.key===key) return S.arrCache.res;
  const res = arrange(S.info, S.opts.arrange); S.arrCache = { key, res }; return res;
}
function movePlates(t, moves){
  const blocks = []; const re = /<plate>[\s\S]*?<\/plate>/g; let m;
  while((m = re.exec(t))) blocks.push({ text:m[0], start:m.index, end:m.index+m[0].length, pid:Number((m[0].match(/key="plater_id"\s+value="(\d+)"/)||[])[1]) || blocks.length+1 });
  const pend = {};
  const cleaned = blocks.map(b => b.text.replace(/[ \t]*<model_instance>[\s\S]*?<\/model_instance>[ \t]*\r?\n?/g, inst => {
    const oid = (inst.match(/key="object_id"\s+value="(\d+)"/)||[])[1];
    if(oid && moves.has(oid) && moves.get(oid)+1 !== b.pid){ (pend[moves.get(oid)+1] = pend[moves.get(oid)+1] || []).push(inst.trim()); return ''; }
    return inst;
  }));
  let out = '', pos = 0;
  blocks.forEach((b,i) => {
    out += t.slice(pos, b.start);
    out += pend[b.pid] ? cleaned[i].replace(/<\/plate>/, '    '+pend[b.pid].join('\n    ')+'\n  </plate>') : cleaned[i];
    pos = b.end;
  });
  return out + t.slice(pos);
}

/* ---------- evaluación ---------- */
const GAP = 1.2; /* separación entre placas = 1,2 × ancho de cama (medido en los dos archivos de ejemplo) */
function plateOrigin(i, n, w, h){ const cols = Math.ceil(Math.sqrt(n)); return [ (i % cols) * w * GAP, -Math.floor(i / cols) * h * GAP ]; }
function itemShift(info, o, p){
  if(!info.bed) return [0,0];
  const [dx,dy] = shiftFor(info,o);
  if(info.plates < 2) return [dx,dy];
  const os = plateOrigin(p, info.plates, info.bed.w, info.bed.h), ot = plateOrigin(p, info.plates, AD5X.w, AD5X.h);
  return [dx+ot[0]-os[0], dy+ot[1]-os[1]];
}
function evaluate(){
  const info = S.info, o = S.opts;
  const [dx,dy] = shiftFor(info,o);
  const arr = (o.arrange!=='off' && canArrange(info)) ? getArrangement() : null;
  const okBox = w => w[0]>=-.05 && w[1]>=-.05 && w[3]<=AD5X.w+.05 && w[4]<=AD5X.h+.05 && w[5]<=AD5X.z+.05;
  const items = [];
  info.items.forEach((it,idx) => {
    if(!it.bounds) return;
    const a = arr && arr.map.get(idx);
    if(a){
      const ot = plateOrigin(a.plate, info.plates, AD5X.w, AD5X.h);
      items.push({ idx, plate:a.plate, b:a.b, moved:true, inside:okBox(a.b),
                   B:[a.c,a.s,0,-a.s,a.c,0,0,0,1,a.tx,a.ty,0], m:{ c:a.c, s:a.s, tx:a.tx-ot[0], ty:a.ty-ot[1] } });
    } else {
      const b = it.bounds, os = info.bed ? plateOrigin(it.plate, info.plates, info.bed.w, info.bed.h) : [0,0];
      const w = [b[0]-os[0]+dx, b[1]-os[1]+dy, b[2], b[3]-os[0]+dx, b[4]-os[1]+dy, b[5]];
      const lost = !!(arr && arr.unplaced.indexOf(idx)>=0);
      items.push({ idx, plate:it.plate, b:w, moved:false, inside:!lost && okBox(w), m:{ c:1, s:0, tx:dx-os[0], ty:dy-os[1] } });
    }
  });
  const per = [];
  for(let p=0; p<info.plates; p++){
    let u = null; items.filter(i=>i.plate===p).forEach(i => u = unionB(u,i.b));
    const over = u ? { x:Math.max(0,-u[0],u[3]-AD5X.w), y:Math.max(0,-u[1],u[4]-AD5X.h), z:Math.max(0,u[5]-AD5X.z) } : null;
    const lost = items.some(i => i.plate===p && !i.inside && arr && !i.moved);
    per.push({ plate:p, u, over, fits: u ? (over.x<=.05 && over.y<=.05 && over.z<=.05 && !lost) : null });
  }
  const unlocatable = info.plates>1 && !info.bed;
  const measured = per.filter(x=>x.u);
  const fits = (!measured.length || unlocatable) ? null : measured.every(x=>x.fits);
  const conf = buildConfig();
  const kept = [], repl = [], drop = [], wr = [];
  if(S.base){
    if(o.keep && info.cfg) kept.push('Altura de capa, paredes, relleno y soportes del creador');
    if(info.cfg) kept.push('Colores y filamentos asignados a cada pieza');
    repl.push('Impresora, filamento y proceso: los de “'+esc(S.base.name)+'”');
    drop.push('El resto del perfil del creador, velocidades y aceleraciones incluidas');
    if(conf.baseFilaments && info.filaments>conf.baseFilaments) wr.push('El perfil base tiene '+conf.baseFilaments+' filamento(s) y el modelo usa '+info.filaments+'. Se replicó el primero: asigná los materiales al abrirlo.');
    const bb = readBed(S.base.cfg);
    if(bb && (Math.abs(bb.w-AD5X.w)>1 || Math.abs(bb.h-AD5X.h)>1)) wr.push('El perfil base no parece de una AD5X: su cama mide '+fmt(bb.w)+' × '+fmt(bb.h)+' mm.');
    const st = info.cfg && Array.isArray(info.cfg.filament_type) ? String(info.cfg.filament_type[0]||'') : '';
    const bt = Array.isArray(S.base.cfg.filament_type) ? String(S.base.cfg.filament_type[0]||'') : '';
    if(st && bt && st.toUpperCase()!==bt.toUpperCase()) wr.push('El creador usa '+esc(st)+' y tu perfil base tiene '+esc(bt)+'. Se usa el de tu perfil base: cambialo en el laminador si querés '+esc(st)+'.');
    if(info.filaments>1) wr.push('La torre de purga usa la posición de tu perfil base. Confirmala al laminar.');
  } else if(info.cfg){
    kept.push('Capas, relleno, paredes, soportes y costura del creador');
    kept.push('Temperaturas'+(conf.clamps ? ' ('+conf.clamps+' limitadas a 300 °C de boquilla o 110 °C de cama)' : ''));
    kept.push('Colores y filamentos asignados a cada pieza');
    repl.push('Impresora: '+esc(info.printerName||'Bambu Lab')+' → Flashforge AD5X, cama 220 × 220 × 220 mm');
    repl.push('Boquilla de '+fmt(Number(o.nozzle))+' mm');
    if(conf.filaments){
      const orig = Array.isArray(info.cfg.filament_settings_id) ? info.cfg.filament_settings_id : [];
      repl.push('Filamento: '+esc(orig.join(', ')||'de Bambu')+' → '+esc(conf.filaments.join(', ')));
    }
    repl.push('G-code de inicio y fin, límites de máquina y formato de miniaturas de la AD5X');
    drop.push('Velocidades y aceleraciones ('+(conf.dropped ? conf.dropped.length : 0)+' valores): están ajustadas a la cinemática de Bambu');
    if(conf.invalid) drop.push(conf.invalid+' valor(es) −1 no válidos para Flash Studio, cambiados a 0');
    wr.push('Sin perfil base, los datos de máquina salen de un proyecto de referencia de Flash Studio (boquilla de 0,4 mm) y el filamento sale del creador. Con un perfil base salen tus ajustes reales.');
    if(o.nozzle!=='0.4') wr.push('Los nombres de perfil de la AD5X los verifiqué solo con boquilla de 0,4 mm.');
    if(info.filaments>1) wr.push('La torre de purga se colocó en la posición de referencia de la AD5X. Confirmala al laminar.');
  } else {
    wr.push('Este archivo no trae ajustes de impresora, así que solo se pudo reposicionar y limpiar.');
  }
  if(PG.apply && PG.n===info.filaments && info.filaments>1) repl.push('Matriz de purga editada en la calculadora (multiplicador '+fmt(PG.mult).replace(/,0$/,'')+')');
  if(arr){
    const moved = items.filter(i => i.moved), other = moved.filter(i => i.plate!==info.items[i.idx].plate).length;
    repl.push('Piezas acomodadas ('+(o.arrange==='rotate' ? 'movidas y rotadas' : 'solo movidas')+'): '+moved.length+', con '+ARR_GAP+' mm entre sí y '+ARR_EDGE+' mm del borde');
    if(other) repl.push(other+' pieza(s) pasaron a otra placa');
    if(arr.unplaced.length) wr.push(arr.unplaced.length+' pieza(s) no entran en ninguna de las '+info.plates+' placas, ni acomodadas. Hace falta otra placa: creala en el laminador y pasá esas piezas.');
  } else if(info.bed && (dx||dy)) repl.push('Posición de los objetos, recentrados en la cama ('+signed(dx)+' mm en X, '+signed(dy)+' mm en Y)');
  if(info.bed && info.plates>1 && !arr) repl.push('Cada objeto se mantuvo en su placa: la separación entre placas depende del tamaño de la cama');
  if(o.strip) drop.push('G-code y datos de laminado de Bambu');
  if(info.filaments>4) wr.push('Usa '+info.filaments+' filamentos y el IFS de la AD5X carga 4.');
  if(unlocatable) wr.push('Tiene '+info.plates+' placas y sin los ajustes de cama no puedo ubicarlas. Revisalas en el laminador.');
  if(info.nozzles>1) wr.push('El archivo es de doble boquilla. La AD5X tiene una sola.');
  if(info.app && !/bambu/i.test(info.app)) wr.push('No parece creado con Bambu Studio ('+esc(info.app)+'). Revisalo al abrirlo.');
  if(fits===false) wr.push(o.arrange==='off' ? 'Probá con “Acomodar piezas” en Ajustes, o rotá y escalá la pieza en el laminador.' : 'Rotá o escalá la pieza en el laminador para que entre.');
  return { items, per, fits, unlocatable, dx, dy, kept, repl, drop, wr, conf, arr };
}

/* ---------- dibujo de la cama ---------- */
function renderPlate(ev, animate){
  const C = 180, info = S.info;
  const sb = info && info.bed ? info.bed : {w:256,h:256};
  const k = 300 / Math.max(sb.w, sb.h, AD5X.w);
  const sw = sb.w*k, sh = sb.h*k, aw = AD5X.w*k, ah = AD5X.h*k;
  let o = '';
  const showSrc = Math.abs(sb.w-AD5X.w)>1 || Math.abs(sb.h-AD5X.h)>1;
  if(showSrc){
    o += `<rect class="bed-src" x="${C-sw/2}" y="${C-sh/2}" width="${sw}" height="${sh}"/>`;
    o += `<text class="lbl" x="${C-sw/2}" y="${C-sh/2-8}">Cama de origen ${fmt(sb.w)} × ${fmt(sb.h)}</text>`;
    o += `<circle class="dot-s" cx="${C-sw/2}" cy="${C+sh/2}" r="3.5"/>`;
  }
  o += `<rect class="bed-ad5x" x="${C-aw/2}" y="${C-ah/2}" width="${aw}" height="${ah}"/>`;
  for(let v=20; v<AD5X.w; v+=20){
    o += `<line class="grid-l" x1="${C-aw/2+v*k}" y1="${C-ah/2}" x2="${C-aw/2+v*k}" y2="${C+ah/2}"/>`;
    o += `<line class="grid-l" x1="${C-aw/2}" y1="${C-ah/2+v*k}" x2="${C+aw/2}" y2="${C-ah/2+v*k}"/>`;
  }
  o += `<text class="lbl a" x="${C-aw/2+8}" y="${C-ah/2+18}">AD5X 220 × 220</text>`;
  o += `<circle class="dot-a" cx="${C-aw/2}" cy="${C+ah/2}" r="4.5"/>`;
  if(info && info.plates>1) o += `<text class="lbl a" text-anchor="end" x="${C+aw/2-8}" y="${C-ah/2+18}">Placa ${S.plate+1} de ${info.plates}</text>`;
  if(ev && !ev.unlocatable){
    o += `<g class="foot-g${animate?' in':''}">`;
    ev.items.filter(i => i.plate===S.plate).forEach(i => {
      const b = i.b;
      o += `<rect class="foot${i.inside?'':' out'}" x="${C+(b[0]-AD5X.w/2)*k}" y="${C-(b[4]-AD5X.h/2)*k}" width="${(b[3]-b[0])*k}" height="${(b[4]-b[1])*k}"/>`;
    });
    o += '</g>';
  }
  $('#svg').innerHTML = o;
}

/* ---------- vista 3D (three.js) ---------- */
const V3 = { inited:false, failed:false, mat:null, r:null, scene:null, cam:null, group:null, raf:0, az:-0.55, el:0.72, dist:430,
             target:null, geo:new Map(), ptr:new Map(), pinch:0, budget:0 };
const TRI_ITEM_LIMIT = 900000, TRI_TOTAL_LIMIT = 1600000;
function cssHex(name, fb){ const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : fb; }
function parseColor(h){ const s = String(h||'').replace('#',''); if(s.length<6) return [.7,.75,.8]; return [0,2,4].map(i => (parseInt(s.slice(i,i+2),16)||0)/255); }
function countTris(models, path, id, depth, parts, st){
  const mm = models.get(path), o = mm && mm.get(id); if(!o) return;
  if(o.verts){ if(o.tris) st.n += o.tris.length/3; else st.missing = true; }
  else if(o.comps) for(const c of o.comps){
    if(depth===0 && parts){ const p = parts[c.id]; if(p && p.subtype!=='normal_part') continue; }
    countTris(models, c.path || path, c.id, depth+1, null, st);
  }
}
function fillTris(models, path, id, M, depth, parts, ext, cols, pos, col, st){
  const mm = models.get(path), o = mm && mm.get(id); if(!o) return;
  if(o.verts && o.tris){
    const v = o.verts, t = o.tris, rgb = cols[ext-1] || [.7,.75,.8];
    for(let i=0;i<t.length;i++){
      const k = t[i]*3, x=v[k], y=v[k+1], z=v[k+2], q = st.p*3;
      pos[q]   = x*M[0]+y*M[3]+z*M[6]+M[9];
      pos[q+1] = x*M[1]+y*M[4]+z*M[7]+M[10];
      pos[q+2] = x*M[2]+y*M[5]+z*M[8]+M[11];
      col[q]=rgb[0]; col[q+1]=rgb[1]; col[q+2]=rgb[2]; st.p++;
    }
  } else if(o.comps){
    for(const c of o.comps){
      let pe = ext;
      if(depth===0 && parts){ const p = parts[c.id]; if(p){ if(p.subtype!=='normal_part') continue; pe = p.extruder || ext; } }
      fillTris(models, c.path || path, c.id, composeTr(c.tr, M), depth+1, null, pe, cols, pos, col, st);
    }
  }
}
function v3Geo(idx){
  if(V3.geo.has(idx)) return V3.geo.get(idx);
  const info = S.info, it = info.items[idx], oi = info.objInfo[it.id];
  const cols = (info.cfg && Array.isArray(info.cfg.filament_colour) ? info.cfg.filament_colour : []).map(parseColor);
  const st = { n:0, missing:false }; countTris(info.models, info.mainPath, it.id, 0, oi && oi.parts, st);
  let geo;
  if(st.missing || !st.n || st.n>TRI_ITEM_LIMIT || V3.budget+st.n>TRI_TOTAL_LIMIT){
    const b = it.bounds; geo = new THREE.BoxGeometry(b[3]-b[0], b[4]-b[1], b[5]-b[2]);
    geo.translate((b[0]+b[3])/2, (b[1]+b[4])/2, (b[2]+b[5])/2);
    const n = geo.attributes.position.count, c = new Float32Array(n*3).fill(.62);
    geo.setAttribute('color', new THREE.BufferAttribute(c,3)); geo.userData.box = true;
  } else {
    V3.budget += st.n;
    const pos = new Float32Array(st.n*9), col = new Float32Array(st.n*9);
    fillTris(info.models, info.mainPath, it.id, it.tr, 0, oi && oi.parts, (oi && oi.extruder) || 1, cols, pos, col, { p:0 });
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    geo.computeVertexNormals();
  }
  V3.geo.set(idx, geo); return geo;
}
function v3Reset(){ V3.geo.forEach(g => g.dispose()); V3.geo.clear(); V3.budget = 0; }
function v3Dirty(){
  if(V3.raf || !V3.inited) return;
  V3.raf = requestAnimationFrame(() => {
    V3.raf = 0; if(S.view!=='3d') return;
    const {az,el,dist,target} = V3;
    V3.cam.position.set(target.x+dist*Math.cos(el)*Math.sin(az), target.y-dist*Math.cos(el)*Math.cos(az), target.z+dist*Math.sin(el));
    V3.cam.lookAt(target); V3.r.render(V3.scene, V3.cam);
  });
}
function v3Resize(){
  if(!V3.inited) return; const el = $('#v3d'), w = el.clientWidth, h = el.clientHeight; if(!w || !h) return;
  V3.r.setSize(w,h,false); V3.cam.aspect = w/h; V3.cam.updateProjectionMatrix(); v3Dirty();
}
function v3Init(){
  if(V3.inited) return true; if(V3.failed) return false;
  if(typeof THREE==='undefined'){ V3.failed = true; return false; }
  try{
    const el = $('#v3d');
    V3.r = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    V3.r.setPixelRatio(Math.min(window.devicePixelRatio||1, 2)); V3.r.setClearColor(0x000000, 0);
    const cv = V3.r.domElement; cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block'; el.appendChild(cv);
    V3.scene = new THREE.Scene(); V3.cam = new THREE.PerspectiveCamera(38, 1, 1, 4000); V3.cam.up.set(0,0,1);
    V3.scene.add(new THREE.AmbientLight(0xffffff, .62));
    const d1 = new THREE.DirectionalLight(0xffffff, .78); d1.position.set(-120,-200,300); V3.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, .28); d2.position.set(250,150,120); V3.scene.add(d2);
    V3.mat = new THREE.MeshLambertMaterial({ vertexColors:true, side:THREE.DoubleSide });
    V3.group = new THREE.Group(); V3.scene.add(V3.group); V3.target = new THREE.Vector3(110,110,18);
    el.addEventListener('pointerdown', e => { try{ el.setPointerCapture(e.pointerId); }catch(_){} V3.ptr.set(e.pointerId,{x:e.clientX,y:e.clientY}); V3.pinch = 0; });
    el.addEventListener('pointermove', e => {
      const p = V3.ptr.get(e.pointerId); if(!p) return;
      const dx = e.clientX-p.x, dy = e.clientY-p.y; p.x = e.clientX; p.y = e.clientY;
      if(V3.ptr.size===1){ V3.az -= dx*.008; V3.el = Math.max(.08, Math.min(1.5, V3.el+dy*.008)); }
      else if(V3.ptr.size===2){
        const [a,b] = [...V3.ptr.values()], d = Math.hypot(a.x-b.x, a.y-b.y);
        if(V3.pinch) V3.dist = Math.max(120, Math.min(900, V3.dist*V3.pinch/d)); V3.pinch = d;
      }
      v3Dirty();
    });
    const up = e => { V3.ptr.delete(e.pointerId); V3.pinch = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); V3.dist = Math.max(120, Math.min(900, V3.dist*Math.exp(e.deltaY*.001))); v3Dirty(); }, { passive:false });
    if(typeof ResizeObserver!=='undefined') new ResizeObserver(v3Resize).observe(el);
    V3.inited = true; v3Resize(); return true;
  } catch(e){ console.error(e); V3.failed = true; return false; }
}
function v3Update(ev){
  if(S.view!=='3d' || !S.info || !ev) return;
  if(!v3Init()){
    S.view = '3d-fail'; applyView();
    $('#plateCap').textContent = 'Tu navegador no pudo iniciar WebGL, así que sigo mostrando la vista 2D.';
    return;
  }
  while(V3.group.children.length){
    const c = V3.group.children.pop();
    if(c.userData.own){ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }
  }
  const add = obj => { obj.userData.own = true; V3.group.add(obj); return obj; };
  const bed = add(new THREE.Mesh(new THREE.PlaneGeometry(AD5X.w, AD5X.h), new THREE.MeshBasicMaterial({ color:new THREE.Color(cssHex('--surface','#eeeeee')) })));
  bed.position.set(AD5X.w/2, AD5X.h/2, -.05);
  const lineCol = new THREE.Color(cssHex('--line','#bbbbbb'));
  const grid = add(new THREE.GridHelper(AD5X.w, 11, lineCol, lineCol));
  grid.rotation.x = Math.PI/2; grid.position.set(AD5X.w/2, AD5X.h/2, 0);
  const box = add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(AD5X.w, AD5X.h, AD5X.z)), new THREE.LineBasicMaterial({ color:new THREE.Color(cssHex('--accent','#00778c')) })));
  box.position.set(AD5X.w/2, AD5X.h/2, AD5X.z/2);
  const holder = new THREE.Group(); V3.group.add(holder);
  ev.items.filter(i => i.plate===S.plate).forEach(e => {
    const mesh = new THREE.Mesh(v3Geo(e.idx), V3.mat);
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
    mesh.matrix.set(e.m.c,-e.m.s,0,e.m.tx, e.m.s,e.m.c,0,e.m.ty, 0,0,1,0, 0,0,0,1); mesh.matrixWorldNeedsUpdate = true;
    holder.add(mesh);
  });
  v3Resize(); v3Dirty();
}
function applyView(){
  const has = !!S.info, on = has && S.view==='3d';
  $('#plate').classList.toggle('is3d', on); $('#v3d').hidden = !on;
  if(on) $('#plateCap').textContent = 'Arrastrá para girar y usá la rueda o el pellizco para acercar. Los colores son los filamentos asignados a cada pieza; los colores pintados a mano no se muestran.';
  const r = document.querySelector('input[name="view"][value="'+(S.view==='3d-fail'?'2d':S.view)+'"]'); if(r) r.checked = true;
}

/* ---------- interfaz ---------- */
function renderTabs(){
  const t = $('#tabs'); const n = S.info ? S.info.plates : 1;
  if(n < 2){ t.hidden = true; t.innerHTML = ''; return; }
  t.hidden = false;
  t.innerHTML = Array.from({length:n}, (_,i) => `<button type="button" role="tab" aria-selected="${i===S.plate}" data-p="${i}">Placa ${i+1}</button>`).join('');
}
function renderSummary(ev, animate){
  const info = S.info;
  renderTabs();
  renderPlate(ev, animate);
  let vcls='', vtxt='', sub='';
  const measured = ev.per.filter(x=>x.u);
  if(ev.unlocatable){ vcls='warn'; vtxt=info.plates+' placas'; sub='No puedo ubicar cada placa sin los ajustes de cama.'; }
  else if(!measured.length){ vcls='warn'; vtxt='No pude medir las piezas'; sub='El archivo no trae la geometría en un formato que pueda leer.'; }
  else if(ev.fits===true){ vcls='ok'; vtxt='Entra en la AD5X'; if(info.plates>1) sub='Las '+info.plates+' placas entran en 220 × 220 mm.'; }
  else {
    vcls='bad'; vtxt='No entra en la cama';
    const bad = measured.filter(x=>!x.fits).map(x => {
      const p=[]; if(x.over.x>.05)p.push('se pasa '+fmt(x.over.x)+' mm en X'); if(x.over.y>.05)p.push('se pasa '+fmt(x.over.y)+' mm en Y'); if(x.over.z>.05)p.push('se pasa '+fmt(x.over.z)+' mm de alto');
      return (info.plates>1 ? 'Placa '+(x.plate+1)+': ' : '') + p.join(', ');
    });
    sub = bad.join('. ').replace(/^./,c=>c.toUpperCase())+'.';
  }
  const cur = ev.per[S.plate];
  if(cur && cur.u && !ev.unlocatable){
    const dims = (info.plates>1 ? 'Placa '+(S.plate+1)+': ' : '') + 'ocupa '+fmt(cur.u[3]-cur.u[0])+' × '+fmt(cur.u[4]-cur.u[1])+' mm y '+fmt(cur.u[5]-cur.u[2])+' mm de alto.';
    sub = sub ? sub+' '+dims.replace(/^./,c=>c.toUpperCase()) : dims.replace(/^./,c=>c.toUpperCase());
  }
  let h = `<p class="verdict ${vcls}"><i aria-hidden="true"></i>${esc(vtxt)}</p><p class="sub">${esc(sub)}</p>`;
  [['Conservado',ev.kept],['Reemplazado',ev.repl],['Descartado',ev.drop]].forEach(([t,l]) => {
    if(l.length) h += `<h3>${t}</h3><ul class="list">${l.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  });
  if(ev.wr.length) h += `<h3>A revisar</h3><ul class="list warn">${ev.wr.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  $('#result').innerHTML = h;
  $('#plateCap').textContent = ev.unlocatable
    ? 'Archivo con varias placas: no hay vista previa de las piezas.'
    : (info.plates>1 ? 'Este proyecto tiene '+info.plates+' placas (trabajos de impresión separados). Elegí una para ver sus piezas; la conversión incluye todas. ' : '') + 'Los puntos marcan el origen (0, 0) de cada cama. Las piezas se dibujan como quedarán en la AD5X.';
  $('#svg').setAttribute('aria-label', 'Cama de la AD5X de 220 por 220 milímetros. '+vtxt+'.');
  applyView(); v3Update(ev);
}
function refresh(animate){
  const has = !!S.info;
  $('#cta').hidden = has;
  $('#pick2').hidden = !has;
  $('#dl').disabled = !has || S.busy;
  const nz = document.querySelectorAll('input[name="nz"]');
  nz.forEach(r => r.disabled = !!S.base);
  $('#oGeneric').disabled = !!S.base; $('#genWrap').classList.toggle('off', !!S.base);
  const keep = $('#oKeep'); keep.disabled = !S.base; $('#keepWrap').classList.toggle('off', !S.base);
  $('#baseName').textContent = S.base ? S.base.name : '';
  $('#clearBase').hidden = !S.base;
  const arrOn = S.opts.arrange!=='off';
  $('#oRecenter').disabled = arrOn; $('#recWrap').classList.toggle('off', arrOn);
  $('#arrNote').textContent = arrOn
    ? 'Cada pieza se reubica con '+ARR_GAP+' mm de separación y '+ARR_EDGE+' mm del borde, y se reserva lugar para la torre de purga si hay más de un color. Usa el rectángulo que envuelve a cada pieza, no su forma exacta.'
    : 'Reubica las piezas dentro de los 220 × 220 mm cuando no entran o quedaron mal repartidas.';
  if(!has){ renderTabs(); renderPlate(null,false); applyView(); S.ev = null; if(PG.key!=='') purgeBuild(); return; }
  if(S.plate >= S.info.plates) S.plate = 0;
  const ev = evaluate(); S.ev = ev; renderSummary(ev, animate);
  const pk = S.name+'|'+S.info.filaments+'|'+(S.base ? S.base.name : '');
  if(PG.key!==pk) purgeBuild(ev);
  purgeEstimate(ev);
}
function setStatus(t, err){ const s=$('#status'); s.textContent = t||''; s.classList.toggle('err', !!err); }

async function loadFile(file){
  if(!file) return;
  setStatus(''); $('#ctaT').textContent = 'Leyendo el archivo…';
  try{
    const buf = await file.arrayBuffer();
    const info = await analyze(buf);
    S.buf = buf; S.info = info; S.name = file.name; S.size = file.size; S.plate = 0; S.arrCache = null; v3Reset();
    const bits = [fmtSize(file.size)];
    bits.push(info.app ? info.app.replace(/-/g,' ') : 'origen desconocido');
    if(info.printerName) bits.push(info.printerName);
    $('#fileLine').innerHTML = '<strong>'+esc(file.name)+'</strong><br><span class="muted">'+esc(bits.join(' · '))+'</span>';
    refresh(true);
  } catch(e){
    console.error(e);
    S.info = null; S.buf = null;
    $('#fileLine').textContent = 'No pude leer ese archivo.';
    setStatus(e && e.message ? e.message : 'No pude leer el archivo como 3MF.', true);
    refresh(false);
  } finally { $('#ctaT').textContent = 'Soltá tu archivo .3mf sobre la cama'; }
}
async function loadBase(file){
  if(!file) return;
  setStatus('');
  try{
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const {cfg} = await readCfg(zip);
    if(!cfg) throw new Error('Ese archivo no trae Metadata/project_settings.config. Guardalo como proyecto (.3mf) desde Orca-Flashforge.');
    S.base = { name:file.name, cfg };
    refresh(false);
  } catch(e){ setStatus(e.message || 'No pude leer el perfil base.', true); }
}

async function convert(){
  if(!S.info || S.busy) return;
  S.busy = true; $('#dl').disabled = true; setStatus('Generando el archivo…');
  try{
    const info = S.info, o = S.opts;
    const zip = await JSZip.loadAsync(S.buf);
    const {cfg} = buildConfig();
    if(cfg) zip.file(info.cfgName || 'Metadata/project_settings.config', JSON.stringify(cfg, null, 4));
    const ev = evaluate();
    const idxOf = {}; info.items.forEach((it,k) => { idxOf[it.id] = k; });
    const evOf = new Map(ev.items.map(e => [e.idx, e]));
    if(info.bed || ev.items.some(e => e.moved)){
      let t = await zip.file(info.mainPath).async('string');
      t = t.replace(/<build\b[\s\S]*?<\/build>/, blk => blk.replace(/<item\b([^>]*?)(\/?)>/g, (all, attrs, slash) => {
        const oid = (attrs.match(/\bobjectid="(\d+)"/)||[])[1];
        const e = evOf.get(idxOf[oid]);
        const tm = attrs.match(/\btransform="([^"]*)"/);
        let tr = parseTr(tm ? tm[1] : null);
        if(e && e.moved) tr = composeTr(tr, e.B);
        else { const [sx,sy] = itemShift(info, o, info.plateOf[oid]||0); if(!sx && !sy) return all; tr[9]+=sx; tr[10]+=sy; }
        const val = tr.map(n => +n.toFixed(6)).join(' ');
        const na = tm ? attrs.replace(/\btransform="[^"]*"/, 'transform="'+val+'"') : attrs+' transform="'+val+'"';
        return '<item'+na+slash+'>';
      }));
      zip.file(info.mainPath, t);
    }
    const moves = new Map();
    ev.items.forEach(e => { if(e.moved && e.plate!==info.items[e.idx].plate) moves.set(info.items[e.idx].id, e.plate); });
    if(moves.size){
      const ms0 = Object.keys(zip.files).find(n => /^Metadata\/model_settings\.config$/i.test(n));
      if(ms0) zip.file(ms0, movePlates(await zip.file(ms0).async('string'), moves));
    }
    if(o.strip){
      const removed = new Set();
      Object.keys(zip.files).forEach(n => { if(!zip.files[n].dir && STRIP_RE.test(n)){ removed.add(n); zip.remove(n); } });
      const ms = Object.keys(zip.files).find(n => /^Metadata\/model_settings\.config$/i.test(n));
      if(ms){
        let t = await zip.file(ms).async('string');
        t = t.replace(/^[ \t]*<metadata\s+key="gcode_file"\s+value="[^"]*"\s*\/>[ \t]*\r?\n?/gm, '');
        zip.file(ms, t);
      }
      const si = Object.keys(zip.files).find(n => /^Metadata\/slice_info\.config$/i.test(n));
      if(si){
        const t = await zip.file(si).async('string');
        const hd = (t.match(/<header>[\s\S]*?<\/header>/) || [''])[0];
        zip.file(si, '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  '+hd+'\n</config>\n');
      }
      const have = new Set(Object.keys(zip.files));
      for(const n of Object.keys(zip.files).filter(n => /\.rels$/i.test(n))){
        let t = await zip.file(n).async('string');
        t = t.replace(/\s*<Relationship\b[^>]*?Target="([^"]+)"[^>]*?\/>/g, (all, tg) => have.has(tg.replace(/^\//,'')) ? all : '');
        if(!/<Relationship\b/.test(t) && /model_settings\.config\.rels$/i.test(n)) zip.remove(n); else zip.file(n, t);
      }
    }
    if(!Object.keys(zip.files).some(n => /^Metadata\/filament_sequence\.json$/i.test(n))){
      const fs = {}; for(let i=1;i<=info.plates;i++) fs['plate_'+i] = {nozzle_sequence:[],optimal_assignment:[],sequence:[]};
      zip.file('Metadata/filament_sequence.json', JSON.stringify(fs));
    }
    const blob = await zip.generateAsync({type:'blob', mimeType:'model/3mf', compression:'DEFLATE', compressionOptions:{level:6}},
      m => setStatus('Generando el archivo… '+Math.round(m.percent)+'%'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = S.name.replace(/\.3mf$/i,'') + '_AD5X.3mf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus('Listo: '+a.download+' ('+fmtSize(blob.size)+').');
  } catch(e){
    console.error(e); setStatus('No pude generar el archivo: '+(e.message||e), true);
  } finally { S.busy = false; $('#dl').disabled = !S.info; }
}

/* ---------- comparar dos 3MF ---------- */
const CMP = { A:null, B:null, f:'chg', cat:'all', q:'', limit:150 };
const CAT_FIL = /^(filament_|nozzle_temperature|.*_plate_temp|fan_|.*_fan_|.*fan_speed|slow_down_|overhang_fan|close_fan|full_fan|pressure_advance|enable_pressure|temperature_vitrification|required_nozzle|reduce_fan|additional_cooling|activate_|chamber_temp|idle_temperature|default_filament_colour|dont_slow|support_material_interface_fan|flush_|filament)/;
const CAT_PRT = /^(printer_|machine_|nozzle_diameter|nozzle_type|nozzle_volume|printable_|bed_|extruder_|retract|deretract|z_hop|gcode_flavor|thumbnails|use_relative|single_extruder|scan_first|change_filament|layer_change|time_lapse|before_layer|file_start|emit_machine|default_print_profile|template_custom|fan_kickstart|use_firmware|long_retraction|wipe$|wipe_distance|min_layer_height|max_layer_height|auxiliary_fan|support_air|support_chamber|curr_bed|default_bed|cooling_tube|parking|purge_in_prime|from$|name$|version$|inherits|print_extruder|printer_extruder)/;
function catOf(k){ if(CAT_PRT.test(k)) return 'Impresora'; if(CAT_FIL.test(k)) return 'Filamento'; return 'Proceso'; }
function fmtVal(v){ if(v===undefined) return ''; return typeof v==='string' ? v : JSON.stringify(v); }
async function readMeta(file){
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const {cfg} = await readCfg(zip);
  if(!cfg) throw new Error('“'+file.name+'” no trae Metadata/project_settings.config. Tiene que ser un proyecto (.3mf) guardado desde un laminador.');
  const names = Object.keys(zip.files);
  const ms = names.find(n => /^Metadata\/model_settings\.config$/i.test(n));
  let plates = 1, objects = 0;
  if(ms){ const t = await zip.file(ms).async('string'); plates = Math.max(1,(t.match(/<plate>/g)||[]).length); objects = (t.match(/<object\s+id=/g)||[]).length; }
  const mp = names.find(n => /^3D\/3dmodel\.model$/i.test(n));
  let app = ''; if(mp){ const t = await zip.file(mp).async('string'); app = ((t.match(/<metadata\s+name="Application"[^>]*>([^<]*)</i)||[])[1]||'').trim(); }
  return { name:file.name, cfg, plates, objects, app };
}
async function cmpLoad(slot, file){
  if(!file) return;
  try{ CMP[slot] = await readMeta(file); CMP.limit = 150; cmpRender(); }
  catch(e){ console.error(e); $('#cmpMsg').textContent = e.message || 'No pude leer el archivo.'; }
}
function cmpUse(slot, what){
  if(!S.info){ $('#cmpMsg').textContent = 'Primero elegí un archivo en el conversor de arriba.'; return; }
  if(what==='orig'){
    if(!S.info.cfg){ $('#cmpMsg').textContent = 'El archivo cargado no trae ajustes para comparar.'; return; }
    CMP[slot] = { name:S.name+' (original)', cfg:S.info.cfg, plates:S.info.plates, objects:Object.keys(S.info.objInfo).length, app:S.info.app };
  } else {
    const r = buildConfig(); if(!r.cfg){ $('#cmpMsg').textContent = 'No hay ajustes que convertir en ese archivo.'; return; }
    CMP[slot] = { name:S.name.replace(/\.3mf$/i,'')+'_AD5X (resultado)', cfg:r.cfg, plates:S.info.plates, objects:Object.keys(S.info.objInfo).length, app:S.info.app };
  }
  CMP.limit = 150; cmpRender();
}
function cmpDiff(){
  const a = CMP.A.cfg, b = CMP.B.cfg, rows = [];
  [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().forEach(k => {
    const ia = k in a, ib = k in b;
    if(ia && ib){ if(JSON.stringify(a[k])===JSON.stringify(b[k])) return; rows.push({ k, st:'chg', cat:catOf(k), a:a[k], b:b[k] }); }
    else rows.push({ k, st:ia?'onlyA':'onlyB', cat:catOf(k), a:a[k], b:b[k] });
  });
  return rows;
}
function valCell(v){
  const s = fmtVal(v); if(s==='') return '<span class="muted">—</span>';
  return s.length>120 ? '<details><summary>'+esc(s.slice(0,90))+'…</summary><pre>'+esc(s)+'</pre></details>' : '<code>'+esc(s)+'</code>';
}
function modList(cfg){
  const d = cfg.different_settings_to_system; if(!Array.isArray(d) || d.length<2) return '<span class="muted">no trae la lista</span>';
  const groups = [['Proceso', d[0]], ['Filamento', d.slice(1,-1).join(';')], ['Impresora', d[d.length-1]]];
  return groups.map(([t,s]) => { const ks = [...new Set(String(s||'').split(';').filter(Boolean))];
    return '<p><b>'+t+' ('+ks.length+'):</b> '+(ks.length ? ks.map(k => '<code>'+esc(k)+'</code>').join(' ') : '<span class="muted">ninguna</span>')+'</p>'; }).join('');
}
function cmpRender(){
  ['A','B'].forEach(s => { $('#cmp'+s+'Name').textContent = CMP[s] ? CMP[s].name : 'Sin elegir'; });
  const out = $('#cmpOut');
  if(!CMP.A || !CMP.B){ out.hidden = true; $('#cmpMsg').textContent = CMP.A||CMP.B ? 'Falta el otro archivo.' : ''; return; }
  $('#cmpMsg').textContent = ''; out.hidden = false;
  const A = CMP.A, B = CMP.B, get = (c,k) => Array.isArray(c[k]) ? c[k].join(', ') : (c[k]===undefined ? '—' : String(c[k]));
  const meta = [
    ['Impresora', get(A.cfg,'printer_settings_id'), get(B.cfg,'printer_settings_id')],
    ['Proceso', get(A.cfg,'print_settings_id'), get(B.cfg,'print_settings_id')],
    ['Filamento', get(A.cfg,'filament_settings_id'), get(B.cfg,'filament_settings_id')],
    ['Tipo de filamento', get(A.cfg,'filament_type'), get(B.cfg,'filament_type')],
    ['Boquilla (mm)', get(A.cfg,'nozzle_diameter'), get(B.cfg,'nozzle_diameter')],
    ['Cama', get(A.cfg,'printable_area'), get(B.cfg,'printable_area')],
    ['Aplicación', A.app||'—', B.app||'—'],
    ['Versión de la configuración', get(A.cfg,'version'), get(B.cfg,'version')],
    ['Placas · objetos', A.plates+' · '+A.objects, B.plates+' · '+B.objects],
    ['Cantidad de ajustes', Object.keys(A.cfg).length, Object.keys(B.cfg).length]
  ];
  $('#cmpMeta').innerHTML = '<table class="cmp-t"><thead><tr><th></th><th>A</th><th>B</th></tr></thead><tbody>'+
    meta.map(r => '<tr><th scope="row">'+esc(r[0])+'</th><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>').join('')+'</tbody></table>';
  $('#cmpMods').innerHTML = '<div><h4>Modificados en A</h4>'+modList(A.cfg)+'</div><div><h4>Modificados en B</h4>'+modList(B.cfg)+'</div>';
  const rows = cmpDiff();
  const cnt = { chg:0, onlyA:0, onlyB:0 }; rows.forEach(r => cnt[r.st]++);
  $('#cmpCnt').innerHTML = '<span><b>'+cnt.chg+'</b> con valores distintos</span><span><b>'+cnt.onlyA+'</b> solo en A</span><span><b>'+cnt.onlyB+'</b> solo en B</span>';
  const q = CMP.q.trim().toLowerCase();
  const vis = rows.filter(r => (CMP.f==='all' || r.st===CMP.f) && (CMP.cat==='all' || r.cat===CMP.cat) && (!q || r.k.toLowerCase().indexOf(q)>=0 || fmtVal(r.a).toLowerCase().indexOf(q)>=0 || fmtVal(r.b).toLowerCase().indexOf(q)>=0));
  const shown = vis.slice(0, CMP.limit);
  $('#cmpRows').innerHTML = shown.length
    ? '<table class="cmp-t rows"><thead><tr><th>Ajuste</th><th>A</th><th>B</th></tr></thead><tbody>'+shown.map(r => '<tr class="'+r.st+'"><th scope="row"><code>'+esc(r.k)+'</code><small>'+r.cat+'</small></th><td>'+valCell(r.a)+'</td><td>'+valCell(r.b)+'</td></tr>').join('')+'</tbody></table>'
    : '<p class="muted">No hay ajustes que coincidan con ese filtro.</p>';
  $('#cmpMore').hidden = vis.length<=CMP.limit; $('#cmpMore').textContent = 'Mostrar más ('+(vis.length-CMP.limit)+' restantes)';
}

/* ---------- calculadora de purga ---------- */
const PG = { key:'', n:0, cols:[], mat0:[], mat:[], mult0:1, mult:1, min:0, max:0, chg:0, dens:1.24, apply:false, edited:false, srcNote:'' };
const hexRGB = h => { const s = String(h||'').replace('#',''); return s.length<6 ? [180,180,180] : [0,2,4].map(i => parseInt(s.slice(i,i+2),16)||0); };
const lum = c => (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;
function suggestFlush(a,b){
  const d = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2])/441.7;
  return Math.max(100, Math.min(720, Math.round(100 + 500*Math.max(0, lum(b)-lum(a)) + 120*d)));
}
function partsZ(info, it){
  if(it.zparts) return it.zparts;
  const oi = info.objInfo[it.id], out = [], mm = info.models.get(info.mainPath), o = mm && mm.get(it.id);
  if(o && o.comps){
    o.comps.forEach(c => {
      const p = oi && oi.parts[c.id]; if(p && p.subtype!=='normal_part') return;
      const b = worldBounds(info.models, c.path || info.mainPath, c.id, composeTr(c.tr, it.tr), 1);
      if(b) out.push({ z0:b[2], z1:b[5], e:(p && p.extruder) || (oi && oi.extruder) || 1 });
    });
  }
  if(!out.length) out.push({ z0:it.bounds[2], z1:it.bounds[5], e:(oi && oi.extruder) || 1 });
  return (it.zparts = out);
}
function estimateChanges(info, ev){
  if(info.filaments<2 || !ev) return { min:0, max:0 };
  const cfg = info.cfg || {}, lh = Number(cfg.layer_height)||.2, h0 = Number(cfg.initial_layer_print_height)||lh;
  let mn = 0, mx = 0;
  for(let p=0;p<info.plates;p++){
    const parts = []; ev.items.filter(i => i.plate===p).forEach(i => partsZ(info, info.items[i.idx]).forEach(q => parts.push(q)));
    if(!parts.length) continue;
    const zmax = Math.max(...parts.map(q => q.z1)), z0min = Math.min(...parts.map(q => q.z0)), H = zmax - z0min;
    let bottom = 0, thick = h0;
    while(bottom < H-1e-6){
      const zm = z0min + bottom + thick/2, act = new Set();
      parts.forEach(q => { if(q.z0<=zm && zm<=q.z1) act.add(q.e); });
      if(act.size>=2){ mn += act.size-1; mx += act.size; }
      bottom += thick; thick = lh;
    }
  }
  return { min:mn, max:mx };
}
function pgMean(mat, n){ let s=0, c=0; for(let i=0;i<n;i++) for(let j=0;j<n;j++) if(i!==j){ s += mat[i][j]; c++; } return c ? s/c : 0; }
function purgeBuild(ev){
  const info = S.info, box = $('#purgeOut');
  if(!info){ PG.n = 0; PG.key = ''; box.innerHTML = '<p class="muted">Elegí un archivo en el conversor de arriba y la calculadora usa sus colores y su matriz de purga.</p>'; return; }
  const N = info.filaments;
  PG.key = S.name+'|'+N+'|'+(S.base ? S.base.name : ''); PG.n = N; PG.apply = false; PG.edited = false;
  if(N<2){ box.innerHTML = '<p>Este archivo usa un solo filamento, así que no hay cambios de color ni purga en la torre.</p>'; return; }
  PG.cols = (info.cfg && Array.isArray(info.cfg.filament_colour) ? info.cfg.filament_colour : []).slice(0,N).map(hexRGB);
  while(PG.cols.length<N) PG.cols.push([180,180,180]);
  const pick = [S.base && S.base.cfg, info.cfg].find(c => c && Array.isArray(c.flush_volumes_matrix) && c.flush_volumes_matrix.length===N*N);
  PG.mat0 = []; PG.srcNote = pick ? 'Matriz leída de '+(pick===info.cfg ? 'el archivo' : 'tu perfil base')+'.' : 'El archivo no trae una matriz para '+N+' filamentos: partí de valores sugeridos por color.';
  for(let i=0;i<N;i++){ PG.mat0.push([]); for(let j=0;j<N;j++) PG.mat0[i].push(i===j ? 0 : (pick ? Number(pick.flush_volumes_matrix[i*N+j])||0 : suggestFlush(PG.cols[i],PG.cols[j]))); }
  PG.mat = PG.mat0.map(r => r.slice());
  const fm = pick && pick.flush_multiplier !== undefined ? pick.flush_multiplier : (info.cfg && info.cfg.flush_multiplier);
  PG.mult0 = PG.mult = Number(Array.isArray(fm) ? fm[0] : fm) || 1;
  const dn = info.cfg && Array.isArray(info.cfg.filament_density) ? info.cfg.filament_density.map(Number).filter(Number.isFinite) : [];
  PG.dens = dn.length ? dn.reduce((a,b)=>a+b,0)/dn.length : 1.24;
  const sw = i => '<i class="sw" style="background:rgb('+PG.cols[i].join(',')+')" title="Filamento '+(i+1)+'"></i>';
  let t = '<table class="mtx"><thead><tr><th class="corner">De \\ a</th>'+PG.cols.map((_,j) => '<th scope="col">'+sw(j)+'<span>'+(j+1)+'</span></th>').join('')+'</tr></thead><tbody>';
  for(let i=0;i<N;i++){
    t += '<tr><th scope="row">'+sw(i)+'<span>'+(i+1)+'</span></th>';
    for(let j=0;j<N;j++) t += i===j ? '<td class="diag">—</td>' : '<td><input type="number" min="0" max="2000" step="10" inputmode="numeric" data-i="'+i+'" data-j="'+j+'" aria-label="Purga de filamento '+(i+1)+' a '+(j+1)+'"></td>';
    t += '</tr>';
  }
  t += '</tbody></table>';
  box.innerHTML = '<div class="pg-grid"><div><h3>Matriz de purga (mm³)</h3><p class="muted small">Volumen que se descarta en la torre al cambiar de la fila a la columna. '+esc(PG.srcNote)+'</p><div class="mtx-wrap">'+t+'</div>'+
    '<div class="btns"><button type="button" class="btn sm" id="pgSug">Sugerir según colores</button><button type="button" class="btn ghost sm" data-scale="0.75">−25 %</button><button type="button" class="btn ghost sm" data-scale="0.5">−50 %</button><button type="button" class="btn ghost sm" id="pgReset">Restaurar</button></div>'+
    '<label class="fld">Multiplicador de purga<input type="number" id="pgMult" min="0" max="5" step="0.05"></label></div>'+
    '<div><h3>Estimación</h3><label class="fld">Cambios de color en total<input type="number" id="pgChg" min="0" step="1"></label><p class="muted small" id="pgChgNote"></p><div id="pgRes" aria-live="polite"></div>'+
    '<label class="opt"><input type="checkbox" id="pgApply"><span>Aplicar esta matriz al 3MF convertido<small>Reemplaza la matriz y el multiplicador en el archivo que descargues.</small></span></label></div></div>';
  purgeFill();
}
function purgeFill(){
  const N = PG.n; if(N<2) return;
  document.querySelectorAll('#purgeOut input[data-i]').forEach(inp => { inp.value = PG.mat[+inp.dataset.i][+inp.dataset.j]; });
  $('#pgMult').value = PG.mult;
  purgeCalc();
}
function purgeEstimate(ev){
  if(!S.info || PG.n<2) return;
  const e = estimateChanges(S.info, ev || S.ev); PG.min = e.min; PG.max = e.max;
  if(!PG.edited) PG.chg = Math.round((e.min+e.max)/2);
  const inp = $('#pgChg'); if(inp && !PG.edited) inp.value = PG.chg;
  const note = $('#pgChgNote'); if(note) note.textContent = e.max>0
    ? 'Estimé entre '+e.min+' y '+e.max+' cambios según las capas donde se cruzan colores. Es una aproximación: no ve colores pintados a mano y depende del orden que elija el laminador. Si el laminador te da el número real, escribilo.'
    : 'No detecté capas con más de un color en las piezas. Si pintaste colores a mano, escribí acá la cantidad de cambios que te informa el laminador.';
  purgeCalc();
}
function purgeCalc(){
  const N = PG.n; if(N<2 || !$('#pgRes')) return;
  const vNew = pgMean(PG.mat, N)*PG.mult, vOld = pgMean(PG.mat0, N)*PG.mult0;
  const g = v => v*PG.chg/1000*PG.dens, gNew = g(vNew), gOld = g(vOld), save = gOld-gNew;
  const r1 = n => fmt(n);
  $('#pgRes').innerHTML = '<dl class="res"><div><dt>Purga media por cambio</dt><dd>'+r1(vNew)+' mm³ <small>(antes '+r1(vOld)+')</small></dd></div>'+
    '<div><dt>Purga total estimada</dt><dd>'+r1(gNew)+' g <small>('+r1(vNew*PG.chg/1000)+' cm³)</small></dd></div>'+
    '<div><dt>Con la matriz original</dt><dd>'+r1(gOld)+' g</dd></div>'+
    '<div class="sv"><dt>Diferencia</dt><dd>'+(save>=0 ? 'Ahorrás ' : 'Gastás ')+r1(Math.abs(save))+' g'+(gOld>0 ? ' <small>('+r1(Math.abs(save)/gOld*100)+' %)</small>' : '')+'</dd></div></dl>'+
    '<p class="muted small">Densidad usada: '+String(Math.round(PG.dens*100)/100).replace('.',',')+' g/cm³. Menos purga puede dejar rastros del color anterior en la pieza: probalo primero con una pieza chica.</p>';
}

/* ---------- eventos ---------- */
const fileIn = $('#file'), baseIn = $('#baseFile'), plate = $('#plate');
$('#pick').addEventListener('click', () => fileIn.click());
$('#pick2').addEventListener('click', () => fileIn.click());
$('#pickBase').addEventListener('click', () => baseIn.click());
$('#clearBase').addEventListener('click', () => { S.base = null; setStatus(''); refresh(false); });
fileIn.addEventListener('change', () => { loadFile(fileIn.files[0]); fileIn.value=''; });
baseIn.addEventListener('change', () => { loadBase(baseIn.files[0]); baseIn.value=''; });
['dragenter','dragover'].forEach(ev => plate.addEventListener(ev, e => { e.preventDefault(); plate.classList.add('drag'); }));
['dragleave','drop'].forEach(ev => plate.addEventListener(ev, e => { e.preventDefault(); plate.classList.remove('drag'); }));
plate.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if(f) loadFile(f); });
['dragover','drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));
$('#oRecenter').addEventListener('change', e => { S.opts.recenter = e.target.checked; refresh(false); });
$('#oStrip').addEventListener('change', e => { S.opts.strip = e.target.checked; refresh(false); });
$('#oGeneric').addEventListener('change', e => { S.opts.generic = e.target.checked; refresh(false); });
$('#oKeep').addEventListener('change', e => { S.opts.keep = e.target.checked; refresh(false); });
const pickPlate = i => { if(!S.info || i<0 || i>=S.info.plates) return; S.plate = i; refresh(false); const b = document.querySelector('#tabs button[data-p="'+i+'"]'); if(b) b.focus(); };
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if(b) pickPlate(Number(b.dataset.p)); });
$('#tabs').addEventListener('keydown', e => { if(e.key==='ArrowRight') { e.preventDefault(); pickPlate(S.plate+1); } if(e.key==='ArrowLeft') { e.preventDefault(); pickPlate(S.plate-1); } });
document.querySelectorAll('input[name="nz"]').forEach(r => r.addEventListener('change', e => { S.opts.nozzle = e.target.value; refresh(false); }));
$('#dl').addEventListener('click', convert);

document.querySelectorAll('input[name="arr"]').forEach(r => r.addEventListener('change', e => { S.opts.arrange = e.target.value; refresh(false); }));
document.querySelectorAll('input[name="view"]').forEach(r => r.addEventListener('change', e => { S.view = e.target.value; refresh(false); }));
/* comparar */
$('#cmpAPick').addEventListener('click', () => $('#cmpAFile').click());
$('#cmpBPick').addEventListener('click', () => $('#cmpBFile').click());
$('#cmpAFile').addEventListener('change', e => { cmpLoad('A', e.target.files[0]); e.target.value=''; });
$('#cmpBFile').addEventListener('change', e => { cmpLoad('B', e.target.files[0]); e.target.value=''; });
$('#cmpAUse').addEventListener('click', () => cmpUse('A','orig'));
$('#cmpBUse').addEventListener('click', () => cmpUse('B','result'));
document.querySelectorAll('input[name="cmpf"]').forEach(r => r.addEventListener('change', e => { CMP.f = e.target.value; CMP.limit = 150; if(CMP.A && CMP.B) cmpRender(); }));
$('#cmpCat').addEventListener('change', e => { CMP.cat = e.target.value; CMP.limit = 150; if(CMP.A && CMP.B) cmpRender(); });
$('#cmpQ').addEventListener('input', e => { CMP.q = e.target.value; CMP.limit = 150; if(CMP.A && CMP.B) cmpRender(); });
$('#cmpMore').addEventListener('click', () => { CMP.limit += 200; cmpRender(); });
/* purga */
const pgBox = $('#purgeOut');
pgBox.addEventListener('input', e => {
  const t = e.target;
  if(t.dataset && t.dataset.i !== undefined){ PG.mat[+t.dataset.i][+t.dataset.j] = Math.max(0, Number(t.value)||0); purgeCalc(); }
  else if(t.id==='pgMult'){ PG.mult = Math.max(0, Number(t.value)||0); purgeCalc(); }
  else if(t.id==='pgChg'){ PG.chg = Math.max(0, Math.round(Number(t.value)||0)); PG.edited = true; purgeCalc(); }
});
pgBox.addEventListener('change', e => { if(e.target.id==='pgApply'){ PG.apply = e.target.checked; refresh(false); } });
pgBox.addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b || PG.n<2) return;
  if(b.id==='pgSug'){ for(let i=0;i<PG.n;i++) for(let j=0;j<PG.n;j++) PG.mat[i][j] = i===j ? 0 : suggestFlush(PG.cols[i],PG.cols[j]); purgeFill(); }
  else if(b.dataset.scale){ const k = Number(b.dataset.scale); PG.mat = PG.mat.map(r => r.map(v => Math.round(v*k/10)*10)); purgeFill(); }
  else if(b.id==='pgReset'){ PG.mat = PG.mat0.map(r => r.slice()); PG.mult = PG.mult0; purgeFill(); }
});
if(typeof window.__TRAZA_TEST==='function') window.__TRAZA_TEST({ V3, S, PG, CMP, evaluate, arrange, getArrangement, v3Geo, hullOf, buildConfig, estimateChanges, suggestFlush, cmpDiff, catOf, plateOrigin, composeTr, worldBounds });
refresh(false);
})();
