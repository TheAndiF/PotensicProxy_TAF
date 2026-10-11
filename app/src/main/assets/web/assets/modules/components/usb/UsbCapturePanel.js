import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { onMounted, onUnmounted, reactive, ref } from '../../../vendor/vue.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'UsbCapturePanel',
    setup(__props, { expose: __expose }) {
        __expose();
        const busy = ref(false);
        const status = reactive({ active: false, startedAt: 0, directory: '', rawBytes: 0, feFrames: 0, fe06Bytes: 0 });
        let timer;
        const base = () => `${location.protocol}//${location.hostname}:9090`;
        async function refresh() { try {
            Object.assign(status, await (await fetch(`${base()}/api/capture/status`)).json());
        }
        catch { } }
        async function startCapture() { busy.value = true; try {
            await fetch(`${base()}/api/capture/start`, { method: 'POST' });
            await refresh();
        }
        finally {
            busy.value = false;
        } }
        async function stopCapture() { busy.value = true; try {
            await fetch(`${base()}/api/capture/stop`, { method: 'POST' });
            await refresh();
        }
        finally {
            busy.value = false;
        } }
        function downloadCapture() { window.open(`${base()}/api/capture/download`, '_blank'); }
        function fmt(v) { if (v < 1024)
            return `${v} B`; if (v < 1048576)
            return `${(v / 1024).toFixed(1)} KB`; return `${(v / 1048576).toFixed(1)} MB`; }
        onMounted(() => { refresh(); timer = window.setInterval(refresh, 1000); });
        onUnmounted(() => { if (timer)
            clearInterval(timer); });
        const __returned__ = { busy, status, get timer() { return timer; }, set timer(v) { timer = v; }, base, refresh, startCapture, stopCapture, downloadCapture, fmt };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "capture-panel" };
const _hoisted_2 = { class: "capture-actions" };
const _hoisted_3 = ["disabled"];
const _hoisted_4 = ["disabled"];
const _hoisted_5 = ["disabled"];
const _hoisted_6 = {
    key: 0,
    class: "stats"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _cache[0] || (_cache[0] = _createElementVNode("div", { class: "capture-title" }, "Video Transport Capture", -1 /* CACHED */)),
        _cache[1] || (_cache[1] = _createElementVNode("div", { class: "capture-info" }, " Records USB RAW, parsed FE frames and the complete FE 0x06 payload stream for offline ATOM protocol analysis. ", -1 /* CACHED */)),
        _createElementVNode("div", _hoisted_2, [
            (!$setup.status.active)
                ? (_openBlock(), _createElementBlock("button", {
                    key: 0,
                    class: "btn start",
                    onClick: $setup.startCapture,
                    disabled: $setup.busy
                }, "● Start Capture", 8 /* PROPS */, _hoisted_3))
                : (_openBlock(), _createElementBlock("button", {
                    key: 1,
                    class: "btn stop",
                    onClick: $setup.stopCapture,
                    disabled: $setup.busy
                }, "■ Stop Capture", 8 /* PROPS */, _hoisted_4)),
            _createElementVNode("button", {
                class: "btn",
                onClick: $setup.downloadCapture,
                disabled: $setup.status.active || !$setup.status.directory
            }, "Download Capture ZIP", 8 /* PROPS */, _hoisted_5),
            _createElementVNode("span", {
                class: _normalizeClass(['state', $setup.status.active ? 'active' : ''])
            }, _toDisplayString($setup.status.active ? 'RECORDING' : 'Idle'), 3 /* TEXT, CLASS */)
        ]),
        ($setup.status.directory)
            ? (_openBlock(), _createElementBlock("div", _hoisted_6, _toDisplayString($setup.status.directory) + " · USB " + _toDisplayString($setup.fmt($setup.status.rawBytes)) + " · FE " + _toDisplayString($setup.status.feFrames) + " frames · FE06 " + _toDisplayString($setup.fmt($setup.status.fe06Bytes)), 1 /* TEXT */))
            : _createCommentVNode("v-if", true)
    ]));
}
__sfc__.__scopeId = "data-v-eb460ea7";
__sfc__.render = render;
export default __sfc__;
