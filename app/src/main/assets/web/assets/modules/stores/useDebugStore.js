/**
 * Pinia Store for Debugging & Engineering Console
 */
import { defineStore } from '../../vendor/pinia.js';
import { ref, reactive } from '../../vendor/vue.js';
export const useDebugStore = defineStore('debug', () => {
    // Active sub-tab in Debug View
    const activeSubTab = ref('flight');
    // 1. Camera Interactive Debug Console
    const terminalLogs = ref([]);
    const temperatures = reactive({
        socTemp: null,
        sensorTemp: null,
        isp970Temp: null,
        lastUpdated: null
    });
    // 2. RF & FPV Real-time Telemetry
    const rfStats = reactive({
        lastUpdated: null,
        rcGainA: 0,
        rcGainB: 0,
        rcSnr: 0,
        fcGainA: 0,
        fcGainB: 0,
        fcSnr: 0,
        mcs: 0,
        channels: []
    });
    // 3. FPV Custom Command Logs
    const fpvLogs = ref([]);
    // FPV Settings state
    const fpvSettings = reactive({
        factoryFlyMode: false,
        allFreqUnlocked: false,
        rfProbeActive: false,
        bandwidthMhz: 20
    });
    // 4. IMU & Gimbal Calibration
    const imuCal = reactive({
        isCalibrating: false,
        stage: 0,
        text: 'Idle (calibration not started)',
        faces: {
            top: false,
            bottom: false,
            left: false,
            right: false,
            front: false,
            back: false
        },
        acc: { x: 0, y: 0, z: 0 },
        gyro: { x: 0, y: 0, z: 0 }
    });
    // 5. Remote ID & Drone Binding SN
    const remoteId = reactive({
        countryCode: 'CN',
        uasId: 'N/A',
        status: 'Not connected'
    });
    const boundDroneSn = ref('N/A');
    // 6. Wireless Link & Pairing State (5909 / FpvRevConnectState)
    const linkState = reactive({
        lastUpdated: null,
        signalLevel: 0,
        wirelessConnected: false,
        flightConnected: false,
        remoterConnected: false,
        cameraConnected: false,
        isPairing: false,
        isHopSupport: false,
        powerAdaptive: false,
        rfChannelMhz: 0,
        interference: 0,
        isHighInterference: false,
        mcs: 0,
        txMcs: 0,
        rxMcs: 0,
        isImgTransInterrupt: false,
        isFactoryFlight: false,
        isRemoteWirelessData: false,
        isLargeBand: false,
        countryBand: 'N/A',
        flightType: 'N/A'
    });
    // --- Actions ---
    function addTerminalLog(dir, opcode, text, hex) {
        terminalLogs.value.push({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString(),
            dir,
            opcode,
            text,
            hex
        });
        if (terminalLogs.value.length > 500) {
            terminalLogs.value.shift();
        }
    }
    function clearTerminalLogs() {
        terminalLogs.value = [];
    }
    function updateTemperatures(soc, sensor, isp970) {
        if (soc !== undefined && soc !== null)
            temperatures.socTemp = soc;
        if (sensor !== undefined && sensor !== null)
            temperatures.sensorTemp = sensor;
        if (isp970 !== undefined && isp970 !== null)
            temperatures.isp970Temp = isp970;
        temperatures.lastUpdated = new Date().toLocaleTimeString();
    }
    function updateRfStats(data) {
        Object.assign(rfStats, data);
        rfStats.lastUpdated = new Date().toLocaleTimeString();
    }
    function addFpvLog(dir, hex, description) {
        fpvLogs.value.unshift({
            id: Math.random().toString(36).substring(2, 9),
            time: new Date().toLocaleTimeString(),
            dir,
            hex,
            description
        });
        if (fpvLogs.value.length > 200) {
            fpvLogs.value.pop();
        }
    }
    function updateImuCal(data) {
        Object.assign(imuCal, data);
    }
    function updateRemoteId(data) {
        Object.assign(remoteId, data);
    }
    function setBoundDroneSn(sn) {
        boundDroneSn.value = sn;
    }
    function updateLinkState(data) {
        Object.assign(linkState, data);
        linkState.lastUpdated = new Date().toLocaleTimeString();
    }
    return {
        activeSubTab,
        terminalLogs,
        temperatures,
        rfStats,
        fpvLogs,
        fpvSettings,
        imuCal,
        remoteId,
        boundDroneSn,
        linkState,
        addTerminalLog,
        clearTerminalLogs,
        updateTemperatures,
        updateRfStats,
        addFpvLog,
        updateImuCal,
        updateRemoteId,
        setBoundDroneSn,
        updateLinkState
    };
});
