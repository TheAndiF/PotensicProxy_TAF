/**
 * Potensic Atom 2 Drone Protocol Constants
 */

export const FE_TYPES: Record<number, string> = {
  0x05: 'Camera Response (camera response)',
  0x06: 'H.265 Video Stream (video stream)',
  0x12: 'AOA Handshake (AOA handshake packet)',
  0x14: 'Flight / Heartbeat TX (flight control/Heartbeat)',
  0x15: 'Camera Command TX (camera control command)',
  0x16: 'FPV / RF Command TX (video/RF settings channel)',
  0x17: 'Remoter Command TX (controller configuration channel)',
  0x21: 'Flight Telemetry RX (Flight Telemetry FlightRevGps)',
  0x31: 'Flight Cmd Response RX (Flight Controlresponse)',
  0x32: 'GPS Data RX (GPS data)',
  0x41: 'Remoter Status RX (Controller Status/buttons/sticks)'
}

export const PROTOCOL_HEX = {
  HANDSHAKE: 'fe00000000000012000000000000000100',
  HEARTBEAT: 'fe00000000000014000000000000000afffd060000030000000500'
}

export const CMD_SHORTS = {
  CAMERA: 0x1200,          // 4608
  FLIGHT: 0x0301,          // 769
  HEARTBEAT: 0x0300,       // 768
  TELEMETRY_GPS: 0x0200,   // 512
  GIMBAL_CONTROL: 0x0801,  // 2049

  // FPV & RF Debugging Commands (a52)
  FPV_SYNC_VERSION: 5632,       // 0x1600 sync video-link version
  FPV_START_SCAN: 5633,         // 0x1601 start frequency scan
  FPV_STOP_SCAN: 5634,          // 0x1602 stop frequency scan
  FPV_START_PAIR: 5635,         // 0x1603 start pairing
  FPV_WIRELESS_DEBUG_START: 5636, // 0x1604 start wireless debug
  FPV_WIRELESS_DEBUG_STOP: 5637,  // 0x1605 stop wireless debug
  FPV_SET_FACTORY_FLY: 5640,    // 0x1608 set factory flight mode
  FPV_GET_FACTORY_FLY: 5641,    // 0x1609 get factory flight mode
  FPV_ENTER_RF_TEST: 5642,      // 0x160A enter RF test mode
  FPV_SET_SUPPORT_BANDS: 5643,  // 0x160B set supported video-link bands
  FPV_RC_RF_CONFIG: 5649,       // 0x1611 controller RF test-mode config
  FPV_RF_RESET: 5650,           // 0x1612 RF reset/restart (ASCII "reset\n")
  FPV_SET_WORK_BAND: 5651,      // 0x1613 set video-link working band
  FPV_SET_BANDWIDTH: 5652,      // 0x1614 set wireless video bandwidth
  FPV_PROBE_STREAM: 5656,       // 0x1618 get band-probe debug stream switch
  RF_PROBE: 5656,               // 0x1618 get band-probe debug stream switch (Alias)
  FPV_ALLOW_ALL_FREQS: 5658,    // 0x161A allow all video-link sub-bands (All-band unlock)
  FPV_CUSTOM_DEBUG: 5696,       // 0x1640 custom video-link debug command (HEX byte send)
  FPV_CONNECT_STATE: 5909,      // 0x1715 full link/pairing status report (FpvRevConnectState)
  FPV_SCAN_FREQ: 5910,          // 0x1716 band-scan noise histogram data
  FPV_DEBUG_PARAMS: 5911,       // 0x1717 low-level wireless debug telemetry (SNR/packet loss/retry rate)
  FPV_REALTIME_REPORT: 5913,    // 0x1719 real-time RF parameter report

  // Remoter Commands (l95 / i95)
  RC_CONTROL_STREAM: 0x1130,    // 4400 controller 4-axis stick/button control stream
  RC_CALIBRATION_STATE: 0x1131, // 4401 controller calibration feedback and voltage
  RC_BATTERY_STATUS: 0x1133,    // 4403 controller battery/charging state

  // Flight Telemetry Commands (pz1 / ny1)
  FLIGHT_ATTITUDE: 0x0201,      // 513 attitude angles (Pitch/Roll/Yaw)
  FLIGHT_BATTERY: 0x0204,       // 516 flight-battery cell voltages and temperature
  FLIGHT_FAULT: 0x0206          // 518 flight-controller faults and alert codes
}


export const CAMERA_USB = {
  INNER_FUNCTION: 0x0020,
  TX_HEADER_0: 0xff,
  TX_HEADER_1: 0xfd,
  RX_HEADER_0: 0xff,
  RX_HEADER_1: 0xfe,
  TAKE_PHOTO: 0x01,
  RECORD: 0x00,
  MODE: 0x03,
  FILE_COUNT: 0x18,
  FILE_LIST: 0x19,
  FILE_INFO: 0x1a,
  FILE_DOWNLOAD: 0x1b,
  THUMBNAIL_DOWNLOAD: 0x1c,
  FILE_DELETE: 0x1d,
  FILE_DOWNLOAD_CANCEL: 0x1e,
  THUMBNAIL_CANCEL: 0x1f,
  FILE_META_LIST: 0x20,
  ENTER_GALLERY: 0x21,
  QUIT_GALLERY: 0x22
} as const

export const CAMERA_CMDS = {
  GET_ALL_PARAMS: 0x01,       // 1 (0x01): get all parameters
  CAMERA_FUNCTION: 0x16,      // 22 (0x16): set camera feature flags (Preview / H265 / Watermark)
  GET_CAMERA_FUNCTION: 0x15,  // 21 (0x15): get camera feature flags
  TAKE_PHOTO: 0x51,
  TOGGLE_RECORD: 0x50,
  REQUEST_IDR: 0xD9,
  LIVEVIEW_PARAMS: 0xD8,
  WIFI_SWITCH: 0xD2,
  LIVEVIEW_START: 0x73,       // 115 (0x73): start video link (LiveView Start, data = [0x00, 0x64])

  // Camera Engineering / Debug SubCommands (a30)
  DEBUG_TERMINAL: 0x6F,       // 111 (0x6F): interactive camera terminal command/echo (f10)
  REMOTE_ID_CONFIG: 0x73,     // 115 (0x73): read/set Remote ID config
  DPC_CALIBRATION: 0x6E,      // 110 (0x6E): camera defective-pixel detection (bright/dark DPC)
  FPN_CALIBRATION: 0x74,      // 116 (0x74): camera FPN noise calibration
  COUNTRY_WIFI_CONFIG: 0xEB,  // 235 (0xEB): set country code and Wi-Fi channel
  TEMPERATURE_REPORT: 0xF0,   // 240 (0xF0): chip temperature telemetry report (h00)
  SFR_CHECK_REGION: 0x76,     // 118: SFR check mode
  SFR_CHECK_RESULT: 0x77      // 119: SFR check result
}


