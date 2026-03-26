# Potensic Atom 2 — Audit sulla Privacy: Dati Inviati a Insaputa dell'Utente (Italian / Italiano)

> **Firmware analizzato:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **Libreria RemoteID:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Trasmissione Continua BLE/WiFi (La Piu Invasiva)

Tramite `libridtrans.so` (protocollo ASTM F3411 / OpenDroneID), il drone trasmette continuamente i seguenti dati via BLE e WiFi:

| Dati | Funzione API |
|------|-------------|
| **Numero di serie** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Posizione GPS in tempo reale** (lat, lon, alt) | `RIDTRANS_SetLocation` |
| **Velocita orizzontale/verticale** | `RIDTRANS_SetLocation` |
| **Direzione di volo** | `RIDTRANS_SetLocation` |
| **Altitudine barometrica + geodetica** | `RIDTRANS_SetLocation` |
| **Precisione orizzontale/verticale/velocita** | `RIDTRANS_SetLocation` |
| **Posizione del pilota** (Operator Location) | `RIDTRANS_SetSystem` |
| **Categoria + classe UE** del drone | `RIDTRANS_SetSystem` |
| **ID operatore** | `RIDTRANS_SetOperatorID` |
| **Testo libero** (Self ID) | `RIDTRANS_SetSelfID` |
| **Dati di autenticazione** | `RIDTRANS_SetAuth` |
| **Timestamp** | `RIDTRNAS_SetTime` |

**Chiunque** disponga di un ricevitore BLE/WiFi entro un raggio di ~1km puo leggere tutti questi dati in tempo reale. Questo e **intenzionale** (normative UE/FAA), ma gli utenti potrebbero non essere pienamente consapevoli della portata dei dati trasmessi.

## 2. Metadati EXIF/XMP nelle Foto e nei Video

Ogni file foto e video contiene metadati incorporati (namespace XMP `http://www.ipotensic.com/drone/1.0/`):

| Campo | Contenuto |
|-------|-----------|
| `GPSLatitude` / `GPSLongitude` | Posizione esatta |
| `GPSAltitude` | Altitudine |
| `AbsoluteAltitude` / `RelativeAltitude` | Altitudini assoluta e relativa |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Orientamento della fotocamera |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Orientamento del drone |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | Velocita 3D |
| `CameraSerialNumber` / `BodySerialNumber` | Numeri di serie |
| `Make` / `Model` | Identificativi hardware |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Impostazioni della fotocamera |

Questi dati sono **incorporati nei file** — se condividi una foto o un video, tutto questo viene trasmesso con essi.

## 3. Traccia Privata "Potensic MetaData" nei Video MP4

Le registrazioni video MP4 contengono una **traccia dati privata** (`Create private data track`) con voci `UserDefAtom` — un flusso telemetrico completo codificato all'interno del file video (GPS, assetto, velocita, ecc. per ogni fotogramma).

## 4. Heartbeat verso l'App del Telefono — Flusso Dati Continuo

Il `camera_heartbeat` invia continuamente all'app del telefono connessa:
- Modalita operativa
- Stato della scheda SD
- Stato dei media
- Stato WiFi Direct
- Stato composito
- Modalita media attiva

## 5. Autenticazione del Telefono

Il drone **identifica e autentica** il telefono connesso:
- `is_cellphone_id_authenticated` — verifica se il telefono e autorizzato
- `cellphone id authenticated: %s` — registra l'ID del telefono nei log
- Token salvato in `/data/config/token`

## 6. Zone di Volo Vietate — Applicate Silenziosamente

Il sistema NFZ (`deepsea_nfz`):
- Scarica le zone di restrizione dai server Potensic (tramite l'app del telefono)
- Le salva in `/data/no_fly_zone/` (formati cerchio + poligono)
- Il Flight Controller **rifiuta di volare** in queste zone
- L'utente **non puo rimuoverle** senza accesso root

## Cosa NON Viene Fatto (Aspetti Positivi)

- Il drone **non si connette direttamente a Internet** — tutte le comunicazioni passano attraverso l'app del telefono
- Nessuna telemetria cloud diretta dal drone
- Nessun comportamento autonomo di "phone home"

## Riepilogo dei Rischi

| Rischio | Gravita | Controllo dell'Utente |
|---------|---------|----------------------|
| RemoteID che trasmette posizione/seriale continuamente | **Alta** | Nessuno (non disattivabile senza root) |
| GPS/seriale incorporati nelle foto condivise | **Media** | Rimuovere i dati EXIF prima della condivisione |
| Traccia telemetrica nei video | **Media** | Nessun modo semplice per rimuoverla |
| NFZ applicate dal server | **Media** | Nessuno senza root |
| Autenticazione del telefono | **Bassa** | Normale per l'associazione |
