import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, ref } from '../../../vendor/vue.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'SelfCenteringAxisControl',
    props: {
        modelValue: { type: Number, required: true },
        limit: { type: Number, required: true },
        label: { type: String, required: true }
    },
    emits: ["control-start", "update:modelValue", "control-end"],
    setup(__props, { expose: __expose, emit: __emit }) {
        __expose();
        const props = __props;
        const emit = __emit;
        const trackRef = ref(null);
        let dragging = false;
        let keyboardActive = false;
        const safeLimit = computed(() => Math.max(1, Math.round(Math.abs(Number(props.limit) || 1))));
        const safeValue = computed(() => Math.max(-safeLimit.value, Math.min(safeLimit.value, Math.round(Number(props.modelValue) || 0))));
        const normalized = computed(() => safeValue.value / safeLimit.value);
        const thumbStyle = computed(() => ({ left: `${50 + normalized.value * 45}%` }));
        const fillStyle = computed(() => {
            const target = 50 + normalized.value * 45;
            return normalized.value >= 0
                ? { left: '50%', width: `${target - 50}%` }
                : { left: `${target}%`, width: `${50 - target}%` };
        });
        function setFromPointer(e) {
            const el = trackRef.value;
            if (!el)
                return;
            const rect = el.getBoundingClientRect();
            const usable = Math.max(1, rect.width * 0.90);
            const center = rect.left + rect.width / 2;
            const dx = Math.max(-usable / 2, Math.min(usable / 2, e.clientX - center));
            emit('update:modelValue', Math.round((dx / (usable / 2)) * safeLimit.value));
        }
        function onPointerDown(e) {
            dragging = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            emit('control-start');
            setFromPointer(e);
        }
        function onPointerMove(e) {
            if (dragging)
                setFromPointer(e);
        }
        function onPointerUp(e) {
            if (!dragging)
                return;
            dragging = false;
            emit('update:modelValue', 0);
            try {
                ;
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            catch (_) { /* already released */ }
            emit('control-end');
        }
        function onLostPointerCapture() {
            if (!dragging)
                return;
            dragging = false;
            emit('update:modelValue', 0);
            emit('control-end');
        }
        function onKeyDown(e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
                return;
            e.preventDefault();
            if (!keyboardActive) {
                keyboardActive = true;
                emit('control-start');
            }
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            emit('update:modelValue', Math.max(-safeLimit.value, Math.min(safeLimit.value, safeValue.value + direction)));
        }
        function onKeyUp(e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
                return;
            e.preventDefault();
            releaseToNeutral();
        }
        function releaseToNeutral() {
            if (!dragging && !keyboardActive && safeValue.value === 0)
                return;
            dragging = false;
            keyboardActive = false;
            emit('update:modelValue', 0);
            emit('control-end');
        }
        const __returned__ = { props, emit, trackRef, get dragging() { return dragging; }, set dragging(v) { dragging = v; }, get keyboardActive() { return keyboardActive; }, set keyboardActive(v) { keyboardActive = v; }, safeLimit, safeValue, normalized, thumbStyle, fillStyle, setFromPointer, onPointerDown, onPointerMove, onPointerUp, onLostPointerCapture, onKeyDown, onKeyUp, releaseToNeutral };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, normalizeStyle as _normalizeStyle, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = ["aria-label", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", {
        ref: "trackRef",
        class: "axis-control",
        role: "slider",
        tabindex: "0",
        "aria-label": $props.label,
        "aria-valuemin": -$setup.safeLimit,
        "aria-valuemax": $setup.safeLimit,
        "aria-valuenow": $setup.safeValue,
        "aria-valuetext": $setup.safeValue === 0 ? 'Neutralstellung' : String($setup.safeValue),
        onPointerdown: $setup.onPointerDown,
        onPointermove: $setup.onPointerMove,
        onPointerup: $setup.onPointerUp,
        onPointercancel: $setup.onPointerUp,
        onLostpointercapture: $setup.onLostPointerCapture,
        onKeydown: $setup.onKeyDown,
        onKeyup: $setup.onKeyUp,
        onBlur: $setup.releaseToNeutral
    }, [
        _cache[1] || (_cache[1] = _createElementVNode("div", { class: "axis-track" }, null, -1 /* CACHED */)),
        _cache[2] || (_cache[2] = _createElementVNode("div", {
            class: "axis-center-mark",
            "aria-hidden": "true"
        }, null, -1 /* CACHED */)),
        _createElementVNode("div", {
            class: "axis-fill",
            style: _normalizeStyle($setup.fillStyle),
            "aria-hidden": "true"
        }, null, 4 /* STYLE */),
        _createElementVNode("div", {
            class: "axis-thumb",
            style: _normalizeStyle($setup.thumbStyle),
            "aria-hidden": "true"
        }, [...(_cache[0] || (_cache[0] = [
                _createElementVNode("span", { class: "axis-thumb-dot" }, null, -1 /* CACHED */)
            ]))], 4 /* STYLE */)
    ], 40 /* PROPS, NEED_HYDRATION */, _hoisted_1));
}
__sfc__.__scopeId = "data-v-a65c9588";
__sfc__.render = render;
export default __sfc__;
