from flask import Flask, request, jsonify, render_template
import requests

app = Flask(__name__)

OPENROUTE_KEY = '5b3ce3597851110001cf6248952d0b5db06244d4969eabec951d847f'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/ruta', methods=['POST'])
def calcular_ruta():
    data = request.get_json()
    origen = data.get('origen')
    destino = data.get('destino')

    if not origen or not destino:
        return jsonify({'error': 'Faltan coordenadas de origen o destino'}), 400

    if origen == destino:
        return jsonify({'error': 'El origen y destino no pueden ser el mismo punto'}), 400

    try:
        url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'
        headers = {
            'Authorization': OPENROUTE_KEY,
            'Content-Type': 'application/json'
        }
        payload = {'coordinates': [origen, destino]}
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data_ruta = response.json()

        ruta_coords = data_ruta['features'][0]['geometry']['coordinates']
        summary = data_ruta['features'][0]['properties']['summary']
        distancia_metros = summary.get('distance', 0)
        duracion_segundos = summary.get('duration', 0)

        distancia_km = round(distancia_metros / 1000, 2)
        duracion_min = round(duracion_segundos / 60, 1)

        return jsonify({
            'ruta': ruta_coords,
            'mensaje': 'Ruta calculada correctamente.',
            'distancia_km': distancia_km,
            'duracion_min': duracion_min
        })
    except Exception as e:
        print("Error calculando ruta:", e)
        return jsonify({'error': 'No se pudo calcular la ruta.'}), 500

@app.route('/api/geocodificar', methods=['POST'])
def geocodificar():
    data = request.get_json()
    lat = data.get('lat')
    lon = data.get('lon')

    if lat is None or lon is None:
        return jsonify({'error': 'Faltan coordenadas'}), 400

    url = 'https://api.openrouteservice.org/geocode/reverse'
    params = {
        'api_key': OPENROUTE_KEY,
        'point.lat': lat,
        'point.lon': lon,
        'size': 1
    }

    response = requests.get(url, params=params)
    if response.status_code != 200:
        return jsonify({'error': 'Error en geocodificación'}), 500

    data = response.json()
    features = data.get('features')
    if not features:
        return jsonify({'nombre': 'Ubicación no encontrada'}), 200

    nombre = features[0]['properties'].get('label', 'Sin nombre')
    return jsonify({'nombre': nombre})

@app.route('/api/geocodificar/buscar', methods=['POST'])
def buscar_lugares():
    data = request.get_json()
    query = data.get('query', '')
    if not query or len(query) < 3:
        return jsonify({'lugares': []})

    url = 'https://api.openrouteservice.org/geocode/search'
    params = {
        'api_key': OPENROUTE_KEY,
        'text': query,
        'size': 5,
        'layers': 'locality',
        'boundary.country': 'MX'
    }

    response = requests.get(url, params=params)
    if response.status_code != 200:
        return jsonify({'lugares': []})

    data_resp = response.json()
    features = data_resp.get('features', [])

    lugares = []
    for f in features:
        props = f.get('properties', {})
        coords = f.get('geometry', {}).get('coordinates', [0, 0])
        nombre = props.get('label', '')
        lon, lat = coords[0], coords[1]
        lugares.append({'lat': lat, 'lon': lon, 'nombre': nombre})

    return jsonify({'lugares': lugares})

if __name__ == '__main__':
    app.run(debug=True)
