import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, onMounted, onUnmounted, reactive, ref } from '../../../vendor/vue.js';
import { ElMessage, ElMessageBox } from '../../../vendor/element-plus.js';
import { useI18n } from '../../i18n/index.js';
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useCockpitViewSettings } from '../../composables/useCockpitViewSettings.js';
import { useMapPosition } from '../../composables/useMapPosition.js';
import InfoPopover from '../map/InfoPopover.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'MapSettingsView',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const { t } = useI18n();
        const { mainView, pipVisible, pipPosition } = useCockpitViewSettings();
        const { source: positionSource, setManualPosition, validCoordinates } = useMapPosition();
        const config = ref(null);
        const version = ref(null);
        const versionError = ref('');
        const regions = ref([]);
        const temporaryCache = ref(null);
        const connectionTest = ref(null);
        const testing = ref(false);
        const saving = ref(false);
        const draft = reactive({ latitude: 52.52, longitude: 13.405, radiusKm: 5, minZoom: 11, maxZoom: 16 });
        let regionTimer;
        let cacheTimer;
        const isMapbox = computed(() => config.value?.provider === 'mapbox-satellite' || config.value?.provider === 'mapbox-style');
        const hasGps = computed(() => {
            const lat = store.telemetry.latitude;
            const lon = store.telemetry.longitude;
            return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);
        });
        const draftCoordsValid = computed(() => validCoordinates(draft.latitude, draft.longitude));
        const positionSourceLabel = computed(() => positionSource.value === 'drone' ? t('map.currentDrone') : positionSource.value === 'manual' ? t('map.currentManual') : t('map.currentNone'));
        const cacheCoverage = computed(() => {
            const bounds = temporaryCache.value?.bounds;
            if (!bounds)
                return '—';
            return `${bounds.south.toFixed(3)}…${bounds.north.toFixed(3)} / ${bounds.west.toFixed(3)}…${bounds.east.toFixed(3)}`;
        });
        function localTokenType(token) {
            if (token === '********')
                return config.value?.tokenType || 'none';
            if (token.startsWith('pk.'))
                return 'public';
            if (token.startsWith('sk.'))
                return 'secret';
            if (token.startsWith('tk.'))
                return 'temporary';
            return token ? 'unknown' : 'none';
        }
        const effectiveTokenType = computed(() => connectionTest.value?.tokenType || localTokenType(config.value?.accessToken || ''));
        const tokenTypeLabel = computed(() => ({ public: t('map.publicToken'), secret: t('map.secretToken'), temporary: t('map.temporaryToken'), unknown: t('map.unknownToken'), none: t('map.noToken') }[effectiveTokenType.value]));
        const tokenTagType = computed(() => effectiveTokenType.value === 'secret' ? 'warning' : effectiveTokenType.value === 'unknown' ? 'danger' : 'info');
        function applyPreset() {
            if (!config.value)
                return;
            connectionTest.value = null;
            if (config.value.provider === 'osm') {
                config.value.style = 'street';
                config.value.tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
                config.value.attribution = '© OpenStreetMap contributors';
            }
            else if (config.value.provider === 'mapbox-satellite') {
                config.value.style = 'satellite';
                config.value.attribution = '© Mapbox © OpenStreetMap';
            }
            else if (config.value.provider === 'mapbox-style') {
                config.value.style = 'mapbox-style';
                if (!config.value.mapboxStyle)
                    config.value.mapboxStyle = 'mapbox://styles/mapbox/streets-v12';
                config.value.attribution = '© Mapbox © OpenStreetMap';
            }
            else if (config.value.provider === 'custom')
                config.value.style = 'custom';
        }
        async function testConnection(showToast = true) {
            if (!config.value)
                return false;
            testing.value = true;
            connectionTest.value = null;
            try {
                connectionTest.value = await MapService.testConfig(config.value);
                if (showToast)
                    connectionTest.value.ok ? ElMessage.success(t('map.testSuccessToast')) : ElMessage.warning(connectionTest.value.message);
                return connectionTest.value.ok;
            }
            catch (e) {
                const message = e?.message || t('map.testFailed');
                connectionTest.value = { ok: false, provider: config.value.provider, tokenType: localTokenType(config.value.accessToken), httpStatus: 0, resource: '', contentType: '', message };
                if (showToast)
                    ElMessage.error(message);
                return false;
            }
            finally {
                testing.value = false;
            }
        }
        async function saveConfig() {
            if (!config.value)
                return;
            saving.value = true;
            try {
                config.value = await MapService.saveConfig(config.value);
                const ok = await testConnection(false);
                if (ok)
                    ElMessage.success(t('map.savedOk'));
                else
                    ElMessage.warning(t('map.savedFailed', { error: connectionTest.value?.message || t('map.error') }));
            }
            catch (e) {
                ElMessage.error(e?.message || t('map.saveError'));
            }
            finally {
                saving.value = false;
            }
        }
        function useDronePosition() {
            if (!hasGps.value)
                return;
            draft.latitude = store.telemetry.latitude;
            draft.longitude = store.telemetry.longitude;
        }
        function setCurrentPosition() {
            if (!draftCoordsValid.value)
                return;
            setManualPosition(draft.latitude, draft.longitude);
        }
        async function refreshRegions() {
            try {
                regions.value = await MapService.regions();
            }
            catch (e) {
                console.warn('Could not refresh offline regions:', e?.message || e);
            }
        }
        async function refreshTemporaryCache() {
            try {
                temporaryCache.value = await MapService.temporaryCache();
            }
            catch (e) {
                console.warn('Could not refresh temporary map cache:', e?.message || e);
            }
        }
        async function clearTemporaryCache() {
            try {
                await ElMessageBox.confirm(t('map.clearCacheConfirm'), t('map.clearCacheTitle'), { confirmButtonText: t('map.clearCache'), cancelButtonText: t('actions.cancel'), type: 'warning' });
                const result = await MapService.clearTemporaryCache();
                temporaryCache.value = result.cache;
                ElMessage.success(t('map.cacheCleared'));
            }
            catch (e) {
                if (e !== 'cancel' && e !== 'close')
                    ElMessage.error(e?.message || t('map.clearCacheError'));
            }
        }
        async function download() {
            if (config.value?.provider === 'osm') {
                ElMessage.warning(t('map.offlineOsmBlocked'));
                return;
            }
            try {
                await MapService.downloadRegion({ latitude: draft.latitude, longitude: draft.longitude, radiusM: draft.radiusKm * 1000, minZoom: draft.minZoom, maxZoom: draft.maxZoom });
                await refreshRegions();
                ElMessage.success(t('map.offlineStarted'));
            }
            catch (e) {
                ElMessage.error(e?.message || t('map.offlineStartError'));
            }
        }
        function pct(r) { return r.total ? Math.min(100, Math.round((r.downloaded / r.total) * 100)) : 0; }
        function isProgressStatus(status) { return ['downloading', 'updating', 'reloading'].includes(status); }
        function isBusy(r) { return isProgressStatus(r.status) || r.status === 'clearing'; }
        function statusLabel(status) { return { ready: t('map.ready'), ready_with_errors: t('map.readyErrors'), tiles_cleared: t('map.tilesDeleted'), clearing: t('map.deletingTiles'), error: t('map.error') }[status] || status; }
        function statusTagType(status) { return status === 'ready' ? 'success' : status === 'error' ? 'danger' : status === 'tiles_cleared' ? 'info' : 'warning'; }
        function providerLabel(r) {
            if (r.provider === 'mapbox-satellite')
                return 'Mapbox Satellite';
            if (r.provider === 'mapbox-style')
                return r.style === 'outdoors' ? 'Mapbox Outdoors' : 'Mapbox Style';
            if (r.provider === 'osm')
                return 'OpenStreetMap';
            return 'Custom XYZ';
        }
        function formatBytes(bytes) {
            if (!Number.isFinite(bytes) || bytes <= 0)
                return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            let value = bytes;
            let unit = 0;
            while (value >= 1024 && unit < units.length - 1) {
                value /= 1024;
                unit++;
            }
            return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
        }
        function formatTimestamp(value) { return value ? new Date(value).toLocaleString() : '—'; }
        async function updateTiles(region) {
            try {
                await MapService.updateRegion(region.id);
                await refreshRegions();
                ElMessage.success(t('map.updateStarted'));
            }
            catch (e) {
                ElMessage.error(e?.message || t('map.updateError'));
            }
        }
        async function reloadTiles(region) {
            try {
                await ElMessageBox.confirm(t('map.reloadConfirm', { count: region.total, id: region.id }), t('map.reloadTitle'), { confirmButtonText: t('map.reload'), cancelButtonText: t('actions.cancel'), type: 'warning' });
                await MapService.reloadRegion(region.id);
                await refreshRegions();
                ElMessage.success(t('map.reloadStarted'));
            }
            catch (e) {
                if (e !== 'cancel' && e !== 'close')
                    ElMessage.error(e?.message || t('map.reloadError'));
            }
        }
        async function clearTiles(region) {
            try {
                await ElMessageBox.confirm(t('map.deleteTilesConfirm', { id: region.id }), t('map.deleteTilesTitle'), { confirmButtonText: t('map.deleteTiles'), cancelButtonText: t('actions.cancel'), type: 'warning' });
                await MapService.clearRegionTiles(region.id);
                await refreshRegions();
                ElMessage.success(t('map.deleteTilesStarted'));
            }
            catch (e) {
                if (e !== 'cancel' && e !== 'close')
                    ElMessage.error(e?.message || t('map.deleteTilesError'));
            }
        }
        async function removeRegion(region) {
            try {
                await ElMessageBox.confirm(t('map.removeConfirm', { id: region.id }), t('map.removeTitle'), { confirmButtonText: t('map.remove'), cancelButtonText: t('actions.cancel'), type: 'warning' });
                await MapService.deleteRegion(region.id);
                await refreshRegions();
                ElMessage.success(t('map.removeDone'));
            }
            catch (e) {
                if (e !== 'cancel' && e !== 'close')
                    ElMessage.error(e?.message || t('map.removeError'));
            }
        }
        function onMapConfigChanged(event) {
            const detail = event.detail;
            if (!detail)
                return;
            config.value = detail;
            connectionTest.value = null;
        }
        onMounted(async () => {
            try {
                version.value = await MapService.getVersion();
            }
            catch (e) {
                versionError.value = t('map.versionUnavailable', { error: e?.message || t('map.sourceUnavailable') });
            }
            try {
                config.value = await MapService.getConfig();
            }
            catch (e) {
                ElMessage.error(e?.message || t('map.loadError'));
            }
            window.addEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged);
            await Promise.all([refreshRegions(), refreshTemporaryCache()]);
            regionTimer = setInterval(refreshRegions, 1500);
            cacheTimer = setInterval(refreshTemporaryCache, 5000);
        });
        onUnmounted(() => {
            if (regionTimer)
                clearInterval(regionTimer);
            if (cacheTimer)
                clearInterval(cacheTimer);
            window.removeEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged);
        });
        const __returned__ = { store, t, mainView, pipVisible, pipPosition, positionSource, setManualPosition, validCoordinates, config, version, versionError, regions, temporaryCache, connectionTest, testing, saving, draft, get regionTimer() { return regionTimer; }, set regionTimer(v) { regionTimer = v; }, get cacheTimer() { return cacheTimer; }, set cacheTimer(v) { cacheTimer = v; }, isMapbox, hasGps, draftCoordsValid, positionSourceLabel, cacheCoverage, localTokenType, effectiveTokenType, tokenTypeLabel, tokenTagType, applyPreset, testConnection, saveConfig, useDronePosition, setCurrentPosition, refreshRegions, refreshTemporaryCache, clearTemporaryCache, download, pct, isProgressStatus, isBusy, statusLabel, statusTagType, providerLabel, formatBytes, formatTimestamp, updateTiles, reloadTiles, clearTiles, removeRegion, onMapConfigChanged, InfoPopover };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode, openBlock as _openBlock, createBlock as _createBlock, createCommentVNode as _createCommentVNode, createElementBlock as _createElementBlock, normalizeClass as _normalizeClass } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "settings-page" };
const _hoisted_2 = { class: "field-with-info" };
const _hoisted_3 = { class: "token-field" };
const _hoisted_4 = { class: "token-chips" };
const _hoisted_5 = { class: "chip-with-info" };
const _hoisted_6 = {
    key: 0,
    class: "chip-with-info"
};
const _hoisted_7 = { class: "field-with-info wrap" };
const _hoisted_8 = { class: "position-actions" };
const _hoisted_9 = { class: "sep" };
const _hoisted_10 = { class: "cache-section" };
const _hoisted_11 = { class: "section-title-row" };
const _hoisted_12 = { class: "muted" };
const _hoisted_13 = {
    key: 0,
    class: "cache-grid"
};
const _hoisted_14 = {
    key: 1,
    class: "empty-note"
};
const _hoisted_15 = { class: "downloaded-heading" };
const _hoisted_16 = { class: "muted" };
const _hoisted_17 = {
    key: 2,
    class: "muted"
};
const _hoisted_18 = { class: "muted" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_descriptions_item = _resolveComponent("el-descriptions-item");
    const _component_el_descriptions = _resolveComponent("el-descriptions");
    const _component_el_alert = _resolveComponent("el-alert");
    const _component_el_skeleton = _resolveComponent("el-skeleton");
    const _component_el_card = _resolveComponent("el-card");
    const _component_el_radio_button = _resolveComponent("el-radio-button");
    const _component_el_radio_group = _resolveComponent("el-radio-group");
    const _component_el_form_item = _resolveComponent("el-form-item");
    const _component_el_switch = _resolveComponent("el-switch");
    const _component_el_form = _resolveComponent("el-form");
    const _component_el_option = _resolveComponent("el-option");
    const _component_el_select = _resolveComponent("el-select");
    const _component_el_input = _resolveComponent("el-input");
    const _component_el_tag = _resolveComponent("el-tag");
    const _component_el_slider = _resolveComponent("el-slider");
    const _component_el_button = _resolveComponent("el-button");
    const _component_el_input_number = _resolveComponent("el-input-number");
    const _component_el_divider = _resolveComponent("el-divider");
    const _component_el_table_column = _resolveComponent("el-table-column");
    const _component_el_progress = _resolveComponent("el-progress");
    const _component_el_table = _resolveComponent("el-table");
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("h2", null, _toDisplayString($setup.t('map.settings')), 1 /* TEXT */),
        _createVNode(_component_el_card, { class: "card version-card" }, {
            header: _withCtx(() => [
                _createTextVNode(_toDisplayString($setup.t('map.versionIndex')), 1 /* TEXT */)
            ]),
            default: _withCtx(() => [
                ($setup.version)
                    ? (_openBlock(), _createBlock(_component_el_descriptions, {
                        key: 0,
                        column: 2,
                        border: "",
                        size: "small"
                    }, {
                        default: _withCtx(() => [
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.projectPackage')
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString($setup.version.projectVersion), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.androidApp')
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString($setup.version.appVersion), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.backend')
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString($setup.version.backendVersion), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.webUi')
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString($setup.version.webUiVersion), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.module')
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString($setup.version.mapModuleVersion), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.api')
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode("v" + _toDisplayString($setup.version.mapApiVersion), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_descriptions_item, {
                                label: $setup.t('map.buildDate'),
                                span: 2
                            }, {
                                default: _withCtx(() => [
                                    _createTextVNode(_toDisplayString($setup.version.buildDate), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"])
                        ]),
                        _: 1 /* STABLE */
                    }))
                    : ($setup.versionError)
                        ? (_openBlock(), _createBlock(_component_el_alert, {
                            key: 1,
                            type: "warning",
                            closable: false,
                            title: $setup.versionError
                        }, null, 8 /* PROPS */, ["title"]))
                        : (_openBlock(), _createBlock(_component_el_skeleton, {
                            key: 2,
                            rows: 2,
                            animated: ""
                        }))
            ]),
            _: 1 /* STABLE */
        }),
        _createVNode(_component_el_card, { class: "card" }, {
            header: _withCtx(() => [
                _createTextVNode(_toDisplayString($setup.t('map.cockpitDisplay')), 1 /* TEXT */)
            ]),
            default: _withCtx(() => [
                _createVNode(_component_el_form, { "label-width": "190px" }, {
                    default: _withCtx(() => [
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.mainView')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_radio_group, {
                                    modelValue: $setup.mainView,
                                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.mainView) = $event))
                                }, {
                                    default: _withCtx(() => [
                                        _createVNode(_component_el_radio_button, { value: "video" }, {
                                            default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString($setup.t('map.liveview')), 1 /* TEXT */)
                                            ]),
                                            _: 1 /* STABLE */
                                        }),
                                        _createVNode(_component_el_radio_button, { value: "map" }, {
                                            default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString($setup.t('map.map')), 1 /* TEXT */)
                                            ]),
                                            _: 1 /* STABLE */
                                        })
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["modelValue"])
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.smallWindow')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_switch, {
                                    modelValue: $setup.pipVisible,
                                    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.pipVisible) = $event)),
                                    "active-text": $setup.t('map.visible'),
                                    "inactive-text": $setup.t('map.hidden')
                                }, null, 8 /* PROPS */, ["modelValue", "active-text", "inactive-text"])
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.smallWindowPosition')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_radio_group, {
                                    modelValue: $setup.pipPosition,
                                    "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.pipPosition) = $event)),
                                    disabled: !$setup.pipVisible
                                }, {
                                    default: _withCtx(() => [
                                        _createVNode(_component_el_radio_button, { value: "overlay" }, {
                                            default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString($setup.t('map.inMainImage')), 1 /* TEXT */)
                                            ]),
                                            _: 1 /* STABLE */
                                        }),
                                        _createVNode(_component_el_radio_button, { value: "controls" }, {
                                            default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString($setup.t('map.belowControls')), 1 /* TEXT */)
                                            ]),
                                            _: 1 /* STABLE */
                                        })
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["modelValue", "disabled"])
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_alert, {
                            type: "info",
                            closable: false,
                            "show-icon": ""
                        }, {
                            default: _withCtx(() => [
                                _createTextVNode(_toDisplayString($setup.t('map.swapInfo')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _: 1 /* STABLE */
                })
            ]),
            _: 1 /* STABLE */
        }),
        _createVNode(_component_el_card, { class: "card" }, {
            header: _withCtx(() => [
                _createTextVNode(_toDisplayString($setup.t('map.source')), 1 /* TEXT */)
            ]),
            default: _withCtx(() => [
                ($setup.config)
                    ? (_openBlock(), _createBlock(_component_el_form, {
                        key: 0,
                        class: "compact-map-form",
                        "label-width": "190px"
                    }, {
                        default: _withCtx(() => [
                            _createVNode(_component_el_form_item, {
                                label: $setup.t('map.provider')
                            }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_select, {
                                        modelValue: $setup.config.provider,
                                        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.config.provider) = $event)),
                                        onChange: $setup.applyPreset
                                    }, {
                                        default: _withCtx(() => [
                                            _createVNode(_component_el_option, {
                                                label: "OpenStreetMap",
                                                value: "osm"
                                            }),
                                            _createVNode(_component_el_option, {
                                                label: "Mapbox Satellite (Raster Tiles)",
                                                value: "mapbox-satellite"
                                            }),
                                            _createVNode(_component_el_option, {
                                                label: "Mapbox Studio Style (Static Tiles)",
                                                value: "mapbox-style"
                                            }),
                                            _createVNode(_component_el_option, {
                                                label: "Custom XYZ",
                                                value: "custom"
                                            })
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["modelValue"])
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            ($setup.isMapbox)
                                ? (_openBlock(), _createBlock(_component_el_form_item, {
                                    key: 0,
                                    label: $setup.t('map.style')
                                }, {
                                    default: _withCtx(() => [
                                        _createElementVNode("div", _hoisted_2, [
                                            _createVNode(_component_el_input, {
                                                modelValue: $setup.config.mapboxStyle,
                                                "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.config.mapboxStyle) = $event)),
                                                placeholder: "mapbox://styles/mapbox/streets-v12",
                                                disabled: $setup.config.provider === 'mapbox-satellite'
                                            }, null, 8 /* PROPS */, ["modelValue", "disabled"]),
                                            _createVNode($setup["InfoPopover"], {
                                                content: $setup.config.provider === 'mapbox-satellite' ? $setup.t('map.styleUnused') : $setup.t('map.styleStaticInfo'),
                                                "aria-label": $setup.t('map.style')
                                            }, null, 8 /* PROPS */, ["content", "aria-label"])
                                        ])
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["label"]))
                                : _createCommentVNode("v-if", true),
                            ($setup.config.provider === 'osm')
                                ? (_openBlock(), _createBlock(_component_el_form_item, {
                                    key: 1,
                                    label: $setup.t('map.tileSource')
                                }, {
                                    default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
                                            _createElementVNode("span", { class: "muted" }, "https://tile.openstreetmap.org/{z}/{x}/{y}.png", -1 /* CACHED */)
                                        ]))]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["label"]))
                                : _createCommentVNode("v-if", true),
                            ($setup.config.provider === 'custom')
                                ? (_openBlock(), _createBlock(_component_el_form_item, {
                                    key: 2,
                                    label: $setup.t('map.customTileUrl')
                                }, {
                                    default: _withCtx(() => [
                                        _createVNode(_component_el_input, {
                                            modelValue: $setup.config.customTileUrlTemplate,
                                            "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => (($setup.config.customTileUrlTemplate) = $event)),
                                            placeholder: "https://example/{z}/{x}/{y}.png?key={token}"
                                        }, null, 8 /* PROPS */, ["modelValue"])
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["label"]))
                                : _createCommentVNode("v-if", true),
                            ($setup.config.provider !== 'osm')
                                ? (_openBlock(), _createBlock(_component_el_form_item, {
                                    key: 3,
                                    label: $setup.t('map.apiToken')
                                }, {
                                    default: _withCtx(() => [
                                        _createElementVNode("div", _hoisted_3, [
                                            _createVNode(_component_el_input, {
                                                modelValue: $setup.config.accessToken,
                                                "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => (($setup.config.accessToken) = $event)),
                                                type: "password",
                                                "show-password": "",
                                                placeholder: $setup.t('map.tokenPlaceholder')
                                            }, null, 8 /* PROPS */, ["modelValue", "placeholder"]),
                                            _createElementVNode("div", _hoisted_4, [
                                                _createElementVNode("span", _hoisted_5, [
                                                    _createVNode(_component_el_tag, {
                                                        type: $setup.config.hasAccessToken ? 'success' : 'info'
                                                    }, {
                                                        default: _withCtx(() => [
                                                            _createTextVNode(_toDisplayString($setup.config.hasAccessToken ? $setup.t('map.stored') : $setup.t('map.notStored')), 1 /* TEXT */)
                                                        ]),
                                                        _: 1 /* STABLE */
                                                    }, 8 /* PROPS */, ["type"]),
                                                    _createVNode($setup["InfoPopover"], {
                                                        content: $setup.t('map.tokenStorageInfo'),
                                                        "aria-label": $setup.t('map.stored')
                                                    }, null, 8 /* PROPS */, ["content", "aria-label"])
                                                ]),
                                                ($setup.isMapbox)
                                                    ? (_openBlock(), _createElementBlock("span", _hoisted_6, [
                                                        ($setup.effectiveTokenType !== 'none')
                                                            ? (_openBlock(), _createBlock(_component_el_tag, {
                                                                key: 0,
                                                                type: $setup.tokenTagType
                                                            }, {
                                                                default: _withCtx(() => [
                                                                    _createTextVNode(_toDisplayString($setup.tokenTypeLabel), 1 /* TEXT */)
                                                                ]),
                                                                _: 1 /* STABLE */
                                                            }, 8 /* PROPS */, ["type"]))
                                                            : _createCommentVNode("v-if", true),
                                                        _createVNode($setup["InfoPopover"], {
                                                            content: $setup.t('map.tokenHandlingInfo'),
                                                            "aria-label": $setup.tokenTypeLabel
                                                        }, null, 8 /* PROPS */, ["content", "aria-label"])
                                                    ]))
                                                    : _createCommentVNode("v-if", true)
                                            ])
                                        ])
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["label"]))
                                : _createCommentVNode("v-if", true),
                            _createVNode(_component_el_form_item, {
                                label: $setup.t('map.attribution')
                            }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_input, {
                                        modelValue: $setup.config.attribution,
                                        "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => (($setup.config.attribution) = $event))
                                    }, null, 8 /* PROPS */, ["modelValue"])
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_form_item, {
                                label: $setup.t('map.defaultZoom')
                            }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_slider, {
                                        modelValue: $setup.config.defaultZoom,
                                        "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => (($setup.config.defaultZoom) = $event)),
                                        min: 1,
                                        max: 19,
                                        "show-input": ""
                                    }, null, 8 /* PROPS */, ["modelValue"])
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_form_item, {
                                label: $setup.t('map.data')
                            }, {
                                default: _withCtx(() => [
                                    _createElementVNode("div", _hoisted_7, [
                                        _createVNode(_component_el_radio_group, {
                                            modelValue: $setup.config.dataMode,
                                            "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => (($setup.config.dataMode) = $event))
                                        }, {
                                            default: _withCtx(() => [
                                                _createVNode(_component_el_radio_button, { value: "auto" }, {
                                                    default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
                                                            _createTextVNode("Auto", -1 /* CACHED */)
                                                        ]))]),
                                                    _: 1 /* STABLE */
                                                }),
                                                _createVNode(_component_el_radio_button, { value: "offline" }, {
                                                    default: _withCtx(() => [
                                                        _createTextVNode(_toDisplayString($setup.t('map.offlineOnly')), 1 /* TEXT */)
                                                    ]),
                                                    _: 1 /* STABLE */
                                                }),
                                                _createVNode(_component_el_radio_button, { value: "online" }, {
                                                    default: _withCtx(() => [
                                                        _createTextVNode(_toDisplayString($setup.t('map.onlineFirst')), 1 /* TEXT */)
                                                    ]),
                                                    _: 1 /* STABLE */
                                                })
                                            ]),
                                            _: 1 /* STABLE */
                                        }, 8 /* PROPS */, ["modelValue"]),
                                        _createVNode($setup["InfoPopover"], {
                                            content: $setup.t('map.modeInfo'),
                                            "aria-label": $setup.t('map.data'),
                                            width: 380
                                        }, null, 8 /* PROPS */, ["content", "aria-label"])
                                    ])
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_form_item, { class: "action-row" }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_button, {
                                        loading: $setup.testing,
                                        onClick: $setup.testConnection
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.testConnection')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["loading"]),
                                    _createVNode(_component_el_button, {
                                        type: "primary",
                                        loading: $setup.saving,
                                        onClick: $setup.saveConfig
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.saveTest')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["loading"])
                                ]),
                                _: 1 /* STABLE */
                            }),
                            ($setup.connectionTest)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 4,
                                    class: _normalizeClass(["connection-status", $setup.connectionTest.ok ? 'ok' : 'error'])
                                }, [
                                    _createElementVNode("strong", null, _toDisplayString($setup.connectionTest.ok ? $setup.t('map.connectionSuccessful') : $setup.connectionTest.message), 1 /* TEXT */),
                                    _createElementVNode("span", null, _toDisplayString($setup.connectionTest.resource) + " · " + _toDisplayString($setup.t('map.tokenLabel')) + ": " + _toDisplayString($setup.connectionTest.tokenType) + " · HTTP " + _toDisplayString($setup.connectionTest.httpStatus || '-'), 1 /* TEXT */)
                                ], 2 /* CLASS */))
                                : _createCommentVNode("v-if", true)
                        ]),
                        _: 1 /* STABLE */
                    }))
                    : _createCommentVNode("v-if", true)
            ]),
            _: 1 /* STABLE */
        }),
        _createVNode(_component_el_card, { class: "card" }, {
            header: _withCtx(() => [
                _createTextVNode(_toDisplayString($setup.t('map.downloadOfflineArea')), 1 /* TEXT */)
            ]),
            default: _withCtx(() => [
                ($setup.config?.provider === 'osm')
                    ? (_openBlock(), _createBlock(_component_el_alert, {
                        key: 0,
                        class: "offline-warning",
                        type: "warning",
                        closable: false,
                        title: $setup.t('map.osmWarning')
                    }, null, 8 /* PROPS */, ["title"]))
                    : ($setup.isMapbox)
                        ? (_openBlock(), _createBlock(_component_el_alert, {
                            key: 1,
                            class: "offline-warning",
                            type: "info",
                            closable: false,
                            title: $setup.t('map.mapboxWarning')
                        }, null, 8 /* PROPS */, ["title"]))
                        : _createCommentVNode("v-if", true),
                _createVNode(_component_el_form, { "label-width": "190px" }, {
                    default: _withCtx(() => [
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.latitude')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_input_number, {
                                    modelValue: $setup.draft.latitude,
                                    "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => (($setup.draft.latitude) = $event)),
                                    precision: 6,
                                    step: 0.001
                                }, null, 8 /* PROPS */, ["modelValue"])
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.longitude')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_input_number, {
                                    modelValue: $setup.draft.longitude,
                                    "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => (($setup.draft.longitude) = $event)),
                                    precision: 6,
                                    step: 0.001
                                }, null, 8 /* PROPS */, ["modelValue"])
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_form_item, null, {
                            default: _withCtx(() => [
                                _createElementVNode("div", _hoisted_8, [
                                    _createVNode(_component_el_button, {
                                        onClick: $setup.useDronePosition,
                                        disabled: !$setup.hasGps
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.useDronePosition')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["disabled"]),
                                    _createVNode(_component_el_button, {
                                        type: "primary",
                                        plain: "",
                                        onClick: $setup.setCurrentPosition,
                                        disabled: !$setup.draftCoordsValid
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.setCurrentPosition')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["disabled"]),
                                    _createVNode(_component_el_tag, {
                                        type: $setup.positionSource === 'drone' ? 'success' : $setup.positionSource === 'manual' ? 'warning' : 'info'
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.positionSourceLabel), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["type"])
                                ])
                            ]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.radius')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_input_number, {
                                    modelValue: $setup.draft.radiusKm,
                                    "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => (($setup.draft.radiusKm) = $event)),
                                    min: 0.1,
                                    max: 50,
                                    step: 0.5
                                }, null, 8 /* PROPS */, ["modelValue"]),
                                _cache[17] || (_cache[17] = _createTextVNode(" km", -1 /* CACHED */))
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_form_item, {
                            label: $setup.t('map.zoom')
                        }, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_input_number, {
                                    modelValue: $setup.draft.minZoom,
                                    "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => (($setup.draft.minZoom) = $event)),
                                    min: 1,
                                    max: 19
                                }, null, 8 /* PROPS */, ["modelValue"]),
                                _cache[18] || (_cache[18] = _createTextVNode()),
                                _createElementVNode("span", _hoisted_9, _toDisplayString($setup.t('map.to')), 1 /* TEXT */),
                                _cache[19] || (_cache[19] = _createTextVNode()),
                                _createVNode(_component_el_input_number, {
                                    modelValue: $setup.draft.maxZoom,
                                    "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => (($setup.draft.maxZoom) = $event)),
                                    min: $setup.draft.minZoom,
                                    max: 19
                                }, null, 8 /* PROPS */, ["modelValue", "min"])
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["label"]),
                        _createVNode(_component_el_form_item, null, {
                            default: _withCtx(() => [
                                _createVNode(_component_el_button, {
                                    type: "success",
                                    onClick: $setup.download,
                                    disabled: $setup.config?.provider === 'osm'
                                }, {
                                    default: _withCtx(() => [
                                        _createTextVNode(_toDisplayString($setup.t('map.downloadArea')), 1 /* TEXT */)
                                    ]),
                                    _: 1 /* STABLE */
                                }, 8 /* PROPS */, ["disabled"])
                            ]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _: 1 /* STABLE */
                })
            ]),
            _: 1 /* STABLE */
        }),
        _createVNode(_component_el_card, { class: "card" }, {
            header: _withCtx(() => [
                _createTextVNode(_toDisplayString($setup.t('map.offlineMaps')), 1 /* TEXT */)
            ]),
            default: _withCtx(() => [
                _createElementVNode("section", _hoisted_10, [
                    _createElementVNode("div", _hoisted_11, [
                        _createElementVNode("div", null, [
                            _createElementVNode("strong", null, _toDisplayString($setup.t('map.temporaryCache')), 1 /* TEXT */),
                            _createElementVNode("div", _hoisted_12, _toDisplayString($setup.t('map.temporaryCacheHelp')), 1 /* TEXT */)
                        ]),
                        _createVNode(_component_el_button, {
                            type: "danger",
                            plain: "",
                            disabled: !$setup.temporaryCache?.tileCount,
                            onClick: $setup.clearTemporaryCache
                        }, {
                            default: _withCtx(() => [
                                _createTextVNode(_toDisplayString($setup.t('map.clearCache')), 1 /* TEXT */)
                            ]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["disabled"])
                    ]),
                    ($setup.temporaryCache?.tileCount)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_13, [
                            _createElementVNode("div", null, [
                                _createElementVNode("span", null, _toDisplayString($setup.t('map.cache')), 1 /* TEXT */),
                                _createElementVNode("strong", null, _toDisplayString($setup.formatBytes($setup.temporaryCache.sizeBytes)), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", null, [
                                _createElementVNode("span", null, _toDisplayString($setup.t('map.tileCount')), 1 /* TEXT */),
                                _createElementVNode("strong", null, _toDisplayString($setup.temporaryCache.tileCount), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", null, [
                                _createElementVNode("span", null, _toDisplayString($setup.t('map.lastUpdated')), 1 /* TEXT */),
                                _createElementVNode("strong", null, _toDisplayString($setup.formatTimestamp($setup.temporaryCache.lastUpdated)), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", null, [
                                _createElementVNode("span", null, _toDisplayString($setup.t('map.coverage')), 1 /* TEXT */),
                                _createElementVNode("strong", null, _toDisplayString($setup.cacheCoverage), 1 /* TEXT */)
                            ])
                        ]))
                        : (_openBlock(), _createElementBlock("div", _hoisted_14, _toDisplayString($setup.t('map.cacheEmpty')), 1 /* TEXT */))
                ]),
                _createVNode(_component_el_divider),
                _createElementVNode("section", null, [
                    _createElementVNode("div", _hoisted_15, _toDisplayString($setup.t('map.downloadedAreas')), 1 /* TEXT */),
                    _createVNode(_component_el_alert, {
                        class: "source-info",
                        type: "info",
                        closable: false,
                        "show-icon": ""
                    }, {
                        default: _withCtx(() => [
                            _createTextVNode(_toDisplayString($setup.t('map.offlineHelp')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_table, {
                        data: $setup.regions,
                        "empty-text": $setup.t('map.noOfflineAreas')
                    }, {
                        default: _withCtx(() => [
                            _createVNode(_component_el_table_column, {
                                prop: "id",
                                label: $setup.t('map.region'),
                                "min-width": "150"
                            }, null, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_table_column, {
                                label: $setup.t('map.sourceLabel'),
                                "min-width": "140"
                            }, {
                                default: _withCtx((s) => [
                                    _createElementVNode("div", null, _toDisplayString($setup.providerLabel(s.row)), 1 /* TEXT */),
                                    _createElementVNode("small", _hoisted_16, "Z" + _toDisplayString(s.row.minZoom) + "-" + _toDisplayString(s.row.maxZoom) + " · " + _toDisplayString((s.row.radiusM / 1000).toFixed(1)) + " km", 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_table_column, {
                                label: $setup.t('map.status'),
                                "min-width": "160"
                            }, {
                                default: _withCtx((s) => [
                                    ($setup.isProgressStatus(s.row.status))
                                        ? (_openBlock(), _createBlock(_component_el_progress, {
                                            key: 0,
                                            percentage: $setup.pct(s.row),
                                            status: s.row.errors ? 'warning' : undefined
                                        }, null, 8 /* PROPS */, ["percentage", "status"]))
                                        : (_openBlock(), _createBlock(_component_el_tag, {
                                            key: 1,
                                            type: $setup.statusTagType(s.row.status)
                                        }, {
                                            default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString($setup.statusLabel(s.row.status)), 1 /* TEXT */)
                                            ]),
                                            _: 2 /* DYNAMIC */
                                        }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["type"])),
                                    (s.row.errors)
                                        ? (_openBlock(), _createElementBlock("div", _hoisted_17, _toDisplayString(s.row.errors) + " " + _toDisplayString($setup.t('map.errors')), 1 /* TEXT */))
                                        : _createCommentVNode("v-if", true)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_table_column, {
                                label: $setup.t('map.cache'),
                                "min-width": "110"
                            }, {
                                default: _withCtx((s) => [
                                    _createElementVNode("div", null, _toDisplayString($setup.formatBytes(s.row.sizeBytes || 0)), 1 /* TEXT */),
                                    _createElementVNode("small", _hoisted_18, _toDisplayString(s.row.cachedTiles ?? '—') + " / " + _toDisplayString(s.row.total) + " " + _toDisplayString($setup.t('map.tileCount').toLowerCase()), 1 /* TEXT */)
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"]),
                            _createVNode(_component_el_table_column, {
                                label: $setup.t('map.actions'),
                                "min-width": "290",
                                fixed: "right"
                            }, {
                                default: _withCtx((s) => [
                                    _createVNode(_component_el_button, {
                                        link: "",
                                        type: "primary",
                                        disabled: $setup.isBusy(s.row),
                                        onClick: $event => ($setup.updateTiles(s.row))
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.update')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["disabled", "onClick"]),
                                    _createVNode(_component_el_button, {
                                        link: "",
                                        type: "warning",
                                        disabled: $setup.isBusy(s.row),
                                        onClick: $event => ($setup.reloadTiles(s.row))
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.reload')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["disabled", "onClick"]),
                                    _createVNode(_component_el_button, {
                                        link: "",
                                        type: "danger",
                                        disabled: $setup.isBusy(s.row),
                                        onClick: $event => ($setup.clearTiles(s.row))
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.deleteTiles')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["disabled", "onClick"]),
                                    _createVNode(_component_el_button, {
                                        link: "",
                                        disabled: $setup.isBusy(s.row),
                                        onClick: $event => ($setup.removeRegion(s.row))
                                    }, {
                                        default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString($setup.t('map.remove')), 1 /* TEXT */)
                                        ]),
                                        _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["disabled", "onClick"])
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["label"])
                        ]),
                        _: 1 /* STABLE */
                    }, 8 /* PROPS */, ["data", "empty-text"])
                ])
            ]),
            _: 1 /* STABLE */
        })
    ]));
}
__sfc__.__scopeId = "data-v-f0661560";
__sfc__.render = render;
export default __sfc__;
