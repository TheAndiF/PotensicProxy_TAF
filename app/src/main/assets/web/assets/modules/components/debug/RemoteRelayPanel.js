import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { UsbTransportService } from '../../services/UsbTransportService.js';
import { ByteUtils } from '../../utils/ByteUtils.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'RemoteRelayPanel',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        function onReconnect() {
            store.setTargetHost(store.connection.targetHost);
            UsbTransportService.getInstance().connect();
        }
        const __returned__ = { store, onReconnect, get ByteUtils() { return ByteUtils; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode, withKeys as _withKeys, normalizeClass as _normalizeClass, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "relay-layout" };
const _hoisted_2 = { class: "panel-box relay-panel" };
const _hoisted_3 = { class: "box-title-row" };
const _hoisted_4 = { class: "relay-form" };
const _hoisted_5 = { class: "host-row" };
const _hoisted_6 = { class: "panel-box stats-panel" };
const _hoisted_7 = { class: "stats-grid" };
const _hoisted_8 = { class: "stat-card" };
const _hoisted_9 = { class: "stat-card" };
const _hoisted_10 = { class: "stat-card" };
const _hoisted_11 = { class: "stat-card" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_tag = _resolveComponent("el-tag");
    const _component_el_input = _resolveComponent("el-input");
    const _component_el_button = _resolveComponent("el-button");
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("section", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, [
                _cache[1] || (_cache[1] = _createElementVNode("div", null, [
                    _createElementVNode("div", { class: "box-title" }, "🌐 Remote / Relay"),
                    _createElementVNode("div", { class: "box-subtitle" }, "Optional engineering connection. Not part of the normal flight control path.")
                ], -1 /* CACHED */)),
                _createVNode(_component_el_tag, {
                    type: $setup.store.connection.wsConnected ? 'success' : 'info',
                    effect: "dark",
                    size: "small"
                }, {
                    default: _withCtx(() => [
                        _createTextVNode(_toDisplayString($setup.store.connection.wsConnected ? 'Connected' : 'Disconnected'), 1 /* TEXT */)
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["type"])
            ]),
            _createElementVNode("div", _hoisted_4, [
                _cache[3] || (_cache[3] = _createElementVNode("label", {
                    class: "field-label",
                    for: "relay-host"
                }, "Relay / phone address", -1 /* CACHED */)),
                _createElementVNode("div", _hoisted_5, [
                    _createVNode(_component_el_input, {
                        id: "relay-host",
                        modelValue: $setup.store.connection.targetHost,
                        "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.store.connection.targetHost) = $event)),
                        size: "small",
                        placeholder: "47.100.253.70:19090",
                        onKeyup: _withKeys($setup.onReconnect, ["enter"])
                    }, null, 8 /* PROPS */, ["modelValue"]),
                    _createVNode(_component_el_button, {
                        type: "primary",
                        size: "small",
                        plain: "",
                        onClick: $setup.onReconnect
                    }, {
                        default: _withCtx(() => [...(_cache[2] || (_cache[2] = [
                                _createTextVNode("Connect", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    })
                ]),
                _cache[4] || (_cache[4] = _createElementVNode("div", { class: "field-help" }, " The address is only used by the optional WebSocket / HTTP transport. Flight Cockpit remains the default view. ", -1 /* CACHED */))
            ])
        ]),
        _createElementVNode("section", _hoisted_6, [
            _cache[11] || (_cache[11] = _createElementVNode("div", { class: "box-title" }, "📊 Connection Traffic", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_7, [
                _createElementVNode("div", _hoisted_8, [
                    _cache[5] || (_cache[5] = _createElementVNode("span", { class: "stat-label" }, "RX packets", -1 /* CACHED */)),
                    _createElementVNode("strong", null, _toDisplayString($setup.store.streamStats.packetsRx), 1 /* TEXT */),
                    _createElementVNode("small", null, _toDisplayString($setup.ByteUtils.formatBytes($setup.store.streamStats.bytesRx)), 1 /* TEXT */)
                ]),
                _createElementVNode("div", _hoisted_9, [
                    _cache[6] || (_cache[6] = _createElementVNode("span", { class: "stat-label" }, "TX packets", -1 /* CACHED */)),
                    _createElementVNode("strong", null, _toDisplayString($setup.store.streamStats.packetsTx), 1 /* TEXT */),
                    _createElementVNode("small", null, _toDisplayString($setup.ByteUtils.formatBytes($setup.store.streamStats.bytesTx)), 1 /* TEXT */)
                ]),
                _createElementVNode("div", _hoisted_10, [
                    _cache[7] || (_cache[7] = _createElementVNode("span", { class: "stat-label" }, "Controller USB", -1 /* CACHED */)),
                    _createElementVNode("strong", {
                        class: _normalizeClass($setup.store.connection.usbConnected ? 'ok' : 'muted')
                    }, _toDisplayString($setup.store.connection.usbConnected ? 'Connected' : 'Disconnected'), 3 /* TEXT, CLASS */),
                    _cache[8] || (_cache[8] = _createElementVNode("small", null, "Local controller status", -1 /* CACHED */))
                ]),
                _createElementVNode("div", _hoisted_11, [
                    _cache[9] || (_cache[9] = _createElementVNode("span", { class: "stat-label" }, "Passthrough", -1 /* CACHED */)),
                    _createElementVNode("strong", {
                        class: _normalizeClass($setup.store.connection.wsConnected ? 'ok' : 'muted')
                    }, _toDisplayString($setup.store.connection.wsConnected ? 'Ready' : 'Disconnected'), 3 /* TEXT, CLASS */),
                    _cache[10] || (_cache[10] = _createElementVNode("small", null, "WebSocket transport", -1 /* CACHED */))
                ])
            ])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-c7e6007d";
__sfc__.render = render;
export default __sfc__;
