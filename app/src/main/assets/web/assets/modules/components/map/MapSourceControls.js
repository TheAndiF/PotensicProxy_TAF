import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, ref } from '../../../vendor/vue.js';
import { useI18n } from '../../i18n/index.js';
import { MapService } from '../../services/MapService.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'MapSourceControls',
    props: {
        config: { type: null, required: true },
        modelValue: { type: Number, required: true },
        showDataMode: { type: Boolean, required: false, default: false },
        compact: { type: Boolean, required: false, default: false }
    },
    emits: ["update:modelValue", "config-saved", "error"],
    setup(__props, { expose: __expose, emit: __emit }) {
        __expose();
        const props = __props;
        const emit = __emit;
        const { t } = useI18n();
        const busy = ref(false);
        const localError = ref('');
        const isMapbox = computed(() => props.config?.provider === 'mapbox-satellite' || props.config?.provider === 'mapbox-style');
        const sourcePreset = computed(() => {
            const config = props.config;
            if (!config)
                return 'osm';
            if (config.provider !== 'mapbox-style')
                return config.provider;
            const style = config.mapboxStyle.replace(/^mapbox:\/\/styles\//, '');
            if (style === 'mapbox/streets-v12')
                return 'mapbox-streets';
            if (style === 'mapbox/outdoors-v12')
                return 'mapbox-outdoors';
            return 'mapbox-style';
        });
        function setZoom(value) { emit('update:modelValue', Math.max(1, Math.min(19, Math.round(value)))); }
        function onZoomInput(event) { setZoom(Number(event.target.value)); }
        async function savePatch(patch, fallback) {
            if (!props.config)
                return;
            busy.value = true;
            localError.value = '';
            try {
                const saved = await MapService.saveConfig(patch);
                emit('config-saved', saved);
            }
            catch (error) {
                localError.value = error?.message || fallback;
                emit('error', localError.value);
            }
            finally {
                busy.value = false;
            }
        }
        function changeSource(event) {
            const value = event.target.value;
            const patch = value === 'mapbox-streets'
                ? { provider: 'mapbox-style', style: 'street', mapboxStyle: 'mapbox://styles/mapbox/streets-v12', attribution: '© Mapbox © OpenStreetMap' }
                : value === 'mapbox-outdoors'
                    ? { provider: 'mapbox-style', style: 'outdoors', mapboxStyle: 'mapbox://styles/mapbox/outdoors-v12', attribution: '© Mapbox © OpenStreetMap' }
                    : value === 'mapbox-satellite'
                        ? { provider: 'mapbox-satellite', style: 'satellite', attribution: '© Mapbox © OpenStreetMap' }
                        : value === 'mapbox-style'
                            ? { provider: 'mapbox-style', style: 'mapbox-style', attribution: '© Mapbox © OpenStreetMap' }
                            : value === 'custom'
                                ? { provider: 'custom', style: 'custom' }
                                : { provider: 'osm', style: 'street', attribution: '© OpenStreetMap contributors' };
            void savePatch(patch, t('map.sourceUnavailable'));
        }
        function changeDataMode(event) {
            const dataMode = event.target.value;
            void savePatch({ dataMode }, t('map.sourceUnavailable'));
        }
        const __returned__ = { props, emit, t, busy, localError, isMapbox, sourcePreset, setZoom, onZoomInput, savePatch, changeSource, changeDataMode };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, withModifiers as _withModifiers, normalizeClass as _normalizeClass } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "source-field" };
const _hoisted_2 = ["value", "disabled", "aria-label"];
const _hoisted_3 = { value: "mapbox-satellite" };
const _hoisted_4 = {
    key: 0,
    class: "source-field"
};
const _hoisted_5 = ["value", "disabled", "aria-label"];
const _hoisted_6 = { value: "offline" };
const _hoisted_7 = { value: "online" };
const _hoisted_8 = ["aria-label"];
const _hoisted_9 = { class: "zoom-row" };
const _hoisted_10 = ["title"];
const _hoisted_11 = ["value", "aria-label"];
const _hoisted_12 = ["title"];
const _hoisted_13 = {
    key: 1,
    class: "quick-status"
};
const _hoisted_14 = { key: 0 };
const _hoisted_15 = {
    key: 1,
    class: "quick-error"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", {
        class: _normalizeClass(["standard-map-controls", { compact: $props.compact }]),
        onWheel: _cache[2] || (_cache[2] = _withModifiers(() => { }, ["stop"])),
        onClick: _cache[3] || (_cache[3] = _withModifiers(() => { }, ["stop"]))
    }, [
        _createElementVNode("label", _hoisted_1, [
            _createElementVNode("span", null, _toDisplayString($setup.t('map.view')), 1 /* TEXT */),
            _createElementVNode("select", {
                value: $setup.sourcePreset,
                disabled: $setup.busy,
                "aria-label": $setup.t('map.source'),
                onChange: $setup.changeSource
            }, [
                _cache[4] || (_cache[4] = _createElementVNode("option", { value: "osm" }, "OpenStreetMap", -1 /* CACHED */)),
                _createElementVNode("option", _hoisted_3, _toDisplayString($setup.t('map.satellite')), 1 /* TEXT */),
                _cache[5] || (_cache[5] = _createElementVNode("option", { value: "mapbox-streets" }, "Mapbox Streets", -1 /* CACHED */)),
                _cache[6] || (_cache[6] = _createElementVNode("option", { value: "mapbox-outdoors" }, "Mapbox Outdoors", -1 /* CACHED */)),
                _cache[7] || (_cache[7] = _createElementVNode("option", { value: "mapbox-style" }, "Mapbox Studio Style", -1 /* CACHED */)),
                _cache[8] || (_cache[8] = _createElementVNode("option", { value: "custom" }, "Custom XYZ", -1 /* CACHED */))
            ], 40 /* PROPS, NEED_HYDRATION */, _hoisted_2)
        ]),
        ($props.showDataMode)
            ? (_openBlock(), _createElementBlock("label", _hoisted_4, [
                _createElementVNode("span", null, _toDisplayString($setup.t('map.data')), 1 /* TEXT */),
                _createElementVNode("select", {
                    value: $props.config?.dataMode || 'auto',
                    disabled: $setup.busy,
                    "aria-label": $setup.t('map.data'),
                    onChange: $setup.changeDataMode
                }, [
                    _cache[9] || (_cache[9] = _createElementVNode("option", { value: "auto" }, "Auto", -1 /* CACHED */)),
                    _createElementVNode("option", _hoisted_6, _toDisplayString($setup.t('map.offlineOnly')), 1 /* TEXT */),
                    _createElementVNode("option", _hoisted_7, _toDisplayString($setup.t('map.onlineFirst')), 1 /* TEXT */)
                ], 40 /* PROPS, NEED_HYDRATION */, _hoisted_5)
            ]))
            : _createCommentVNode("v-if", true),
        _createElementVNode("div", {
            class: "zoom-control",
            "aria-label": $setup.t('map.zoom')
        }, [
            _createElementVNode("span", null, _toDisplayString($setup.t('map.zoom')), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_9, [
                _createElementVNode("button", {
                    type: "button",
                    title: $setup.t('map.zoomOut'),
                    onClick: _cache[0] || (_cache[0] = $event => ($setup.setZoom($props.modelValue - 1)))
                }, "-", 8 /* PROPS */, _hoisted_10),
                _createElementVNode("input", {
                    type: "number",
                    min: "1",
                    max: "19",
                    step: "1",
                    value: $props.modelValue,
                    "aria-label": $setup.t('map.zoom'),
                    onChange: $setup.onZoomInput
                }, null, 40 /* PROPS, NEED_HYDRATION */, _hoisted_11),
                _createElementVNode("button", {
                    type: "button",
                    title: $setup.t('map.zoomIn'),
                    onClick: _cache[1] || (_cache[1] = $event => ($setup.setZoom($props.modelValue + 1)))
                }, "+", 8 /* PROPS */, _hoisted_12)
            ])
        ], 8 /* PROPS */, _hoisted_8),
        ($setup.isMapbox || $setup.localError)
            ? (_openBlock(), _createElementBlock("div", _hoisted_13, [
                ($setup.isMapbox)
                    ? (_openBlock(), _createElementBlock("span", _hoisted_14, _toDisplayString($props.config?.hasAccessToken ? $setup.t('map.tokenStored') : $setup.t('map.tokenMissing')), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true),
                ($setup.localError)
                    ? (_openBlock(), _createElementBlock("span", _hoisted_15, _toDisplayString($setup.localError), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true)
            ]))
            : _createCommentVNode("v-if", true)
    ], 34 /* CLASS, NEED_HYDRATION */));
}
__sfc__.__scopeId = "data-v-97a20a19";
__sfc__.render = render;
export default __sfc__;
