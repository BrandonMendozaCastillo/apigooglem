// Mapa
const map = L.map('map').setView([19.4326, -99.1332], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap'
}).addTo(map);

// Elementos HTML
const iOrigen = document.getElementById('input-origen'),
      iDestino = document.getElementById('input-destino'),
      sOrigen = document.getElementById('sug-origen'),
      sDestino = document.getElementById('sug-destino'),
      btnCalcular = document.getElementById('btn-calcular'),
      btnReiniciar = document.getElementById('btn-reiniciar'),
      datosRuta = document.getElementById('datos-ruta');

// Variables
let origen = null, destino = null;
let mOrigen = null, mDestino = null, rutaLayer = null;

// Autocompletar municipios
async function buscar(query) {
  const res = await fetch('/api/geocodificar/buscar', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ query })
  });
  const js = await res.json();
  return js.lugares || [];
}

function mostrarSugerencias(lst, container, isOrigen) {
  container.innerHTML = '';
  lst.forEach((loc) => {
    const li = document.createElement('li');
    li.textContent = loc.nombre;
    li.onclick = () => seleccionarMunicipio(loc, isOrigen);
    container.appendChild(li);
  });
}

// Selección de municipio (autocompletar)
function seleccionarMunicipio(loc, isOrigen) {
  const [lat,lon] = [loc.lat, loc.lon];
  const coord = [lon,lat];

  if (isOrigen) {
    origen = coord;
    iOrigen.value = loc.nombre;
    sOrigen.innerHTML = '';
    if (mOrigen) map.removeLayer(mOrigen);
    mOrigen = L.marker([lat,lon], { color:'green' }).addTo(map);
  } else {
    destino = coord;
    iDestino.value = loc.nombre;
    sDestino.innerHTML = '';
    if (mDestino) map.removeLayer(mDestino);
    mDestino = L.marker([lat,lon], { color:'red' }).addTo(map);
  }

  activarBoton();
  moverAMarcador(lat,lon);
}

function activarBoton() {
  btnCalcular.disabled = !(origen && destino);
}

function moverAMarcador(lat, lon) {
  map.setView([lat, lon], 9);
}

// Búsqueda dinámica
[iOrigen,sOrigen,true].forEach(() => {});  // evitar fragmento roto

iOrigen.addEventListener('keyup', async () => {
  if (iOrigen.value.length >= 3) {
    const lst = await buscar(iOrigen.value);
    mostrarSugerencias(lst, sOrigen, true);
  } else sOrigen.innerHTML='';
});

iDestino.addEventListener('keyup', async () => {
  if (iDestino.value.length >= 3) {
    const lst = await buscar(iDestino.value);
    mostrarSugerencias(lst, sDestino, false);
  } else sDestino.innerHTML='';
});

// Calcular ruta
btnCalcular.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/ruta', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ origen, destino })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||'Error');
    if (rutaLayer) map.removeLayer(rutaLayer);
    rutaLayer = L.polyline(data.ruta.map(c=>[c[1],c[0]]),{color:'blue'}).addTo(map);
    map.fitBounds(rutaLayer.getBounds(), {padding:[50,50]});
    datosRuta.innerHTML = `<strong>Distancia:</strong> ${data.distancia_km} km<br><strong>Duración:</strong> ${data.duracion_min} min`;
  } catch(err) {
    alert(err.message.includes('excede') ? 
      'Ruta excede la distancia máxima permitida.' :
      'No se pudo calcular la ruta. Intenta nuevamente.');
  }
});

// Reiniciar todo
btnReiniciar.addEventListener('click', () => {
  origen = destino = null;
  [mOrigen, mDestino, rutaLayer].forEach(m=>m && map.removeLayer(m));
  mOrigen = mDestino = rutaLayer = null;
  iOrigen.value = iDestino.value = '';
  sOrigen.innerHTML = sDestino.innerHTML = '';
  datosRuta.innerHTML = '';
  btnCalcular.disabled = true;
});

// Selección directa por clic en mapa
map.on('click', async (e) => {
  if (!origen) {
    origen = [e.latlng.lng, e.latlng.lat];
    mOrigen && map.removeLayer(mOrigen);
    mOrigen = L.marker(e.latlng).addTo(map);
    iOrigen.value = 'Marcado por clic';
  } else if (!destino) {
    destino = [e.latlng.lng, e.latlng.lat];
    mDestino && map.removeLayer(mDestino);
    mDestino = L.marker(e.latlng).addTo(map);
    iDestino.value = 'Marcado por clic';
  }
  activarBoton();
});
