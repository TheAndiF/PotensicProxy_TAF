import { computed, ref } from 'vue'

export type UiLocale = 'system' | 'en' | 'de' | 'zh'
type EffectiveLocale = Exclude<UiLocale, 'system'>

const STORAGE_KEY = 'potensic-proxy-ui-language'
const selectedLocale = ref<UiLocale>((localStorage.getItem(STORAGE_KEY) as UiLocale) || 'system')

function systemLocale(): EffectiveLocale {
  const lang = (navigator.language || 'en').toLowerCase()
  if (lang.startsWith('de')) return 'de'
  if (lang.startsWith('zh')) return 'zh'
  return 'en'
}

export const effectiveLocale = computed<EffectiveLocale>(() =>
  selectedLocale.value === 'system' ? systemLocale() : selectedLocale.value
)

const messages: Record<EffectiveLocale, Record<string, string>> = {
  en: {
    'language.title': 'Language',
    'language.subtitle': 'Controls the user-interface language. System follows the browser/device language.',
    'language.system': 'System', 'language.english': 'English', 'language.german': 'Deutsch', 'language.chinese': 'Chinese',
    'header.cockpit': 'Flight Cockpit', 'header.mission': 'Mission Planning', 'header.map': 'Map', 'header.gallery': 'Gallery', 'header.usb': 'USB Tools', 'header.system': 'System', 'header.engineering': 'Engineering', 'header.logs': 'Logs',
    'status.connected': 'Connected', 'status.disconnected': 'Disconnected', 'status.ready': 'Ready',
    'theme.title': 'Background', 'theme.dark': 'Dark', 'theme.light': 'Light', 'theme.gray': 'Gray',
    'profile.title': 'Drone Protocol',
    'profile.subtitle': 'Central model selection. All confirmed ATOM / ATOM 2 protocol differences are switched together.',
    'profile.switched': 'Drone protocol switched to {model}', 'profile.failed': 'Protocol switch failed: {error}',
    'telemetry.battery': 'Battery', 'telemetry.altitude': 'Altitude', 'telemetry.horizontalSpeed': 'Horizontal Speed',
    'telemetry.verticalSpeed': 'Vertical Speed', 'telemetry.horizontalDistance': 'Horizontal Distance', 'telemetry.satellites': 'Satellites',
    'telemetry.heading': 'Heading', 'telemetry.pitch': 'Pitch', 'telemetry.roll': 'Roll', 'telemetry.controllerVoltage': 'Controller Voltage',
    'telemetry.phoneBattery': 'Phone', 'telemetry.controllerBattery': 'Controller', 'telemetry.droneBattery': 'Drone',
    'actions.flight': 'Flight Actions', 'actions.takeoff': 'Takeoff', 'actions.takeoffConfirm': 'Confirm takeoff?', 'actions.land': 'Land', 'actions.landConfirm': 'Confirm landing?', 'actions.cancelLand': 'Cancel landing', 'actions.rth': 'RTH', 'actions.rthConfirm': 'Confirm return-to-home?', 'actions.cancelRth': 'Cancel RTH',
    'actions.emergency': 'Emergency Stop', 'actions.emergencyConfirmTitle': 'Confirm emergency stop', 'actions.emergencyConfirmText': 'Emergency stop can stop the motors immediately. Really execute this action?', 'actions.emergencyExecute': 'Execute emergency stop', 'actions.cancel': 'Cancel', 'actions.camera': 'Camera & Video Control', 'actions.photo': 'Photo', 'actions.photoMode': 'Switch to Photo', 'actions.photoShoot': 'Take Photo', 'actions.snapshotAndroid': 'Live Reco capture',
    'actions.record': 'Video Start/Stop', 'actions.recordStart': 'Start Video', 'actions.recordStop': 'Stop Video', 'actions.keyframe': 'Request Keyframe (IDR)', 'actions.liveview': 'Initialize LiveView Parameters',
    'video.waitingTitle': 'Waiting for drone video stream',
    'video.waitingDesc': 'Currently using direct frontend USB passthrough mode. If the aircraft is powered on and paired, activate the stream to send the initialization sequence.',
    'video.usbPassthrough': 'USB Passthrough Channel (WebSocket):', 'video.androidUsb': 'Android USB accessory:',
    'video.rxLink': 'Controller / Drone RX link:', 'video.videoExtraction': '0x06 Video Frame Extraction:', 'video.feTraffic': 'FE RX Traffic:',
    'video.parser': 'Video Parser:', 'video.webcodecs': 'Browser Hardware Decode Support (WebCodecs):', 'video.decoder': 'Decoder Status:',
    'video.open': 'Open', 'video.closed': 'Closed', 'video.waitingRx': 'Waiting for RX', 'video.rxConfirmed': 'Connected (RX confirmed)',
    'video.frames': 'frames', 'video.decoded': 'Decoded', 'video.dropped': 'dropped', 'video.activate': 'Activate Stream',
    'video.switchMode': 'Switch Mode', 'video.current': 'Current', 'video.live': 'Live Video', 'video.waiting': 'Waiting for Stream',
    'video.render': 'Render', 'video.hwDecode': 'HW Decode', 'video.stream': 'Stream', 'video.requestIFrame': 'Request I-Frame',
    'video.fullscreen': 'Fullscreen', 'video.fullscreenTitle': 'View video fullscreen', 'video.battery': 'Battery',
    'system.flight': 'Flight / Calibration / Smart Modes',
    'engineering.camera': 'Camera Console', 'engineering.fpv': 'Video & RF', 'engineering.sensor': 'Sensors & Calibration',
    'engineering.rid': 'Remote ID & System', 'engineering.relay': 'Remote / Relay', 'engineering.map': 'Map', 'engineering.logs': 'Logs', 'engineering.frontend': 'Frontend',
    'engineering.backend': 'Backend', 'engineering.hardwareTelemetry': 'Hardware Telemetry', 'engineering.waitingData': 'Waiting for data',
    'map.settings': 'Map Settings', 'map.versionIndex': 'Version index', 'map.projectPackage': 'Project package', 'map.androidApp': 'Android app', 'map.backend': 'Backend', 'map.webUi': 'Web UI', 'map.module': 'Map module', 'map.api': 'Map API', 'map.buildDate': 'Build date',
    'map.cockpitDisplay': 'Cockpit display', 'map.mainView': 'Main view', 'map.liveview': 'Liveview', 'map.map': 'Map', 'map.smallWindow': 'Small window', 'map.visible': 'Visible', 'map.hidden': 'Hidden', 'map.smallWindowPosition': 'Small window position', 'map.inMainImage': 'In main image', 'map.belowControls': 'Below controls', 'map.swapInfo': 'Liveview and map can always be swapped in the cockpit. The small-window position is independent of which view is currently large.',
    'map.source': 'Map source', 'map.provider': 'Provider', 'map.style': 'Mapbox style', 'map.styleUnused': 'Style is not used by Mapbox Satellite raster tiles.', 'map.styleStaticInfo': 'This mode rasterizes a compatible Mapbox Studio style through the Static Tiles API. Mapbox Standard and Standard Satellite are not supported there; use Mapbox Satellite raster or a compatible Studio style.', 'map.tileSource': 'Tile source', 'map.customTileUrl': 'Custom tile URL',
    'map.apiToken': 'API key / token', 'map.tokenPlaceholder': 'stored persistently in the Android backend', 'map.stored': 'Stored', 'map.notStored': 'Not stored', 'map.tokenStorageInfo': 'The token is stored in the app-internal backend configuration, survives app/device restarts, is returned to the WebUI only as ******** and is removed when app data is cleared or the app is uninstalled.', 'map.publicToken': 'Public token (pk.)', 'map.secretToken': 'Secret token (sk.)', 'map.temporaryToken': 'Temporary token (tk.)', 'map.unknownToken': 'Unknown token format', 'map.noToken': 'No token', 'map.tokenHandlingInfo': 'Mapbox pk., sk. and tk. tokens are accepted when the selected resource is permitted by their scopes/restrictions. Secret tokens are used only by the backend and are never returned in clear text to the WebUI.',
    'map.attribution': 'Attribution', 'map.defaultZoom': 'Default zoom', 'map.data': 'Map data', 'map.offlineOnly': 'Offline only', 'map.onlineFirst': 'Online first', 'map.modeInfo': 'Auto prefers downloaded offline areas and temporary cached tiles and downloads only missing tiles. Offline only uses local offline/cache data without online requests. Online first prefers online data and uses local data as fallback.', 'map.testConnection': 'Test connection', 'map.saveTest': 'Save & test', 'map.connectionSuccessful': 'Connection successful', 'map.tokenLabel': 'Token', 'map.homePoint': 'Home point',
    'map.downloadOfflineArea': 'Download offline area', 'map.osmWarning': 'The public OpenStreetMap tile service does not permit bulk/offline preloading. Select a provider whose terms explicitly permit offline downloads.', 'map.mapboxWarning': "Mapbox's documented full offline workflow is provided by its mobile Maps SDK/TileStore. Use this backend prefetch only when your Mapbox plan and terms permit the intended caching/offline use.", 'map.latitude': 'Latitude', 'map.longitude': 'Longitude', 'map.useDronePosition': 'Use current drone position', 'map.setCurrentPosition': 'Set as current position', 'map.currentManual': 'Current position: Manual', 'map.currentDrone': 'Current position: Drone', 'map.currentNone': 'Current position: Not available', 'map.radius': 'Radius', 'map.zoom': 'Zoom', 'map.to': 'to', 'map.downloadArea': 'Download area',
    'map.offlineMaps': 'Offline maps', 'map.downloadedAreas': 'Downloaded areas', 'map.offlineHelp': 'Update downloads only missing/invalid tiles. Reload refreshes every tile from the stored source. Delete tiles keeps the region definition and preserves tiles shared with another stored region.', 'map.noOfflineAreas': 'No offline areas', 'map.region': 'Region', 'map.sourceLabel': 'Source', 'map.status': 'Status', 'map.cache': 'Cache', 'map.actions': 'Actions', 'map.update': 'Update', 'map.reload': 'Reload', 'map.deleteTiles': 'Delete tiles', 'map.remove': 'Remove', 'map.errors': 'errors', 'map.ready': 'Ready', 'map.readyErrors': 'Ready with errors', 'map.tilesDeleted': 'Tiles deleted', 'map.deletingTiles': 'Deleting tiles', 'map.error': 'Error',
    'map.temporaryCache': 'Temporary tile cache', 'map.temporaryCacheHelp': 'Tiles loaded automatically during normal map use are kept separately from deliberately downloaded offline areas.', 'map.clearCache': 'Clear cache', 'map.lastUpdated': 'Last updated', 'map.tileCount': 'Tiles', 'map.coverage': 'Coverage', 'map.cacheEmpty': 'Temporary tile cache is empty.', 'map.clearCacheConfirm': 'Clear only the temporary tile cache? Downloaded offline areas will remain untouched.', 'map.cacheCleared': 'Temporary tile cache cleared', 'map.saveAsOfflineArea': 'Save as offline area',
    'map.view': 'Map', 'map.satellite': 'Satellite', 'map.loading': 'Map loading', 'map.sourceUnavailable': 'Map source unavailable', 'map.tokenStored': 'Token saved', 'map.tokenMissing': 'Token missing', 'map.zoomIn': 'Zoom in', 'map.zoomOut': 'Zoom out', 'map.waitingGps': 'Waiting for GPS',
    'map.testSuccessToast': 'Map provider connection successful', 'map.updateStarted': 'Offline region update started; only missing/invalid tiles will be downloaded', 'map.updateError': 'Could not update offline region', 'map.reloadConfirm': 'Reload all {count} tiles for {id} from its stored provider? Existing tiles are replaced only after a successful download.', 'map.reloadTitle': 'Reload offline tiles', 'map.reloadStarted': 'Full offline tile reload started', 'map.reloadError': 'Could not reload offline region', 'map.deleteTilesConfirm': 'Delete locally stored tiles for {id}? The region definition is kept. Tiles shared with another stored region are preserved.', 'map.deleteTilesTitle': 'Delete offline tiles', 'map.deleteTilesStarted': 'Offline tile deletion started', 'map.deleteTilesError': 'Could not delete offline tiles', 'map.removeConfirm': 'Remove offline region {id}? Its unshared offline tiles will also be deleted.', 'map.removeTitle': 'Remove offline region', 'map.removeDone': 'Offline region removed', 'map.removeError': 'Could not remove offline region', 'map.offlineOsmBlocked': 'Offline preloading is not permitted for the public OpenStreetMap tile service.', 'map.versionUnavailable': 'Version index unavailable: {error}', 'map.clearCacheTitle': 'Clear temporary tile cache', 'map.clearCacheError': 'Could not clear temporary tile cache', 'map.testFailed': 'Could not test map provider', 'map.savedOk': 'Map settings saved persistently and provider test passed', 'map.savedFailed': 'Map settings saved persistently, but provider test failed: {error}', 'map.saveError': 'Could not save map settings', 'map.loadError': 'Could not load map settings', 'map.offlineStarted': 'Offline download started', 'map.offlineStartError': 'Could not start offline download',
  },
  de: {
    'language.title': 'Sprache',
    'language.subtitle': 'Legt die Sprache der Benutzeroberfläche fest. System folgt der Browser-/Gerätesprache.',
    'language.system': 'System', 'language.english': 'English', 'language.german': 'Deutsch', 'language.chinese': 'Chinesisch',
    'header.cockpit': 'Flug-Cockpit', 'header.mission': 'Missionsplanung', 'header.map': 'Map', 'header.gallery': 'Gallery', 'header.usb': 'USB-Werkzeuge', 'header.system': 'System', 'header.engineering': 'Engineering', 'header.logs': 'Logs',
    'status.connected': 'Verbunden', 'status.disconnected': 'Getrennt', 'status.ready': 'Bereit',
    'theme.title': 'Hintergrund', 'theme.dark': 'Dunkel', 'theme.light': 'Hell', 'theme.gray': 'Grau',
    'profile.title': 'Drohnenprotokoll',
    'profile.subtitle': 'Zentrale Modellauswahl. Alle bestätigten ATOM-/ATOM-2-Protokollunterschiede werden gemeinsam umgeschaltet.',
    'profile.switched': 'Drohnenprotokoll auf {model} umgeschaltet', 'profile.failed': 'Protokollumschaltung fehlgeschlagen: {error}',
    'telemetry.battery': 'Batterie', 'telemetry.altitude': 'Höhe', 'telemetry.horizontalSpeed': 'Horizontale Geschwindigkeit',
    'telemetry.verticalSpeed': 'Vertikale Geschwindigkeit', 'telemetry.horizontalDistance': 'Horizontale Entfernung', 'telemetry.satellites': 'Satelliten',
    'telemetry.heading': 'Kurs', 'telemetry.pitch': 'Nick', 'telemetry.roll': 'Roll', 'telemetry.controllerVoltage': 'Controller-Spannung',
    'telemetry.phoneBattery': 'Handy', 'telemetry.controllerBattery': 'FB', 'telemetry.droneBattery': 'Drohne',
    'actions.flight': 'Flugaktionen', 'actions.takeoff': 'Start', 'actions.takeoffConfirm': 'Start wirklich ausloesen?', 'actions.land': 'Landung', 'actions.landConfirm': 'Landung wirklich ausloesen?', 'actions.cancelLand': 'Landung abbrechen', 'actions.rth': 'RTH', 'actions.rthConfirm': 'Rueckkehr wirklich ausloesen?', 'actions.cancelRth': 'RTH abbrechen',
    'actions.emergency': 'Not-Aus', 'actions.emergencyConfirmTitle': 'Not-Aus bestaetigen', 'actions.emergencyConfirmText': 'Not-Aus kann die Motoren sofort stoppen. Aktion wirklich ausfuehren?', 'actions.emergencyExecute': 'Not-Aus ausfuehren', 'actions.cancel': 'Abbrechen', 'actions.camera': 'Kamera & Video', 'actions.photo': 'Foto', 'actions.photoMode': 'Zu Foto wechseln', 'actions.photoShoot': 'Foto ausloesen', 'actions.snapshotAndroid': 'Live Reco aufnehmen',
    'actions.record': 'Video Start/Stopp', 'actions.recordStart': 'Video starten', 'actions.recordStop': 'Video stoppen', 'actions.keyframe': 'Schlüsselbild anfordern (IDR)', 'actions.liveview': 'LiveView-Parameter initialisieren',
    'video.waitingTitle': 'Warte auf Drohnen-Videostream',
    'video.waitingDesc': 'Direkter USB-Passthrough-Modus ist aktiv. Wenn die Drohne eingeschaltet und gekoppelt ist, den Stream aktivieren, um die Initialisierungssequenz zu senden.',
    'video.usbPassthrough': 'USB-Passthrough-Kanal (WebSocket):', 'video.androidUsb': 'Android-USB-Zubehör:',
    'video.rxLink': 'Controller-/Drohnen-RX-Link:', 'video.videoExtraction': '0x06 Video-Frame-Extraktion:', 'video.feTraffic': 'FE-RX-Verkehr:',
    'video.parser': 'Video-Parser:', 'video.webcodecs': 'Browser-Hardwaredecoding (WebCodecs):', 'video.decoder': 'Decoder-Status:',
    'video.open': 'Offen', 'video.closed': 'Geschlossen', 'video.waitingRx': 'Warte auf RX', 'video.rxConfirmed': 'Verbunden (RX bestätigt)',
    'video.frames': 'Frames', 'video.decoded': 'Dekodiert', 'video.dropped': 'verworfen', 'video.activate': 'Stream aktivieren',
    'video.switchMode': 'Modus wechseln', 'video.current': 'Aktuell', 'video.live': 'Livebild', 'video.waiting': 'Warte auf Stream',
    'video.render': 'Darstellung', 'video.hwDecode': 'HW-Decoding', 'video.stream': 'Stream', 'video.requestIFrame': 'I-Frame anfordern',
    'video.fullscreen': 'Vollbild', 'video.fullscreenTitle': 'Video im Vollbild anzeigen', 'video.battery': 'Batterie',
    'system.flight': 'Flug / Kalibrierung / Smart Modes',
    'engineering.camera': 'Kamera-Konsole', 'engineering.fpv': 'Video & RF', 'engineering.sensor': 'Sensoren & Kalibrierung',
    'engineering.rid': 'Remote ID & System', 'engineering.relay': 'Remote / Relay', 'engineering.map': 'Karte', 'engineering.logs': 'Logs', 'engineering.frontend': 'Frontend',
    'engineering.backend': 'Backend', 'engineering.hardwareTelemetry': 'Hardware-Telemetrie', 'engineering.waitingData': 'Warte auf Daten',
    'map.settings': 'Karteneinstellungen', 'map.versionIndex': 'Versionsindex', 'map.projectPackage': 'Projektpaket', 'map.androidApp': 'Android-App', 'map.backend': 'Backend', 'map.webUi': 'WebUI', 'map.module': 'Kartenmodul', 'map.api': 'Map API', 'map.buildDate': 'Build-Datum',
    'map.cockpitDisplay': 'Cockpit-Anzeige', 'map.mainView': 'Hauptansicht', 'map.liveview': 'Livebild', 'map.map': 'Karte', 'map.smallWindow': 'Kleines Fenster', 'map.visible': 'Sichtbar', 'map.hidden': 'Ausgeblendet', 'map.smallWindowPosition': 'Position kleines Fenster', 'map.inMainImage': 'Im Hauptbild', 'map.belowControls': 'Unter den Bedienelementen', 'map.swapInfo': 'Livebild und Karte koennen im Cockpit jederzeit getauscht werden. Die Position des kleinen Fensters ist unabhaengig davon, welche Ansicht gerade gross dargestellt wird.',
    'map.source': 'Kartenquelle', 'map.provider': 'Provider', 'map.style': 'Mapbox-Stil', 'map.styleUnused': 'Der Stil wird fuer Mapbox Satellite Raster Tiles nicht verwendet.', 'map.styleStaticInfo': 'Dieser Modus rastert einen kompatiblen Mapbox-Studio-Stil ueber die Static Tiles API. Mapbox Standard und Standard Satellite werden dort nicht unterstuetzt; verwende Mapbox Satellite Raster oder einen kompatiblen Studio-Stil.', 'map.tileSource': 'Tile-Quelle', 'map.customTileUrl': 'Benutzerdefinierte Tile-URL',
    'map.apiToken': 'API-Schluessel / Token', 'map.tokenPlaceholder': 'dauerhaft im Android-Backend gespeichert', 'map.stored': 'Gespeichert', 'map.notStored': 'Nicht gespeichert', 'map.tokenStorageInfo': 'Der Token wird in der app-internen Backend-Konfiguration gespeichert, bleibt nach App-/Geraeteneustarts erhalten, wird der WebUI nur als ******** zurueckgegeben und durch Loeschen der App-Daten bzw. Deinstallation entfernt.', 'map.publicToken': 'Oeffentlicher Token (pk.)', 'map.secretToken': 'Geheimer Token (sk.)', 'map.temporaryToken': 'Temporaerer Token (tk.)', 'map.unknownToken': 'Unbekanntes Tokenformat', 'map.noToken': 'Kein Token', 'map.tokenHandlingInfo': 'Mapbox pk.-, sk.- und tk.-Tokens werden akzeptiert, wenn Ressource und Scopes/Restriktionen dies erlauben. Secret Tokens werden nur im Backend verwendet und niemals im Klartext an die WebUI zurueckgegeben.',
    'map.attribution': 'Quellenangabe', 'map.defaultZoom': 'Standard-Zoom', 'map.data': 'Kartendaten', 'map.offlineOnly': 'Nur offline', 'map.onlineFirst': 'Online bevorzugt', 'map.modeInfo': 'Auto bevorzugt heruntergeladene Offline-Bereiche und temporaer gespeicherte Tiles und laedt nur Fehlendes nach. Nur offline verwendet lokale Offline-/Cache-Daten ohne Online-Anfragen. Online bevorzugt nutzt Online-Daten zuerst und lokale Daten als Rueckfall.', 'map.testConnection': 'Verbindung testen', 'map.saveTest': 'Speichern & testen', 'map.connectionSuccessful': 'Verbindung erfolgreich', 'map.tokenLabel': 'Token', 'map.homePoint': 'Home-Punkt',
    'map.downloadOfflineArea': 'Offline-Bereich herunterladen', 'map.osmWarning': 'Der oeffentliche OpenStreetMap-Tile-Dienst erlaubt kein Bulk-/Offline-Vorladen. Waehle einen Provider, dessen Bedingungen Offline-Downloads ausdruecklich erlauben.', 'map.mapboxWarning': 'Der dokumentierte vollstaendige Mapbox-Offline-Workflow wird ueber Mobile Maps SDK/TileStore bereitgestellt. Verwende dieses Backend-Prefetch nur, wenn dein Mapbox-Tarif und die Bedingungen die vorgesehene Cache-/Offline-Nutzung erlauben.', 'map.latitude': 'Breitengrad', 'map.longitude': 'Laengengrad', 'map.useDronePosition': 'Aktuelle Drohnenposition verwenden', 'map.setCurrentPosition': 'Als aktuelle Position setzen', 'map.currentManual': 'Aktuelle Position: Manuell', 'map.currentDrone': 'Aktuelle Position: Drohne', 'map.currentNone': 'Aktuelle Position: Nicht verfuegbar', 'map.radius': 'Radius', 'map.zoom': 'Zoom', 'map.to': 'bis', 'map.downloadArea': 'Bereich herunterladen',
    'map.offlineMaps': 'Offline-Karten', 'map.downloadedAreas': 'Heruntergeladene Bereiche', 'map.offlineHelp': 'Update laedt nur fehlende/ungueltige Tiles. Neu laden aktualisiert alle Tiles von der gespeicherten Quelle. Tiles loeschen behaelt die Regionsdefinition und schuetzt Tiles, die von einer anderen gespeicherten Region geteilt werden.', 'map.noOfflineAreas': 'Keine Offline-Bereiche', 'map.region': 'Region', 'map.sourceLabel': 'Quelle', 'map.status': 'Status', 'map.cache': 'Cache', 'map.actions': 'Aktionen', 'map.update': 'Aktualisieren', 'map.reload': 'Neu laden', 'map.deleteTiles': 'Tiles loeschen', 'map.remove': 'Entfernen', 'map.errors': 'Fehler', 'map.ready': 'Bereit', 'map.readyErrors': 'Bereit mit Fehlern', 'map.tilesDeleted': 'Tiles geloescht', 'map.deletingTiles': 'Tiles werden geloescht', 'map.error': 'Fehler',
    'map.temporaryCache': 'Temporaerer Tile-Cache', 'map.temporaryCacheHelp': 'Tiles, die bei normaler Kartennutzung automatisch geladen werden, werden getrennt von bewusst heruntergeladenen Offline-Bereichen verwaltet.', 'map.clearCache': 'Cache leeren', 'map.lastUpdated': 'Zuletzt aktualisiert', 'map.tileCount': 'Tiles', 'map.coverage': 'Abdeckung', 'map.cacheEmpty': 'Der temporaere Tile-Cache ist leer.', 'map.clearCacheConfirm': 'Nur den temporaeren Tile-Cache leeren? Heruntergeladene Offline-Bereiche bleiben unveraendert.', 'map.cacheCleared': 'Temporaerer Tile-Cache geleert', 'map.saveAsOfflineArea': 'Als Offline-Bereich speichern',
    'map.view': 'Karte', 'map.satellite': 'Satellit', 'map.loading': 'Karte wird geladen', 'map.sourceUnavailable': 'Kartenquelle nicht verfuegbar', 'map.tokenStored': 'Token gespeichert', 'map.tokenMissing': 'Token fehlt', 'map.zoomIn': 'Hineinzoomen', 'map.zoomOut': 'Herauszoomen', 'map.waitingGps': 'Warte auf GPS',
    'map.testSuccessToast': 'Verbindung zum Kartenprovider erfolgreich', 'map.updateStarted': 'Offline-Bereich wird aktualisiert; nur fehlende/ungueltige Tiles werden geladen', 'map.updateError': 'Offline-Bereich konnte nicht aktualisiert werden', 'map.reloadConfirm': 'Alle {count} Tiles fuer {id} von der gespeicherten Quelle neu laden? Vorhandene Tiles werden erst nach erfolgreichem Download ersetzt.', 'map.reloadTitle': 'Offline-Tiles neu laden', 'map.reloadStarted': 'Vollstaendiges Neuladen der Offline-Tiles gestartet', 'map.reloadError': 'Offline-Bereich konnte nicht neu geladen werden', 'map.deleteTilesConfirm': 'Lokal gespeicherte Tiles fuer {id} loeschen? Die Regionsdefinition bleibt erhalten. Mit anderen Regionen geteilte Tiles werden geschuetzt.', 'map.deleteTilesTitle': 'Offline-Tiles loeschen', 'map.deleteTilesStarted': 'Loeschen der Offline-Tiles gestartet', 'map.deleteTilesError': 'Offline-Tiles konnten nicht geloescht werden', 'map.removeConfirm': 'Offline-Bereich {id} entfernen? Nicht geteilte Offline-Tiles werden ebenfalls geloescht.', 'map.removeTitle': 'Offline-Bereich entfernen', 'map.removeDone': 'Offline-Bereich entfernt', 'map.removeError': 'Offline-Bereich konnte nicht entfernt werden', 'map.offlineOsmBlocked': 'Offline-Vorladen ist fuer den oeffentlichen OpenStreetMap-Tile-Dienst nicht erlaubt.', 'map.versionUnavailable': 'Versionsindex nicht verfuegbar: {error}', 'map.clearCacheTitle': 'Temporaeren Tile-Cache leeren', 'map.clearCacheError': 'Temporaerer Tile-Cache konnte nicht geleert werden', 'map.testFailed': 'Kartenprovider konnte nicht getestet werden', 'map.savedOk': 'Karteneinstellungen dauerhaft gespeichert und Providertest erfolgreich', 'map.savedFailed': 'Karteneinstellungen dauerhaft gespeichert, aber Providertest fehlgeschlagen: {error}', 'map.saveError': 'Karteneinstellungen konnten nicht gespeichert werden', 'map.loadError': 'Karteneinstellungen konnten nicht geladen werden', 'map.offlineStarted': 'Offline-Download gestartet', 'map.offlineStartError': 'Offline-Download konnte nicht gestartet werden',
  },
  zh: {
    'language.title': '语言', 'language.subtitle': '设置用户界面语言。系统模式跟随浏览器/设备语言。',
    'language.system': '系统', 'language.english': '英语', 'language.german': '德语', 'language.chinese': '中文',
    'header.cockpit': '飞行驾驶舱', 'header.mission': '任务规划', 'header.map': '地图', 'header.gallery': '图库', 'header.usb': 'USB 工具', 'header.system': '系统', 'header.engineering': '工程模式', 'header.logs': '日志',
    'status.connected': '已连接', 'status.disconnected': '已断开', 'status.ready': '就绪',
    'theme.title': '背景', 'theme.dark': '深色', 'theme.light': '浅色', 'theme.gray': '灰色',
    'profile.title': '无人机协议', 'profile.subtitle': '中央机型选择。所有已确认的 ATOM / ATOM 2 协议差异将一起切换。',
    'profile.switched': '无人机协议已切换到 {model}', 'profile.failed': '协议切换失败：{error}',
    'telemetry.battery': '电量', 'telemetry.altitude': '高度', 'telemetry.horizontalSpeed': '水平速度', 'telemetry.verticalSpeed': '垂直速度',
    'telemetry.horizontalDistance': '水平距离', 'telemetry.satellites': '卫星', 'telemetry.heading': '航向', 'telemetry.pitch': '俯仰',
    'telemetry.roll': '横滚', 'telemetry.controllerVoltage': '遥控器电压', 'telemetry.phoneBattery': '手机', 'telemetry.controllerBattery': '遥控器', 'telemetry.droneBattery': '无人机',
    'actions.flight': '飞行动作', 'actions.takeoff': '起飞', 'actions.takeoffConfirm': '确认起飞？', 'actions.land': '降落', 'actions.landConfirm': '确认降落？', 'actions.cancelLand': '取消降落', 'actions.rth': '返航', 'actions.rthConfirm': '确认返航？', 'actions.cancelRth': '取消返航', 'actions.emergency': '紧急停止', 'actions.emergencyConfirmTitle': '确认紧急停止', 'actions.emergencyConfirmText': '紧急停止可能立即停止电机。确定执行吗？', 'actions.emergencyExecute': '执行紧急停止', 'actions.cancel': '取消',
    'actions.camera': '相机与视频控制', 'actions.photo': '拍照', 'actions.photoMode': '切换到拍照模式', 'actions.photoShoot': '执行拍照', 'actions.snapshotAndroid': '保存 Live Reco 图像', 'actions.record': '视频开始/停止', 'actions.recordStart': '开始录像', 'actions.recordStop': '停止录像', 'actions.keyframe': '请求关键帧 (IDR)',
    'actions.liveview': '初始化 LiveView 参数',
    'video.waitingTitle': '等待无人机视频流', 'video.waitingDesc': '当前使用前端 USB 直通模式。如果飞行器已开机并完成配对，请激活视频流以发送初始化序列。',
    'video.usbPassthrough': 'USB 直通通道 (WebSocket)：', 'video.androidUsb': 'Android USB 附件：', 'video.rxLink': '遥控器 / 飞行器 RX 链路：',
    'video.videoExtraction': '0x06 视频帧提取：', 'video.feTraffic': 'FE RX 流量：', 'video.parser': '视频解析器：',
    'video.webcodecs': '浏览器硬件解码支持 (WebCodecs)：', 'video.decoder': '解码器状态：', 'video.open': '已打开', 'video.closed': '已关闭',
    'video.waitingRx': '等待 RX', 'video.rxConfirmed': '已连接（RX 已确认）', 'video.frames': '帧', 'video.decoded': '已解码', 'video.dropped': '丢弃',
    'video.activate': '激活视频流', 'video.switchMode': '切换模式', 'video.current': '当前', 'video.live': '实时画面', 'video.waiting': '等待视频流',
    'video.render': '渲染', 'video.hwDecode': '硬件解码', 'video.stream': '视频流', 'video.requestIFrame': '请求 I 帧', 'video.fullscreen': '全屏',
    'video.fullscreenTitle': '全屏查看视频', 'video.battery': '电量',
    'system.flight': '飞行 / 校准 / 智能模式',
    'engineering.camera': '相机控制台', 'engineering.fpv': '视频与射频', 'engineering.sensor': '传感器与校准', 'engineering.rid': '远程识别与系统',
    'engineering.relay': '远程 / 中继', 'engineering.map': '地图', 'engineering.logs': '日志', 'engineering.frontend': '前端', 'engineering.backend': '后端', 'engineering.hardwareTelemetry': '硬件遥测', 'engineering.waitingData': '等待数据',
    'map.settings': '地图设置', 'map.versionIndex': '版本信息', 'map.projectPackage': '项目包', 'map.androidApp': 'Android 应用', 'map.backend': '后端', 'map.webUi': 'Web UI', 'map.module': '地图模块', 'map.api': '地图 API', 'map.buildDate': '构建日期',
    'map.cockpitDisplay': '驾驶舱显示', 'map.mainView': '主视图', 'map.liveview': '实时画面', 'map.map': '地图', 'map.smallWindow': '小窗口', 'map.visible': '显示', 'map.hidden': '隐藏', 'map.smallWindowPosition': '小窗口位置', 'map.inMainImage': '主画面内', 'map.belowControls': '控制区下方', 'map.swapInfo': '实时画面与地图可在驾驶舱中随时互换。小窗口位置与当前哪一个视图为大图无关。',
    'map.source': '地图源', 'map.provider': '提供商', 'map.style': 'Mapbox 样式', 'map.styleUnused': 'Mapbox Satellite 栅格瓦片不使用该样式。', 'map.styleStaticInfo': '此模式通过 Static Tiles API 栅格化兼容的 Mapbox Studio 样式。Mapbox Standard 与 Standard Satellite 当前不受支持；请使用 Mapbox Satellite 栅格或兼容的 Studio 样式。', 'map.tileSource': '瓦片源', 'map.customTileUrl': '自定义瓦片 URL',
    'map.apiToken': 'API 密钥 / Token', 'map.tokenPlaceholder': '持久保存在 Android 后端', 'map.stored': '已保存', 'map.notStored': '未保存', 'map.tokenStorageInfo': 'Token 保存在应用内部后端配置中，可跨应用/设备重启保留，只以 ******** 返回给 WebUI；清除应用数据或卸载应用时删除。', 'map.publicToken': '公开 Token (pk.)', 'map.secretToken': '私密 Token (sk.)', 'map.temporaryToken': '临时 Token (tk.)', 'map.unknownToken': '未知 Token 格式', 'map.noToken': '无 Token', 'map.tokenHandlingInfo': '当所选资源及其权限/限制允许时，可使用 Mapbox pk.、sk. 与 tk. Token。Secret Token 仅在后端使用，绝不会以明文返回 WebUI。',
    'map.attribution': '来源标注', 'map.defaultZoom': '默认缩放', 'map.data': '地图数据', 'map.offlineOnly': '仅离线', 'map.onlineFirst': '在线优先', 'map.modeInfo': 'Auto 优先使用已下载离线区域和临时缓存瓦片，仅补充缺失瓦片。仅离线模式只使用本地离线/缓存数据且不发起在线请求。在线优先模式先使用在线数据，并以本地数据作为回退。', 'map.testConnection': '测试连接', 'map.saveTest': '保存并测试', 'map.connectionSuccessful': '连接成功', 'map.tokenLabel': 'Token', 'map.homePoint': '返航点',
    'map.downloadOfflineArea': '下载离线区域', 'map.osmWarning': 'OpenStreetMap 公共瓦片服务不允许批量/离线预加载。请选择明确允许离线下载的提供商。', 'map.mapboxWarning': 'Mapbox 文档中的完整离线流程通过移动 Maps SDK/TileStore 提供。仅在你的 Mapbox 套餐和条款允许计划中的缓存/离线使用时使用此前端预取。', 'map.latitude': '纬度', 'map.longitude': '经度', 'map.useDronePosition': '使用当前无人机位置', 'map.setCurrentPosition': '设为当前位置', 'map.currentManual': '当前位置：手动', 'map.currentDrone': '当前位置：无人机', 'map.currentNone': '当前位置：不可用', 'map.radius': '半径', 'map.zoom': '缩放', 'map.to': '至', 'map.downloadArea': '下载区域',
    'map.offlineMaps': '离线地图', 'map.downloadedAreas': '已下载区域', 'map.offlineHelp': '更新仅下载缺失/无效瓦片。重新加载会从已保存源刷新所有瓦片。删除瓦片会保留区域定义，并保留与其他区域共享的瓦片。', 'map.noOfflineAreas': '无离线区域', 'map.region': '区域', 'map.sourceLabel': '来源', 'map.status': '状态', 'map.cache': '缓存', 'map.actions': '操作', 'map.update': '更新', 'map.reload': '重新加载', 'map.deleteTiles': '删除瓦片', 'map.remove': '移除', 'map.errors': '错误', 'map.ready': '就绪', 'map.readyErrors': '就绪但有错误', 'map.tilesDeleted': '瓦片已删除', 'map.deletingTiles': '正在删除瓦片', 'map.error': '错误',
    'map.temporaryCache': '临时瓦片缓存', 'map.temporaryCacheHelp': '正常浏览地图时自动加载的瓦片与主动下载的离线区域分开管理。', 'map.clearCache': '清空缓存', 'map.lastUpdated': '最后更新', 'map.tileCount': '瓦片数', 'map.coverage': '覆盖范围', 'map.cacheEmpty': '临时瓦片缓存为空。', 'map.clearCacheConfirm': '仅清空临时瓦片缓存？已下载的离线区域不会改变。', 'map.cacheCleared': '临时瓦片缓存已清空', 'map.saveAsOfflineArea': '保存为离线区域',
    'map.view': '地图', 'map.satellite': '卫星', 'map.loading': '地图加载中', 'map.sourceUnavailable': '地图源不可用', 'map.tokenStored': 'Token 已保存', 'map.tokenMissing': '缺少 Token', 'map.zoomIn': '放大', 'map.zoomOut': '缩小', 'map.waitingGps': '等待 GPS',
    'map.testSuccessToast': '地图提供商连接成功', 'map.updateStarted': '离线区域更新已开始；仅下载缺失或无效瓦片', 'map.updateError': '无法更新离线区域', 'map.reloadConfirm': '从已保存提供商重新加载 {id} 的全部 {count} 个瓦片？现有瓦片仅在成功下载后替换。', 'map.reloadTitle': '重新加载离线瓦片', 'map.reloadStarted': '完整离线瓦片重新加载已开始', 'map.reloadError': '无法重新加载离线区域', 'map.deleteTilesConfirm': '删除 {id} 的本地瓦片？区域定义会保留，与其他区域共享的瓦片也会保留。', 'map.deleteTilesTitle': '删除离线瓦片', 'map.deleteTilesStarted': '离线瓦片删除已开始', 'map.deleteTilesError': '无法删除离线瓦片', 'map.removeConfirm': '移除离线区域 {id}？未共享的离线瓦片也会删除。', 'map.removeTitle': '移除离线区域', 'map.removeDone': '离线区域已移除', 'map.removeError': '无法移除离线区域', 'map.offlineOsmBlocked': 'OpenStreetMap 公共瓦片服务不允许离线预加载。', 'map.versionUnavailable': '版本信息不可用：{error}', 'map.clearCacheTitle': '清空临时瓦片缓存', 'map.clearCacheError': '无法清空临时瓦片缓存', 'map.testFailed': '无法测试地图提供商', 'map.savedOk': '地图设置已持久保存且提供商测试成功', 'map.savedFailed': '地图设置已持久保存，但提供商测试失败：{error}', 'map.saveError': '无法保存地图设置', 'map.loadError': '无法加载地图设置', 'map.offlineStarted': '离线下载已开始', 'map.offlineStartError': '无法开始离线下载',
  }
}

export function setLocale(locale: UiLocale) {
  selectedLocale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = effectiveLocale.value
}

export function useI18n() {
  const t = (key: string, vars?: Record<string, string | number>) => {
    let value = messages[effectiveLocale.value][key] || messages.en[key] || key
    if (vars) for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement))
    return value
  }
  return { t, locale: selectedLocale, effectiveLocale, setLocale }
}

export function tr(key: string, vars?: Record<string, string | number>) {
  let value = messages[effectiveLocale.value][key] || messages.en[key] || key
  if (vars) for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement))
  return value
}

setLocale(selectedLocale.value)
