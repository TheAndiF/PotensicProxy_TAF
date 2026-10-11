import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { nextTick, ref, watch } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'LogConsole',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const scrollRef = ref(null);
        function pad(value) {
            return String(value).padStart(2, '0');
        }
        function saveLog() {
            const snapshot = store.logs.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`);
            const content = snapshot.length ? `${snapshot.join('\r\n')}\r\n` : '';
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const filename = `PotensicProxy_TAF_LiveLog_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.log`;
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        }
        watch(() => store.logs.length, async () => {
            await nextTick();
            if (scrollRef.value) {
                scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
            }
        });
        const __returned__ = { store, scrollRef, pad, saveLog };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, normalizeClass as _normalizeClass, createCommentVNode as _createCommentVNode } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "logs-container" };
const _hoisted_2 = { class: "logs-header" };
const _hoisted_3 = { class: "logs-actions" };
const _hoisted_4 = { class: "line-count" };
const _hoisted_5 = {
    ref: "scrollRef",
    class: "logs-scroll"
};
const _hoisted_6 = { class: "log-time" };
const _hoisted_7 = { class: "log-level" };
const _hoisted_8 = { class: "log-msg" };
const _hoisted_9 = {
    key: 0,
    class: "empty-logs"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _cache[1] || (_cache[1] = _createElementVNode("span", { class: "title" }, "Live System Logs", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_3, [
                _createElementVNode("span", _hoisted_4, _toDisplayString($setup.store.logs.length) + " / 1000 lines", 1 /* TEXT */),
                _createElementVNode("button", {
                    class: "btn",
                    onClick: $setup.saveLog
                }, "Save Log"),
                _createElementVNode("button", {
                    class: "btn btn-clear",
                    onClick: _cache[0] || (_cache[0] = $event => ($setup.store.clearLogs()))
                }, "Clear")
            ])
        ]),
        _createElementVNode("div", _hoisted_5, [
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.store.logs, (log) => {
                return (_openBlock(), _createElementBlock("div", {
                    key: log.id,
                    class: _normalizeClass(["log-line", log.level.toLowerCase()])
                }, [
                    _createElementVNode("span", _hoisted_6, "[" + _toDisplayString(log.timestamp) + "]", 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_7, "[" + _toDisplayString(log.level) + "]", 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_8, _toDisplayString(log.message), 1 /* TEXT */)
                ], 2 /* CLASS */));
            }), 128 /* KEYED_FRAGMENT */)),
            ($setup.store.logs.length === 0)
                ? (_openBlock(), _createElementBlock("div", _hoisted_9, " No log entries "))
                : _createCommentVNode("v-if", true)
        ], 512 /* NEED_PATCH */)
    ]));
}
__sfc__.__scopeId = "data-v-3660e106";
__sfc__.render = render;
export default __sfc__;
