import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref, computed, onMounted } from '../../../vendor/vue.js';
import { PacketBuilder } from '../../protocol/PacketBuilder.js';
import { FeTransport } from '../../protocol/FeTransport.js';
import { FfFdCommand } from '../../protocol/FfFdCommand.js';
import { ByteUtils } from '../../utils/ByteUtils.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'PacketConstructor',
    setup(__props, { expose: __expose }) {
        const store = useDroneStore();
        const presets = [
            { id: 'heartbeat', name: 'Heartbeat (Heartbeat)' },
            { id: 'handshake', name: 'AOA Handshake' },
            { id: 'takeoff', name: 'Takeoff (Takeoff)' },
            { id: 'land', name: 'Land (Land)' },
            { id: 'rth', name: 'RTH (RTH)' },
            { id: 'emergency', name: 'Emergency Stop (Stop)' },
            { id: 'photo', name: 'Photo (Photo)' },
            { id: 'record', name: 'Record Toggle (Record)' },
            { id: 'idr', name: 'Request IDR (IDR)' },
            { id: 'liveview', name: 'LiveView Parameters (LiveView)' },
            { id: 'combined_joy', name: 'Combined RC Control (127B)' },
            { id: 'rf_probe', name: 'RF Parameter Probe' },
            { id: 'wifi_direct', name: 'Controller Wi-Fi Hotspot' }
        ];
        const currentPreset = ref('takeoff');
        const feType = ref('0x14');
        const cmdShort = ref('0x0301');
        const cmdByte = ref('0x01');
        const hexContent = ref('');
        const repeats = ref(1);
        const interval = ref(50);
        const byteCount = computed(() => {
            const clean = hexContent.value.replace(/[\s\r\n]/g, '');
            return Math.floor(clean.length / 2);
        });
        function applyPreset(id) {
            currentPreset.value = id;
            let bytes = null;
            switch (id) {
                case 'heartbeat':
                    bytes = PacketBuilder.buildHeartbeat();
                    feType.value = '0x14';
                    break;
                case 'handshake':
                    bytes = PacketBuilder.buildHandshake();
                    feType.value = '0x12';
                    break;
                case 'takeoff':
                    bytes = PacketBuilder.buildTakeoff();
                    feType.value = '0x14';
                    break;
                case 'land':
                    bytes = PacketBuilder.buildLand();
                    feType.value = '0x14';
                    break;
                case 'rth':
                    bytes = PacketBuilder.buildRTH();
                    feType.value = '0x14';
                    break;
                case 'emergency':
                    bytes = PacketBuilder.buildEmergencyStop();
                    feType.value = '0x14';
                    break;
                case 'photo':
                    bytes = PacketBuilder.buildCameraTakePhoto();
                    feType.value = '0x15';
                    break;
                case 'record':
                    bytes = PacketBuilder.buildCameraStartRecord();
                    feType.value = '0x15';
                    break;
                case 'idr':
                    bytes = PacketBuilder.buildIdrRequest();
                    feType.value = '0x15';
                    break;
                case 'liveview':
                    bytes = PacketBuilder.buildLiveViewParams();
                    feType.value = '0x15';
                    break;
                case 'combined_joy':
                    bytes = PacketBuilder.buildCombinedControl(store.userJoysticks.throttle, store.userJoysticks.yaw, store.userJoysticks.pitch, store.userJoysticks.roll);
                    feType.value = 'none';
                    break;
                case 'rf_probe':
                    bytes = PacketBuilder.buildRfProbe(true);
                    feType.value = '0x14';
                    break;
                case 'wifi_direct':
                    bytes = PacketBuilder.buildWifiDirectSwitch(true);
                    feType.value = '0x15';
                    break;
            }
            if (bytes) {
                hexContent.value = ByteUtils.bytesToHex(bytes);
                store.addLog('INFO', `Vue3 constructor loaded: ${id} (${bytes.length} bytes)`);
            }
        }
        function rebuildFrame() {
            if (feType.value === 'none')
                return;
            try {
                const s = parseInt(cmdShort.value, 16) || 0x1200;
                const b = parseInt(cmdByte.value, 16) || 0;
                const f = parseInt(feType.value, 16) || 0x14;
                const inner = FfFdCommand.buildWithCmdByte(b, null, s);
                const full = FeTransport.wrap(inner, f);
                hexContent.value = ByteUtils.bytesToHex(full);
            }
            catch (_) { }
        }
        function onSend() {
            DroneControlService.sendRawHex(hexContent.value, repeats.value, interval.value);
        }
        function loadHex(hex) {
            hexContent.value = hex;
            store.addLog('INFO', `Loaded packet (${Math.floor(hex.length / 2)} bytes) into builder`);
        }
        __expose({
            loadHex
        });
        onMounted(() => {
            applyPreset('takeoff');
        });
        const __returned__ = { store, presets, currentPreset, feType, cmdShort, cmdByte, hexContent, repeats, interval, byteCount, applyPreset, rebuildFrame, onSend, loadHex };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, createCommentVNode as _createCommentVNode, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "constructor-panel" };
const _hoisted_2 = { class: "form-item" };
const _hoisted_3 = { class: "preset-chips" };
const _hoisted_4 = { class: "form-item" };
const _hoisted_5 = {
    key: 0,
    class: "form-item"
};
const _hoisted_6 = { class: "inline-grid" };
const _hoisted_7 = { class: "form-item" };
const _hoisted_8 = { class: "label-row" };
const _hoisted_9 = { class: "byte-count" };
const _hoisted_10 = { class: "inline-grid" };
const _hoisted_11 = { class: "form-item" };
const _hoisted_12 = { class: "form-item" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_tag = _resolveComponent("el-tag");
    const _component_el_option = _resolveComponent("el-option");
    const _component_el_select = _resolveComponent("el-select");
    const _component_el_input = _resolveComponent("el-input");
    const _component_el_input_number = _resolveComponent("el-input-number");
    const _component_el_button = _resolveComponent("el-button");
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _cache[14] || (_cache[14] = _createElementVNode("div", { class: "panel-title" }, "🛠️ Vue 3 Packet Builder", -1 /* CACHED */)),
        _cache[15] || (_cache[15] = _createElementVNode("p", { class: "desc-text" }, " Build binary packets in Vue 3 and send them to the phone USB port via WebSocket passthrough. ", -1 /* CACHED */)),
        _createCommentVNode(" Presets Selector "),
        _createElementVNode("div", _hoisted_2, [
            _cache[6] || (_cache[6] = _createElementVNode("div", { class: "item-label" }, "Protocol Presets:", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_3, [
                (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.presets, (p) => {
                    return _createVNode(_component_el_tag, {
                        key: p.id,
                        effect: $setup.currentPreset === p.id ? 'dark' : 'plain',
                        class: "preset-chip",
                        onClick: $event => ($setup.applyPreset(p.id))
                    }, {
                        default: _withCtx(() => [
                            _createTextVNode(_toDisplayString(p.name), 1 /* TEXT */)
                        ]),
                        _: 2 /* DYNAMIC */
                    }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["effect", "onClick"]);
                }), 64 /* STABLE_FRAGMENT */))
            ])
        ]),
        _createCommentVNode(" FE Frame Options "),
        _createElementVNode("div", _hoisted_4, [
            _cache[7] || (_cache[7] = _createElementVNode("div", { class: "item-label" }, "FE Transport Type (FE Type):", -1 /* CACHED */)),
            _createVNode(_component_el_select, {
                modelValue: $setup.feType,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.feType) = $event)),
                size: "small",
                onChange: $setup.rebuildFrame,
                style: { "width": "100%" }
            }, {
                default: _withCtx(() => [
                    _createVNode(_component_el_option, {
                        value: "0x14",
                        label: "0x14 - Flight Control / Heartbeat"
                    }),
                    _createVNode(_component_el_option, {
                        value: "0x15",
                        label: "0x15 - Camera Command Channel"
                    }),
                    _createVNode(_component_el_option, {
                        value: "0x12",
                        label: "0x12 - AOA Handshake Protocol"
                    }),
                    _createVNode(_component_el_option, {
                        value: "0x16",
                        label: "0x16 - FPV RF Configuration Channel"
                    }),
                    _createVNode(_component_el_option, {
                        value: "none",
                        label: "No FE Wrapper (Raw HFD Data)"
                    })
                ]),
                _: 1 /* STABLE */
            }, 8 /* PROPS */, ["modelValue"])
        ]),
        ($setup.feType !== 'none')
            ? (_openBlock(), _createElementBlock("div", _hoisted_5, [
                _createElementVNode("div", _hoisted_6, [
                    _createElementVNode("div", null, [
                        _cache[8] || (_cache[8] = _createElementVNode("div", { class: "item-label" }, "Inner Short (LE):", -1 /* CACHED */)),
                        _createVNode(_component_el_input, {
                            modelValue: $setup.cmdShort,
                            "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.cmdShort) = $event)),
                            size: "small",
                            onInput: $setup.rebuildFrame,
                            placeholder: "e.g.: 0x0301"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _createElementVNode("div", null, [
                        _cache[9] || (_cache[9] = _createElementVNode("div", { class: "item-label" }, "Inner Cmd Byte (Hex):", -1 /* CACHED */)),
                        _createVNode(_component_el_input, {
                            modelValue: $setup.cmdByte,
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.cmdByte) = $event)),
                            size: "small",
                            onInput: $setup.rebuildFrame,
                            placeholder: "e.g.: 0x01"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ])
                ])
            ]))
            : _createCommentVNode("v-if", true),
        _createCommentVNode(" Hex Input/Edit Area "),
        _createElementVNode("div", _hoisted_7, [
            _createElementVNode("div", _hoisted_8, [
                _cache[10] || (_cache[10] = _createElementVNode("span", { class: "item-label" }, "Packet HEX Payload (editable):", -1 /* CACHED */)),
                _createElementVNode("span", _hoisted_9, "Bytes: " + _toDisplayString($setup.byteCount) + "B", 1 /* TEXT */)
            ]),
            _createVNode(_component_el_input, {
                modelValue: $setup.hexContent,
                "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.hexContent) = $event)),
                type: "textarea",
                rows: 3,
                placeholder: "Enter HEX or generate from preset above...",
                style: { "font-family": "var(--mono)", "font-size": "11px" }
            }, null, 8 /* PROPS */, ["modelValue"])
        ]),
        _createCommentVNode(" Repeats & Interval "),
        _createElementVNode("div", _hoisted_10, [
            _createElementVNode("div", _hoisted_11, [
                _cache[11] || (_cache[11] = _createElementVNode("div", { class: "item-label" }, "Repeat Count:", -1 /* CACHED */)),
                _createVNode(_component_el_input_number, {
                    modelValue: $setup.repeats,
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.repeats) = $event)),
                    min: 1,
                    max: 50,
                    size: "small",
                    style: { "width": "100%" }
                }, null, 8 /* PROPS */, ["modelValue"])
            ]),
            _createElementVNode("div", _hoisted_12, [
                _cache[12] || (_cache[12] = _createElementVNode("div", { class: "item-label" }, "Interval (ms):", -1 /* CACHED */)),
                _createVNode(_component_el_input_number, {
                    modelValue: $setup.interval,
                    "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => (($setup.interval) = $event)),
                    min: 10,
                    max: 1000,
                    step: 10,
                    size: "small",
                    style: { "width": "100%" }
                }, null, 8 /* PROPS */, ["modelValue"])
            ])
        ]),
        _createCommentVNode(" Send Button "),
        _createVNode(_component_el_button, {
            type: "primary",
            size: "default",
            class: "send-btn",
            onClick: $setup.onSend,
            disabled: !$setup.hexContent.trim()
        }, {
            default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
                    _createTextVNode(" 🚀 Send via Passthrough to Phone USB ", -1 /* CACHED */)
                ]))]),
            _: 1 /* STABLE */
        }, 8 /* PROPS */, ["disabled"])
    ]));
}
__sfc__.__scopeId = "data-v-1c32364c";
__sfc__.render = render;
export default __sfc__;
