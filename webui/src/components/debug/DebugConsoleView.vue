<template>
  <div class="debug-console-container">
    <!-- Sub-navigation Header -->
    <div class="debug-header">
      <div class="tab-selectors">
        <el-radio-group v-model="debugStore.activeSubTab" size="small">
          <el-radio-button value="camera">📷 {{ t('engineering.camera') }}</el-radio-button>
          <el-radio-button value="fpv">📶 {{ t('engineering.fpv') }}</el-radio-button>
          <el-radio-button value="sensor">⚖️ {{ t('engineering.sensor') }}</el-radio-button>
          <el-radio-button value="rid">📡 {{ t('engineering.rid') }}</el-radio-button>
          <el-radio-button value="relay">🌐 {{ t('engineering.relay') }}</el-radio-button>
          <el-radio-button value="map">🗺️ {{ t('engineering.map') }}</el-radio-button>
        </el-radio-group>
      </div>

      <div class="header-right-badges">
        <el-tag size="small" effect="dark" type="success" class="badge-item version-badge">
          {{ t('engineering.frontend') }}: v{{ FRONTEND_VERSION }}
        </el-tag>
        <el-tag size="small" effect="dark" :type="backendVersion === 'unavailable' ? 'danger' : 'success'" class="badge-item version-badge">
          {{ t('engineering.backend') }}: {{ backendVersion === 'unavailable' ? 'unavailable' : 'v' + backendVersion }}
        </el-tag>
        <el-tag size="small" effect="dark" type="info" class="badge-item">
          {{ t('engineering.hardwareTelemetry') }}: {{ debugStore.temperatures.lastUpdated || t('engineering.waitingData') }}
        </el-tag>
      </div>
    </div>

    <DroneProfilePanel />
    <LanguagePanel />

    <!-- Main Content Area -->
    <div class="debug-body">
      <!-- ================= Sub-tab 1: Camera command console ================= -->
      <div v-show="debugStore.activeSubTab === 'camera'" class="sub-tab-pane camera-pane">
        <!-- Chip Temperatures Bar -->
        <div class="temp-cards-bar">
          <div class="temp-card">
            <div class="temp-title">SoC Core Temperature</div>
            <div class="temp-val" :class="getTempClass(debugStore.temperatures.socTemp)">
              {{ debugStore.temperatures.socTemp !== null ? debugStore.temperatures.socTemp + ' °C' : '--' }}
            </div>
            <div class="temp-sub">FE 0x15 -> 0x1200 / 0xF0</div>
          </div>

          <div class="temp-card">
            <div class="temp-title">Sensor Temperature</div>
            <div class="temp-val" :class="getTempClass(debugStore.temperatures.sensorTemp)">
              {{ debugStore.temperatures.sensorTemp !== null ? debugStore.temperatures.sensorTemp + ' °C' : '--' }}
            </div>
            <div class="temp-sub">CMOS Sensor</div>
          </div>

          <div class="temp-card">
            <div class="temp-title">ISP 970 Temperature</div>
            <div class="temp-val" :class="getTempClass(debugStore.temperatures.isp970Temp)">
              {{ debugStore.temperatures.isp970Temp !== null ? debugStore.temperatures.isp970Temp + ' °C' : '--' }}
            </div>
            <div class="temp-sub">Image Processing Core</div>
          </div>

          <div class="temp-card status-card">
            <div class="temp-title">Terminal Protocol Status</div>
            <div class="temp-status-text">
              <span class="dot-online"></span> Passthrough Channel Ready (0x1200 / 0x6F)
            </div>
            <div class="temp-sub">Entries: {{ debugStore.terminalLogs.length }}</div>
          </div>
        </div>

        <!-- Terminal Log Box -->
        <div class="terminal-container">
          <div class="terminal-header">
            <div class="term-title">
              <span class="term-icon">⚡</span>
              <span>Camera Command Passthrough (CamRevTestDebugInfo / 0x6F)</span>
            </div>
            <div class="term-tools">
              <el-checkbox v-model="autoScroll" size="small" label="Auto Scroll" />
              <el-button size="small" type="danger" plain @click="debugStore.clearTerminalLogs">
                Clear Terminal
              </el-button>
            </div>
          </div>

          <div ref="terminalBodyRef" class="terminal-body">
            <div v-if="debugStore.terminalLogs.length === 0" class="terminal-empty">
              > Waiting for camera terminal output... Select a preset command below or enter a custom command.
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
              placeholder="Enter camera debug command (e.g. get_version, status, sensor_info, reboot, idr_request)..."
              class="cmd-input"
              @keydown.enter="sendCameraCmd"
            />

            <el-button size="small" type="primary" @click="sendCameraCmd">
              Send Command (TX)
            </el-button>
          </div>

          <!-- Quick Command Preset Chips -->
          <div class="terminal-presets">
            <span class="presets-label">Debug Presets:</span>
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

      <!-- ================= Sub-tab 2: Video and RF low-level tools ================= -->
      <div v-show="debugStore.activeSubTab === 'fpv'" class="sub-tab-pane fpv-pane">
        <!-- Left: Quick RF Actions -->
        <div class="fpv-controls-col">
          <div class="panel-box">
            <div class="box-title">📶 RF Low-Level Commands</div>

            <!-- RF All Bands Unlock -->
            <div class="action-card highlight-card">
              <div class="act-header">
                <span class="act-name">Full-Band Unlock (CMD 5658 / 0x161A)</span>
                <el-tag size="small" type="danger" effect="dark">Unlock Band</el-tag>
              </div>
              <p class="act-desc">
                Sends inner protocol frame 5658 to enable all supported frequency bands.
              </p>
              <el-button type="warning" size="small" @click="onAllowAllFrequencies">
                🔓 Send Full-Band Unlock (5658)
              </el-button>
            </div>

            <!-- RF Hardware Reset -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">RF Hardware Reset (CMD 5650 / 0x1612)</span>
                <el-tag size="small" type="info" effect="dark">reset\n</el-tag>
              </div>
              <p class="act-desc">
                Writes the ASCII command "reset\n" to the RF baseband to trigger an RF front-end restart.
              </p>
              <el-button type="danger" plain size="small" @click="onResetRf">
                🔄 RF Hardware Reset (5650)
              </el-button>
            </div>

            <!-- Factory Flight Mode -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">Factory Test Flight Mode (CMD 5640 / 0x1608)</span>
                <el-switch
                  v-model="debugStore.fpvSettings.factoryFlyMode"
                  size="small"
                  active-text="Enabled"
                  inactive-text="Disabled"
                  @change="onToggleFactoryFly"
                />
              </div>
              <p class="act-desc">
                Toggles the internal factory flight test mode.
              </p>
            </div>

            <!-- Bandwidth Settings -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">Video Link Bandwidth (CMD 5652 / 0x1614)</span>
              </div>
              <div class="bandwidth-row">
                <el-radio-group v-model="debugStore.fpvSettings.bandwidthMhz" size="small">
                  <el-radio-button :value="10">10 MHz</el-radio-button>
                  <el-radio-button :value="20">20 MHz</el-radio-button>
                  <el-radio-button :value="40">40 MHz</el-radio-button>
                </el-radio-group>
                <el-button size="small" type="primary" plain @click="onApplyBandwidth">
                  Set Bandwidth
                </el-button>
              </div>
            </div>

            <!-- RF Real-time Probe Toggle -->
            <div class="action-card">
              <div class="act-header">
                <span class="act-name">Real-Time RF Spectrum Telemetry (CMD 5656 / 5913)</span>
                <el-button
                  size="small"
                  :type="debugStore.fpvSettings.rfProbeActive ? 'danger' : 'success'"
                  plain
                  @click="onToggleRfProbe"
                >
                  {{ debugStore.fpvSettings.rfProbeActive ? 'Stop Spectrum Capture' : 'Start Spectrum Capture (5656)' }}
                </el-button>
              </div>
              <p class="act-desc">
                Starts real-time baseband channel scanning and noise probing; reports 5913 runtime parameters.
              </p>
            </div>
          </div>

          <!-- FPV Custom Hex Injection -->
          <div class="panel-box">
            <div class="box-title">🔧 FPV Custom HEX Injection (CMD 5696 / 0x1640)</div>
            <div class="custom-hex-wrap">
              <el-input
                v-model="fpvCustomHex"
                type="textarea"
                :rows="2"
                placeholder="Enter custom FPV HEX payload, e.g. 01020304..."
                style="font-family: var(--mono); font-size: 11px;"
              />
              <div class="hex-actions">
                <el-button size="small" type="primary" @click="onSendFpvHex">
                  Send HEX Command
                </el-button>
                <el-button size="small" plain @click="fpvCustomHex = '01'">Preset: 01</el-button>
                <el-button size="small" plain @click="fpvCustomHex = '00'">Preset: 00</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: RF Live Spectrum & Parameters (5913) & Link State (5909) -->
        <div class="fpv-monitor-col">
          <!-- RF Link & Pairing State (CMD 5909 / FpvRevConnectState) -->
          <div class="panel-box link-state-box">
            <div class="box-title-row">
              <span class="box-title">🔗 Controller & Video Link Status (CMD 5909 / FpvRevConnectState)</span>
              <span class="update-time">Updated: {{ debugStore.linkState.lastUpdated || 'No Data' }}</span>
            </div>

            <div class="link-state-grid">
              <div class="link-card-item">
                <div class="lc-label">Wireless Video Link</div>
                <div class="lc-val" :class="debugStore.linkState.wirelessConnected ? 'status-ok' : 'status-bad'">
                  {{ debugStore.linkState.wirelessConnected ? 'Connected (ONLINE)' : 'Disconnected' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Flight Controller Link</div>
                <div class="lc-val" :class="debugStore.linkState.flightConnected ? 'status-ok' : 'status-bad'">
                  {{ debugStore.linkState.flightConnected ? 'Connected' : 'Not Connected' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Controller USB Channel</div>
                <div class="lc-val" :class="debugStore.linkState.remoterConnected ? 'status-ok' : 'status-bad'">
                  {{ debugStore.linkState.remoterConnected ? 'Handshake Ready' : 'Not Ready' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Pairing Status</div>
                <div class="lc-val" :class="debugStore.linkState.isPairing ? 'status-warn' : 'status-ok'">
                  {{ debugStore.linkState.isPairing ? 'Pairing' : 'Not Pairing' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Current Channel Frequency</div>
                <div class="lc-val highlight-cyan">
                  {{ debugStore.linkState.rfChannelMhz ? debugStore.linkState.rfChannelMhz + ' MHz' : '--' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Channel Interference</div>
                <div class="lc-val" :class="getInterferenceClass(debugStore.linkState.interference)">
                  {{ debugStore.linkState.interference !== null ? debugStore.linkState.interference + (debugStore.linkState.interference < 85 ? ' (High Interference)' : ' (Good)') : '--' }}
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Rate / MCS</div>
                <div class="lc-val highlight-blue">
                  MCS {{ debugStore.linkState.mcs !== null ? debugStore.linkState.mcs : '--' }}
                  <span v-if="debugStore.linkState.txMcs !== null" class="sub-mcs">
                    (TX:{{ debugStore.linkState.txMcs }} / RX:{{ debugStore.linkState.rxMcs }})
                  </span>
                </div>
              </div>

              <div class="link-card-item">
                <div class="lc-label">Frequency Hopping & Power Adaptation</div>
                <div class="lc-val">
                  Frequency hopping: {{ debugStore.linkState.isHopSupport ? 'On' : 'Off' }} / Adaptive: {{ debugStore.linkState.powerAdaptive ? 'On' : 'Off' }}
                </div>
              </div>
            </div>
          </div>

          <div class="panel-box spectrum-box">
            <div class="box-title-row">
              <span class="box-title">📊 Real-Time RF Parameters & Channel Spectrum (CMD 5913 / 0x1719)</span>
              <span class="update-time">Updated: {{ debugStore.rfStats.lastUpdated || 'No Data' }}</span>
            </div>

            <!-- RF Metrics Grid -->
            <div class="rf-metrics-grid">
              <div class="rf-metric-item">
                <div class="m-label">Controller Gain (RC Gain)</div>
                <div class="m-value">
                  A: <span class="num">{{ debugStore.rfStats.rcGainA }}</span> dB /
                  B: <span class="num">{{ debugStore.rfStats.rcGainB }}</span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">Controller SNR (RC SNR)</div>
                <div class="m-value">
                  <span class="num" :class="getSnrClass(debugStore.rfStats.rcSnr)">
                    {{ debugStore.rfStats.rcSnr }}
                  </span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">Aircraft Gain (FC Gain)</div>
                <div class="m-value">
                  A: <span class="num">{{ debugStore.rfStats.fcGainA }}</span> dB /
                  B: <span class="num">{{ debugStore.rfStats.fcGainB }}</span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">Aircraft SNR (FC SNR)</div>
                <div class="m-value">
                  <span class="num" :class="getSnrClass(debugStore.rfStats.fcSnr)">
                    {{ debugStore.rfStats.fcSnr }}
                  </span> dB
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">PHY Rate (MCS)</div>
                <div class="m-value">
                  MCS <span class="num highlight">{{ debugStore.rfStats.mcs }}</span>
                </div>
              </div>

              <div class="rf-metric-item">
                <div class="m-label">Scanned Channels</div>
                <div class="m-value">
                  <span class="num">{{ debugStore.rfStats.channels.length }}</span> channels
                </div>
              </div>
            </div>

            <!-- Spectrum Bar Chart -->
            <div class="spectrum-chart-wrap">
              <div class="chart-header">
                <span>Real-Time Channel Noise / Interference</span>
                <span class="legend">Green=Low / Yellow=Medium / Red=High Interference</span>
              </div>

              <div v-if="debugStore.rfStats.channels.length === 0" class="spectrum-empty">
                <span>No 5913 RF runtime parameter frame received yet. Use Start Spectrum Capture (5656) to begin active probing.</span>
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
              <div class="log-list-title">FPV Custom Packet History (Last 200)</div>
              <div class="fpv-log-body">
                <div v-if="debugStore.fpvLogs.length === 0" class="log-empty">
                  No FPV command history
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

      <!-- ================= Sub-tab 3: Sensors and calibration ================= -->
      <div v-show="debugStore.activeSubTab === 'sensor'" class="sub-tab-pane sensor-pane">
        <!-- IMU 6-Axis Calibration Card -->
        <div class="panel-box">
          <div class="box-title-row">
            <span class="box-title">⚖️ IMU Six-Side Calibration (0x0301 / CMD 23)</span>
            <el-tag
              :type="debugStore.imuCal.isCalibrating ? 'warning' : 'info'"
              effect="dark"
              size="small"
            >
              Status: {{ debugStore.imuCal.text }}
            </el-tag>
          </div>

          <p class="cal-desc">
            IMU calibration requires a level surface or placing all six aircraft sides steadily as instructed.
          </p>

          <div class="cal-actions-bar">
            <el-button
              type="primary"
              size="small"
              :disabled="debugStore.imuCal.isCalibrating"
              @click="onStartImuCal"
            >
              🚀 Start IMU Six-Side Calibration (Action=3)
            </el-button>

            <el-button
              type="danger"
              size="small"
              plain
              :disabled="!debugStore.imuCal.isCalibrating"
              @click="onStopImuCal"
            >
              ⏹️ Stop Calibration (Action=2)
            </el-button>
          </div>

          <!-- 6-Faces Status Grid -->
          <div class="faces-grid">
            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.top }">
              <div class="face-name">1. Top Side Up</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.top ? '✓ Completed' : '○ Waiting' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.bottom }">
              <div class="face-name">2. Bottom Side Up</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.bottom ? '✓ Completed' : '○ Waiting' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.left }">
              <div class="face-name">3. Left Side Up</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.left ? '✓ Completed' : '○ Waiting' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.right }">
              <div class="face-name">4. Right Side Up</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.right ? '✓ Completed' : '○ Waiting' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.front }">
              <div class="face-name">5. Front Side Up</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.front ? '✓ Completed' : '○ Waiting' }}</div>
            </div>

            <div class="face-card" :class="{ 'face-done': debugStore.imuCal.faces.back }">
              <div class="face-name">6. Rear Side Up</div>
              <div class="face-indicator">{{ debugStore.imuCal.faces.back ? '✓ Completed' : '○ Waiting' }}</div>
            </div>
          </div>

          <!-- Raw Vectors Display -->
          <div class="vectors-row">
            <div class="vector-item">
              <span class="v-name">Accelerometer (Acc):</span>
              <span class="v-val">X: {{ debugStore.imuCal.acc.x.toFixed(3) }}</span>
              <span class="v-val">Y: {{ debugStore.imuCal.acc.y.toFixed(3) }}</span>
              <span class="v-val">Z: {{ debugStore.imuCal.acc.z.toFixed(3) }}</span>
            </div>
            <div class="vector-item">
              <span class="v-name">Gyroscope (Gyro):</span>
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
            <div class="box-title">🎥 Gimbal Attitude & Calibration (0x0801 / 5)</div>
            <p class="cal-desc">
              Sends a command to clear gimbal IMU calibration data for tilt or yaw-zero troubleshooting.
            </p>
            <el-popconfirm
              title="Clear gimbal IMU calibration data?"
              confirm-button-text="Clear"
              cancel-button-text="Cancel"
              @confirm="onClearGimbalImu"
            >
              <template #reference>
                <el-button type="danger" size="small">
                  🧹 Clear Gimbal IMU Calibration (0x0801)
                </el-button>
              </template>
            </el-popconfirm>
          </div>

          <!-- Camera Optical Sensor Calibration -->
          <div class="panel-box">
            <div class="box-title">📷 Camera Sensor DPC & Noise Calibration (0x1200)</div>
            <p class="cal-desc">
              CMOS defective-pixel correction (DPC) and fixed-pattern-noise (FPN) calibration.
            </p>
            <div class="cam-cal-buttons">
              <el-button-group size="small">
                <el-button type="info" plain @click="onStartDpc(true, 0)">Dark-Frame DPC Step 0</el-button>
                <el-button type="info" plain @click="onStartDpc(true, 1)">Dark-Frame DPC Step 1</el-button>
                <el-button type="info" plain @click="onStartDpc(true, 2)">Dark-Frame DPC Step 2</el-button>
              </el-button-group>

              <el-button-group size="small">
                <el-button type="primary" plain @click="onStartDpc(false, 0)">Bright-Frame DPC Step 0</el-button>
                <el-button type="primary" plain @click="onStartDpc(false, 1)">Bright-Frame DPC Step 1</el-button>
              </el-button-group>

              <el-button size="small" type="warning" plain @click="onStartFpn">
                FPN Noise Calibration (0x74)
              </el-button>
            </div>
          </div>
        </div>

        <!-- GNSS & Satellite Debug -->
        <div class="panel-box">
          <div class="box-title">🛰️ GNSS Debug (0x0301)</div>
          <div class="gnss-toggles">
            <div class="toggle-item">
              <span class="t-label">GPS Test Mode (Subcmd 23):</span>
              <el-switch
                v-model="gpsTestEnabled"
                size="small"
                active-text="Enabled"
                inactive-text="Disabled"
                @change="onToggleGpsTest"
              />
            </div>

            <div class="toggle-item">
              <span class="t-label">BeiDou Satellite System (Subcmd 24):</span>
              <el-switch
                v-model="beidouEnabled"
                size="small"
                active-text="Enabled"
                inactive-text="Disabled"
                @change="onToggleBeidou"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ================= Sub-tab 4: Remote ID and system ================= -->
      <div v-show="debugStore.activeSubTab === 'rid'" class="sub-tab-pane rid-pane">
        <div class="panel-box">
          <div class="box-title-row">
            <span class="box-title">📡 Drone Remote ID (RID) Status</span>
            <el-button size="small" type="primary" plain @click="onQueryRemoteId">
              🔍 Query Remote ID Parameters (0x73)
            </el-button>
          </div>

          <div class="rid-cards-grid">
            <div class="rid-item">
              <div class="rid-label">Country Code</div>
              <div class="rid-value">{{ debugStore.remoteId.countryCode }}</div>
            </div>

            <div class="rid-item">
              <div class="rid-label">Aircraft Unique ID (UAS ID)</div>
              <div class="rid-value mono">{{ debugStore.remoteId.uasId }}</div>
            </div>

            <div class="rid-item">
              <div class="rid-label">RID Broadcast Status</div>
              <div class="rid-value">
                <el-tag size="small" type="success" effect="dark">{{ debugStore.remoteId.status }}</el-tag>
              </div>
            </div>

            <div class="rid-item">
              <div class="rid-label">Bound Aircraft Mainboard SN</div>
              <div class="rid-value mono">{{ debugStore.boundDroneSn }}</div>
            </div>
          </div>

          <div v-if="debugStore.remoteId.rawHex" class="rid-raw-hex">
            <div class="raw-title">Raw 0x73 Protocol Response HEX:</div>
            <div class="raw-box">{{ debugStore.remoteId.rawHex }}</div>
          </div>
        </div>
      </div>

      <!-- ================= Sub-tab 5: Remote / Relay ================= -->
      <div v-show="debugStore.activeSubTab === 'relay'" class="sub-tab-pane relay-pane">
        <RemoteRelayPanel />
      </div>

      <!-- ================= Sub-tab 6: Map settings ================= -->
      <div v-show="debugStore.activeSubTab === 'map'" class="sub-tab-pane map-pane">
        <MapSettingsView />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useDebugStore } from '../../stores/useDebugStore'
import { DroneControlService } from '../../services/DroneControlService'
import { ElMessage } from 'element-plus'
import RemoteRelayPanel from './RemoteRelayPanel.vue'
import MapSettingsView from '../settings/MapSettingsView.vue'
import DroneProfilePanel from './DroneProfilePanel.vue'
import LanguagePanel from './LanguagePanel.vue'
import { useI18n } from '../../i18n'
import { MapService } from '../../services/MapService'
import { FRONTEND_VERSION } from '../../version'

const debugStore = useDebugStore()
const { t } = useI18n()
const backendVersion = ref('loading...')

async function refreshSoftwareVersions() {
  try {
    const info = await MapService.getVersion()
    backendVersion.value = info.backendVersion || info.appVersion || 'unavailable'
  } catch (_) {
    backendVersion.value = 'unavailable'
  }
}

onMounted(() => {
  refreshSoftwareVersions()
})

// --- Camera Terminal State ---
const autoScroll = ref(true)
const cameraOpcode = ref(0)
const cameraCmdText = ref('')
const terminalBodyRef = ref<HTMLDivElement | null>(null)

const cameraPresets = [
  { label: 'Query Firmware Version', opcode: 0, cmd: 'get_version' },
  { label: 'Query Status', opcode: 0, cmd: 'status' },
  { label: 'CMOS Sensor Information', opcode: 0, cmd: 'sensor_info' },
  { label: 'Request IDR (IDR)', opcode: 0, cmd: 'idr_request' },
  { label: 'Restart Camera Core', opcode: 0, cmd: 'reboot' },
  { label: 'Query Camera SN', opcode: 0, cmd: 'get_sn' },
  { label: 'Terminal Help', opcode: 0, cmd: 'help' }
]

function sendCameraCmd() {
  const text = cameraCmdText.value.trim()
  if (!text) {
    ElMessage.warning('Enter a debug command')
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
  ElMessage.success('All-band unlock command (5658) sent')
}

function onResetRf() {
  DroneControlService.resetRf()
  ElMessage.warning('RF reset command \"reset\\n\" sent')
}

function onToggleFactoryFly(val: string | number | boolean) {
  DroneControlService.setFpvFactoryFlyMode(Boolean(val))
}

function onApplyBandwidth() {
  DroneControlService.setFpvBandwidth(true, debugStore.fpvSettings.bandwidthMhz)
  ElMessage.success(`Bandwidth ${debugStore.fpvSettings.bandwidthMhz}MHz setting command sent`)
}

function onToggleRfProbe() {
  const next = !debugStore.fpvSettings.rfProbeActive
  debugStore.fpvSettings.rfProbeActive = next
  DroneControlService.toggleRfProbeStream(next)
  ElMessage.info(next ? 'Real-time spectrum telemetry probing enabled' : 'Real-time spectrum probing stopped')
}

function onSendFpvHex() {
  const hex = fpvCustomHex.value.trim()
  if (!hex) {
    ElMessage.warning('Enter valid HEX data')
    return
  }
  DroneControlService.sendFpvCustomHex(hex)
  debugStore.addFpvLog('TX', hex, 'User custom command')
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
  debugStore.updateImuCal({ isCalibrating: true, text: 'Six-side calibration started; place the aircraft as instructed' })
  DroneControlService.startImuCalibration()
  ElMessage.info('IMU sensor calibration started')
}

function onStopImuCal() {
  debugStore.updateImuCal({ isCalibrating: false, text: 'Calibration stopped' })
  DroneControlService.stopImuCalibration()
  ElMessage.info('IMU calibration stopped')
}

function onClearGimbalImu() {
  DroneControlService.clearGimbalImu()
  ElMessage.success('Clear gimbal IMU calibration-data command sent')
}

function onStartDpc(isDark: boolean, step: number) {
  DroneControlService.startCameraDpc(isDark, step)
  ElMessage.info(`Send ${isDark ? 'dark-frame' : 'bright-frame'} DPC defective-pixel test step ${step}`)
}

function onStartFpn() {
  DroneControlService.startCameraFpn()
  ElMessage.info('Camera FPN fixed-pattern-noise calibration command sent')
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
  ElMessage.info('Remote ID query sent')
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
  background: var(--ui-bg-header);
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
  color: var(--ui-success);
}

.temp-warn {
  color: var(--ui-warning);
}

.temp-danger {
  color: var(--ui-danger);
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
  background: var(--ui-success);
  box-shadow: 0 0 8px var(--ui-success);
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
  color: var(--ui-primary);
}

.line-rx {
  color: var(--ui-success);
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
  background: var(--ui-bg-header);
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
  color: var(--ui-success) !important;
}

.status-bad {
  color: var(--ui-danger) !important;
}

.status-warn {
  color: var(--ui-warning) !important;
}

.highlight-cyan {
  color: var(--ui-primary) !important;
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
  color: var(--ui-primary);
}

.m-value .highlight {
  color: var(--ui-success);
}

.text-accent {
  color: var(--ui-success) !important;
}

.text-warn {
  color: var(--ui-warning) !important;
}

.text-danger {
  color: var(--ui-danger) !important;
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
  background: linear-gradient(to top, var(--ui-success), var(--ui-primary));
}

.noise-mid {
  background: linear-gradient(to top, var(--ui-warning), #fb8500);
}

.noise-high {
  background: linear-gradient(to top, var(--ui-danger), #d90429);
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
  color: var(--ui-primary);
}

.rx-color {
  color: var(--ui-success);
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
  border-color: var(--ui-success);
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
  color: var(--ui-success);
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


