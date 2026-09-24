<template>
  <div class="debug-console-container">
    <!-- Sub-navigation Header -->
    <div class="debug-header">
      <div class="tab-selectors">
        <el-radio-group v-model="debugStore.activeSubTab" size="small">
          <el-radio-button value="camera">📷 相机交互终端</el-radio-button>
          <el-radio-button value="fpv">📶 图传与射频底层</el-radio-button>
          <el-radio-button value="sensor">⚖️ 传感器与标定</el-radio-button>
          <el-radio-button value="rid">📡 远程识别与系统</el-radio-button>
        </el-radio-group>
      </div>

      <div class="header-right-badges">
        <el-tag size="small" effect="dark" type="info" class="badge-item">
          硬件芯片遥测: {{ debugStore.temperatures.lastUpdated || '等待上报' }}
        </el-tag>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="debug-body">
      <!-- ================= Sub-tab 1: 相机命令行终端 ================= -->
      <div v-show="debugStore.activeSubTab === 'camera'" class="sub-tab-pane camera-pane">
        <!-- Chip Temperatures Bar -->
        <div class="temp-cards-bar">
          <div class="temp-card">
            <div class="temp-title">SoC 核心温度</div>
            <div class="temp-val" :class="getTempClass(debugStore.temperatures.socTemp)">
              {{ debugStore.temperatures.socTemp !== null ? debugStore.temperatures.socTemp + ' °C' : '--' }}
            </div>
            <div class="temp-sub">FE 0x15 -> 0x1200 / 0xF0</div>
          </div>

          <div class="temp-card">
            <div class="temp-title">Sensor 传感器温度</div>
            <div class="temp-val" :class="getTempClass(debugStore.temperatures.sensorTemp)">
              {{ debugStore.temperatures.sensorTemp !== null ? debugStore.temperatures.sensorTemp + ' °C' : '--' }}
            </div>
            <div class="temp-sub">CMOS 感光芯片</div>
          </div>

          <div class="temp-card">
            <div class="temp-title">ISP 970 芯片温度</div>
            <div class="temp-val" :class="getTempClass(debugStore.temperatures.isp970Temp)">
              {{ debugStore.temperatures.isp970Temp !== null ? debugStore.temperatures.isp970Temp + ' °C' : '--' }}
            </div>
            <div class="temp-sub">图像处理核心</div>
          </div>

          <div class="temp-card status-card">
            <div class="temp-title">终端协议状态</div>
            <div class="temp-status-text">
              <span class="dot-online"></span> 透传通道就绪 (0x1200 / 0x6F)
            </div>
            <div class="temp-sub">条目数: {{ debugStore.terminalLogs.length }}</div>
          </div>
        </div>

        <!-- Terminal Log Box -->
        <div class="terminal-container">
          <div class="terminal-header">
            <div class="term-title">
              <span class="term-icon">⚡</span>
              <span>相机命令行透传交互 (CamRevTestDebugInfo / 0x6F)</span>
            </div>
            <div class="term-tools">
              <el-checkbox v-model="autoScroll" size="small" label="自动滚屏" />
              <el-button size="small" type="danger" plain @click="debugStore.clearTerminalLogs">
                清空终端
              </el-button>
            </div>
          </div>

          <div ref="terminalBodyRef" class="terminal-body">
            <div v-if="debugStore.terminalLogs.length === 0" class="terminal-empty">
              > 等待相机终端日志输出... 可在下方选择常用指令或输入自定义指令进行交互测试。
            </div>
            <div
              v-for="log in debugStore.terminalLogs"
              :key="log.id"
              class="terminal-line"
              :class="log.dir === 'TX' ? 'line-tx' : 'line-rx'"
            >
              <span class="line-time">[{{ log.time }}]</span>
              <span class="line-dir">[{{ log.dir }}]</span>
              <span class="line-opcode">(Op: 0x{{ log.opcode.toString(16).padStart(2, '0') }})</span>
              <span class="line-text">{{ log.text }}</span>
              <span v-if="log.hex" class="line-hex" :title="log.hex">[HEX]</span>
            </div>
          </div>

          <!-- Command Input Toolbar -->
          <div class="terminal-input-bar">
            <div class="opcode-select">
              <span class="input-label">OpCode:</span>
              <el-input-number
                v-model="cameraOpcode"
                :min="0"
                :max="255"
                size="small"
                controls-position="right"
                style="width: 90px;"
              />
            </div>

            <el-input
              v-model="cameraCmdText"
              size="small"
              placeholder="输入相机调试指令 (例: get_version, status, sensor_info, reboot, idr_request)..."
              class="cmd-input"
              @keydown.enter="sendCameraCmd"
            />

            <el-button size="small" type="primary" @click="sendCameraCmd">
              发送指令 (TX)
            </el-button>
          </div>

          <!-- Quick Command Preset Chips -->
          <div class="terminal-presets">
            <span class="presets-label">快捷调试指令:</span>
            <el-button
              v-for="p in cameraPresets"
              :key="p.cmd"
              size="small"
              round
              plain
              class="preset-btn"
              @click="applyAndSendCameraCmd(p.opcode, p.cmd)"
            >
              {{ p.label }} ({{ p.cmd }})
            </el-button>
          </div>
        </div>
      </div>

      <!-- ================= Sub-tab 2: 图传与射频底层 ================= -->
      <div v-show="debugStore.activeSubTab === 'fpv'" class="sub-tab-pane fpv-pane">
        <!-- Left: Quick RF Actions -->
        <div class="fpv-controls-col">
          <div class="panel-box">
            <div class="box-title">📶 射频底层调试指令</div>

            <!-- RF All Bands Unlock -->
            <div class="action-card highlight-card">
              <div class="act-header">
                <span class="act-name">全频段强制解锁 (CMD 5658 / 0x161A)</span>
                <el-tag size="small" type="danger" effect="dark">解除锁频</el-tag>
              </div>
              <p class="act-desc">
                下发内层 5658 协议帧，强制打开全频段支持（解除国内/国外频段信道屏蔽与功率限制）。
              </p>
              <el-button type="warning" size="small" @click="onAllowAllFrequencies">
                🔓 发送全频段强制解锁 (5658)
              </el-button>
            </div>

            <!-- RF Hardware Reset -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">射频芯片硬件复位 (CMD 5650 / 0x1612)</span>
                <el-tag size="small" type="info" effect="dark">reset\n</el-tag>
              </div>
              <p class="act-desc">
                向射频基带写入 "reset\n" ASCII 控制字符，触发射频前端硬件热重启。
              </p>
              <el-button type="danger" plain size="small" @click="onResetRf">
                🔄 射频硬件复位 (5650)
              </el-button>
            </div>

            <!-- Factory Flight Mode -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">工厂特权飞行模式 (CMD 5640 / 0x1608)</span>
                <el-switch
                  v-model="debugStore.fpvSettings.factoryFlyMode"
                  size="small"
                  active-text="开启"
                  inactive-text="关闭"
                  @change="onToggleFactoryFly"
                />
              </div>
              <p class="act-desc">
                切换工厂内部测试飞行模式，绕过部分传感器准备校验与限飞逻辑。
              </p>
            </div>

            <!-- Bandwidth Settings -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">图传信道频宽切换 (CMD 5652 / 0x1614)</span>
              </div>
              <div class="bandwidth-row">
                <el-radio-group v-model="debugStore.fpvSettings.bandwidthMhz" size="small">
                  <el-radio-button :value="10">10 MHz</el-radio-button>
                  <el-radio-button :value="20">20 MHz</el-radio-button>
                  <el-radio-button :value="40">40 MHz</el-radio-button>
                </el-radio-group>
                <el-button size="small" type="primary" plain @click="onApplyBandwidth">
                  设置频宽
                </el-button>
              </div>
            </div>

            <!-- RF Real-time Probe Toggle -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">实时射频频谱遥测流 (CMD 5656 / 5913)</span>
                <el-button
                  size="small"
                  :type="debugStore.fpvSettings.rfProbeActive ? 'danger' : 'success'"
                  plain
                  @click="onToggleRfProbe"
                >
                  {{ debugStore.fpvSettings.rfProbeActive ? '停止频谱采集' : '开启频谱采集 (5656)' }}
                </el-button>
              </div>
              <p class="act-desc">
                启动基带实时信道扫描与噪声探测，上报 5913 实时工作参数。
              </p>
            </div>
          </div>

          <!-- FPV Custom Hex Injection -->
          <div class="panel-box">
            <div class="box-title">🔧 FPV 自定义 HEX 注入 (CMD 5696 / 0x1640)</div>
            <div class="custom-hex-wrap">
              <el-input
                v-model="fpvCustomHex"
                type="textarea"
                :rows="2"
                placeholder="输入 FPV 自定义 16 进制报文载荷，例如: 01020304..."
                style="font-family: var(--mono); font-size: 11px;"
              />
              <div class="hex-actions">
                <el-button size="small" type="primary" @click="onSendFpvHex">
                  下发 HEX 指令
                </el-button>
                <el-button size="small" plain @click="fpvCustomHex = '01'">预设: 01</el-button>
                <el-button size="small" plain @click="fpvCustomHex = '00'">预设: 00</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: RF Live Spectrum & Parameters (5913) & Link State (5909) -->
        <div class="fpv-monitor-col">
          <!-- RF Link & Pairing State (CMD 5909 / FpvRevConnectState) -->
          <div class="panel-box link-state-box">
            <div class="box-title-row">
              <span class="box-title">🔗 遥控器与图传链路状态 (CMD 5909 / FpvRevConnectState)</span>
              <span class="update-time">更新: {{ debugStore.linkState.lastUpdated || '无数据上报' }}</span>
            </div>

            <div class="link-state-grid">
              <div class="link-card-item">
                <div class="lc-label">无线图传连线</div>
                <div class="lc-val" :class="debugStore.linkState.wirelessConnected ? 'status-ok' : 'status-bad'">
                  {{ debugStore.linkState.wirelessConnected ? '已连接 (ONLINE)' : '未连接 (DISCONNECTED)' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">飞控通信链路</div>
                <div class="lc-val" :class="debugStore.linkState.flightConnected ? 'status-ok' : 'status-bad'">
                  {{ debugStore.linkState.flightConnected ? '已连通' : '未建立连接' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">遥控器 USB 通道</div>
                <div class="lc-val" :class="debugStore.linkState.remoterConnected ? 'status-ok' : 'status-bad'">
                  {{ debugStore.linkState.remoterConnected ? '握手就绪' : '未就绪' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">对频状态</div>
                <div class="lc-val" :class="debugStore.linkState.isPairing ? 'status-warn' : 'status-ok'">
                  {{ debugStore.linkState.isPairing ? '对频中 (PAIRING)' : '非对频状态' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">当前信道频点</div>
                <div class="lc-val highlight-cyan">
                  {{ debugStore.linkState.rfChannelMhz ? debugStore.linkState.rfChannelMhz + ' MHz' : '--' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">信道干扰电平</div>
                <div class="lc-val" :class="getInterferenceClass(debugStore.linkState.interference)">
                  {{ debugStore.linkState.interference !== null ? debugStore.linkState.interference + (debugStore.linkState.interference < 85 ? ' (强干扰)' : ' (良好)') : '--' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">速率 / MCS</div>
                <div class="lc-val highlight-blue">
                  MCS {{ debugStore.linkState.mcs !== null ? debugStore.linkState.mcs : '--' }}
                  <span v-if="debugStore.linkState.txMcs !== null" class="sub-mcs">
                    (TX:{{ debugStore.linkState.txMcs }} / RX:{{ debugStore.linkState.rxMcs }})
                  </span>
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">跳频与功率自适应</div>
                <div class="lc-val">
                  跳频: {{ debugStore.linkState.isHopSupport ? '开' : '关' }} / 自适应: {{ debugStore.linkState.powerAdaptive ? '开' : '关' }}
                </div>
              </div>
            </div>
          </div>

          <div class="panel-box spectrum-box">
            <div class="box-title-row">
              <span class="box-title">📊 射频实时工作参数与信道频谱 (CMD 5913 / 0x1719)</span>
              <span class="update-time">更新: {{ debugStore.rfStats.lastUpdated || '无数据上报' }}</span>
            </div>

            <!-- RF Metrics Grid -->
            <div class="rf-metrics-grid">
              <div class="rf-metric-item">
                <div class="m-label">遥控端增益 (RC Gain)</div>
                <div class="m-value">
                  A: <span class="num">{{ debugStore.rfStats.rcGainA }}</span> dB /
                  B: <span class="num">{{ debugStore.rfStats.rcGainB }}</span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">遥控端信噪比 (RC SNR)</div>
                <div class="m-value">
                  <span class="num" :class="getSnrClass(debugStore.rfStats.rcSnr)">
                    {{ debugStore.rfStats.rcSnr }}
                  </span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">飞控端增益 (FC Gain)</div>
                <div class="m-value">
                  A: <span class="num">{{ debugStore.rfStats.fcGainA }}</span> dB /
                  B: <span class="num">{{ debugStore.rfStats.fcGainB }}</span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">飞控端信噪比 (FC SNR)</div>
                <div class="m-value">
                  <span class="num" :class="getSnrClass(debugStore.rfStats.fcSnr)">
                    {{ debugStore.rfStats.fcSnr }}
                  </span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">物理层速率 (MCS)</div>
                <div class="m-value">
                  MCS <span class="num highlight">{{ debugStore.rfStats.mcs }}</span>
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">扫描信道总数</div>
                <div class="m-value">
                  <span class="num">{{ debugStore.rfStats.channels.length }}</span> 个信道
                </div>
              </div>
            </div>

            <!-- Spectrum Bar Chart -->
            <div class="spectrum-chart-wrap">
              <div class="chart-header">
                <span>信道实时噪声 / 干扰电平分布</span>
                <span class="legend">绿色=低干扰 / 黄色=中等 / 红色=拥堵</span>
              </div>

              <div v-if="debugStore.rfStats.channels.length === 0" class="spectrum-empty">
                <span>暂未接收到 5913 射频工作参数帧。可点击左侧「开启频谱采集 (5656)」启动主动探测。</span>
              </div>

              <div v-else class="spectrum-bars">
                <div
                  v-for="ch in debugStore.rfStats.channels"
                  :key="ch.channelIndex"
                  class="spectrum-bar-item"
                >
                  <div class="bar-snr-tag">{{ ch.snr }}dB</div>
                  <div class="bar-outer">
                    <div
                      class="bar-inner"
                      :style="{ height: `${Math.min(100, Math.max(8, ch.noiseLevel))}%` }"
                      :class="getNoiseBarClass(ch.noiseLevel)"
                    ></div>
                  </div>
                  <div class="bar-ch-num">CH{{ ch.channelIndex }}</div>
                  <div class="bar-freq">{{ ch.frequencyMhz }}M</div>
                </div>
              </div>
            </div>

            <!-- FPV Log History -->
            <div class="fpv-log-list">
              <div class="log-list-title">FPV 自定义报文交互历史 (最近 200 条)</div>
              <div class="fpv-log-body">
                <div v-if="debugStore.fpvLogs.length === 0" class="log-empty">
                  无 FPV 指令交互记录
                </div>
                <div
                  v-for="fl in debugStore.fpvLogs"
                  :key="fl.id"
                  class="fpv-log-item"
                  :class="fl.dir === 'TX' ? 'tx-color' : 'rx-color'"
                >
                  <span class="fpv-log-time">[{{ fl.time }}]</span>
                  <span class="fpv-log-dir">[{{ fl.dir }}]</span>
                  <span class="fpv-log-hex">{{ fl.hex }}</span>
                  <span v-if="fl.description" class="fpv-log-desc">({{ fl.description }})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= Sub-tab 3: 传感器与标定 ================= -->
      <div v-show="debugStore.activeSubTab === 'sensor'" class="sub-tab-pane sensor-pane">
        <!-- IMU 6-Axis Calibration Card -->
        <div class="panel-box">
          <div class="box-title-row">
            <span class="box-title">⚖️ IMU 传感器六面标定 (0x0301 / CMD 23)</span>
            <el-tag
              :type="debugStore.imuCal.isCalibrating ? 'warning' : 'info'"
              effect="dark"
              size="small"
            >
              状态: {{ debugStore.imuCal.text }}
            </el-tag>
          </div>

          <p class="cal-desc">
            IMU 标定需在水平桌面或按指引依次将飞行器的 6 个面平稳放置静止。
          </p>

          <div class="cal-actions-bar">
            <el-button
              type="primary"
              size="small"
              :disabled="debugStore.imuCal.isCalibrating"
              @click="onStartImuCal"
            >
              🚀 启动 IMU 六面校准 (Action=3)
            </el-button>

            <el-button
              type="danger"
              size="small"
              plain
              :disabled="!debugStore.imuCal.isCalibrating"
              @click="onStopImuCal"
            >
              ⏹️ 终止校准 (Action=2)
            </el-button>
          </div>

          <!-- 6-Faces Status Grid -->
          <div class="faces-grid">
            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.top }">
              <div class="face-name">1. 顶面朝上 (Top)</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.top ? '✓ 已完成' : '○ 待放置' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.bottom }">
              <div class="face-name">2. 底面朝上 (Bottom)</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.bottom ? '✓ 已完成' : '○ 待放置' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.left }">
              <div class="face-name">3. 左侧朝上 (Left)</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.left ? '✓ 已完成' : '○ 待放置' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.right }">
              <div class="face-name">4. 右侧朝上 (Right)</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.right ? '✓ 已完成' : '○ 待放置' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.front }">
              <div class="face-name">5. 机头朝上 (Front)</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.front ? '✓ 已完成' : '○ 待放置' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.back }">
              <div class="face-name">6. 机尾朝上 (Back)</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.back ? '✓ 已完成' : '○ 待放置' }}</div>
            </div>
          </div>

          <!-- Raw Vectors Display -->
          <div class="vectors-row">
            <div class="vector-item">
              <span class="v-name">加速度计 (Acc):</span>
              <span class="v-val">X: {{ debugStore.imuCal.acc.x.toFixed(3) }}</span>
              <span class="v-val">Y: {{ debugStore.imuCal.acc.y.toFixed(3) }}</span>
              <span class="v-val">Z: {{ debugStore.imuCal.acc.z.toFixed(3) }}</span>
            </div>
            <div class="vector-item">
              <span class="v-name">陀螺仪 (Gyro):</span>
              <span class="v-val">X: {{ debugStore.imuCal.gyro.x.toFixed(3) }}</span>
              <span class="v-val">Y: {{ debugStore.imuCal.gyro.y.toFixed(3) }}</span>
              <span class="v-val">Z: {{ debugStore.imuCal.gyro.z.toFixed(3) }}</span>
            </div>
          </div>
        </div>

        <!-- Gimbal & Camera Sensors Calibration -->
        <div class="sub-row-two-col">
          <!-- Gimbal Reset -->
          <div class="panel-box">
            <div class="box-title">🎥 云台姿态与标定管理 (0x0801 / 5)</div>
            <p class="cal-desc">
              向三轴无刷云台下发清除 IMU 标定数据指令，用于解决云台倾斜、偏航零点飘移问题。
            </p>
            <el-popconfirm
              title="确定要清除云台 IMU 标定数据吗？"
              confirm-button-text="确定清除"
              cancel-button-text="取消"
              @confirm="onClearGimbalImu"
            >
              <template #reference>
                <el-button type="danger" size="small">
                  🧹 清除云台 IMU 标定 (0x0801)
                </el-button>
              </template>
            </el-popconfirm>
          </div>

          <!-- Camera Optical Sensor Calibration -->
          <div class="panel-box">
            <div class="box-title">📷 相机传感器坏点与噪声校准 (0x1200)</div>
            <p class="cal-desc">
              CMOS 感光元件出厂与后期坏点校正 (DPC) 及固定模式噪声 (FPN) 消除。
            </p>
            <div class="cam-cal-buttons">
              <el-button-group size="small">
                <el-button type="info" plain @click="onStartDpc(true, 0)">暗场 DPC 步0</el-button>
                <el-button type="info" plain @click="onStartDpc(true, 1)">暗场 DPC 步1</el-button>
                <el-button type="info" plain @click="onStartDpc(true, 2)">暗场 DPC 步2</el-button>
              </el-button-group>

              <el-button-group size="small">
                <el-button type="primary" plain @click="onStartDpc(false, 0)">亮场 DPC 步0</el-button>
                <el-button type="primary" plain @click="onStartDpc(false, 1)">亮场 DPC 步1</el-button>
              </el-button-group>

              <el-button size="small" type="warning" plain @click="onStartFpn">
                FPN 噪声校准 (0x74)
              </el-button>
            </div>
          </div>
        </div>

        <!-- GNSS & Satellite Debug -->
        <div class="panel-box">
          <div class="box-title">🛰️ GNSS 卫星定位系统调试 (0x0301)</div>
          <div class="gnss-toggles">
            <div class="toggle-item">
              <span class="t-label">GPS 测试模式 (Subcmd 23):</span>
              <el-switch
                v-model="gpsTestEnabled"
                size="small"
                active-text="开启"
                inactive-text="关闭"
                @change="onToggleGpsTest"
              />
            </div>

            <div class="toggle-item">
              <span class="t-label">北斗卫星系统使能 (Subcmd 24):</span>
              <el-switch
                v-model="beidouEnabled"
                size="small"
                active-text="开启"
                inactive-text="关闭"
                @change="onToggleBeidou"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ================= Sub-tab 4: 远程识别与系统 ================= -->
      <div v-show="debugStore.activeSubTab === 'rid'" class="sub-tab-pane rid-pane">
        <div class="panel-box">
          <div class="box-title-row">
            <span class="box-title">📡 无人机远程识别 (Remote ID / RID) 状态</span>
            <el-button size="small" type="primary" plain @click="onQueryRemoteId">
              🔍 查询 Remote ID 参数 (0x73)
            </el-button>
          </div>

          <div class="rid-cards-grid">
            <div class="rid-item">
              <div class="rid-label">国家代码 (Country Code)</div>
              <div class="rid-value">{{ debugStore.remoteId.countryCode }}</div>
            </div>

            <div class="rid-item">
              <div class="rid-label">无人机唯一序列识别码 (UAS ID)</div>
              <div class="rid-value mono">{{ debugStore.remoteId.uasId }}</div>
            </div>

            <div class="rid-item">
              <div class="rid-label">RID 广播运行状态</div>
              <div class="rid-value">
                <el-tag size="small" type="success" effect="dark">{{ debugStore.remoteId.status }}</el-tag>
              </div>
            </div>

            <div class="rid-item">
              <div class="rid-label">绑定的飞机主板 SN</div>
              <div class="rid-value mono">{{ debugStore.boundDroneSn }}</div>
            </div>
          </div>

          <div v-if="debugStore.remoteId.rawHex" class="rid-raw-hex">
            <div class="raw-title">原始 0x73 协议响应 HEX:</div>
            <div class="raw-box">{{ debugStore.remoteId.rawHex }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useDebugStore } from '../../stores/useDebugStore'
import { DroneControlService } from '../../services/DroneControlService'
import { ElMessage } from 'element-plus'

const debugStore = useDebugStore()

// --- Camera Terminal State ---
const autoScroll = ref(true)
const cameraOpcode = ref(0)
const cameraCmdText = ref('')
const terminalBodyRef = ref<HTMLDivElement | null>(null)

const cameraPresets = [
  { label: '查询固件版本', opcode: 0, cmd: 'get_version' },
  { label: '查询工作状态', opcode: 0, cmd: 'status' },
  { label: 'CMOS 传感器信息', opcode: 0, cmd: 'sensor_info' },
  { label: '关键帧请求 (IDR)', opcode: 0, cmd: 'idr_request' },
  { label: '重启相机核心', opcode: 0, cmd: 'reboot' },
  { label: '查询相机 SN', opcode: 0, cmd: 'get_sn' },
  { label: '终端帮助命令', opcode: 0, cmd: 'help' }
]

function sendCameraCmd() {
  const text = cameraCmdText.value.trim()
  if (!text) {
    ElMessage.warning('请输入调试命令')
    return
  }
  DroneControlService.sendCameraTerminal(cameraOpcode.value, text)
  debugStore.addTerminalLog('TX', cameraOpcode.value, text)
  cameraCmdText.value = ''
  scrollToBottom()
}

function applyAndSendCameraCmd(opcode: number, cmd: string) {
  cameraOpcode.value = opcode
  cameraCmdText.value = cmd
  sendCameraCmd()
}

function scrollToBottom() {
  if (autoScroll.value) {
    nextTick(() => {
      if (terminalBodyRef.value) {
        terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight
      }
    })
  }
}

watch(
  () => debugStore.terminalLogs.length,
  () => {
    scrollToBottom()
  }
)

function getTempClass(temp: number | null) {
  if (temp === null) return ''
  if (temp >= 80) return 'temp-danger'
  if (temp >= 65) return 'temp-warn'
  return 'temp-good'
}

// --- FPV / RF State ---
const fpvCustomHex = ref('')

function onAllowAllFrequencies() {
  DroneControlService.allowAllRfFrequencies()
  ElMessage.success('全频段解锁指令 (5658) 已发送')
}

function onResetRf() {
  DroneControlService.resetRf()
  ElMessage.warning('射频复位指令 "reset\\n" 已发送')
}

function onToggleFactoryFly(val: string | number | boolean) {
  DroneControlService.setFpvFactoryFlyMode(Boolean(val))
}

function onApplyBandwidth() {
  DroneControlService.setFpvBandwidth(true, debugStore.fpvSettings.bandwidthMhz)
  ElMessage.success(`频宽 ${debugStore.fpvSettings.bandwidthMhz}MHz 设置指令已发送`)
}

function onToggleRfProbe() {
  const next = !debugStore.fpvSettings.rfProbeActive
  debugStore.fpvSettings.rfProbeActive = next
  DroneControlService.toggleRfProbeStream(next)
  ElMessage.info(next ? '已开启实时频谱遥测探测' : '已停止实时频谱探测')
}

function onSendFpvHex() {
  const hex = fpvCustomHex.value.trim()
  if (!hex) {
    ElMessage.warning('请输入有效的 HEX 数据')
    return
  }
  DroneControlService.sendFpvCustomHex(hex)
  debugStore.addFpvLog('TX', hex, '用户下发自定义指令')
}

function getSnrClass(snr: number) {
  if (snr < 10) return 'text-danger'
  if (snr < 20) return 'text-warn'
  return 'text-accent'
}

function getNoiseBarClass(noise: number) {
  if (noise > 70) return 'noise-high'
  if (noise > 40) return 'noise-mid'
  return 'noise-low'
}

function getInterferenceClass(interference: number | null) {
  if (interference === null) return ''
  if (interference < 85) return 'status-bad'
  return 'status-ok'
}

// --- Sensor / IMU State ---
const gpsTestEnabled = ref(false)
const beidouEnabled = ref(true)

function onStartImuCal() {
  debugStore.updateImuCal({ isCalibrating: true, text: '六面标定已启动，请按指引平放' })
  DroneControlService.startImuCalibration()
  ElMessage.info('已启动 IMU 传感器标定流程')
}

function onStopImuCal() {
  debugStore.updateImuCal({ isCalibrating: false, text: '标定流程已终止' })
  DroneControlService.stopImuCalibration()
  ElMessage.info('已终止 IMU 标定')
}

function onClearGimbalImu() {
  DroneControlService.clearGimbalImu()
  ElMessage.success('已下发清除云台 IMU 标定数据指令')
}

function onStartDpc(isDark: boolean, step: number) {
  DroneControlService.startCameraDpc(isDark, step)
  ElMessage.info(`下发 ${isDark ? '暗场' : '亮场'} DPC 坏点检测步骤 ${step}`)
}

function onStartFpn() {
  DroneControlService.startCameraFpn()
  ElMessage.info('下发相机 FPN 固定模式噪声消除校准指令')
}

function onToggleGpsTest(val: string | number | boolean) {
  DroneControlService.setGpsTest(Boolean(val))
}

function onToggleBeidou(val: string | number | boolean) {
  DroneControlService.setBeidou(Boolean(val))
}

// --- Remote ID State ---
function onQueryRemoteId() {
  DroneControlService.queryRemoteId()
  ElMessage.info('已下发 Remote ID 查询请求')
}
</script>

<style scoped>
.debug-console-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  overflow: hidden;
}

.debug-header {
  background: #0d101a;
  border-bottom: 1px solid var(--border);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-right-badges {
  display: flex;
  gap: 8px;
}

.debug-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.sub-tab-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Panel Box */
.panel-box {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
}

.box-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.box-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 10px;
}

.box-title-row .box-title {
  margin-bottom: 0;
}

.update-time {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
}

/* ================= 1. Camera Pane ================= */
.temp-cards-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.temp-card {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.temp-title {
  font-size: 11px;
  color: var(--text-muted);
}

.temp-val {
  font-size: 22px;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--accent);
}

.temp-good {
  color: #00ff88;
}

.temp-warn {
  color: #ffb703;
}

.temp-danger {
  color: #ff2a5f;
}

.temp-sub {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--mono);
}

.temp-status-text {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  margin-top: 4px;
}

.dot-online {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00ff88;
  box-shadow: 0 0 8px #00ff88;
}

/* Terminal Container */
.terminal-container {
  background: #08090f;
  border: 1px solid var(--border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  height: 520px;
}

.terminal-header {
  background: #111422;
  border-bottom: 1px solid var(--border);
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.term-title {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cyan);
}

.term-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.terminal-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  background: #06070c;
}

.terminal-empty {
  color: var(--text-muted);
  font-style: italic;
  padding: 20px;
}

.terminal-line {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  word-break: break-all;
}

.line-tx {
  color: #00d9ff;
}

.line-rx {
  color: #00ff88;
}

.line-time {
  color: #526075;
  flex-shrink: 0;
}

.line-dir {
  font-weight: 700;
  flex-shrink: 0;
}

.line-opcode {
  color: #8c9bb0;
  flex-shrink: 0;
}

.line-text {
  flex: 1;
}

.line-hex {
  color: #6366f1;
  cursor: pointer;
  flex-shrink: 0;
}

.terminal-input-bar {
  background: #0d101a;
  border-top: 1px solid var(--border);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.opcode-select {
  display: flex;
  align-items: center;
  gap: 6px;
}

.input-label {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
}

.cmd-input {
  flex: 1;
}

.terminal-presets {
  background: #090b14;
  border-top: 1px solid #161b2c;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.presets-label {
  font-size: 11px;
  color: var(--text-muted);
}

.preset-btn {
  font-family: var(--mono);
  font-size: 10px;
}

/* ================= 2. FPV & RF Pane ================= */
.fpv-pane {
  display: grid;
  grid-template-columns: 460px 1fr;
  gap: 14px;
}

.fpv-controls-col, .fpv-monitor-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.action-card {
  background: rgba(25, 30, 48, 0.4);
  border: 1px solid #1c2235;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.highlight-card {
  border-color: rgba(255, 183, 3, 0.4);
  background: rgba(255, 183, 3, 0.05);
}

.act-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.act-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}

.act-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
  line-height: 1.4;
}

.bandwidth-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-hex-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hex-actions {
  display: flex;
  gap: 8px;
}

/* Link State Grid (5909) */
.link-state-box {
  border-color: rgba(0, 217, 255, 0.25);
  background: rgba(13, 19, 33, 0.7);
}

.link-state-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.link-card-item {
  background: rgba(20, 26, 43, 0.6);
  border: 1px solid #1a2238;
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.lc-label {
  font-size: 11px;
  color: var(--text-muted);
}

.lc-val {
  font-size: 12.5px;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-ok {
  color: #00ff88 !important;
}

.status-bad {
  color: #ff2a5f !important;
}

.status-warn {
  color: #ffb703 !important;
}

.highlight-cyan {
  color: #00d9ff !important;
}

.highlight-blue {
  color: #38bdf8 !important;
}

.sub-mcs {
  font-size: 10.5px;
  font-weight: normal;
  color: #94a3b8;
}

/* RF Metrics Grid */
.rf-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.rf-metric-item {
  background: rgba(25, 30, 48, 0.5);
  border: 1px solid #1f263c;
  border-radius: 6px;
  padding: 10px;
}

.m-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.m-value {
  font-size: 13px;
  color: var(--text);
  font-family: var(--mono);
}

.m-value .num {
  font-size: 15px;
  font-weight: 700;
  color: #00d9ff;
}

.m-value .highlight {
  color: #00ff88;
}

.text-accent {
  color: #00ff88 !important;
}

.text-warn {
  color: #ffb703 !important;
}

.text-danger {
  color: #ff2a5f !important;
}

/* Spectrum Chart */
.spectrum-chart-wrap {
  background: #090c14;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 14px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.legend {
  font-size: 10px;
}

.spectrum-empty {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.spectrum-bars {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 140px;
  padding: 0 4px;
}

.spectrum-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-snr-tag {
  font-size: 9px;
  font-family: var(--mono);
  color: var(--cyan);
  margin-bottom: 2px;
}

.bar-outer {
  flex: 1;
  width: 100%;
  background: #131726;
  border-radius: 3px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-inner {
  width: 100%;
  transition: height 0.3s ease;
  border-radius: 2px;
}

.noise-low {
  background: linear-gradient(to top, #00ff88, #00d9ff);
}

.noise-mid {
  background: linear-gradient(to top, #ffb703, #fb8500);
}

.noise-high {
  background: linear-gradient(to top, #ff2a5f, #d90429);
}

.bar-ch-num {
  font-size: 10px;
  font-weight: 700;
  margin-top: 4px;
  color: var(--text);
  font-family: var(--mono);
}

.bar-freq {
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--mono);
}

/* FPV Log History */
.fpv-log-list {
  background: #080a10;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}

.log-list-title {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.fpv-log-body {
  max-height: 160px;
  overflow-y: auto;
  font-family: var(--mono);
  font-size: 11px;
}

.log-empty {
  color: #526075;
  font-style: italic;
  padding: 10px 0;
}

.fpv-log-item {
  display: flex;
  gap: 8px;
  margin-bottom: 3px;
}

.tx-color {
  color: #00d9ff;
}

.rx-color {
  color: #00ff88;
}

/* ================= 3. Sensor Pane ================= */
.sensor-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cal-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.cal-actions-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.faces-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.face-card {
  background: #111422;
  border: 1px solid #1f273d;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  transition: all 0.3s;
}

.face-done {
  border-color: #00ff88;
  background: rgba(0, 255, 136, 0.08);
}

.face-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}

.face-indicator {
  font-size: 11px;
  font-family: var(--mono);
  color: var(--text-muted);
}

.face-done .face-indicator {
  color: #00ff88;
  font-weight: 700;
}

.vectors-row {
  display: flex;
  gap: 20px;
  background: #090c15;
  border: 1px solid #1a2033;
  border-radius: 6px;
  padding: 10px 14px;
}

.vector-item {
  display: flex;
  gap: 12px;
  align-items: center;
  font-family: var(--mono);
  font-size: 12px;
}

.v-name {
  color: var(--text-muted);
  font-weight: 600;
}

.v-val {
  color: var(--cyan);
}

.sub-row-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.cam-cal-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.gnss-toggles {
  display: flex;
  gap: 40px;
  align-items: center;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.t-label {
  font-size: 12px;
  color: var(--text);
}

/* ================= 4. Remote ID Pane ================= */
.rid-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.rid-item {
  background: #111524;
  border: 1px solid #1f273e;
  border-radius: 6px;
  padding: 14px;
}

.rid-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.rid-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.mono {
  font-family: var(--mono);
}

.rid-raw-hex {
  margin-top: 14px;
  background: #090c15;
  border: 1px solid #1a2033;
  border-radius: 6px;
  padding: 12px;
}

.raw-title {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.raw-box {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--cyan);
  word-break: break-all;
}
</style>
