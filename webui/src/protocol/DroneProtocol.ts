/**
 * Potensic Atom 2 Drone Protocol Constants
 */

export const FE_TYPES: Record<number, string> = {
  0x05: 'Camera Response (相机响应)',
  0x06: 'H.265 Video Stream (视频图传流)',
  0x12: 'AOA Handshake (AOA握手包)',
  0x14: 'Flight / Heartbeat TX (飞行控制/心跳包)',
  0x15: 'Camera Command TX (相机控制指令)',
  0x16: 'FPV / RF Command TX (图传射频设置通道)',
  0x17: 'Remoter Command TX (遥控器配置通道)',
  0x21: 'Flight Telemetry RX (飞行遥测 FlightRevGps)',
  0x31: 'Flight Cmd Response RX (飞控指令应答)',
  0x32: 'GPS Data RX (GPS数据)',
  0x41: 'Remoter Status RX (遥控器状态/按键/摇杆)'
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
  FPV_SYNC_VERSION: 5632,       // 0x1600 同步图传版本
  FPV_START_SCAN: 5633,         // 0x1601 开始扫频
  FPV_STOP_SCAN: 5634,          // 0x1602 停止扫频
  FPV_START_PAIR: 5635,         // 0x1603 开始对频
  FPV_WIRELESS_DEBUG_START: 5636, // 0x1604 开始无线调试
  FPV_WIRELESS_DEBUG_STOP: 5637,  // 0x1605 停止无线调试
  FPV_SET_FACTORY_FLY: 5640,    // 0x1608 设置工厂飞行模式
  FPV_GET_FACTORY_FLY: 5641,    // 0x1609 获取工厂飞行模式
  FPV_ENTER_RF_TEST: 5642,      // 0x160A 设置进入射频测试
  FPV_SET_SUPPORT_BANDS: 5643,  // 0x160B 设置图传支持频段
  FPV_RC_RF_CONFIG: 5649,       // 0x1611 遥控器射频测试模式配置
  FPV_RF_RESET: 5650,           // 0x1612 射频复位重启 (ASCII "reset\n")
  FPV_SET_WORK_BAND: 5651,      // 0x1613 设置图传工作频段
  FPV_SET_BANDWIDTH: 5652,      // 0x1614 设置无线图传工作频宽
  FPV_PROBE_STREAM: 5656,       // 0x1618 获取频段探测调试参数流开关
  RF_PROBE: 5656,               // 0x1618 获取频段探测调试参数流开关 (Alias)
  FPV_ALLOW_ALL_FREQS: 5658,    // 0x161A 设置图传允许使用所有子频段 (全频段解锁)
  FPV_CUSTOM_DEBUG: 5696,       // 0x1640 图传自定义命令调试 (HEX字节发送)
  FPV_CONNECT_STATE: 5909,      // 0x1715 链路与对频全量状态上报 (FpvRevConnectState)
  FPV_SCAN_FREQ: 5910,          // 0x1716 频段扫描底噪柱状图数据
  FPV_DEBUG_PARAMS: 5911,       // 0x1717 底层无线调试遥测 (SNR/丢包率/重传率)
  FPV_REALTIME_REPORT: 5913,    // 0x1719 射频实时工作参数上报

  // Remoter Commands (l95 / i95)
  RC_CONTROL_STREAM: 0x1130,    // 4400 遥控器四轴摇杆与按键控制流
  RC_CALIBRATION_STATE: 0x1131, // 4401 遥控器校准回显与电压
  RC_BATTERY_STATUS: 0x1133,    // 4403 遥控器电量与充电状态

  // Flight Telemetry Commands (pz1 / ny1)
  FLIGHT_ATTITUDE: 0x0201,      // 513 姿态角度 (Pitch/Roll/Yaw)
  FLIGHT_BATTERY: 0x0204,       // 516 动力电池电芯分压与温度
  FLIGHT_FAULT: 0x0206          // 518 飞控故障与告警码
}

export const CAMERA_CMDS = {
  GET_ALL_PARAMS: 0x01,       // 1 (0x01): 获取全部参数
  CAMERA_FUNCTION: 0x16,      // 22 (0x16): 设置相机功能开关 (Preview / H265 / Watermark)
  GET_CAMERA_FUNCTION: 0x15,  // 21 (0x15): 获取相机功能开关
  TAKE_PHOTO: 0x51,
  TOGGLE_RECORD: 0x50,
  REQUEST_IDR: 0xD9,
  LIVEVIEW_PARAMS: 0xD8,
  WIFI_SWITCH: 0xD2,
  LIVEVIEW_START: 0x73,       // 115 (0x73): 启动图传 (LiveView Start, data = [0x00, 0x64])

  // Camera Engineering / Debug SubCommands (a30)
  DEBUG_TERMINAL: 0x6F,       // 111 (0x6F): 交互式相机终端命令与回显 (f10)
  REMOTE_ID_CONFIG: 0x73,     // 115 (0x73): 读取/设置 Remote ID 配置
  DPC_CALIBRATION: 0x6E,      // 110 (0x6E): 相机坏点检测 (亮场/暗场 DPC)
  FPN_CALIBRATION: 0x74,      // 116 (0x74): 相机 FPN 噪声消除标定
  COUNTRY_WIFI_CONFIG: 0xEB,  // 235 (0xEB): 设置国家码和 WiFi 信道
  TEMPERATURE_REPORT: 0xF0,   // 240 (0xF0): 芯片温度遥测上报 (h00)
  SFR_CHECK_REGION: 0x76,     // 118: SFR 检测模式
  SFR_CHECK_RESULT: 0x77      // 119: SFR 检测结果
}

