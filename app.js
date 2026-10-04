import { Anthropic } from "./vendor/anthropic.js";

// ---------- Ficha SCA ----------
const DEFECTOS = [
  {k:"negro_completo",n:"Negro completo",c:1,e:1,d:"más de la mitad del grano negro o marrón muy oscuro, opaco; suele ser más chico, arrugado y con la hendidura central abierta. No confundir con hongo (polvoriento, en parches)"},
  {k:"agrio_completo",n:"Agrio completo",c:1,e:1,d:"grano entero amarillo, café claro a café oscuro o rojizo, a menudo con película plateada rojiza o aspecto ceroso. En naturales y honeys un tono marrón suave y parejo es propio del proceso: márcalo agrio solo si destaca claramente frente a los granos sanos del lote"},
  {k:"cereza_seca",n:"Cereza seca",c:1,e:1,d:"grano todavía dentro de la piel seca de la cereza: bola oscura y rugosa, más grande, sin hendidura visible (la cáscara suelta no tiene grano dentro)"},
  {k:"hongo",n:"Daño por hongo",c:1,e:1,d:"parches polvorientos blancos, amarillos o café rojizo, a veces con puntos de esporas (no liso como el negro parcial)"},
  {k:"materia_extrana",n:"Materia extraña",c:1,e:1,d:"piedras, palos, terrones u otros objetos que no son café"},
  {k:"insecto_severo",n:"Insecto severo",c:1,e:5,d:"3 o más perforaciones de broca: agujeros redondos de ~1 mm, a veces con borde oscuro o galerías"},
  {k:"negro_parcial",n:"Negro parcial",c:2,e:3,d:"mancha negra u oscura lisa en menos de la mitad del grano (punta, borde o centro); no confundir con puntos de tierra"},
  {k:"agrio_parcial",n:"Agrio parcial",c:2,e:3,d:"zona amarilla o café rojiza en menos de la mitad del grano, que destaca frente al tono normal del lote (no manchas de secado de naturales y honeys)"},
  {k:"pergamino",n:"Pergamino",c:2,e:5,d:"grano cubierto total o parcialmente por la cascarilla clara y papelosa del pergamino (la película plateada es más delgada y brillante)"},
  {k:"flotador",n:"Flotador",c:2,e:5,d:"grano blanqueado, blanquecino, de aspecto liviano y poco denso (el inmaduro, en cambio, es verdoso)"},
  {k:"inmaduro",n:"Inmaduro",c:2,e:5,d:"más chico, verde amarillento o verde oliva claro, opaco, película plateada adherida, puntas curvadas en U, bordes delgados. Es frecuente: revisa todos los granos verdosos"},
  {k:"arrugado",n:"Arrugado",c:2,e:5,d:"superficie arrugada como pasa, grano liviano y claro (si es oscuro, es negro)"},
  {k:"concha",n:"Concha / malformado",c:2,e:5,d:"grano en forma de oreja o concha con cavidad, o dos mitades una dentro de otra; también granos deformes o asimétricos por defecto de formación"},
  {k:"partido",n:"Partido / mordido",c:2,e:5,d:"fragmentos, bordes quebrados, puntas faltantes o cortes de despulpadora, a menudo con el corte oscurecido. Es frecuente: revisa el contorno de cada grano"},
  {k:"cascara",n:"Cáscara / pulpa",c:2,e:5,d:"trozos sueltos de piel o pulpa seca, sin grano dentro"},
  {k:"insecto_leve",n:"Insecto leve",c:2,e:10,d:"1 o 2 perforaciones pequeñas y oscuras de ~1 mm, a menudo cerca de la punta o en la cara curva; revisa cada grano de cerca"}
];
const MODELO = "claude-opus-5-5";
const MAX_FOTOS = 2, MAX_REFS = 2, LADO_MAX = 1568;

const $ = id => document.getElementById(id);
const vacio = () => Object.fromEntries(DEFECTOS.map(d => [d.k, 0]));
const limpiar = o => Object.fromEntries(DEFECTOS.map(d => [d.k, Math.max(0, parseInt(o?.[d.k]) || 0)]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const hoy = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function gradoDe(conteos, peso, hum, qk){
  const factor = 350 / (peso || 350);
  let cat1 = 0, cat2 = 0;
  const filas = DEFECTOS.map(d => {
    const granos = Math.max(0, Math.round(conteos?.[d.k] || 0));
    const completos = Math.floor(granos * factor / d.e);
    if (d.c === 1) cat1 += completos; else cat2 += completos;
    return {...d, granos, completos};
  });
  const total = cat1 + cat2;
  let grado, clase, porque;
  if (cat1 === 0 && total <= 5) { grado = "Especialidad"; clase = "ok"; porque = "Sin defectos de categoría 1 y " + total + " defectos completos (máximo 5)."; }
  else if (total <= 8) { grado = "Premium"; clase = "warn"; porque = cat1 > 0 ? "Tiene " + cat1 + " defecto(s) completo(s) de categoría 1, que la especialidad no permite." : "Tiene " + total + " defectos completos; la especialidad permite hasta 5."; }
  else if (total <= 23) { grado = "Exchange"; clase = "bad"; porque = total + " defectos completos (rango 9 a 23)."; }
  else if (total <= 86) { grado = "Bajo estándar"; clase = "bad"; porque = total + " defectos completos (rango 24 a 86)."; }
  else { grado = "Fuera de grado"; clase = "bad"; porque = "Más de 86 defectos completos."; }
  const avisos = [];
  if (grado === "Especialidad") {
    if (hum !== null && (hum < 9 || hum > 13)) { grado = "No califica"; clase = "bad"; avisos.push("Humedad " + hum + " % fuera del rango 9–13 %."); }
    if (qk !== null && qk > 0) { grado = "No califica"; clase = "bad"; avisos.push(qk + " quaker(s) en tostado; la especialidad exige 0."); }
    if (hum === null || qk === null) avisos.push("Falta confirmar " + [hum === null ? "humedad (9–13 %)" : "", qk === null ? "quakers (0 en 100 g tostados)" : ""].filter(Boolean).join(" y ") + ".");
  }
  if (peso && Math.abs(peso - 350) > 0.5) avisos.push("Conteos normalizados de " + peso + " g a 350 g.");
  return {filas, cat1, cat2, total, grado, clase, porque, avisos};
}

// ---------- Base local (IndexedDB) ----------
let dbp = null;
function abrirDB(){
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open("clasificador-sca", 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("muestras", {keyPath: "id"}); d.createObjectStore("kv"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, modo, fn){
  const d = await abrirDB();
  return new Promise((res, rej) => {
    const t = d.transaction(store, modo); const s = t.objectStore(store);
    let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const dbTodas = () => tx("muestras", "readonly", s => s.getAll());
const dbPut = m => tx("muestras", "readwrite", s => s.put(m));
const dbDel = id => tx("muestras", "readwrite", s => s.delete(id));
const kvGet = k => tx("kv", "readonly", s => s.get(k));
const kvSet = (k, v) => tx("kv", "readwrite", s => s.put(v, k));

// ---------- Estado ----------
let muestras = [], lecciones = [];
let fotos = [];            // Blobs de la muestra en edición
let claudeRes = null, catador = vacio(), sinClasificar = 0;
let editandoId = null, ctl = null, ocupado = false;
const urls = new Map();
function urlDe(blob){ if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob)); return urls.get(blob); }

const ajustes = { get clave(){ try { return localStorage.getItem("clave") || ""; } catch { return ""; } },
  get esfuerzo(){ try { return localStorage.getItem("esfuerzo") || "high"; } catch { return "high"; } } };

async function recargar(){
  muestras = (await dbTodas()).sort((a, b) => (b.creado || 0) - (a.creado || 0));
  lecciones = (await kvGet("lecciones")) || [];
  renderHist(); renderAprendizaje(); renderAvisos();
}

// ---------- Fotos ----------
async function reducir(file){
  // Achica a 1568 px por lado (lo que Claude mira) y la pasa a JPEG; también convierte HEIC en Safari.
  let fuente;
  try { fuente = await createImageBitmap(file, {imageOrientation: "from-image"}); }
  catch {
    fuente = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w = fuente.width || fuente.naturalWidth, h = fuente.height || fuente.naturalHeight;
  const f = Math.min(1, LADO_MAX / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * f); c.height = Math.round(h * f);
  c.getContext("2d").drawImage(fuente, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("toBlob")), "image/jpeg", 0.85));
}
async function agregarArchivos(lista){
  const nuevas = Array.from(lista || []);
  if (!nuevas.length) return;
  estado("Preparando foto…");
  for (const f of nuevas) {
    if (fotos.length >= MAX_FOTOS) { estado("Uso solo " + MAX_FOTOS + " fotos por muestra (una por cara)."); break; }
    try { fotos.push(await reducir(f)); estado(""); }
    catch { estado("No pude abrir esa foto. Prueba con otra o sácala en JPG.", true); }
  }
  renderFotos();
}
function renderFotos(){
  const th = $("thumbs"); th.replaceChildren();
  fotos.forEach((b, i) => {
    const d = document.createElement("div"); d.className = "thumb";
    const img = document.createElement("img"); img.src = urlDe(b); img.alt = "Foto " + (i + 1);
    const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", "Quitar foto " + (i + 1));
    x.addEventListener("click", () => { fotos.splice(i, 1); renderFotos(); });
    d.append(img, x); th.append(d);
  });
  const hay = fotos.length > 0;
  $("evaluar").disabled = !hay || ocupado; $("manual").disabled = !hay || ocupado; $("pendiente").disabled = !hay || ocupado;
}
["camara", "galeria"].forEach(id => $(id).addEventListener("change", e => { agregarArchivos(e.target.files); e.target.value = ""; }));

function b64(blob){
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
}
async function bloqueImagen(blob){ return {type: "image", source: {type: "base64", media_type: "image/jpeg", data: await b64(blob)}}; }

// ---------- Aprendizaje ----------
const verificadas = () => muestras.filter(m => m.catador && m.estado === "verificada");
function sesgos(){
  const con = verificadas().filter(m => m.claude);
  if (!con.length) return [];
  return DEFECTOS.map(d => ({n: d.n, c: con.reduce((s, m) => s + (parseInt(m.claude?.[d.k]) || 0), 0), h: con.reduce((s, m) => s + (parseInt(m.catador?.[d.k]) || 0), 0), nm: con.length}))
    .filter(s => s.c || s.h);
}
function textoSesgos(){
  const s = sesgos().filter(x => x.c !== x.h);
  if (!s.length) return "";
  return "Sesgos medidos en " + s[0].nm + " muestra(s) verificada(s) por el catador (granos que contaste tú vs. el catador):\n" +
    s.map(x => `- ${x.n}: tú ${x.c}, catador ${x.h} → ${x.c > x.h ? "cuentas de más" : "cuentas de menos"}`).join("\n");
}
const referencias = () => muestras.filter(m => m.referencia && m.catador && m.fotos?.length && m.id !== editandoId);
const conteoTexto = c => DEFECTOS.filter(d => c?.[d.k]).map(d => `${d.k} ${c[d.k]}`).join(", ") || "sin defectos";

const SISTEMA = `Eres un evaluador de café verde arábica según el SCA Green Arabica Defect Handbook. Trabajas para un tostador que separa a mano los granos defectuosos de una muestra y los fotografía. Tu tarea es contar los granos defectuosos por tipo.

Tipos de defecto (clave, nombre, categoría y cómo se ve):
${DEFECTOS.map(d => `- ${d.k} (${d.n}, categoría ${d.c}): ${d.d}`).join("\n")}

Reglas SCA:
- Cuenta granos, no defectos completos; la app hace las equivalencias.
- Un grano con varios defectos se cuenta una sola vez, por el más grave.
- Caracol (peaberry) y granos triangulares NO son defectos SCA: cuéntalos como sanos.
- Aspecto según proceso: lavado = verde azulado parejo, cualquier marrón o amarillo llama la atención; honey = puede tener tonos café claro suaves y restos de mucílago seco; natural = más variación ámbar o marrón parejo. Esos tonos parejos NO son agrio.
- La densidad (flotador) no se ve bien en foto; márcalo solo si el grano se ve claramente blanqueado.
- Si dudas entre dos categorías, no lo cuentes: ponlo en "dudosos" con su ubicación (foto, zona) y tu hipótesis.
- Recorre la foto grano por grano y verifica que conteos + dudosos + sanos se acerque al total de granos visibles.
- Si hay dos fotos de la muestra, son la misma bandeja por cada cara: cuenta cada grano una sola vez y usa la segunda cara para ver perforaciones y manchas ocultas.
- Si la foto impide juzgar (desenfoque, sombras, granos encimados), dilo en "problemas_foto".
- Escribe en español.`;

const ESQUEMA = {
  type: "object",
  properties: {
    conteos: {type: "object", properties: Object.fromEntries(DEFECTOS.map(d => [d.k, {type: "integer"}])), required: DEFECTOS.map(d => d.k), additionalProperties: false},
    dudosos: {type: "array", items: {type: "object", properties: {donde: {type: "string"}, hipotesis: {type: "string"}}, required: ["donde", "hipotesis"], additionalProperties: false}},
    sanos_en_foto: {type: "integer"},
    total_granos_visibles: {type: "integer"},
    confianza: {type: "string", enum: ["alta", "media", "baja"]},
    motivo_confianza: {type: "string"},
    problemas_foto: {type: "string"},
    notas: {type: "string"}
  },
  required: ["conteos", "dudosos", "sanos_en_foto", "total_granos_visibles", "confianza", "motivo_confianza", "problemas_foto", "notas"],
  additionalProperties: false
};

async function contenidoEvaluacion(m, fotosMuestra){
  const content = [];
  const refs = referencias().slice(0, MAX_REFS);
  if (refs.length) content.push({type: "text", text: "EJEMPLOS DE REFERENCIA ya clasificados por el catador. Úsalos para calibrar tu criterio; no los cuentes."});
  for (const r of refs) {
    content.push(await bloqueImagen(r.fotos[0]));
    content.push({type: "text", text: `Referencia: lote ${r.lote || "sin nombre"} (${r.origen || "origen no indicado"}), ${r.peso || 350} g. Conteo verificado: ${conteoTexto(r.catador)}${r.sin_clasificar ? `; ${r.sin_clasificar} granos sin clasificar` : ""}.${r.notas_catador ? " Notas del catador: " + r.notas_catador : ""}`});
  }
  content.push({type: "text", text: `MUESTRA NUEVA a clasificar (${fotosMuestra.length} foto${fotosMuestra.length > 1 ? "s" : ""}):`});
  for (const b of fotosMuestra) content.push(await bloqueImagen(b));
  const lec = lecciones.length ? "Lecciones aprendidas de correcciones anteriores del catador (síguelas):\n" + lecciones.map(l => "- " + l.texto).join("\n") : "";
  content.push({type: "text", text: [
    `Estas fotos muestran SOLO los granos que el catador separó como defectuosos de una muestra de ${m.peso || 350} g.`,
    `Lote: ${m.lote || "sin nombre"}. Origen/proceso: ${m.origen || "no indicado"}.`,
    lec, textoSesgos(),
    "Clasifica cada grano y responde con el JSON pedido."
  ].filter(Boolean).join("\n\n")});
  return {content, refs};
}

let cliente = null, claveCliente = "";
function getCliente(){
  const k = ajustes.clave;
  if (!k) return null;
  if (!cliente || claveCliente !== k) { cliente = new Anthropic({apiKey: k, dangerouslyAllowBrowser: true, maxRetries: 2}); claveCliente = k; }
  return cliente;
}

// Pide a Claude un JSON con esquema. Usa respaldo automático de modelo si Claude rechaza la solicitud.
async function pedirJSON({system, content, schema, effort, maxTokens = 16000, signal}){
  const c = getCliente(); if (!c) throw {codigo: "sin_clave"};
  const base = {model: MODELO, max_tokens: maxTokens, system, messages: [{role: "user", content}],
    thinking: {type: "adaptive"}, output_config: {effort, format: {type: "json_schema", schema}}};
  let msg;
  try {
    msg = await c.beta.messages.stream({...base, fallbacks: "default", betas: ["server-side-fallback-2026-07-01"]}, {signal}).finalMessage();
  } catch (e) {
    if (e?.status === 400 && /fallback/i.test(String(e?.message))) msg = await c.messages.stream(base, {signal}).finalMessage();
    else throw e;
  }
  if (msg.stop_reason === "refusal") throw {codigo: "rechazo"};
  if (msg.stop_reason === "max_tokens") throw {codigo: "incompleta"};
  const texto = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  try { return JSON.parse(texto); } catch { throw {codigo: "incompleta"}; }
}

function mensajeError(e){
  if (e?.codigo === "sin_clave") return "Falta tu clave de Claude. Agrégala en Ajustes.";
  if (e?.codigo === "rechazo") return "Claude no pudo evaluar estas fotos. Prueba con otras.";
  if (e?.codigo === "incompleta") return "La respuesta vino incompleta. Toca Evaluar de nuevo.";
  if (e?.name === "AbortError" || e?.constructor?.name === "APIUserAbortError") return "Evaluación detenida.";
  const s = e?.status;
  if (s === 401) return "La clave de Claude no es válida. Revísala en Ajustes.";
  if (s === 403) return "La clave no tiene permiso para este modelo. Revisa tu cuenta en console.anthropic.com.";
  if (s === 402 || /credit|billing/i.test(String(e?.message))) return "Tu cuenta de Anthropic no tiene saldo. Carga créditos en console.anthropic.com.";
  if (s === 429) return "Llegaste al límite de uso por ahora. Intenta en un rato.";
  if (s === 529 || s >= 500) return "Claude está saturado en este momento. Intenta de nuevo en unos minutos.";
  if (s === 413) return "Las fotos pesan demasiado. Prueba con una sola foto.";
  if (!navigator.onLine || !s) return "Sin conexión. Toca Guardar para después y evalúa cuando tengas señal.";
  return "No se pudo evaluar (" + s + "). Intenta de nuevo.";
}

async function evaluarMuestra(m, fotosMuestra, signal){
  const {content, refs} = await contenidoEvaluacion(m, fotosMuestra);
  const r = await pedirJSON({system: SISTEMA, content, schema: ESQUEMA, effort: ajustes.esfuerzo, signal});
  return {conteos: limpiar(r.conteos),
    dudosos: (r.dudosos || []).slice(0, 30).map(x => ({donde: String(x.donde || ""), hipotesis: String(x.hipotesis || "")})),
    confianza: String(r.confianza || ""), motivo_confianza: String(r.motivo_confianza || ""),
    problemas_foto: String(r.problemas_foto || ""), notas: String(r.notas || ""),
    sanos: parseInt(r.sanos_en_foto) || 0, visibles: parseInt(r.total_granos_visibles) || 0,
    referencias_usadas: refs.map(x => x.id), lecciones_usadas: lecciones.length, fecha: new Date().toISOString()};
}

async function generarLecciones(m){
  const difs = DEFECTOS.filter(d => (m.claude?.[d.k] || 0) !== (m.catador?.[d.k] || 0)).map(d => `- ${d.n}: Claude ${m.claude?.[d.k] || 0}, catador ${m.catador?.[d.k] || 0}`);
  if (!difs.length || !m.fotos?.length) return [];
  const content = [];
  for (const b of m.fotos) content.push(await bloqueImagen(b));
  content.push({type: "text", text: `Clasificaste los defectos de café verde de estas fotos (norma SCA) y un catador experto corrigió tu conteo.
Lote: ${m.lote}. Origen/proceso: ${m.origen || "no indicado"}.
Diferencias (granos):
${difs.join("\n")}
${m.notas_catador ? "Notas del catador: " + m.notas_catador : ""}
Lecciones que ya existen:
${lecciones.map(l => "- " + l.texto).join("\n") || "(ninguna)"}

Mirando las fotos, escribe de 1 a 3 lecciones NUEVAS, breves (máx. 30 palabras cada una) y generalizables, sobre qué pistas visuales mirar para no repetir estos errores en otras muestras. No repitas lecciones existentes. Escribe en español.`});
  const r = await pedirJSON({system: "Eres un evaluador de café verde según la norma SCA que aprende de las correcciones de un catador.", content,
    schema: {type: "object", properties: {lecciones: {type: "array", items: {type: "string"}}}, required: ["lecciones"], additionalProperties: false},
    effort: "medium", maxTokens: 8000});
  return (r.lecciones || []).map(String).map(t => t.trim()).filter(Boolean).slice(0, 3);
}
async function guardarLecciones(nuevas, origen){
  if (!nuevas.length) return;
  lecciones = [...nuevas.map(t => ({texto: t.slice(0, 400), fecha: hoy(), origen})), ...lecciones].slice(0, 40);
  await kvSet("lecciones", lecciones);
}

// ---------- Formulario ----------
function estado(t, err){ $("status").textContent = t; $("status").className = "status" + (err ? " err" : ""); }
function datosForm(){
  return {lote: $("lote").value.trim() || "Sin nombre", origen: $("origen").value.trim(), fecha: $("fecha").value || hoy(),
    peso: num($("peso").value) || 350, humedad: num($("humedad").value), quakers: num($("quakers").value)};
}
function calcular(){ return gradoDe(catador, num($("peso").value) || 350, num($("humedad").value), num($("quakers").value)); }
["peso", "humedad", "quakers"].forEach(id => $(id).addEventListener("input", () => { if (!$("resultado").hidden) renderResultado(); }));

function setOcupado(v){
  ocupado = v; $("detener").hidden = !v; renderFotos();
  $("evaluar-pendientes").disabled = v;
}

$("evaluar").addEventListener("click", async () => {
  if (!fotos.length) return estado("Primero toma o elige al menos una foto.", true);
  if (!ajustes.clave) { estado("Sin clave de Claude. Usa \"Sin clave: evaluar en el chat de Claude\" aquí abajo.", true); $("modo-chat").open = true; $("modo-chat").scrollIntoView({behavior: "smooth"}); return; }
  if (!navigator.onLine) return estado("Sin conexión. Toca Guardar para después y evalúa cuando tengas señal.", true);
  ctl = new AbortController(); setOcupado(true);
  const nrefs = Math.min(MAX_REFS, referencias().length);
  estado("Claude está mirando los granos" + (nrefs ? " con " + nrefs + " ejemplo(s) de referencia y " + lecciones.length + " lección(es)" : "") + "… puede tardar uno o dos minutos.");
  try {
    claudeRes = await evaluarMuestra(datosForm(), fotos, ctl.signal);
    catador = {...claudeRes.conteos}; sinClasificar = 0;
    mostrarResultado();
    estado("Listo. Revisa tu columna y toca Guardar y enseñar.");
  } catch (e) { estado(mensajeError(e), true); }
  finally { setOcupado(false); }
});
$("detener").addEventListener("click", () => ctl?.abort());

// Resultado traído desde el chat de Claude (sin clave de API): "SCA{...}"
$("usar-resultado").addEventListener("click", () => {
  const t = $("pegar-resultado").value;
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  let r = null;
  try { r = JSON.parse(t.slice(i, j + 1)); } catch {}
  const conteos = r?.conteos || r;
  if (!r || typeof conteos !== "object" || !DEFECTOS.some(d => d.k in conteos)) { estado("Ese código no se pudo leer. Cópialo entero desde el chat, desde SCA{ hasta la última llave }.", true); return; }
  if (r.lote && !$("lote").value) $("lote").value = String(r.lote);
  if (r.origen && !$("origen").value) $("origen").value = String(r.origen);
  if (num(r.peso)) $("peso").value = num(r.peso);
  claudeRes = {conteos: limpiar(conteos),
    dudosos: Array.isArray(r.dudosos) ? r.dudosos.slice(0, 30).map(x => typeof x === "string" ? {donde: "", hipotesis: x} : {donde: String(x?.donde || ""), hipotesis: String(x?.hipotesis || "")}) : [],
    confianza: String(r.confianza || ""), motivo_confianza: String(r.motivo_confianza || ""), problemas_foto: String(r.problemas_foto || ""),
    notas: String(r.notas || ""), sanos: parseInt(r.sanos_en_foto) || 0, visibles: parseInt(r.total_granos_visibles) || 0, origen_resultado: "chat", fecha: new Date().toISOString()};
  catador = {...claudeRes.conteos}; sinClasificar = 0;
  $("pegar-resultado").value = ""; $("modo-chat").open = false;
  mostrarResultado();
  estado("Resultado de Claude cargado." + (fotos.length ? "" : " Agrega la foto arriba si quieres guardarla como referencia.") + " Revisa tu columna y toca Guardar y enseñar.");
});

$("manual").addEventListener("click", () => {
  claudeRes = null; catador = vacio(); sinClasificar = 0;
  mostrarResultado(); estado("Anota tu conteo en la tabla y toca Guardar y enseñar.");
});

$("pendiente").addEventListener("click", async () => {
  if (!fotos.length) return;
  const m = {id: editandoId || uid(), ...datosForm(), fotos: [...fotos], claude: null, catador: null, estado: "pendiente", referencia: false, creado: Date.now()};
  try { await dbPut(m); } catch { return estado("No se pudo guardar en el teléfono. Revisa el espacio libre.", true); }
  limpiarForm(); await recargar();
  estado("Guardada como pendiente. Cuando tengas señal, toca Evaluar pendientes arriba.");
});

function mostrarResultado(){
  $("resultado").hidden = false; $("guardar").hidden = false; $("guardar-status").textContent = "";
  renderResultado();
  $("resultado").scrollIntoView({behavior: "smooth", block: "start"});
}

function renderResultado(){
  const r = calcular();
  const v = $("verdict"); v.className = "verdict " + r.clase; v.replaceChildren();
  const big = document.createElement("div"); big.className = "big";
  big.textContent = r.grado === "Especialidad" ? "Café de especialidad" : r.grado === "No califica" ? "No califica como especialidad" : "No es especialidad · " + r.grado;
  const why = document.createElement("p"); why.className = "why"; why.textContent = r.porque;
  v.append(big, why);
  r.avisos.forEach(a => { const p = document.createElement("p"); p.className = "why"; p.textContent = a; v.append(p); });
  $("s-cat1").textContent = r.cat1; $("s-cat2").textContent = r.cat2; $("s-total").textContent = r.total;

  const cl = claudeRes?.conteos;
  const tb = $("tabla"); tb.replaceChildren();
  [1, 2].forEach(c => {
    const h = document.createElement("tr"); h.className = "cat";
    const td = document.createElement("td"); td.colSpan = 4; td.textContent = "Categoría " + c + (c === 1 ? " · primarios" : " · secundarios");
    h.append(td); tb.append(h);
    r.filas.filter(f => f.c === c).forEach(f => {
      const cv = cl ? (cl[f.k] || 0) : null;
      const tr = document.createElement("tr"); if (!f.granos && !cv) tr.className = "zero";
      const a = document.createElement("td"); a.textContent = f.n; a.title = f.d;
      const eq = document.createElement("span"); eq.className = "eq"; eq.textContent = "equiv. " + f.e; a.append(eq);
      const b = document.createElement("td"); b.className = "mono" + (cv !== null && cv !== f.granos ? " diff" : ""); b.textContent = cv === null ? "—" : cv;
      const i = document.createElement("td"); const inp = document.createElement("input");
      inp.type = "number"; inp.min = "0"; inp.inputMode = "numeric"; inp.value = f.granos;
      inp.setAttribute("aria-label", "Tu conteo de " + f.n);
      inp.addEventListener("change", () => { catador[f.k] = Math.max(0, parseInt(inp.value) || 0); requestAnimationFrame(renderResultado); });
      i.append(inp);
      const x = document.createElement("td"); x.className = "mono"; x.textContent = f.completos;
      tr.append(a, b, i, x); tb.append(tr);
    });
    const s = document.createElement("tr"); s.className = "sub";
    const s1 = document.createElement("td"); s1.textContent = "Subtotal cat. " + c; s1.colSpan = 3;
    const s2 = document.createElement("td"); s2.className = "mono"; s2.textContent = c === 1 ? r.cat1 : r.cat2;
    s.append(s1, s2); tb.append(s);
  });
  const sc = document.createElement("tr");
  const sc1 = document.createElement("td"); sc1.textContent = "Sin clasificar (no suma)";
  const sc2 = document.createElement("td"); sc2.textContent = "—";
  const sc3 = document.createElement("td"); const si = document.createElement("input");
  si.type = "number"; si.min = "0"; si.inputMode = "numeric"; si.value = sinClasificar; si.setAttribute("aria-label", "Granos sin clasificar");
  si.addEventListener("change", () => { sinClasificar = Math.max(0, parseInt(si.value) || 0); });
  sc3.append(si); sc.append(sc1, sc2, sc3, document.createElement("td")); tb.append(sc);

  const ex = $("extra"); ex.replaceChildren();
  const add = (titulo, cuerpo) => {
    if (!cuerpo || (Array.isArray(cuerpo) && !cuerpo.length)) return;
    const d = document.createElement("div"); d.style.padding = "6px 0";
    const t = document.createElement("p"); t.style.fontWeight = "600"; t.textContent = titulo; d.append(t);
    if (Array.isArray(cuerpo)) { const ul = document.createElement("ul"); ul.className = "plain"; cuerpo.forEach(i => { const li = document.createElement("li"); li.textContent = i; ul.append(li); }); d.append(ul); }
    else { const p = document.createElement("p"); p.textContent = cuerpo; d.append(p); }
    ex.append(d);
  };
  if (claudeRes) {
    add("Dudosos según Claude (no sumados)", (claudeRes.dudosos || []).map(d => (d.donde ? d.donde + ": " : "") + d.hipotesis));
    add("Confianza de Claude", claudeRes.confianza ? claudeRes.confianza + (claudeRes.motivo_confianza ? ". " + claudeRes.motivo_confianza : "") : "");
    if (claudeRes.visibles) add("Granos en la foto", claudeRes.visibles + " visibles, " + claudeRes.sanos + " sin defecto según Claude.");
    add("Problemas de la foto", claudeRes.problemas_foto);
    add("Notas de Claude", claudeRes.notas);
  }
}

$("guardar").addEventListener("click", async () => {
  const r = calcular();
  $("guardar").disabled = true; $("guardar-status").textContent = "Guardando…";
  const previa = editandoId ? muestras.find(x => x.id === editandoId) : null;
  const m = {
    id: editandoId || uid(), ...datosForm(), fotos: [...fotos],
    claude: claudeRes ? claudeRes.conteos : null,
    claude_detalle: claudeRes ? {dudosos: claudeRes.dudosos, confianza: claudeRes.confianza, motivo_confianza: claudeRes.motivo_confianza, problemas_foto: claudeRes.problemas_foto, notas: claudeRes.notas, sanos: claudeRes.sanos, visibles: claudeRes.visibles} : null,
    catador: {...catador}, sin_clasificar: sinClasificar, notas_catador: $("notas-catador").value.trim(),
    referencia: $("es-ref").checked && fotos.length > 0, estado: "verificada",
    cat1: r.cat1, cat2: r.cat2, total: r.total, grado: r.grado, clase: r.clase,
    creado: previa?.creado || Date.now(), actualizado: Date.now()
  };
  try { await dbPut(m); } catch { $("guardar").disabled = false; $("guardar-status").textContent = "No se pudo guardar en el teléfono."; return; }
  let nuevas = [], fallo = false;
  if (m.claude && ajustes.clave && navigator.onLine) {
    $("guardar-status").textContent = "Guardada. Claude está anotando lo que aprendió de tu corrección…";
    try { nuevas = await generarLecciones(m); await guardarLecciones(nuevas, m.lote); } catch { fallo = true; }
  }
  await recargar();
  limpiarForm();
  $("resultado").hidden = false; $("guardar").hidden = true; $("guardar").disabled = false;
  $("guardar-status").textContent = "Guardada en la base." + (nuevas.length ? " Claude sumó " + nuevas.length + " lección(es) nueva(s)." : fallo ? " No se pudieron generar lecciones esta vez." : "");
});

function limpiarForm(){
  fotos = []; editandoId = null; claudeRes = null; catador = vacio(); sinClasificar = 0;
  $("lote").value = ""; $("notas-catador").value = ""; $("humedad").value = ""; $("quakers").value = ""; $("peso").value = 350; $("fecha").value = hoy();
  $("es-ref").checked = true; renderFotos();
}

function abrirMuestra(m){
  editandoId = m.id; fotos = [...(m.fotos || [])];
  $("lote").value = m.lote || ""; $("origen").value = m.origen || ""; $("fecha").value = m.fecha || hoy();
  $("peso").value = m.peso || 350; $("humedad").value = m.humedad ?? ""; $("quakers").value = m.quakers ?? "";
  claudeRes = m.claude ? {conteos: limpiar(m.claude), ...(m.claude_detalle || {})} : null;
  catador = m.catador ? limpiar(m.catador) : m.claude ? limpiar(m.claude) : vacio();
  sinClasificar = parseInt(m.sin_clasificar) || 0;
  $("notas-catador").value = m.notas_catador || "";
  $("es-ref").checked = m.referencia !== false;
  renderFotos();
  if (m.estado === "pendiente") { $("resultado").hidden = true; estado("Muestra pendiente cargada. Toca Evaluar con Claude, o Solo mi conteo."); $("h-fotos").scrollIntoView({behavior: "smooth"}); }
  else { estado(m.estado === "evaluada" ? "Evaluada por Claude, falta tu revisión. Corrige y guarda." : "Muestra cargada. Puedes corregir y guardar de nuevo."); mostrarResultado(); }
}

// ---------- Pendientes ----------
$("evaluar-pendientes").addEventListener("click", async () => {
  if (!ajustes.clave) { abrirAjustes(); return; }
  const pend = muestras.filter(m => m.estado === "pendiente" && m.fotos?.length);
  setOcupado(true);
  let ok = 0, err = "";
  for (const [i, m] of pend.entries()) {
    $("pendientes-texto").textContent = `Evaluando ${i + 1} de ${pend.length}: ${m.lote}…`;
    try {
      const r = await evaluarMuestra(m, m.fotos);
      const g = gradoDe(r.conteos, m.peso, m.humedad, m.quakers);
      await dbPut({...m, claude: r.conteos, claude_detalle: r, estado: "evaluada", cat1: g.cat1, cat2: g.cat2, total: g.total, grado: g.grado, clase: g.clase});
      ok++;
    } catch (e) { err = mensajeError(e); break; }
  }
  setOcupado(false); await recargar();
  if (err) $("pendientes-texto").textContent = err + (ok ? ` (${ok} evaluada(s) antes del error.)` : "");
  else { $("pendientes-banner").hidden = false; $("pendientes-texto").textContent = ok + " muestra(s) evaluada(s). Ábrelas en la base para revisar y corregir."; $("evaluar-pendientes").hidden = true; }
});

function renderAvisos(){
  $("sin-clave").hidden = !!ajustes.clave;
  const n = muestras.filter(m => m.estado === "pendiente").length;
  $("pendientes-banner").hidden = !n;
  $("evaluar-pendientes").hidden = false;
  if (n) $("pendientes-texto").textContent = n === 1 ? "Tienes 1 muestra guardada sin evaluar." : "Tienes " + n + " muestras guardadas sin evaluar.";
}

// ---------- Render de base y aprendizaje ----------
function renderHist(){
  const h = $("historial"); h.replaceChildren();
  if (!muestras.length) {
    const p = document.createElement("p"); p.className = "status";
    p.textContent = "Todavía no hay muestras. Evalúa una y toca Guardar y enseñar, o carga las muestras del proyecto en Respaldo.";
    h.append(p); return;
  }
  muestras.forEach(m => {
    const it = document.createElement("div"); it.className = "hitem";
    let img;
    if (m.fotos?.[0]) { img = document.createElement("img"); img.src = urlDe(m.fotos[0]); img.alt = ""; img.loading = "lazy"; }
    else { img = document.createElement("div"); img.className = "noimg"; }
    const mid = document.createElement("div"); mid.style.minWidth = "0";
    const t = document.createElement("div"); t.className = "t"; t.textContent = m.lote || "Sin nombre";
    const meta = document.createElement("div"); meta.className = "m";
    meta.textContent = m.estado === "pendiente" ? [m.fecha, m.origen, "sin evaluar"].filter(Boolean).join(" · ")
      : [m.fecha, m.origen, "cat. 1: " + (m.cat1 ?? "?") + " · total: " + (m.total ?? "?"), m.estado === "evaluada" ? "falta tu revisión" : m.claude ? "con Claude" : "solo catador"].filter(Boolean).join(" · ");
    const acts = document.createElement("div"); acts.className = "acts";
    const p = document.createElement("span"); p.className = "pill " + (m.estado === "pendiente" ? "pend" : ["ok", "warn", "bad"].includes(m.clase) ? m.clase : "warn");
    p.textContent = m.estado === "pendiente" ? "Pendiente" : (m.grado || "—") + (m.estado === "evaluada" ? " · sin revisar" : "");
    acts.append(p);
    const ab = document.createElement("button"); ab.className = "small"; ab.textContent = m.estado === "pendiente" ? "Evaluar" : "Abrir";
    ab.addEventListener("click", () => abrirMuestra(m)); acts.append(ab);
    if (m.catador && m.fotos?.length) {
      const rb = document.createElement("button"); rb.className = "small"; rb.textContent = m.referencia ? "★ Referencia" : "☆ Referencia";
      rb.setAttribute("aria-pressed", m.referencia ? "true" : "false");
      rb.addEventListener("click", async () => { await dbPut({...m, referencia: !m.referencia}); recargar(); });
      acts.append(rb);
    }
    const db = document.createElement("button"); db.className = "small"; db.textContent = "Borrar";
    db.addEventListener("click", async () => { if (confirm("¿Borrar la muestra " + (m.lote || "") + " y sus fotos de este teléfono?")) { await dbDel(m.id); if (editandoId === m.id) limpiarForm(); recargar(); } });
    acts.append(db);
    mid.append(t, meta, acts);
    it.append(img, mid); h.append(it);
  });
}

function renderAprendizaje(){
  $("a-ver").textContent = verificadas().length;
  $("a-ref").textContent = muestras.filter(m => m.referencia && m.catador && m.fotos?.length).length;
  $("a-lec").textContent = lecciones.length;
  const s = sesgos(), tb = $("sesgos"); tb.replaceChildren();
  if (!s.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 4; td.className = "status"; td.textContent = "Aparecen cuando guardas una muestra evaluada por Claude y corregida por ti."; tr.append(td); tb.append(tr); }
  s.forEach(x => {
    const tr = document.createElement("tr");
    const t = x.c === x.h ? "Coincide" : x.c > x.h ? "Cuenta de más" : "Cuenta de menos";
    [x.n, x.c, x.h, t].forEach((v, i) => { const td = document.createElement("td"); td.textContent = v; if (i === 1 || i === 2) td.className = "mono"; if (i === 3 && x.c !== x.h) td.className = "diff"; tr.append(td); });
    tb.append(tr);
  });
  const L = $("lecciones"); L.replaceChildren();
  if (!lecciones.length) { const p = document.createElement("p"); p.className = "status"; p.textContent = "Todavía no hay lecciones. Se crean solas al guardar una corrección, o escribe una abajo."; L.append(p); return; }
  lecciones.forEach((l, idx) => {
    const d = document.createElement("div"); d.className = "lesson";
    const txt = document.createElement("div");
    const p = document.createElement("p"); p.textContent = String(l.texto || "");
    const m = document.createElement("p"); m.className = "m"; m.textContent = [l.fecha, l.origen ? "de " + l.origen : ""].filter(Boolean).join(" · ");
    txt.append(p, m);
    const b = document.createElement("button"); b.className = "small"; b.textContent = "Quitar";
    b.addEventListener("click", async () => { lecciones = lecciones.filter((_, i) => i !== idx); await kvSet("lecciones", lecciones); renderAprendizaje(); });
    d.append(txt, b); L.append(d);
  });
}
$("nueva-leccion").addEventListener("input", () => { $("agregar-leccion").disabled = !$("nueva-leccion").value.trim(); });
$("agregar-leccion").addEventListener("click", async () => {
  const t = $("nueva-leccion").value.trim(); if (!t) return;
  await guardarLecciones([t], "Diego"); $("nueva-leccion").value = ""; $("agregar-leccion").disabled = true; renderAprendizaje();
});

// ---------- Ajustes ----------
function abrirAjustes(){ $("ajustes").open = true; $("ajustes").scrollIntoView({behavior: "smooth"}); setTimeout(() => $("clave").focus(), 300); }
$("ir-ajustes").addEventListener("click", abrirAjustes);
$("esfuerzo").value = ajustes.esfuerzo;
function describirClave(){
  const k = ajustes.clave;
  $("clave-info").textContent = k ? `Clave guardada: ${k.slice(0, 10)}…${k.slice(-4)} (${k.length} caracteres).` : "No hay clave guardada.";
}
async function probarClave(){
  const c = getCliente(); if (!c) return;
  if (!navigator.onLine) { $("ajustes-status").textContent = "Guardada. La probaré cuando tengas señal."; return; }
  $("ajustes-status").textContent = "Guardada. Probando la clave con Anthropic…";
  try { await c.models.list({limit: 1}); $("ajustes-status").textContent = "Clave correcta ✓. Ya puedes evaluar con Claude."; }
  catch (e) { $("ajustes-status").textContent = e?.status === 401 ? "Anthropic rechazó la clave: está incompleta o fue borrada. Cópiala de nuevo completa (o crea otra) y vuelve a guardar." : mensajeError(e); }
}
$("guardar-clave").addEventListener("click", async () => {
  const k = $("clave").value.replace(/\s+/g, "");
  if (k && !k.startsWith("sk-ant-")) { $("ajustes-status").textContent = "Esa no parece una clave de Anthropic (empieza con sk-ant-)."; return; }
  if (k && k.length < 60) { $("ajustes-status").textContent = `La clave que pegaste tiene ${k.length} caracteres y una completa tiene alrededor de 100. Cópiala de nuevo entera desde console.anthropic.com.`; return; }
  try { if (k) localStorage.setItem("clave", k); localStorage.setItem("esfuerzo", $("esfuerzo").value); }
  catch { $("ajustes-status").textContent = "Este navegador no deja guardar datos. Sal del modo privado."; return; }
  $("clave").value = ""; describirClave(); renderAvisos();
  if (k) await probarClave(); else $("ajustes-status").textContent = "Ajustes guardados.";
});
$("probar-clave").addEventListener("click", probarClave);
describirClave();
$("borrar-clave").addEventListener("click", () => { try { localStorage.removeItem("clave"); } catch {} $("clave").value = ""; $("ajustes-status").textContent = "Clave borrada."; describirClave(); renderAvisos(); });

// ---------- Respaldo ----------
function dataURL(blob){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
async function blobDeURL(u){ const r = await fetch(u); if (!r.ok) throw new Error(u); return r.blob(); }

$("exportar").addEventListener("click", async () => {
  $("respaldo-status").textContent = "Preparando archivo…";
  const out = {formato: "clasificador-sca-v1", exportado: new Date().toISOString(), lecciones, muestras: []};
  for (const m of muestras) out.muestras.push({...m, fotos: undefined, fotos_url: await Promise.all((m.fotos || []).map(dataURL))});
  const blob = new Blob([JSON.stringify(out)], {type: "application/json"});
  const nombre = "base-clasificador-" + hoy() + ".json";
  const file = new File([blob], nombre, {type: "application/json"});
  if (navigator.canShare?.({files: [file]})) { try { await navigator.share({files: [file], title: nombre}); $("respaldo-status").textContent = "Listo."; return; } catch (e) { if (e?.name === "AbortError") { $("respaldo-status").textContent = ""; return; } } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  $("respaldo-status").textContent = "Archivo descargado: " + nombre;
});

async function importar(datos, base){
  if (datos?.formato !== "clasificador-sca-v1") throw new Error("formato");
  let n = 0;
  for (const m of datos.muestras || []) {
    const fotosM = [];
    for (const u of m.fotos_url || []) { try { fotosM.push(await blobDeURL(new URL(u, base).href)); } catch {} }
    const g = gradoDe(m.catador || m.claude || {}, m.peso, m.humedad ?? null, m.quakers ?? null);
    const {fotos_url, ...resto} = m;
    await dbPut({id: m.id || uid(), ...resto, fotos: fotosM, cat1: g.cat1, cat2: g.cat2, total: g.total, grado: m.estado === "pendiente" ? null : g.grado, clase: g.clase});
    n++;
  }
  const textos = new Set(lecciones.map(l => l.texto));
  const nuevas = (datos.lecciones || []).filter(l => l?.texto && !textos.has(l.texto));
  if (nuevas.length) { lecciones = [...lecciones, ...nuevas].slice(0, 40); await kvSet("lecciones", lecciones); }
  await recargar();
  return {n, l: nuevas.length};
}
$("importar").addEventListener("change", async e => {
  const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
  $("respaldo-status").textContent = "Importando…";
  try { const r = await importar(JSON.parse(await f.text()), location.href); $("respaldo-status").textContent = `Importadas ${r.n} muestra(s) y ${r.l} lección(es).`; }
  catch { $("respaldo-status").textContent = "Ese archivo no es un respaldo de esta app."; }
});
$("cargar-semilla").addEventListener("click", async () => {
  $("respaldo-status").textContent = "Cargando…";
  try { const u = new URL("semilla/base.json", location.href); const r = await importar(await (await fetch(u)).json(), u.href.replace(/semilla\/base\.json$/, ""));
    $("respaldo-status").textContent = `Listo: ${r.n} muestra(s) del proyecto y ${r.l} lección(es).`; }
  catch { $("respaldo-status").textContent = "No se pudieron cargar. Revisa la conexión."; }
});

// ---------- Conexión y arranque ----------
function renderRed(){ const on = navigator.onLine; $("net").textContent = on ? "En línea" : "Sin señal"; $("net").className = "net " + (on ? "on" : "off"); }
addEventListener("online", renderRed); addEventListener("offline", renderRed);
renderRed();
$("fecha").value = hoy();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
try { navigator.storage?.persist?.(); } catch {}

(async () => {
  try {
    await recargar();
    // Primera vez: trae las muestras y lecciones del proyecto para que Claude parta calibrado.
    if (!muestras.length && !(await kvGet("semilla"))) {
      await kvSet("semilla", true);
      $("cargar-semilla").click();
    }
  } catch { estado("Este navegador no permite guardar la base. Sal del modo privado.", true); }
})();
