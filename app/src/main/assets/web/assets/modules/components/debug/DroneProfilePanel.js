import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref, onMounted } from '../../../vendor/vue.js';
import { ElMessage } from '../../../vendor/element-plus.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { VideoExtractor } from '../../protocol/VideoExtractor.js';
import { PacketParser } from '../../protocol/PacketParser.js';
import { useI18n } from '../../i18n/index.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'DroneProfilePanel',
    setup(__props, { expose: __expose }) {
        __expose();
        const { t } = useI18n();
        const selected = ref('ATOM');
        const transport = ref('loading');
        const codec = ref('auto');
        const busy = ref(false);
        async function load() {
            try {
                const p = await DroneControlService.getDroneProfile();
                selected.value = p.id === 'ATOM_2' ? 'ATOM_2' : 'ATOM';
                transport.value = p.videoTransport || 'unknown';
                codec.value = p.codec || 'auto';
                VideoExtractor.getInstance().setDroneModel(selected.value);
                PacketParser.setDroneProfile(selected.value);
            }
            catch (_) {
                transport.value = 'unavailable';
            }
        }
        async function onChange(value) {
            const model = value === 'ATOM_2' ? 'ATOM_2' : 'ATOM';
            busy.value = true;
            try {
                const p = await DroneControlService.setDroneProfile(model);
                selected.value = model;
                transport.value = p.videoTransport || 'unknown';
                codec.value = p.codec || 'auto';
                VideoExtractor.getInstance().setDroneModel(model);
                PacketParser.setDroneProfile(model);
                window.dispatchEvent(new CustomEvent('drone-profile-changed', { detail: p }));
                ElMessage.success(t('profile.switched', { model: model.replace('_', ' ') }));
            }
            catch (e) {
                ElMessage.error(t('profile.failed', { error: e?.message || e }));
                await load();
            }
            finally {
                busy.value = false;
            }
        }
        onMounted(load);
        const __returned__ = { t, selected, transport, codec, busy, load, onChange };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "profile-panel" };
const _hoisted_2 = { class: "profile-copy" };
const _hoisted_3 = { class: "profile-title" };
const _hoisted_4 = { class: "profile-subtitle" };
const _hoisted_5 = { class: "profile-state" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_radio_button = _resolveComponent("el-radio-button");
    const _component_el_radio_group = _resolveComponent("el-radio-group");
    const _component_el_tag = _resolveComponent("el-tag");
    return (_openBlock(), _createElementBlock("section", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, _toDisplayString($setup.t('profile.title')), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_4, _toDisplayString($setup.t('profile.subtitle')), 1 /* TEXT */)
        ]),
        _createVNode(_component_el_radio_group, {
            modelValue: $setup.selected,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.selected) = $event)),
            size: "small",
            disabled: $setup.busy,
            onChange: $setup.onChange
        }, {
            default: _withCtx(() => [
                _createVNode(_component_el_radio_button, { value: "ATOM" }, {
                    default: _withCtx(() => [...(_cache[1] || (_cache[1] = [
                            _createTextVNode("ATOM", -1 /* CACHED */)
                        ]))]),
                    _: 1 /* STABLE */
                }),
                _createVNode(_component_el_radio_button, { value: "ATOM_2" }, {
                    default: _withCtx(() => [...(_cache[2] || (_cache[2] = [
                            _createTextVNode("ATOM 2", -1 /* CACHED */)
                        ]))]),
                    _: 1 /* STABLE */
                })
            ]),
            _: 1 /* STABLE */
        }, 8 /* PROPS */, ["modelValue", "disabled"]),
        _createElementVNode("div", _hoisted_5, [
            _createVNode(_component_el_tag, {
                size: "small",
                effect: "dark",
                type: "info"
            }, {
                default: _withCtx(() => [
                    _createTextVNode(_toDisplayString($setup.transport), 1 /* TEXT */)
                ]),
                _: 1 /* STABLE */
            }),
            _createVNode(_component_el_tag, {
                size: "small",
                effect: "dark",
                type: $setup.codec === 'h264' ? 'success' : 'warning'
            }, {
                default: _withCtx(() => [
                    _createTextVNode(_toDisplayString($setup.codec.toUpperCase()), 1 /* TEXT */)
                ]),
                _: 1 /* STABLE */
            }, 8 /* PROPS */, ["type"])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-14bb6fd5";
__sfc__.render = render;
export default __sfc__;
