import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import AdvancedFlightPanel from '../cockpit/AdvancedFlightPanel.js';
import PrecisionStartSettings from '../settings/PrecisionStartSettings.js';
import { ref, nextTick, watch, onMounted } from '../../../vendor/vue.js';
import { useDebugStore } from '../../stores/useDebugStore.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { ElMessage } from '../../../vendor/element-plus.js';
import RemoteRelayPanel from './RemoteRelayPanel.js';
import LogConsole from '../logs/LogConsole.js';
import DroneProfilePanel from './DroneProfilePanel.js';
import LanguagePanel from './LanguagePanel.js';
import DisplaySettingsPanel from './DisplaySettingsPanel.js';
import { useI18n } from '../../i18n/index.js';
import { MapService } from '../../services/MapService.js';
import { FRONTEND_VERSION } from '../../version.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'DebugConsoleView',
    setup(__props, { expose: __expose }) {
        __expose();
        const debugStore = useDebugStore();
        const { t } = useI18n();
        const backendVersion = ref('loading...');
        async function refreshSoftwareVersions() {
            try {
                const info = await MapService.getVersion();
                backendVersion.value = info.backendVersion || info.appVersion || 'unavailable';
            }
            catch (_) {
                backendVersion.value = 'unavailable';
            }
        }
        onMounted(() => {
            refreshSoftwareVersions();
        });
        // --- Camera Terminal State ---
        const autoScroll = ref(true);
        const cameraOpcode = ref(0);
        const cameraCmdText = ref('');
        const terminalBodyRef = ref(null);
        const cameraPresets = [
            { label: 'Query Firmware Version', opcode: 0, cmd: 'get_version' },
            { label: 'Query Status', opcode: 0, cmd: 'status' },
            { label: 'CMOS Sensor Information', opcode: 0, cmd: 'sensor_info' },
            { label: 'Request IDR (IDR)', opcode: 0, cmd: 'idr_request' },
            { label: 'Restart Camera Core', opcode: 0, cmd: 'reboot' },
            { label: 'Query Camera SN', opcode: 0, cmd: 'get_sn' },
            { label: 'Terminal Help', opcode: 0, cmd: 'help' }
        ];
        function sendCameraCmd() {
            const text = cameraCmdText.value.trim();
            if (!text) {
                ElMessage.warning('Enter a debug command');
                return;
            }
            DroneControlService.sendCameraTerminal(cameraOpcode.value, text);
            debugStore.addTerminalLog('TX', cameraOpcode.value, text);
            cameraCmdText.value = '';
            scrollToBottom();
        }
        function applyAndSendCameraCmd(opcode, cmd) {
            cameraOpcode.value = opcode;
            cameraCmdText.value = cmd;
            sendCameraCmd();
        }
        function scrollToBottom() {
            if (autoScroll.value) {
                nextTick(() => {
                    if (terminalBodyRef.value) {
                        terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight;
                    }
                });
            }
        }
        watch(() => debugStore.terminalLogs.length, () => {
            scrollToBottom();
        });
        function getTempClass(temp) {
            if (temp === null)
                return '';
            if (temp >= 80)
                return 'temp-danger';
            if (temp >= 65)
                return 'temp-warn';
            return 'temp-good';
        }
        // --- FPV / RF State ---
        const fpvCustomHex = ref('');
        function onAllowAllFrequencies() {
            DroneControlService.allowAllRfFrequencies();
            ElMessage.success('All-band unlock command (5658) sent');
        }
        function onResetRf() {
            DroneControlService.resetRf();
            ElMessage.warning('RF reset command \"reset\\n\" sent');
        }
        function onToggleFactoryFly(val) {
            DroneControlService.setFpvFactoryFlyMode(Boolean(val));
        }
        function onApplyBandwidth() {
            DroneControlService.setFpvBandwidth(true, debugStore.fpvSettings.bandwidthMhz);
            ElMessage.success(`Bandwidth ${debugStore.fpvSettings.bandwidthMhz}MHz setting command sent`);
        }
        function onToggleRfProbe() {
            const next = !debugStore.fpvSettings.rfProbeActive;
            debugStore.fpvSettings.rfProbeActive = next;
            DroneControlService.toggleRfProbeStream(next);
            ElMessage.info(next ? 'Real-time spectrum telemetry probing enabled' : 'Real-time spectrum probing stopped');
        }
        function onSendFpvHex() {
            const hex = fpvCustomHex.value.trim();
            if (!hex) {
                ElMessage.warning('Enter valid HEX data');
                return;
            }
            DroneControlService.sendFpvCustomHex(hex);
            debugStore.addFpvLog('TX', hex, 'User custom command');
        }
        function getSnrClass(snr) {
            if (snr < 10)
                return 'text-danger';
            if (snr < 20)
                return 'text-warn';
            return 'text-accent';
        }
        function getNoiseBarClass(noise) {
            if (noise > 70)
                return 'noise-high';
            if (noise > 40)
                return 'noise-mid';
            return 'noise-low';
        }
        function getInterferenceClass(interference) {
            if (interference === null)
                return '';
            if (interference < 85)
                return 'status-bad';
            return 'status-ok';
        }
        // --- Sensor / IMU State ---
        const gpsTestEnabled = ref(false);
        const beidouEnabled = ref(true);
        function onStartImuCal() {
            debugStore.updateImuCal({ isCalibrating: true, text: 'Six-side calibration started; place the aircraft as instructed' });
            DroneControlService.startImuCalibration();
            ElMessage.info('IMU sensor calibration started');
        }
        function onStopImuCal() {
            debugStore.updateImuCal({ isCalibrating: false, text: 'Calibration stopped' });
            DroneControlService.stopImuCalibration();
            ElMessage.info('IMU calibration stopped');
        }
        function onClearGimbalImu() {
            DroneControlService.clearGimbalImu();
            ElMessage.success('Clear gimbal IMU calibration-data command sent');
        }
        function onStartDpc(isDark, step) {
            DroneControlService.startCameraDpc(isDark, step);
            ElMessage.info(`Send ${isDark ? 'dark-frame' : 'bright-frame'} DPC defective-pixel test step ${step}`);
        }
        function onStartFpn() {
            DroneControlService.startCameraFpn();
            ElMessage.info('Camera FPN fixed-pattern-noise calibration command sent');
        }
        function onToggleGpsTest(val) {
            DroneControlService.setGpsTest(Boolean(val));
        }
        function onToggleBeidou(val) {
            DroneControlService.setBeidou(Boolean(val));
        }
        // --- Remote ID State ---
        function onQueryRemoteId() {
            DroneControlService.queryRemoteId();
            ElMessage.info('Remote ID query sent');
        }
        const __returned__ = { debugStore, t, backendVersion, refreshSoftwareVersions, autoScroll, cameraOpcode, cameraCmdText, terminalBodyRef, cameraPresets, sendCameraCmd, applyAndSendCameraCmd, scrollToBottom, getTempClass, fpvCustomHex, onAllowAllFrequencies, onResetRf, onToggleFactoryFly, onApplyBandwidth, onToggleRfProbe, onSendFpvHex, getSnrClass, getNoiseBarClass, getInterferenceClass, gpsTestEnabled, beidouEnabled, onStartImuCal, onStopImuCal, onClearGimbalImu, onStartDpc, onStartFpn, onToggleGpsTest, onToggleBeidou, onQueryRemoteId, AdvancedFlightPanel, PrecisionStartSettings, RemoteRelayPanel, LogConsole, DroneProfilePanel, LanguagePanel, DisplaySettingsPanel, get FRONTEND_VERSION() { return FRONTEND_VERSION; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode, createElementVNode as _createElementVNode, vShow as _vShow, withDirectives as _withDirectives, normalizeClass as _normalizeClass, openBlock as _openBlock, createElementBlock as _createElementBlock, renderList as _renderList, Fragment as _Fragment, withKeys as _withKeys, normalizeStyle as _normalizeStyle } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "debug-console-container" };
const _hoisted_2 = { class: "debug-header" };
const _hoisted_3 = { class: "tab-selectors" };
const _hoisted_4 = { class: "header-right-badges" };
const _hoisted_5 = { class: "debug-body" };
const _hoisted_6 = { class: "sub-tab-pane system-flight-pane" };
const _hoisted_7 = { class: "sub-tab-pane system-flight-pane" };
const _hoisted_8 = { class: "sub-tab-pane camera-pane" };
const _hoisted_9 = { class: "temp-cards-bar" };
const _hoisted_10 = { class: "temp-card" };
const _hoisted_11 = { class: "temp-card" };
const _hoisted_12 = { class: "temp-card" };
const _hoisted_13 = { class: "temp-card status-card" };
const _hoisted_14 = { class: "temp-sub" };
const _hoisted_15 = { class: "terminal-container" };
const _hoisted_16 = { class: "terminal-header" };
const _hoisted_17 = { class: "term-tools" };
const _hoisted_18 = {
    ref: "terminalBodyRef",
    class: "terminal-body"
};
const _hoisted_19 = {
    key: 0,
    class: "terminal-empty"
};
const _hoisted_20 = { class: "line-time" };
const _hoisted_21 = { class: "line-dir" };
const _hoisted_22 = { class: "line-opcode" };
const _hoisted_23 = { class: "line-text" };
const _hoisted_24 = ["title"];
const _hoisted_25 = { class: "terminal-input-bar" };
const _hoisted_26 = { class: "opcode-select" };
const _hoisted_27 = { class: "terminal-presets" };
const _hoisted_28 = { class: "sub-tab-pane fpv-pane" };
const _hoisted_29 = { class: "fpv-controls-col" };
const _hoisted_30 = { class: "panel-box" };
const _hoisted_31 = { class: "action-card highlight-card" };
const _hoisted_32 = { class: "act-header" };
const _hoisted_33 = { class: "action-card" };
const _hoisted_34 = { class: "act-header" };
const _hoisted_35 = { class: "action-card" };
const _hoisted_36 = { class: "act-header" };
const _hoisted_37 = { class: "action-card" };
const _hoisted_38 = { class: "bandwidth-row" };
const _hoisted_39 = { class: "action-card" };
const _hoisted_40 = { class: "act-header" };
const _hoisted_41 = { class: "panel-box" };
const _hoisted_42 = { class: "custom-hex-wrap" };
const _hoisted_43 = { class: "hex-actions" };
const _hoisted_44 = { class: "fpv-monitor-col" };
const _hoisted_45 = { class: "panel-box link-state-box" };
const _hoisted_46 = { class: "box-title-row" };
const _hoisted_47 = { class: "update-time" };
const _hoisted_48 = { class: "link-state-grid" };
const _hoisted_49 = { class: "link-card-item" };
const _hoisted_50 = { class: "link-card-item" };
const _hoisted_51 = { class: "link-card-item" };
const _hoisted_52 = { class: "link-card-item" };
const _hoisted_53 = { class: "link-card-item" };
const _hoisted_54 = { class: "lc-val highlight-cyan" };
const _hoisted_55 = { class: "link-card-item" };
const _hoisted_56 = { class: "link-card-item" };
const _hoisted_57 = { class: "lc-val highlight-blue" };
const _hoisted_58 = {
    key: 0,
    class: "sub-mcs"
};
const _hoisted_59 = { class: "link-card-item" };
const _hoisted_60 = { class: "lc-val" };
const _hoisted_61 = { class: "panel-box spectrum-box" };
const _hoisted_62 = { class: "box-title-row" };
const _hoisted_63 = { class: "update-time" };
const _hoisted_64 = { class: "rf-metrics-grid" };
const _hoisted_65 = { class: "rf-metric-item" };
const _hoisted_66 = { class: "m-value" };
const _hoisted_67 = { class: "num" };
const _hoisted_68 = { class: "num" };
const _hoisted_69 = { class: "rf-metric-item" };
const _hoisted_70 = { class: "m-value" };
const _hoisted_71 = { class: "rf-metric-item" };
const _hoisted_72 = { class: "m-value" };
const _hoisted_73 = { class: "num" };
const _hoisted_74 = { class: "num" };
const _hoisted_75 = { class: "rf-metric-item" };
const _hoisted_76 = { class: "m-value" };
const _hoisted_77 = { class: "rf-metric-item" };
const _hoisted_78 = { class: "m-value" };
const _hoisted_79 = { class: "num highlight" };
const _hoisted_80 = { class: "rf-metric-item" };
const _hoisted_81 = { class: "m-value" };
const _hoisted_82 = { class: "num" };
const _hoisted_83 = { class: "spectrum-chart-wrap" };
const _hoisted_84 = {
    key: 0,
    class: "spectrum-empty"
};
const _hoisted_85 = {
    key: 1,
    class: "spectrum-bars"
};
const _hoisted_86 = { class: "bar-snr-tag" };
const _hoisted_87 = { class: "bar-outer" };
const _hoisted_88 = { class: "bar-ch-num" };
const _hoisted_89 = { class: "bar-freq" };
const _hoisted_90 = { class: "fpv-log-list" };
const _hoisted_91 = { class: "fpv-log-body" };
const _hoisted_92 = {
    key: 0,
    class: "log-empty"
};
const _hoisted_93 = { class: "fpv-log-time" };
const _hoisted_94 = { class: "fpv-log-dir" };
const _hoisted_95 = { class: "fpv-log-hex" };
const _hoisted_96 = {
    key: 0,
    class: "fpv-log-desc"
};
const _hoisted_97 = { class: "sub-tab-pane sensor-pane" };
const _hoisted_98 = { class: "panel-box" };
const _hoisted_99 = { class: "box-title-row" };
const _hoisted_100 = { class: "cal-actions-bar" };
const _hoisted_101 = { class: "faces-grid" };
const _hoisted_102 = { class: "face-indicator" };
const _hoisted_103 = { class: "face-indicator" };
const _hoisted_104 = { class: "face-indicator" };
const _hoisted_105 = { class: "face-indicator" };
const _hoisted_106 = { class: "face-indicator" };
const _hoisted_107 = { class: "face-indicator" };
const _hoisted_108 = { class: "vectors-row" };
const _hoisted_109 = { class: "vector-item" };
const _hoisted_110 = { class: "v-val" };
const _hoisted_111 = { class: "v-val" };
const _hoisted_112 = { class: "v-val" };
const _hoisted_113 = { class: "vector-item" };
const _hoisted_114 = { class: "v-val" };
const _hoisted_115 = { class: "v-val" };
const _hoisted_116 = { class: "v-val" };
const _hoisted_117 = { class: "sub-row-two-col" };
const _hoisted_118 = { class: "panel-box" };
const _hoisted_119 = { class: "panel-box" };
const _hoisted_120 = { class: "cam-cal-buttons" };
const _hoisted_121 = { class: "panel-box" };
const _hoisted_122 = { class: "gnss-toggles" };
const _hoisted_123 = { class: "toggle-item" };
const _hoisted_124 = { class: "toggle-item" };
const _hoisted_125 = { class: "sub-tab-pane rid-pane" };
const _hoisted_126 = { class: "panel-box" };
const _hoisted_127 = { class: "box-title-row" };
const _hoisted_128 = { class: "rid-cards-grid" };
const _hoisted_129 = { class: "rid-item" };
const _hoisted_130 = { class: "rid-value" };
const _hoisted_131 = { class: "rid-item" };
const _hoisted_132 = { class: "rid-value mono" };
const _hoisted_133 = { class: "rid-item" };
const _hoisted_134 = { class: "rid-value" };
const _hoisted_135 = { class: "rid-item" };
const _hoisted_136 = { class: "rid-value mono" };
const _hoisted_137 = {
    key: 0,
    class: "rid-raw-hex"
};
const _hoisted_138 = { class: "raw-box" };
const _hoisted_139 = { class: "sub-tab-pane relay-pane" };
const _hoisted_140 = { class: "sub-tab-pane logs-pane" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_radio_button = _resolveComponent("el-radio-button");
    const _component_el_radio_group = _resolveComponent("el-radio-group");
    const _component_el_tag = _resolveComponent("el-tag");
    const _component_el_checkbox = _resolveComponent("el-checkbox");
    const _component_el_button = _resolveComponent("el-button");
    const _component_el_input_number = _resolveComponent("el-input-number");
    const _component_el_input = _resolveComponent("el-input");
    const _component_el_switch = _resolveComponent("el-switch");
    const _component_el_popconfirm = _resolveComponent("el-popconfirm");
    const _component_el_button_group = _resolveComponent("el-button-group");
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createCommentVNode(" Sub-navigation Header "),
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, [
                _createVNode(_component_el_radio_group, {
                    modelValue: $setup.debugStore.activeSubTab,
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.debugStore.activeSubTab) = $event)),
                    size: "small"
                }, {
                    default: _withCtx(() => [
                        _createVNode(_component_el_radio_button, { value: "flight" }, {
                            default: _withCtx(() => [
                                _createTextVNode("✈️ " + _toDisplayString($setup.t('system.flight')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "pstart" }, {
                            default: _withCtx(() => [
                                _createTextVNode("🎯 " + _toDisplayString($setup.t('pstart.tab')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "camera" }, {
                            default: _withCtx(() => [
                                _createTextVNode("📷 " + _toDisplayString($setup.t('engineering.camera')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "fpv" }, {
                            default: _withCtx(() => [
                                _createTextVNode("📶 " + _toDisplayString($setup.t('engineering.fpv')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "sensor" }, {
                            default: _withCtx(() => [
                                _createTextVNode("⚖️ " + _toDisplayString($setup.t('engineering.sensor')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "rid" }, {
                            default: _withCtx(() => [
                                _createTextVNode("📡 " + _toDisplayString($setup.t('engineering.rid')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "relay" }, {
                            default: _withCtx(() => [
                                _createTextVNode("🌐 " + _toDisplayString($setup.t('engineering.relay')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "logs" }, {
                            default: _withCtx(() => [
                                _createTextVNode("📋 " + _toDisplayString($setup.t('engineering.logs')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["modelValue"])
            ]),
            _createElementVNode("div", _hoisted_4, [
                _createVNode(_component_el_tag, {
                    size: "small",
                    effect: "dark",
                    type: "success",
                    class: "badge-item version-badge"
                }, {
                    default: _withCtx(() => [
                        _createTextVNode(_toDisplayString($setup.t('engineering.frontend')) + ": v" + _toDisplayString($setup.FRONTEND_VERSION), 1 /* TEXT */)
                    ]),
                    _: 1 /* STABLE */
                }),
                _createVNode(_component_el_tag, {
                    size: "small",
                    effect: "dark",
                    type: $setup.backendVersion === 'unavailable' ? 'danger' : 'success',
                    class: "badge-item version-badge"
                }, {
                    default: _withCtx(() => [
                        _createTextVNode(_toDisplayString($setup.t('engineering.backend')) + ": " + _toDisplayString($setup.backendVersion === 'unavailable' ? 'unavailable' : 'v' + $setup.backendVersion), 1 /* TEXT */)
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["type"]),
                _createVNode(_component_el_tag, {
                    size: "small",
                    effect: "dark",
                    type: "info",
                    class: "badge-item"
                }, {
                    default: _withCtx(() => [
                        _createTextVNode(_toDisplayString($setup.t('engineering.hardwareTelemetry')) + ": " + _toDisplayString($setup.debugStore.temperatures.lastUpdated || $setup.t('engineering.waitingData')), 1 /* TEXT */)
                    ]),
                    _: 1 /* STABLE */
                })
            ])
        ]),
        _createVNode($setup["DroneProfilePanel"]),
        _createVNode($setup["LanguagePanel"]),
        _createVNode($setup["DisplaySettingsPanel"]),
        _createCommentVNode(" Main Content Area "),
        _createElementVNode("div", _hoisted_5, [
            _createCommentVNode(" ================= System: flight limits, smart modes and calibration ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_6, [
                _createVNode($setup["AdvancedFlightPanel"])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'flight']
            ]),
            _withDirectives(_createElementVNode("div", _hoisted_7, [
                _createVNode($setup["PrecisionStartSettings"])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'pstart']
            ]),
            _createCommentVNode(" ================= Sub-tab 1: Camera command console ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_8, [
                _createCommentVNode(" Chip Temperatures Bar "),
                _createElementVNode("div", _hoisted_9, [
                    _createElementVNode("div", _hoisted_10, [
                        _cache[16] || (_cache[16] = _createElementVNode("div", { class: "temp-title" }, "SoC Core Temperature", -1 /* CACHED */)),
                        _createElementVNode("div", {
                            class: _normalizeClass(["temp-val", $setup.getTempClass($setup.debugStore.temperatures.socTemp)])
                        }, _toDisplayString($setup.debugStore.temperatures.socTemp !== null ? $setup.debugStore.temperatures.socTemp + ' °C' : '--'), 3 /* TEXT, CLASS */),
                        _cache[17] || (_cache[17] = _createElementVNode("div", { class: "temp-sub" }, "FE 0x15 -> 0x1200 / 0xF0", -1 /* CACHED */))
                    ]),
                    _createElementVNode("div", _hoisted_11, [
                        _cache[18] || (_cache[18] = _createElementVNode("div", { class: "temp-title" }, "Sensor Temperature", -1 /* CACHED */)),
                        _createElementVNode("div", {
                            class: _normalizeClass(["temp-val", $setup.getTempClass($setup.debugStore.temperatures.sensorTemp)])
                        }, _toDisplayString($setup.debugStore.temperatures.sensorTemp !== null ? $setup.debugStore.temperatures.sensorTemp + ' °C' : '--'), 3 /* TEXT, CLASS */),
                        _cache[19] || (_cache[19] = _createElementVNode("div", { class: "temp-sub" }, "CMOS Sensor", -1 /* CACHED */))
                    ]),
                    _createElementVNode("div", _hoisted_12, [
                        _cache[20] || (_cache[20] = _createElementVNode("div", { class: "temp-title" }, "ISP 970 Temperature", -1 /* CACHED */)),
                        _createElementVNode("div", {
                            class: _normalizeClass(["temp-val", $setup.getTempClass($setup.debugStore.temperatures.isp970Temp)])
                        }, _toDisplayString($setup.debugStore.temperatures.isp970Temp !== null ? $setup.debugStore.temperatures.isp970Temp + ' °C' : '--'), 3 /* TEXT, CLASS */),
                        _cache[21] || (_cache[21] = _createElementVNode("div", { class: "temp-sub" }, "Image Processing Core", -1 /* CACHED */))
                    ]),
                    _createElementVNode("div", _hoisted_13, [
                        _cache[22] || (_cache[22] = _createElementVNode("div", { class: "temp-title" }, "Terminal Protocol Status", -1 /* CACHED */)),
                        _cache[23] || (_cache[23] = _createElementVNode("div", { class: "temp-status-text" }, [
                            _createElementVNode("span", { class: "dot-online" }),
                            _createTextVNode(" Passthrough Channel Ready (0x1200 / 0x6F) ")
                        ], -1 /* CACHED */)),
                        _createElementVNode("div", _hoisted_14, "Entries: " + _toDisplayString($setup.debugStore.terminalLogs.length), 1 /* TEXT */)
                    ])
                ]),
                _createCommentVNode(" Terminal Log Box "),
                _createElementVNode("div", _hoisted_15, [
                    _createElementVNode("div", _hoisted_16, [
                        _cache[25] || (_cache[25] = _createElementVNode("div", { class: "term-title" }, [
                            _createElementVNode("span", { class: "term-icon" }, "⚡"),
                            _createElementVNode("span", null, "Camera Command Passthrough (CamRevTestDebugInfo / 0x6F)")
                        ], -1 /* CACHED */)),
                        _createElementVNode("div", _hoisted_17, [
                            _createVNode(_component_el_checkbox, {
                                modelValue: $setup.autoScroll,
                                "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.autoScroll) = $event)),
                                size: "small",
                                label: "Auto Scroll"
                            }, null, 8 /* PROPS */, ["modelValue"]),
                            _createVNode(_component_el_button, {
                                size: "small",
                                type: "danger",
                                plain: "",
                                onClick: $setup.debugStore.clearTerminalLogs
                            }, {
                                default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                                        _createTextVNode(" Clear Terminal ", -1 /* CACHED */)
                                    ]))]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["onClick"])
                        ])
                    ]),
                    _createElementVNode("div", _hoisted_18, [
                        ($setup.debugStore.terminalLogs.length === 0)
                            ? (_openBlock(), _createElementBlock("div", _hoisted_19, " > Waiting for camera terminal output... Select a preset command below or enter a custom command. "))
                            : _createCommentVNode("v-if", true),
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.debugStore.terminalLogs, (log) => {
                            return (_openBlock(), _createElementBlock("div", {
                                key: log.id,
                                class: _normalizeClass(["terminal-line", log.dir === 'TX' ? 'line-tx' : 'line-rx'])
                            }, [
                                _createElementVNode("span", _hoisted_20, "[" + _toDisplayString(log.time) + "]", 1 /* TEXT */),
                                _createElementVNode("span", _hoisted_21, "[" + _toDisplayString(log.dir) + "]", 1 /* TEXT */),
                                _createElementVNode("span", _hoisted_22, "(Op: 0x" + _toDisplayString(log.opcode.toString(16).padStart(2, '0')) + ")", 1 /* TEXT */),
                                _createElementVNode("span", _hoisted_23, _toDisplayString(log.text), 1 /* TEXT */),
                                (log.hex)
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 0,
                                        class: "line-hex",
                                        title: log.hex
                                    }, "[HEX]", 8 /* PROPS */, _hoisted_24))
                                    : _createCommentVNode("v-if", true)
                            ], 2 /* CLASS */));
                        }), 128 /* KEYED_FRAGMENT */))
                    ], 512 /* NEED_PATCH */),
                    _createCommentVNode(" Command Input Toolbar "),
                    _createElementVNode("div", _hoisted_25, [
                        _createElementVNode("div", _hoisted_26, [
                            _cache[26] || (_cache[26] = _createElementVNode("span", { class: "input-label" }, "OpCode:", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.cameraOpcode,
                                "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.cameraOpcode) = $event)),
                                min: 0,
                                max: 255,
                                size: "small",
                                "controls-position": "right",
                                style: { "width": "90px" }
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createVNode(_component_el_input, {
                            modelValue: $setup.cameraCmdText,
                            "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.cameraCmdText) = $event)),
                            size: "small",
                            placeholder: "Enter camera debug command (e.g. get_version, status, sensor_info, reboot, idr_request)...",
                            class: "cmd-input",
                            onKeydown: _withKeys($setup.sendCameraCmd, ["enter"])
                        }, null, 8 /* PROPS */, ["modelValue"]),
                        _createVNode(_component_el_button, {
                            size: "small",
                            type: "primary",
                            onClick: $setup.sendCameraCmd
                        }, {
                            default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
                                    _createTextVNode(" Send Command (TX) ", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _createCommentVNode(" Quick Command Preset Chips "),
                    _createElementVNode("div", _hoisted_27, [
                        _cache[28] || (_cache[28] = _createElementVNode("span", { class: "presets-label" }, "Debug Presets:", -1 /* CACHED */)),
                        (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.cameraPresets, (p) => {
                            return _createVNode(_component_el_button, {
                                key: p.cmd,
                                size: "small",
                                round: "",
                                plain: "",
                                class: "preset-btn",
                                onClick: $event => ($setup.applyAndSendCameraCmd(p.opcode, p.cmd))
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString(p.label) + " (" + _toDisplayString(p.cmd) + ") ", 1 /* TEXT */)
                                ]),
                                _: 2 /* DYNAMIC */
                            }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["onClick"]);
                        }), 64 /* STABLE_FRAGMENT */))
                    ])
                ])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'camera']
            ]),
            _createCommentVNode(" ================= Sub-tab 2: Video and RF low-level tools ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_28, [
                _createCommentVNode(" Left: Quick RF Actions "),
                _createElementVNode("div", _hoisted_29, [
                    _createElementVNode("div", _hoisted_30, [
                        _cache[46] || (_cache[46] = _createElementVNode("div", { class: "box-title" }, "📶 RF Low-Level Commands", -1 /* CACHED */)),
                        _createCommentVNode(" RF All Bands Unlock "),
                        _createElementVNode("div", _hoisted_31, [
                            _createElementVNode("div", _hoisted_32, [
                                _cache[30] || (_cache[30] = _createElementVNode("span", { class: "act-name" }, "Full-Band Unlock (CMD 5658 / 0x161A)", -1 /* CACHED */)),
                                _createVNode(_component_el_tag, {
                                    size: "small",
                                    type: "danger",
                                    effect: "dark"
                                }, {
                                    default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                                            _createTextVNode("Unlock Band", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                })
                            ]),
                            _cache[32] || (_cache[32] = _createElementVNode("p", { class: "act-desc" }, " Sends inner protocol frame 5658 to enable all supported frequency bands. ", -1 /* CACHED */)),
                            _createVNode(_component_el_button, {
                                type: "warning",
                                size: "small",
                                onClick: $setup.onAllowAllFrequencies
                            }, {
                                default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                                        _createTextVNode(" 🔓 Send Full-Band Unlock (5658) ", -1 /* CACHED */)
                                    ]))]),
                                _: 1 /* STABLE */
                            })
                        ]),
                        _createCommentVNode(" RF Hardware Reset "),
                        _createElementVNode("div", _hoisted_33, [
                            _createElementVNode("div", _hoisted_34, [
                                _cache[34] || (_cache[34] = _createElementVNode("span", { class: "act-name" }, "RF Hardware Reset (CMD 5650 / 0x1612)", -1 /* CACHED */)),
                                _createVNode(_component_el_tag, {
                                    size: "small",
                                    type: "info",
                                    effect: "dark"
                                }, {
                                    default: _withCtx(() => [...(_cache[33] || (_cache[33] = [
                                            _createTextVNode("reset\\n", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                })
                            ]),
                            _cache[36] || (_cache[36] = _createElementVNode("p", { class: "act-desc" }, " Writes the ASCII command \"reset\\n\" to the RF baseband to trigger an RF front-end restart. ", -1 /* CACHED */)),
                            _createVNode(_component_el_button, {
                                type: "danger",
                                plain: "",
                                size: "small",
                                onClick: $setup.onResetRf
                            }, {
                                default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
                                        _createTextVNode(" 🔄 RF Hardware Reset (5650) ", -1 /* CACHED */)
                                    ]))]),
                                _: 1 /* STABLE */
                            })
                        ]),
                        _createCommentVNode(" Factory Flight Mode "),
                        _createElementVNode("div", _hoisted_35, [
                            _createElementVNode("div", _hoisted_36, [
                                _cache[37] || (_cache[37] = _createElementVNode("span", { class: "act-name" }, "Factory Test Flight Mode (CMD 5640 / 0x1608)", -1 /* CACHED */)),
                                _createVNode(_component_el_switch, {
                                    modelValue: $setup.debugStore.fpvSettings.factoryFlyMode,
                                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.debugStore.fpvSettings.factoryFlyMode) = $event)),
                                    size: "small",
                                    "active-text": "Enabled",
                                    "inactive-text": "Disabled",
                                    onChange: $setup.onToggleFactoryFly
                                }, null, 8 /* PROPS */, ["modelValue"])
                            ]),
                            _cache[38] || (_cache[38] = _createElementVNode("p", { class: "act-desc" }, " Toggles the internal factory flight test mode. ", -1 /* CACHED */))
                        ]),
                        _createCommentVNode(" Bandwidth Settings "),
                        _createElementVNode("div", _hoisted_37, [
                            _cache[43] || (_cache[43] = _createElementVNode("div", { class: "act-header" }, [
                                _createElementVNode("span", { class: "act-name" }, "Video Link Bandwidth (CMD 5652 / 0x1614)")
                            ], -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_38, [
                                _createVNode(_component_el_radio_group, {
                                    modelValue: $setup.debugStore.fpvSettings.bandwidthMhz,
                                    "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => (($setup.debugStore.fpvSettings.bandwidthMhz) = $event)),
                                    size: "small"
                                }, {
                                    default: _withCtx(() => [
                                        _createVNode(_component_el_radio_button, { value: 10 }, {
                                            default: _withCtx(() => [...(_cache[39] || (_cache[39] = [
                                                    _createTextVNode("10 MHz", -1 /* CACHED */)
                                                ]))]),
                                            _: 1 /* STABLE */
                                        }),
                                        _createVNode(_component_el_radio_button, { value: 20 }, {
                                            default: _withCtx(() => [...(_cache[40] || (_cache[40] = [
                                                    _createTextVNode("20 MHz", -1 /* CACHED */)
                                                ]))]),
                                            _: 1 /* STABLE */
                                        }),
                                        _createVNode(_component_el_radio_button, { value: 40 }, {
                                            default: _withCtx(() => [...(_cache[41] || (_cache[41] = [
                                                    _createTextVNode("40 MHz", -1 /* CACHED */)
                                                ]))]),
                                            _: 1 /* STABLE */
                                        })
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["modelValue"]),
                                _createVNode(_component_el_button, {
                                    size: "small",
                                    type: "primary",
                                    plain: "",
                                    onClick: $setup.onApplyBandwidth
                                }, {
                                    default: _withCtx(() => [...(_cache[42] || (_cache[42] = [
                                            _createTextVNode(" Set Bandwidth ", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                })
                            ])
                        ]),
                        _createCommentVNode(" RF Real-time Probe Toggle "),
                        _createElementVNode("div", _hoisted_39, [
                            _createElementVNode("div", _hoisted_40, [
                                _cache[44] || (_cache[44] = _createElementVNode("span", { class: "act-name" }, "Real-Time RF Spectrum Telemetry (CMD 5656 / 5913)", -1 /* CACHED */)),
                                _createVNode(_component_el_button, {
                                    size: "small",
                                    type: $setup.debugStore.fpvSettings.rfProbeActive ? 'danger' : 'success',
                                    plain: "",
                                    onClick: $setup.onToggleRfProbe
                                }, {
                                    default: _withCtx(() => [
                                        _createTextVNode(_toDisplayString($setup.debugStore.fpvSettings.rfProbeActive ? 'Stop Spectrum Capture' : 'Start Spectrum Capture (5656)'), 1 /* TEXT */)
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["type"])
                            ]),
                            _cache[45] || (_cache[45] = _createElementVNode("p", { class: "act-desc" }, " Starts real-time baseband channel scanning and noise probing; reports 5913 runtime parameters. ", -1 /* CACHED */))
                        ])
                    ]),
                    _createCommentVNode(" FPV Custom Hex Injection "),
                    _createElementVNode("div", _hoisted_41, [
                        _cache[50] || (_cache[50] = _createElementVNode("div", { class: "box-title" }, "🔧 FPV Custom HEX Injection (CMD 5696 / 0x1640)", -1 /* CACHED */)),
                        _createElementVNode("div", _hoisted_42, [
                            _createVNode(_component_el_input, {
                                modelValue: $setup.fpvCustomHex,
                                "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => (($setup.fpvCustomHex) = $event)),
                                type: "textarea",
                                rows: 2,
                                placeholder: "Enter custom FPV HEX payload, e.g. 01020304...",
                                style: { "font-family": "var(--mono)", "font-size": "11px" }
                            }, null, 8 /* PROPS */, ["modelValue"]),
                            _createElementVNode("div", _hoisted_43, [
                                _createVNode(_component_el_button, {
                                    size: "small",
                                    type: "primary",
                                    onClick: $setup.onSendFpvHex
                                }, {
                                    default: _withCtx(() => [...(_cache[47] || (_cache[47] = [
                                            _createTextVNode(" Send HEX Command ", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                }),
                                _createVNode(_component_el_button, {
                                    size: "small",
                                    plain: "",
                                    onClick: _cache[7] || (_cache[7] = $event => ($setup.fpvCustomHex = '01'))
                                }, {
                                    default: _withCtx(() => [...(_cache[48] || (_cache[48] = [
                                            _createTextVNode("Preset: 01", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                }),
                                _createVNode(_component_el_button, {
                                    size: "small",
                                    plain: "",
                                    onClick: _cache[8] || (_cache[8] = $event => ($setup.fpvCustomHex = '00'))
                                }, {
                                    default: _withCtx(() => [...(_cache[49] || (_cache[49] = [
                                            _createTextVNode("Preset: 00", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                })
                            ])
                        ])
                    ])
                ]),
                _createCommentVNode(" Right: RF Live Spectrum & Parameters (5913) & Link State (5909) "),
                _createElementVNode("div", _hoisted_44, [
                    _createCommentVNode(" RF Link & Pairing State (CMD 5909 / FpvRevConnectState) "),
                    _createElementVNode("div", _hoisted_45, [
                        _createElementVNode("div", _hoisted_46, [
                            _cache[51] || (_cache[51] = _createElementVNode("span", { class: "box-title" }, "🔗 Controller & Video Link Status (CMD 5909 / FpvRevConnectState)", -1 /* CACHED */)),
                            _createElementVNode("span", _hoisted_47, "Updated: " + _toDisplayString($setup.debugStore.linkState.lastUpdated || 'No Data'), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", _hoisted_48, [
                            _createElementVNode("div", _hoisted_49, [
                                _cache[52] || (_cache[52] = _createElementVNode("div", { class: "lc-label" }, "Wireless Video Link", -1 /* CACHED */)),
                                _createElementVNode("div", {
                                    class: _normalizeClass(["lc-val", $setup.debugStore.linkState.wirelessConnected ? 'status-ok' : 'status-bad'])
                                }, _toDisplayString($setup.debugStore.linkState.wirelessConnected ? 'Connected (ONLINE)' : 'Disconnected'), 3 /* TEXT, CLASS */)
                            ]),
                            _createElementVNode("div", _hoisted_50, [
                                _cache[53] || (_cache[53] = _createElementVNode("div", { class: "lc-label" }, "Flight Controller Link", -1 /* CACHED */)),
                                _createElementVNode("div", {
                                    class: _normalizeClass(["lc-val", $setup.debugStore.linkState.flightConnected ? 'status-ok' : 'status-bad'])
                                }, _toDisplayString($setup.debugStore.linkState.flightConnected ? 'Connected' : 'Not Connected'), 3 /* TEXT, CLASS */)
                            ]),
                            _createElementVNode("div", _hoisted_51, [
                                _cache[54] || (_cache[54] = _createElementVNode("div", { class: "lc-label" }, "Controller USB Channel", -1 /* CACHED */)),
                                _createElementVNode("div", {
                                    class: _normalizeClass(["lc-val", $setup.debugStore.linkState.remoterConnected ? 'status-ok' : 'status-bad'])
                                }, _toDisplayString($setup.debugStore.linkState.remoterConnected ? 'Handshake Ready' : 'Not Ready'), 3 /* TEXT, CLASS */)
                            ]),
                            _createElementVNode("div", _hoisted_52, [
                                _cache[55] || (_cache[55] = _createElementVNode("div", { class: "lc-label" }, "Pairing Status", -1 /* CACHED */)),
                                _createElementVNode("div", {
                                    class: _normalizeClass(["lc-val", $setup.debugStore.linkState.isPairing ? 'status-warn' : 'status-ok'])
                                }, _toDisplayString($setup.debugStore.linkState.isPairing ? 'Pairing' : 'Not Pairing'), 3 /* TEXT, CLASS */)
                            ]),
                            _createElementVNode("div", _hoisted_53, [
                                _cache[56] || (_cache[56] = _createElementVNode("div", { class: "lc-label" }, "Current Channel Frequency", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_54, _toDisplayString($setup.debugStore.linkState.rfChannelMhz ? $setup.debugStore.linkState.rfChannelMhz + ' MHz' : '--'), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", _hoisted_55, [
                                _cache[57] || (_cache[57] = _createElementVNode("div", { class: "lc-label" }, "Channel Interference", -1 /* CACHED */)),
                                _createElementVNode("div", {
                                    class: _normalizeClass(["lc-val", $setup.getInterferenceClass($setup.debugStore.linkState.interference)])
                                }, _toDisplayString($setup.debugStore.linkState.interference !== null ? $setup.debugStore.linkState.interference + ($setup.debugStore.linkState.interference < 85 ? ' (High Interference)' : ' (Good)') : '--'), 3 /* TEXT, CLASS */)
                            ]),
                            _createElementVNode("div", _hoisted_56, [
                                _cache[58] || (_cache[58] = _createElementVNode("div", { class: "lc-label" }, "Rate / MCS", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_57, [
                                    _createTextVNode(" MCS " + _toDisplayString($setup.debugStore.linkState.mcs !== null ? $setup.debugStore.linkState.mcs : '--') + " ", 1 /* TEXT */),
                                    ($setup.debugStore.linkState.txMcs !== null)
                                        ? (_openBlock(), _createElementBlock("span", _hoisted_58, " (TX:" + _toDisplayString($setup.debugStore.linkState.txMcs) + " / RX:" + _toDisplayString($setup.debugStore.linkState.rxMcs) + ") ", 1 /* TEXT */))
                                        : _createCommentVNode("v-if", true)
                                ])
                            ]),
                            _createElementVNode("div", _hoisted_59, [
                                _cache[59] || (_cache[59] = _createElementVNode("div", { class: "lc-label" }, "Frequency Hopping & Power Adaptation", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_60, " Frequency hopping: " + _toDisplayString($setup.debugStore.linkState.isHopSupport ? 'On' : 'Off') + " / Adaptive: " + _toDisplayString($setup.debugStore.linkState.powerAdaptive ? 'On' : 'Off'), 1 /* TEXT */)
                            ])
                        ])
                    ]),
                    _createElementVNode("div", _hoisted_61, [
                        _createElementVNode("div", _hoisted_62, [
                            _cache[60] || (_cache[60] = _createElementVNode("span", { class: "box-title" }, "📊 Real-Time RF Parameters & Channel Spectrum (CMD 5913 / 0x1719)", -1 /* CACHED */)),
                            _createElementVNode("span", _hoisted_63, "Updated: " + _toDisplayString($setup.debugStore.rfStats.lastUpdated || 'No Data'), 1 /* TEXT */)
                        ]),
                        _createCommentVNode(" RF Metrics Grid "),
                        _createElementVNode("div", _hoisted_64, [
                            _createElementVNode("div", _hoisted_65, [
                                _cache[64] || (_cache[64] = _createElementVNode("div", { class: "m-label" }, "Controller Gain (RC Gain)", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_66, [
                                    _cache[61] || (_cache[61] = _createTextVNode(" A: ", -1 /* CACHED */)),
                                    _createElementVNode("span", _hoisted_67, _toDisplayString($setup.debugStore.rfStats.rcGainA), 1 /* TEXT */),
                                    _cache[62] || (_cache[62] = _createTextVNode(" dB / B: ", -1 /* CACHED */)),
                                    _createElementVNode("span", _hoisted_68, _toDisplayString($setup.debugStore.rfStats.rcGainB), 1 /* TEXT */),
                                    _cache[63] || (_cache[63] = _createTextVNode(" dB ", -1 /* CACHED */))
                                ])
                            ]),
                            _createElementVNode("div", _hoisted_69, [
                                _cache[66] || (_cache[66] = _createElementVNode("div", { class: "m-label" }, "Controller SNR (RC SNR)", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_70, [
                                    _createElementVNode("span", {
                                        class: _normalizeClass(["num", $setup.getSnrClass($setup.debugStore.rfStats.rcSnr)])
                                    }, _toDisplayString($setup.debugStore.rfStats.rcSnr), 3 /* TEXT, CLASS */),
                                    _cache[65] || (_cache[65] = _createTextVNode(" dB ", -1 /* CACHED */))
                                ])
                            ]),
                            _createElementVNode("div", _hoisted_71, [
                                _cache[70] || (_cache[70] = _createElementVNode("div", { class: "m-label" }, "Aircraft Gain (FC Gain)", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_72, [
                                    _cache[67] || (_cache[67] = _createTextVNode(" A: ", -1 /* CACHED */)),
                                    _createElementVNode("span", _hoisted_73, _toDisplayString($setup.debugStore.rfStats.fcGainA), 1 /* TEXT */),
                                    _cache[68] || (_cache[68] = _createTextVNode(" dB / B: ", -1 /* CACHED */)),
                                    _createElementVNode("span", _hoisted_74, _toDisplayString($setup.debugStore.rfStats.fcGainB), 1 /* TEXT */),
                                    _cache[69] || (_cache[69] = _createTextVNode(" dB ", -1 /* CACHED */))
                                ])
                            ]),
                            _createElementVNode("div", _hoisted_75, [
                                _cache[72] || (_cache[72] = _createElementVNode("div", { class: "m-label" }, "Aircraft SNR (FC SNR)", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_76, [
                                    _createElementVNode("span", {
                                        class: _normalizeClass(["num", $setup.getSnrClass($setup.debugStore.rfStats.fcSnr)])
                                    }, _toDisplayString($setup.debugStore.rfStats.fcSnr), 3 /* TEXT, CLASS */),
                                    _cache[71] || (_cache[71] = _createTextVNode(" dB ", -1 /* CACHED */))
                                ])
                            ]),
                            _createElementVNode("div", _hoisted_77, [
                                _cache[74] || (_cache[74] = _createElementVNode("div", { class: "m-label" }, "PHY Rate (MCS)", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_78, [
                                    _cache[73] || (_cache[73] = _createTextVNode(" MCS ", -1 /* CACHED */)),
                                    _createElementVNode("span", _hoisted_79, _toDisplayString($setup.debugStore.rfStats.mcs), 1 /* TEXT */)
                                ])
                            ]),
                            _createElementVNode("div", _hoisted_80, [
                                _cache[76] || (_cache[76] = _createElementVNode("div", { class: "m-label" }, "Scanned Channels", -1 /* CACHED */)),
                                _createElementVNode("div", _hoisted_81, [
                                    _createElementVNode("span", _hoisted_82, _toDisplayString($setup.debugStore.rfStats.channels.length), 1 /* TEXT */),
                                    _cache[75] || (_cache[75] = _createTextVNode(" channels ", -1 /* CACHED */))
                                ])
                            ])
                        ]),
                        _createCommentVNode(" Spectrum Bar Chart "),
                        _createElementVNode("div", _hoisted_83, [
                            _cache[78] || (_cache[78] = _createElementVNode("div", { class: "chart-header" }, [
                                _createElementVNode("span", null, "Real-Time Channel Noise / Interference"),
                                _createElementVNode("span", { class: "legend" }, "Green=Low / Yellow=Medium / Red=High Interference")
                            ], -1 /* CACHED */)),
                            ($setup.debugStore.rfStats.channels.length === 0)
                                ? (_openBlock(), _createElementBlock("div", _hoisted_84, [...(_cache[77] || (_cache[77] = [
                                        _createElementVNode("span", null, "No 5913 RF runtime parameter frame received yet. Use Start Spectrum Capture (5656) to begin active probing.", -1 /* CACHED */)
                                    ]))]))
                                : (_openBlock(), _createElementBlock("div", _hoisted_85, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.debugStore.rfStats.channels, (ch) => {
                                        return (_openBlock(), _createElementBlock("div", {
                                            key: ch.channelIndex,
                                            class: "spectrum-bar-item"
                                        }, [
                                            _createElementVNode("div", _hoisted_86, _toDisplayString(ch.snr) + "dB", 1 /* TEXT */),
                                            _createElementVNode("div", _hoisted_87, [
                                                _createElementVNode("div", {
                                                    class: _normalizeClass(["bar-inner", $setup.getNoiseBarClass(ch.noiseLevel)]),
                                                    style: _normalizeStyle({ height: `${Math.min(100, Math.max(8, ch.noiseLevel))}%` })
                                                }, null, 6 /* CLASS, STYLE */)
                                            ]),
                                            _createElementVNode("div", _hoisted_88, "CH" + _toDisplayString(ch.channelIndex), 1 /* TEXT */),
                                            _createElementVNode("div", _hoisted_89, _toDisplayString(ch.frequencyMhz) + "M", 1 /* TEXT */)
                                        ]));
                                    }), 128 /* KEYED_FRAGMENT */))
                                ]))
                        ]),
                        _createCommentVNode(" FPV Log History "),
                        _createElementVNode("div", _hoisted_90, [
                            _cache[79] || (_cache[79] = _createElementVNode("div", { class: "log-list-title" }, "FPV Custom Packet History (Last 200)", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_91, [
                                ($setup.debugStore.fpvLogs.length === 0)
                                    ? (_openBlock(), _createElementBlock("div", _hoisted_92, " No FPV command history "))
                                    : _createCommentVNode("v-if", true),
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.debugStore.fpvLogs, (fl) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                        key: fl.id,
                                        class: _normalizeClass(["fpv-log-item", fl.dir === 'TX' ? 'tx-color' : 'rx-color'])
                                    }, [
                                        _createElementVNode("span", _hoisted_93, "[" + _toDisplayString(fl.time) + "]", 1 /* TEXT */),
                                        _createElementVNode("span", _hoisted_94, "[" + _toDisplayString(fl.dir) + "]", 1 /* TEXT */),
                                        _createElementVNode("span", _hoisted_95, _toDisplayString(fl.hex), 1 /* TEXT */),
                                        (fl.description)
                                            ? (_openBlock(), _createElementBlock("span", _hoisted_96, "(" + _toDisplayString(fl.description) + ")", 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true)
                                    ], 2 /* CLASS */));
                                }), 128 /* KEYED_FRAGMENT */))
                            ])
                        ])
                    ])
                ])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'fpv']
            ]),
            _createCommentVNode(" ================= Sub-tab 3: Sensors and calibration ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_97, [
                _createCommentVNode(" IMU 6-Axis Calibration Card "),
                _createElementVNode("div", _hoisted_98, [
                    _createElementVNode("div", _hoisted_99, [
                        _cache[80] || (_cache[80] = _createElementVNode("span", { class: "box-title" }, "⚖️ IMU Six-Side Calibration (0x0301 / CMD 23)", -1 /* CACHED */)),
                        _createVNode(_component_el_tag, {
                            type: $setup.debugStore.imuCal.isCalibrating ? 'warning' : 'info',
                            effect: "dark",
                            size: "small"
                        }, {
                            default: _withCtx(() => [
                                _createTextVNode(" Status: " + _toDisplayString($setup.debugStore.imuCal.text), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["type"])
                    ]),
                    _cache[91] || (_cache[91] = _createElementVNode("p", { class: "cal-desc" }, " IMU calibration requires a level surface or placing all six aircraft sides steadily as instructed. ", -1 /* CACHED */)),
                    _createElementVNode("div", _hoisted_100, [
                        _createVNode(_component_el_button, {
                            type: "primary",
                            size: "small",
                            disabled: $setup.debugStore.imuCal.isCalibrating,
                            onClick: $setup.onStartImuCal
                        }, {
                            default: _withCtx(() => [...(_cache[81] || (_cache[81] = [
                                    _createTextVNode(" 🚀 Start IMU Six-Side Calibration (Action=3) ", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["disabled"]),
                        _createVNode(_component_el_button, {
                            type: "danger",
                            size: "small",
                            plain: "",
                            disabled: !$setup.debugStore.imuCal.isCalibrating,
                            onClick: $setup.onStopImuCal
                        }, {
                            default: _withCtx(() => [...(_cache[82] || (_cache[82] = [
                                    _createTextVNode(" ⏹️ Stop Calibration (Action=2) ", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["disabled"])
                    ]),
                    _createCommentVNode(" 6-Faces Status Grid "),
                    _createElementVNode("div", _hoisted_101, [
                        _createElementVNode("div", {
                            class: _normalizeClass(["face-card", { 'face-done': $setup.debugStore.imuCal.faces.top }])
                        }, [
                            _cache[83] || (_cache[83] = _createElementVNode("div", { class: "face-name" }, "1. Top Side Up", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_102, _toDisplayString($setup.debugStore.imuCal.faces.top ? '✓ Completed' : '○ Waiting'), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("div", {
                            class: _normalizeClass(["face-card", { 'face-done': $setup.debugStore.imuCal.faces.bottom }])
                        }, [
                            _cache[84] || (_cache[84] = _createElementVNode("div", { class: "face-name" }, "2. Bottom Side Up", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_103, _toDisplayString($setup.debugStore.imuCal.faces.bottom ? '✓ Completed' : '○ Waiting'), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("div", {
                            class: _normalizeClass(["face-card", { 'face-done': $setup.debugStore.imuCal.faces.left }])
                        }, [
                            _cache[85] || (_cache[85] = _createElementVNode("div", { class: "face-name" }, "3. Left Side Up", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_104, _toDisplayString($setup.debugStore.imuCal.faces.left ? '✓ Completed' : '○ Waiting'), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("div", {
                            class: _normalizeClass(["face-card", { 'face-done': $setup.debugStore.imuCal.faces.right }])
                        }, [
                            _cache[86] || (_cache[86] = _createElementVNode("div", { class: "face-name" }, "4. Right Side Up", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_105, _toDisplayString($setup.debugStore.imuCal.faces.right ? '✓ Completed' : '○ Waiting'), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("div", {
                            class: _normalizeClass(["face-card", { 'face-done': $setup.debugStore.imuCal.faces.front }])
                        }, [
                            _cache[87] || (_cache[87] = _createElementVNode("div", { class: "face-name" }, "5. Front Side Up", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_106, _toDisplayString($setup.debugStore.imuCal.faces.front ? '✓ Completed' : '○ Waiting'), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("div", {
                            class: _normalizeClass(["face-card", { 'face-done': $setup.debugStore.imuCal.faces.back }])
                        }, [
                            _cache[88] || (_cache[88] = _createElementVNode("div", { class: "face-name" }, "6. Rear Side Up", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_107, _toDisplayString($setup.debugStore.imuCal.faces.back ? '✓ Completed' : '○ Waiting'), 1 /* TEXT */)
                        ], 2 /* CLASS */)
                    ]),
                    _createCommentVNode(" Raw Vectors Display "),
                    _createElementVNode("div", _hoisted_108, [
                        _createElementVNode("div", _hoisted_109, [
                            _cache[89] || (_cache[89] = _createElementVNode("span", { class: "v-name" }, "Accelerometer (Acc):", -1 /* CACHED */)),
                            _createElementVNode("span", _hoisted_110, "X: " + _toDisplayString($setup.debugStore.imuCal.acc.x.toFixed(3)), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_111, "Y: " + _toDisplayString($setup.debugStore.imuCal.acc.y.toFixed(3)), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_112, "Z: " + _toDisplayString($setup.debugStore.imuCal.acc.z.toFixed(3)), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", _hoisted_113, [
                            _cache[90] || (_cache[90] = _createElementVNode("span", { class: "v-name" }, "Gyroscope (Gyro):", -1 /* CACHED */)),
                            _createElementVNode("span", _hoisted_114, "X: " + _toDisplayString($setup.debugStore.imuCal.gyro.x.toFixed(3)), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_115, "Y: " + _toDisplayString($setup.debugStore.imuCal.gyro.y.toFixed(3)), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_116, "Z: " + _toDisplayString($setup.debugStore.imuCal.gyro.z.toFixed(3)), 1 /* TEXT */)
                        ])
                    ])
                ]),
                _createCommentVNode(" Gimbal & Camera Sensors Calibration "),
                _createElementVNode("div", _hoisted_117, [
                    _createCommentVNode(" Gimbal Reset "),
                    _createElementVNode("div", _hoisted_118, [
                        _cache[93] || (_cache[93] = _createElementVNode("div", { class: "box-title" }, "🎥 Gimbal Attitude & Calibration (0x0801 / 5)", -1 /* CACHED */)),
                        _cache[94] || (_cache[94] = _createElementVNode("p", { class: "cal-desc" }, " Sends a command to clear gimbal IMU calibration data for tilt or yaw-zero troubleshooting. ", -1 /* CACHED */)),
                        _createVNode(_component_el_popconfirm, {
                            title: "Clear gimbal IMU calibration data?",
                            "confirm-button-text": "Clear",
                            "cancel-button-text": "Cancel",
                            onConfirm: $setup.onClearGimbalImu
                        }, {
                            reference: _withCtx(() => [
                                _createVNode(_component_el_button, {
                                    type: "danger",
                                    size: "small"
                                }, {
                                    default: _withCtx(() => [...(_cache[92] || (_cache[92] = [
                                            _createTextVNode(" 🧹 Clear Gimbal IMU Calibration (0x0801) ", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                })
                            ]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _createCommentVNode(" Camera Optical Sensor Calibration "),
                    _createElementVNode("div", _hoisted_119, [
                        _cache[101] || (_cache[101] = _createElementVNode("div", { class: "box-title" }, "📷 Camera Sensor DPC & Noise Calibration (0x1200)", -1 /* CACHED */)),
                        _cache[102] || (_cache[102] = _createElementVNode("p", { class: "cal-desc" }, " CMOS defective-pixel correction (DPC) and fixed-pattern-noise (FPN) calibration. ", -1 /* CACHED */)),
                        _createElementVNode("div", _hoisted_120, [
                            _createVNode(_component_el_button_group, { size: "small" }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_button, {
                                        type: "info",
                                        plain: "",
                                        onClick: _cache[9] || (_cache[9] = $event => ($setup.onStartDpc(true, 0)))
                                    }, {
                                        default: _withCtx(() => [...(_cache[95] || (_cache[95] = [
                                                _createTextVNode("Dark-Frame DPC Step 0", -1 /* CACHED */)
                                            ]))]),
                                        _: 1 /* STABLE */
                                    }),
                                    _createVNode(_component_el_button, {
                                        type: "info",
                                        plain: "",
                                        onClick: _cache[10] || (_cache[10] = $event => ($setup.onStartDpc(true, 1)))
                                    }, {
                                        default: _withCtx(() => [...(_cache[96] || (_cache[96] = [
                                                _createTextVNode("Dark-Frame DPC Step 1", -1 /* CACHED */)
                                            ]))]),
                                        _: 1 /* STABLE */
                                    }),
                                    _createVNode(_component_el_button, {
                                        type: "info",
                                        plain: "",
                                        onClick: _cache[11] || (_cache[11] = $event => ($setup.onStartDpc(true, 2)))
                                    }, {
                                        default: _withCtx(() => [...(_cache[97] || (_cache[97] = [
                                                _createTextVNode("Dark-Frame DPC Step 2", -1 /* CACHED */)
                                            ]))]),
                                        _: 1 /* STABLE */
                                    })
                                ]),
                                _: 1 /* STABLE */
                            }),
                            _createVNode(_component_el_button_group, { size: "small" }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_button, {
                                        type: "primary",
                                        plain: "",
                                        onClick: _cache[12] || (_cache[12] = $event => ($setup.onStartDpc(false, 0)))
                                    }, {
                                        default: _withCtx(() => [...(_cache[98] || (_cache[98] = [
                                                _createTextVNode("Bright-Frame DPC Step 0", -1 /* CACHED */)
                                            ]))]),
                                        _: 1 /* STABLE */
                                    }),
                                    _createVNode(_component_el_button, {
                                        type: "primary",
                                        plain: "",
                                        onClick: _cache[13] || (_cache[13] = $event => ($setup.onStartDpc(false, 1)))
                                    }, {
                                        default: _withCtx(() => [...(_cache[99] || (_cache[99] = [
                                                _createTextVNode("Bright-Frame DPC Step 1", -1 /* CACHED */)
                                            ]))]),
                                        _: 1 /* STABLE */
                                    })
                                ]),
                                _: 1 /* STABLE */
                            }),
                            _createVNode(_component_el_button, {
                                size: "small",
                                type: "warning",
                                plain: "",
                                onClick: $setup.onStartFpn
                            }, {
                                default: _withCtx(() => [...(_cache[100] || (_cache[100] = [
                                        _createTextVNode(" FPN Noise Calibration (0x74) ", -1 /* CACHED */)
                                    ]))]),
                                _: 1 /* STABLE */
                            })
                        ])
                    ])
                ]),
                _createCommentVNode(" GNSS & Satellite Debug "),
                _createElementVNode("div", _hoisted_121, [
                    _cache[105] || (_cache[105] = _createElementVNode("div", { class: "box-title" }, "🛰️ GNSS Debug (0x0301)", -1 /* CACHED */)),
                    _createElementVNode("div", _hoisted_122, [
                        _createElementVNode("div", _hoisted_123, [
                            _cache[103] || (_cache[103] = _createElementVNode("span", { class: "t-label" }, "GPS Test Mode (Subcmd 23):", -1 /* CACHED */)),
                            _createVNode(_component_el_switch, {
                                modelValue: $setup.gpsTestEnabled,
                                "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => (($setup.gpsTestEnabled) = $event)),
                                size: "small",
                                "active-text": "Enabled",
                                "inactive-text": "Disabled",
                                onChange: $setup.onToggleGpsTest
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("div", _hoisted_124, [
                            _cache[104] || (_cache[104] = _createElementVNode("span", { class: "t-label" }, "BeiDou Satellite System (Subcmd 24):", -1 /* CACHED */)),
                            _createVNode(_component_el_switch, {
                                modelValue: $setup.beidouEnabled,
                                "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => (($setup.beidouEnabled) = $event)),
                                size: "small",
                                "active-text": "Enabled",
                                "inactive-text": "Disabled",
                                onChange: $setup.onToggleBeidou
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ])
                    ])
                ])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'sensor']
            ]),
            _createCommentVNode(" ================= Sub-tab 4: Remote ID and system ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_125, [
                _createElementVNode("div", _hoisted_126, [
                    _createElementVNode("div", _hoisted_127, [
                        _cache[107] || (_cache[107] = _createElementVNode("span", { class: "box-title" }, "📡 Drone Remote ID (RID) Status", -1 /* CACHED */)),
                        _createVNode(_component_el_button, {
                            size: "small",
                            type: "primary",
                            plain: "",
                            onClick: $setup.onQueryRemoteId
                        }, {
                            default: _withCtx(() => [...(_cache[106] || (_cache[106] = [
                                    _createTextVNode(" 🔍 Query Remote ID Parameters (0x73) ", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _createElementVNode("div", _hoisted_128, [
                        _createElementVNode("div", _hoisted_129, [
                            _cache[108] || (_cache[108] = _createElementVNode("div", { class: "rid-label" }, "Country Code", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_130, _toDisplayString($setup.debugStore.remoteId.countryCode), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", _hoisted_131, [
                            _cache[109] || (_cache[109] = _createElementVNode("div", { class: "rid-label" }, "Aircraft Unique ID (UAS ID)", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_132, _toDisplayString($setup.debugStore.remoteId.uasId), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", _hoisted_133, [
                            _cache[110] || (_cache[110] = _createElementVNode("div", { class: "rid-label" }, "RID Broadcast Status", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_134, [
                                _createVNode(_component_el_tag, {
                                    size: "small",
                                    type: "success",
                                    effect: "dark"
                                }, {
                                    default: _withCtx(() => [
                                        _createTextVNode(_toDisplayString($setup.debugStore.remoteId.status), 1 /* TEXT */)
                                    ]),
                                    _: 1 /* STABLE */
                                })
                            ])
                        ]),
                        _createElementVNode("div", _hoisted_135, [
                            _cache[111] || (_cache[111] = _createElementVNode("div", { class: "rid-label" }, "Bound Aircraft Mainboard SN", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_136, _toDisplayString($setup.debugStore.boundDroneSn), 1 /* TEXT */)
                        ])
                    ]),
                    ($setup.debugStore.remoteId.rawHex)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_137, [
                            _cache[112] || (_cache[112] = _createElementVNode("div", { class: "raw-title" }, "Raw 0x73 Protocol Response HEX:", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_138, _toDisplayString($setup.debugStore.remoteId.rawHex), 1 /* TEXT */)
                        ]))
                        : _createCommentVNode("v-if", true)
                ])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'rid']
            ]),
            _createCommentVNode(" ================= Sub-tab 5: Remote / Relay ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_139, [
                _createVNode($setup["RemoteRelayPanel"])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'relay']
            ]),
            _createCommentVNode(" ================= Sub-tab 6: System logs ================= "),
            _withDirectives(_createElementVNode("div", _hoisted_140, [
                _createVNode($setup["LogConsole"])
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.debugStore.activeSubTab === 'logs']
            ])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-7e6355af";
__sfc__.render = render;
export default __sfc__;
