import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { unref as _unref, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, isRef as _isRef, vModelText as _vModelText, withDirectives as _withDirectives, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, renderList as _renderList, Fragment as _Fragment } from '../../../vendor/vue.js';
const _hoisted_1 = { class: "pstart-settings" };
const _hoisted_2 = { class: "settings-card" };
const _hoisted_3 = { class: "settings-title" };
const _hoisted_4 = { class: "settings-help" };
const _hoisted_5 = { class: "settings-grid" };
const _hoisted_6 = { class: "input-unit" };
const _hoisted_7 = { class: "input-unit" };
const _hoisted_8 = { class: "input-unit" };
const _hoisted_9 = { class: "input-unit" };
const _hoisted_10 = { class: "input-unit" };
const _hoisted_11 = {
    class: "rules-box",
    style: { "margin-bottom": "14px" }
};
const _hoisted_12 = ["disabled"];
const _hoisted_13 = ["disabled"];
const _hoisted_14 = { "aria-live": "polite" };
const _hoisted_15 = { key: 0 };
const _hoisted_16 = { key: 0 };
const _hoisted_17 = { class: "rules-box" };
import { useI18n } from '../../i18n.js';
import { ref, computed, onMounted, onUnmounted } from '../../../vendor/vue.js';
import { PStartPostProcessingService } from '../../services/PStartPostProcessingService.js';
import { AndroidMediaService } from '../../services/AndroidMediaService.js';
import { usePrecisionStartSettings } from '../../composables/usePrecisionStartSettings.js';
export default /*@__PURE__*/ _defineComponent({
    __name: 'PrecisionStartSettings',
    setup(__props) {
        const { t } = useI18n();
        const { endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters } = usePrecisionStartSettings();
        const analysis = ref(PStartPostProcessingService.progress);
        const errorText = ref('');
        const busy = computed(() => !['WAITING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED'].includes(analysis.value.state));
        let unsubscribe = null;
        onMounted(() => {
            try {
                const saved = localStorage.getItem('taf.pstart.analysis.latest');
                if (saved && !analysis.value.profile)
                    analysis.value = { state: 'COMPLETED_WITH_WARNINGS', completed: 0, total: 0, message: 'Letztes lokal gespeichertes Ergebnis', profile: JSON.parse(saved) };
            }
            catch { /* optional storage */ }
            unsubscribe = PStartPostProcessingService.subscribe(v => { if (v.profile || v.state !== 'WAITING')
                analysis.value = v; });
        });
        onUnmounted(() => { unsubscribe?.(); });
        async function folderChosen(event) {
            const files = event.target.files;
            if (!files?.length)
                return;
            errorText.value = '';
            try {
                await PStartPostProcessingService.analyzeFolder(files);
            }
            catch (e) {
                errorText.value = String(e);
            }
        }
        async function analyzeLast() {
            errorText.value = '';
            try {
                const images = await AndroidMediaService.listImages('recognition');
                const latest = images.filter(i => /^PStart_.+?_(STEP0|REF_\d+)_.*\.jpe?g$/i.test(i.name)).sort((a, b) => b.createdAt - a.createdAt)[0];
                const match = latest?.name.match(/^PStart_(.+?)_(?:STEP0|REF_\d+)_/i);
                if (!match)
                    throw new Error('Keine PStart-Aufnahmen gefunden');
                await PStartPostProcessingService.analyzeSavedSession(match[1]);
            }
            catch (e) {
                errorText.value = String(e);
            }
        }
        async function requestSaf() { errorText.value=''; try { await PStartPostProcessingService.requestAndroidFolder(); } catch(e) { errorText.value=String(e); } }
        async function analyzeSaf() { errorText.value=''; try { await PStartPostProcessingService.analyzeAndroidFolder(); } catch(e) { errorText.value=String(e); } }
        async function analyzeWritable() {
            errorText.value = '';
            try { await PStartPostProcessingService.analyzeWritableFolder(); }
            catch (e) { errorText.value = String(e); }
        }
        function exportResult() { if (analysis.value.profile)
            PStartPostProcessingService.exportProfile(analysis.value.profile); }
        function normalize() {
            endHeight.value = Math.max(1, Math.min(120, Number(endHeight.value) || 20));
            heightStep.value = Math.max(0.5, Math.min(50, Number(heightStep.value) || 5));
            stabilizationSeconds.value = Math.max(0, Math.min(15, Number(stabilizationSeconds.value) || 2));
            positionWarningMeters.value = Math.max(0.5, Math.min(50, Number(positionWarningMeters.value) || 3));
            positionAbortMeters.value = Math.max(positionWarningMeters.value + 0.5, Math.min(100, Number(positionAbortMeters.value) || 6));
        }
        return (_ctx, _cache) => {
            return (_openBlock(), _createElementBlock("section", _hoisted_1, [
                _createElementVNode("div", _hoisted_2, [
                    _createElementVNode("div", _hoisted_3, "🎯 " + _toDisplayString(_unref(t)('pstart.settingsTitle')), 1 /* TEXT */),
                    _createElementVNode("p", _hoisted_4, _toDisplayString(_unref(t)('pstart.settingsHelp')), 1 /* TEXT */),
                    _createElementVNode("div", _hoisted_5, [
                        _createElementVNode("label", null, [
                            _createElementVNode("span", null, _toDisplayString(_unref(t)('pstart.endHeight')), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_6, [
                                _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => (_isRef(endHeight) ? (endHeight).value = $event : null)),
                                    type: "number",
                                    min: "1",
                                    max: "120",
                                    step: "0.5",
                                    onChange: normalize
                                }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                                    [
                                        _vModelText,
                                        _unref(endHeight),
                                        void 0,
                                        { number: true }
                                    ]
                                ]),
                                _cache[5] || (_cache[5] = _createTextVNode(" m", -1 /* CACHED */))
                            ])
                        ]),
                        _createElementVNode("label", null, [
                            _createElementVNode("span", null, _toDisplayString(_unref(t)('pstart.heightStep')), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_7, [
                                _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => (_isRef(heightStep) ? (heightStep).value = $event : null)),
                                    type: "number",
                                    min: "0.5",
                                    max: "50",
                                    step: "0.5",
                                    onChange: normalize
                                }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                                    [
                                        _vModelText,
                                        _unref(heightStep),
                                        void 0,
                                        { number: true }
                                    ]
                                ]),
                                _cache[6] || (_cache[6] = _createTextVNode(" m", -1 /* CACHED */))
                            ])
                        ]),
                        _createElementVNode("label", null, [
                            _createElementVNode("span", null, _toDisplayString(_unref(t)('pstart.stabilization')), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_8, [
                                _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => (_isRef(stabilizationSeconds) ? (stabilizationSeconds).value = $event : null)),
                                    type: "number",
                                    min: "0",
                                    max: "15",
                                    step: "0.5",
                                    onChange: normalize
                                }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                                    [
                                        _vModelText,
                                        _unref(stabilizationSeconds),
                                        void 0,
                                        { number: true }
                                    ]
                                ]),
                                _cache[7] || (_cache[7] = _createTextVNode(" s", -1 /* CACHED */))
                            ])
                        ]),
                        _createElementVNode("label", null, [
                            _createElementVNode("span", null, _toDisplayString(_unref(t)('pstart.positionWarning')), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_9, [
                                _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => (_isRef(positionWarningMeters) ? (positionWarningMeters).value = $event : null)),
                                    type: "number",
                                    min: "0.5",
                                    max: "50",
                                    step: "0.5",
                                    onChange: normalize
                                }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                                    [
                                        _vModelText,
                                        _unref(positionWarningMeters),
                                        void 0,
                                        { number: true }
                                    ]
                                ]),
                                _cache[8] || (_cache[8] = _createTextVNode(" m", -1 /* CACHED */))
                            ])
                        ]),
                        _createElementVNode("label", null, [
                            _createElementVNode("span", null, _toDisplayString(_unref(t)('pstart.positionAbort')), 1 /* TEXT */),
                            _createElementVNode("span", _hoisted_10, [
                                _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => (_isRef(positionAbortMeters) ? (positionAbortMeters).value = $event : null)),
                                    type: "number",
                                    min: "1",
                                    max: "100",
                                    step: "0.5",
                                    onChange: normalize
                                }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                                    [
                                        _vModelText,
                                        _unref(positionAbortMeters),
                                        void 0,
                                        { number: true }
                                    ]
                                ]),
                                _cache[9] || (_cache[9] = _createTextVNode(" m", -1 /* CACHED */))
                            ])
                        ])
                    ]),
                    _createElementVNode("div", _hoisted_11, [
                        _cache[11] || (_cache[11] = _createElementVNode("strong", null, "PStart – Referenzauswertung (experimentell)", -1 /* CACHED */)),
                        _cache[12] || (_cache[12] = _createElementVNode("p", null, "Automatisch nach PStart oder offline mit JPEG-Ordner. Schreibbare Ordnerauswahl nur bei Browser-Unterstützung; JSON, JSONL und Analyse-JPEGs neben Rohdaten. Keine Flugfreigabe.", -1 /* CACHED */)),
                        _createElementVNode("input", {
                            type: "file",
                            accept: "image/jpeg",
                            multiple: "",
                            webkitdirectory: "",
                            directory: "",
                            onChange: folderChosen,
                            "aria-label": "Offline-Ordner auswählen"
                        }, null, 32 /* NEED_HYDRATION */),
                        _createElementVNode("button", { type: "button", disabled: busy.value, onClick: requestSaf }, "Android-Ordner freigeben (SAF)"),
                        _createElementVNode("button", { type: "button", disabled: busy.value, onClick: analyzeSaf }, "Android-Ordner auswerten und speichern"),
                        _createElementVNode("button", {
                            type: "button",
                            disabled: busy.value,
                            onClick: analyzeWritable
                        }, "Ordner mit Schreibzugriff auswerten", 8 /* PROPS */, _hoisted_12),
                        _createElementVNode("button", {
                            type: "button",
                            onClick: () => PStartPostProcessingService.exportLog()
                        }, "Diagnoselog exportieren"),
                        _createElementVNode("button", {
                            type: "button",
                            disabled: busy.value,
                            onClick: analyzeLast
                        }, "Letzte gespeicherte Sitzung auswerten", 8 /* PROPS */, _hoisted_12),
                        _createElementVNode("button", {
                            type: "button",
                            disabled: !analysis.value.profile,
                            onClick: exportResult
                        }, "Referenzprofil als JSON exportieren", 8 /* PROPS */, _hoisted_13),
                        _createElementVNode("p", _hoisted_14, _toDisplayString(analysis.value.state) + " – " + _toDisplayString(analysis.value.completed) + "/" + _toDisplayString(analysis.value.total) + " – " + _toDisplayString(analysis.value.message), 1 /* TEXT */),
                        (errorText.value)
                            ? (_openBlock(), _createElementBlock("p", _hoisted_15, _toDisplayString(errorText.value), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                        (analysis.value.profile)
                            ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                                _createElementVNode("p", null, [
                                    _cache[10] || (_cache[10] = _createElementVNode("b", null, "PLanding:", -1 /* CACHED */)),
                                    _createTextVNode(" " + _toDisplayString(analysis.value.profile.landingReadiness.status) + " – keine automatische Steuerungsfreigabe", 1 /* TEXT */)
                                ]),
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(analysis.value.profile.references, (ref) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                        key: ref.imageId,
                                        style: { "border-top": "1px solid #888", "padding": "5px 0" }
                                    }, [
                                        _createTextVNode(_toDisplayString(ref.imagePath) + " | " + _toDisplayString(ref.targetHeightM ?? '?') + " m | " + _toDisplayString(ref.zoomRole) + " | " + _toDisplayString(ref.status) + " | Zentrum: " + _toDisplayString(ref.centerPx ? ref.centerPx.join(', ') + ' px' : 'unbekannt') + " ", 1 /* TEXT */),
                                        (ref.warnings.length)
                                            ? (_openBlock(), _createElementBlock("small", _hoisted_16, " – " + _toDisplayString(ref.warnings.join('; ')), 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true)
                                    ]));
                                }), 128 /* KEYED_FRAGMENT */))
                            ], 64 /* STABLE_FRAGMENT */))
                            : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode("div", _hoisted_17, [
                        _createElementVNode("strong", null, _toDisplayString(_unref(t)('pstart.v1Rules')), 1 /* TEXT */),
                        _createElementVNode("ul", null, [
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.ruleNoLateral')), 1 /* TEXT */),
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.ruleFirstPoint')), 1 /* TEXT */),
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.rulePositionTolerance')), 1 /* TEXT */),
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.ruleGrid')), 1 /* TEXT */),
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.ruleImages')), 1 /* TEXT */),
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.ruleProtocol')), 1 /* TEXT */),
                            _createElementVNode("li", null, _toDisplayString(_unref(t)('pstart.ruleStep0')), 1 /* TEXT */)
                        ])
                    ])
                ])
            ]));
        };
    }
});

__sfc__.__scopeId = "data-v-6f4aba77";
