import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref, computed } from '../../../vendor/vue.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'VirtualJoystick',
    props: {
        label: { type: String, required: true },
        valueLabels: { type: Array, required: false },
        modelValue: { type: Object, required: true },
        rcEcho: { type: Object, required: false }
    },
    emits: ["update:modelValue", "change", "control-start", "control-end"],
    setup(__props, { expose: __expose, emit: __emit }) {
        __expose();
        const props = __props;
        const emit = __emit;
        const boxRef = ref(null);
        let isDragging = false;
        const hasRcDot = computed(() => !!props.rcEcho);
        const valueLabels = computed(() => props.valueLabels || ['Y', 'X']);
        const knobStyle = computed(() => ({
            transform: `translate(${props.modelValue.x * 0.04}px, ${-props.modelValue.y * 0.04}px)`
        }));
        const rcDotStyle = computed(() => {
            if (!props.rcEcho)
                return {};
            return {
                transform: `translate(${props.rcEcho.x * 0.04}px, ${-props.rcEcho.y * 0.04}px)`
            };
        });
        function onPointerDown(e) {
            isDragging = true;
            emit('control-start');
            e.currentTarget.setPointerCapture(e.pointerId);
            updatePosition(e);
        }
        function onPointerMove(e) {
            if (isDragging)
                updatePosition(e);
        }
        function onPointerUp(e) {
            if (!isDragging)
                return;
            isDragging = false;
            try {
                ;
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            catch (_) { }
            emit('update:modelValue', { x: 0, y: 0 });
            emit('change', { x: 0, y: 0 });
            emit('control-end');
        }
        function updatePosition(e) {
            if (!boxRef.value)
                return;
            const rect = boxRef.value.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const maxR = rect.width / 2 - 20;
            let dx = e.clientX - cx;
            let dy = e.clientY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxR) {
                dx = (dx / dist) * maxR;
                dy = (dy / dist) * maxR;
            }
            const x = Math.round((dx / maxR) * 1000);
            const y = Math.round((-dy / maxR) * 1000);
            emit('update:modelValue', { x, y });
            emit('change', { x, y });
        }
        const __returned__ = { props, emit, boxRef, get isDragging() { return isDragging; }, set isDragging(v) { isDragging = v; }, hasRcDot, valueLabels, knobStyle, rcDotStyle, onPointerDown, onPointerMove, onPointerUp, updatePosition };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, normalizeStyle as _normalizeStyle, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "stick-wrapper" };
const _hoisted_2 = { class: "stick-title" };
const _hoisted_3 = { class: "stick-values" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, _toDisplayString($props.label), 1 /* TEXT */),
        _createElementVNode("div", {
            class: "stick-box",
            ref: "boxRef",
            onPointerdown: $setup.onPointerDown,
            onPointermove: $setup.onPointerMove,
            onPointerup: $setup.onPointerUp,
            onPointercancel: $setup.onPointerUp
        }, [
            _createElementVNode("div", {
                class: "stick-knob",
                style: _normalizeStyle($setup.knobStyle)
            }, null, 4 /* STYLE */),
            ($setup.hasRcDot)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "stick-rc-dot",
                    style: _normalizeStyle($setup.rcDotStyle)
                }, null, 4 /* STYLE */))
                : _createCommentVNode("v-if", true)
        ], 544 /* NEED_HYDRATION, NEED_PATCH */),
        _createElementVNode("div", _hoisted_3, [
            _createElementVNode("span", null, _toDisplayString($setup.valueLabels[0]) + ": " + _toDisplayString($props.modelValue.y), 1 /* TEXT */),
            _createElementVNode("span", null, _toDisplayString($setup.valueLabels[1]) + ": " + _toDisplayString($props.modelValue.x), 1 /* TEXT */)
        ])
    ]));
}
__sfc__.__scopeId = "data-v-6ee5f4ea";
__sfc__.render = render;
export default __sfc__;
