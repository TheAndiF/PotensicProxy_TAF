# Potensic Atom 2 — Auditoria de Privacidad: Datos Enviados Sin Conocimiento del Usuario (Spanish / Español)

> **Firmware analizado:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **Biblioteca RemoteID:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Transmision Continua BLE/WiFi (Lo Mas Invasivo)

A traves de `libridtrans.so` (protocolo ASTM F3411 / OpenDroneID), el dron transmite continuamente los siguientes datos por BLE y WiFi:

| Dato | Funcion API |
|------|-------------|
| **Numero de serie** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Posicion GPS en tiempo real** (lat, lon, alt) | `RIDTRANS_SetLocation` |
| **Velocidad horizontal/vertical** | `RIDTRANS_SetLocation` |
| **Direccion de vuelo** | `RIDTRANS_SetLocation` |
| **Altitud barometrica + geodesica** | `RIDTRANS_SetLocation` |
| **Precision horizontal/vertical/velocidad** | `RIDTRANS_SetLocation` |
| **Posicion del piloto** (Operator Location) | `RIDTRANS_SetSystem` |
| **Categoria + clase UE** del dron | `RIDTRANS_SetSystem` |
| **ID del operador** | `RIDTRANS_SetOperatorID` |
| **Texto libre** (Self ID) | `RIDTRANS_SetSelfID` |
| **Datos de autenticacion** | `RIDTRANS_SetAuth` |
| **Marca de tiempo** | `RIDTRNAS_SetTime` |

**Cualquier persona** con un receptor BLE/WiFi dentro de un rango de ~1km puede leer todos estos datos en tiempo real. Esto es **por diseno** (regulaciones UE/FAA), pero los usuarios pueden no ser plenamente conscientes del alcance de los datos transmitidos.

## 2. Metadatos EXIF/XMP en Fotos y Videos

Cada archivo de foto y video contiene metadatos integrados (namespace XMP `http://www.ipotensic.com/drone/1.0/`):

| Campo | Contenido |
|-------|-----------|
| `GPSLatitude` / `GPSLongitude` | Posicion exacta |
| `GPSAltitude` | Altitud |
| `AbsoluteAltitude` / `RelativeAltitude` | Altitudes absoluta y relativa |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Orientacion de la camara |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Orientacion del dron |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | Velocidad 3D |
| `CameraSerialNumber` / `BodySerialNumber` | Numeros de serie |
| `Make` / `Model` | Identificadores de hardware |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Configuracion de la camara |

Estos datos estan **integrados en los archivos** — si compartes una foto o video, todo esto va incluido.

## 3. Pista Privada "Potensic MetaData" en Videos MP4

Las grabaciones de video MP4 contienen una **pista de datos privada** (`Create private data track`) con entradas `UserDefAtom` — un flujo de telemetria completo codificado dentro del archivo de video (GPS, actitud, velocidad, etc. cuadro por cuadro).

## 4. Heartbeat al Telefono — Flujo de Datos Continuo

El `camera_heartbeat` envia continuamente a la aplicacion del telefono conectado:
- Modo de operacion
- Estado de la tarjeta SD
- Estado de los medios
- Estado de WiFi Direct
- Estado compuesto
- Modo de medios activo

## 5. Autenticacion del Telefono

El dron **identifica y autentica** el telefono conectado:
- `is_cellphone_id_authenticated` — verifica si el telefono esta autorizado
- `cellphone id authenticated: %s` — registra el ID del telefono
- Token almacenado en `/data/config/token`

## 6. Zonas de Vuelo Prohibido — Aplicadas Silenciosamente

El sistema NFZ (`deepsea_nfz`):
- Descarga zonas de restriccion desde los servidores de Potensic (a traves de la aplicacion del telefono)
- Las almacena en `/data/no_fly_zone/` (formatos circulo + poligono)
- El controlador de vuelo **se niega a volar** en estas zonas
- El usuario **no puede eliminarlas** sin acceso root

## Lo Que NO Se Hace (Positivo)

- El dron **no se conecta directamente a Internet** — toda la comunicacion pasa por la aplicacion del telefono
- No hay telemetria directa a la nube desde el dron
- No hay comportamiento autonomo de "llamada a casa"

## Resumen de Riesgos

| Riesgo | Severidad | Control del Usuario |
|--------|-----------|---------------------|
| RemoteID transmitiendo posicion/serie continuamente | **Alta** | Ninguno (no se puede desactivar sin root) |
| GPS/serie integrados en fotos compartidas | **Media** | Eliminar EXIF antes de compartir |
| Pista de telemetria en videos | **Media** | Sin forma sencilla de eliminar |
| NFZ aplicadas por el servidor | **Media** | Ninguno sin root |
| Autenticacion del telefono | **Baja** | Normal para el emparejamiento |
