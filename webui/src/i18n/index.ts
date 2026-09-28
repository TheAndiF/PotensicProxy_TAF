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
    'header.cockpit': 'Flight Cockpit', 'header.usb': 'USB Tools', 'header.engineering': 'Engineering', 'header.logs': 'Logs',
    'status.connected': 'Connected', 'status.disconnected': 'Disconnected', 'status.ready': 'Ready',
    'profile.title': 'Drone Protocol',
    'profile.subtitle': 'Central model selection. All confirmed ATOM / ATOM 2 protocol differences are switched together.',
    'profile.switched': 'Drone protocol switched to {model}', 'profile.failed': 'Protocol switch failed: {error}',
    'telemetry.battery': 'Battery', 'telemetry.altitude': 'Altitude', 'telemetry.horizontalSpeed': 'Horizontal Speed',
    'telemetry.verticalSpeed': 'Vertical Speed', 'telemetry.horizontalDistance': 'Horizontal Distance', 'telemetry.satellites': 'Satellites',
    'telemetry.heading': 'Heading', 'telemetry.pitch': 'Pitch', 'telemetry.roll': 'Roll', 'telemetry.controllerVoltage': 'Controller Voltage',
    'actions.flight': 'Flight Actions', 'actions.takeoff': 'Takeoff', 'actions.land': 'Land', 'actions.rth': 'RTH',
    'actions.emergency': 'Emergency Stop', 'actions.camera': 'Camera & Video Control', 'actions.photo': 'Photo',
    'actions.record': 'Record Toggle', 'actions.keyframe': 'Request Keyframe (IDR)', 'actions.liveview': 'Initialize LiveView Parameters',
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
    'engineering.camera': 'Camera Console', 'engineering.fpv': 'Video & RF', 'engineering.sensor': 'Sensors & Calibration',
    'engineering.rid': 'Remote ID & System', 'engineering.relay': 'Remote / Relay', 'engineering.frontend': 'Frontend',
    'engineering.backend': 'Backend', 'engineering.hardwareTelemetry': 'Hardware Telemetry', 'engineering.waitingData': 'Waiting for data',
  },
  de: {
    'language.title': 'Sprache',
    'language.subtitle': 'Legt die Sprache der Benutzeroberfläche fest. System folgt der Browser-/Gerätesprache.',
    'language.system': 'System', 'language.english': 'English', 'language.german': 'Deutsch', 'language.chinese': 'Chinesisch',
    'header.cockpit': 'Flug-Cockpit', 'header.usb': 'USB-Werkzeuge', 'header.engineering': 'Engineering', 'header.logs': 'Logs',
    'status.connected': 'Verbunden', 'status.disconnected': 'Getrennt', 'status.ready': 'Bereit',
    'profile.title': 'Drohnenprotokoll',
    'profile.subtitle': 'Zentrale Modellauswahl. Alle bestätigten ATOM-/ATOM-2-Protokollunterschiede werden gemeinsam umgeschaltet.',
    'profile.switched': 'Drohnenprotokoll auf {model} umgeschaltet', 'profile.failed': 'Protokollumschaltung fehlgeschlagen: {error}',
    'telemetry.battery': 'Batterie', 'telemetry.altitude': 'Höhe', 'telemetry.horizontalSpeed': 'Horizontale Geschwindigkeit',
    'telemetry.verticalSpeed': 'Vertikale Geschwindigkeit', 'telemetry.horizontalDistance': 'Horizontale Entfernung', 'telemetry.satellites': 'Satelliten',
    'telemetry.heading': 'Kurs', 'telemetry.pitch': 'Nick', 'telemetry.roll': 'Roll', 'telemetry.controllerVoltage': 'Controller-Spannung',
    'actions.flight': 'Flugaktionen', 'actions.takeoff': 'Start', 'actions.land': 'Landung', 'actions.rth': 'RTH',
    'actions.emergency': 'Not-Aus', 'actions.camera': 'Kamera & Video', 'actions.photo': 'Foto',
    'actions.record': 'Aufnahme umschalten', 'actions.keyframe': 'Schlüsselbild anfordern (IDR)', 'actions.liveview': 'LiveView-Parameter initialisieren',
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
    'engineering.camera': 'Kamera-Konsole', 'engineering.fpv': 'Video & RF', 'engineering.sensor': 'Sensoren & Kalibrierung',
    'engineering.rid': 'Remote ID & System', 'engineering.relay': 'Remote / Relay', 'engineering.frontend': 'Frontend',
    'engineering.backend': 'Backend', 'engineering.hardwareTelemetry': 'Hardware-Telemetrie', 'engineering.waitingData': 'Warte auf Daten',
  },
  zh: {
    'language.title': '语言', 'language.subtitle': '设置用户界面语言。系统模式跟随浏览器/设备语言。',
    'language.system': '系统', 'language.english': '英语', 'language.german': '德语', 'language.chinese': '中文',
    'header.cockpit': '飞行驾驶舱', 'header.usb': 'USB 工具', 'header.engineering': '工程模式', 'header.logs': '日志',
    'status.connected': '已连接', 'status.disconnected': '已断开', 'status.ready': '就绪',
    'profile.title': '无人机协议', 'profile.subtitle': '中央机型选择。所有已确认的 ATOM / ATOM 2 协议差异将一起切换。',
    'profile.switched': '无人机协议已切换到 {model}', 'profile.failed': '协议切换失败：{error}',
    'telemetry.battery': '电量', 'telemetry.altitude': '高度', 'telemetry.horizontalSpeed': '水平速度', 'telemetry.verticalSpeed': '垂直速度',
    'telemetry.horizontalDistance': '水平距离', 'telemetry.satellites': '卫星', 'telemetry.heading': '航向', 'telemetry.pitch': '俯仰',
    'telemetry.roll': '横滚', 'telemetry.controllerVoltage': '遥控器电压',
    'actions.flight': '飞行动作', 'actions.takeoff': '起飞', 'actions.land': '降落', 'actions.rth': '返航', 'actions.emergency': '紧急停止',
    'actions.camera': '相机与视频控制', 'actions.photo': '拍照', 'actions.record': '录像切换', 'actions.keyframe': '请求关键帧 (IDR)',
    'actions.liveview': '初始化 LiveView 参数',
    'video.waitingTitle': '等待无人机视频流', 'video.waitingDesc': '当前使用前端 USB 直通模式。如果飞行器已开机并完成配对，请激活视频流以发送初始化序列。',
    'video.usbPassthrough': 'USB 直通通道 (WebSocket)：', 'video.androidUsb': 'Android USB 附件：', 'video.rxLink': '遥控器 / 飞行器 RX 链路：',
    'video.videoExtraction': '0x06 视频帧提取：', 'video.feTraffic': 'FE RX 流量：', 'video.parser': '视频解析器：',
    'video.webcodecs': '浏览器硬件解码支持 (WebCodecs)：', 'video.decoder': '解码器状态：', 'video.open': '已打开', 'video.closed': '已关闭',
    'video.waitingRx': '等待 RX', 'video.rxConfirmed': '已连接（RX 已确认）', 'video.frames': '帧', 'video.decoded': '已解码', 'video.dropped': '丢弃',
    'video.activate': '激活视频流', 'video.switchMode': '切换模式', 'video.current': '当前', 'video.live': '实时画面', 'video.waiting': '等待视频流',
    'video.render': '渲染', 'video.hwDecode': '硬件解码', 'video.stream': '视频流', 'video.requestIFrame': '请求 I 帧', 'video.fullscreen': '全屏',
    'video.fullscreenTitle': '全屏查看视频', 'video.battery': '电量',
    'engineering.camera': '相机控制台', 'engineering.fpv': '视频与射频', 'engineering.sensor': '传感器与校准', 'engineering.rid': '远程识别与系统',
    'engineering.relay': '远程 / 中继', 'engineering.frontend': '前端', 'engineering.backend': '后端', 'engineering.hardwareTelemetry': '硬件遥测', 'engineering.waitingData': '等待数据',
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
