import { defineStore } from '../../vendor/pinia.js';
import { computed, reactive, ref } from '../../vendor/vue.js';
export const useCameraStore = defineStore('camera', () => {
    const videoResolutionIndex = ref(null);
    const photoResolutionIndex = ref(null);
    const videoEv = ref(null);
    const photoEv = ref(null);
    const zoomTarget = ref(1);
    const zoomActual = ref(null);
    const zoomMax = ref(4);
    const zoomMaxSource = ref('fallback');
    const zoomPending = ref(false);
    const zoomLastUpdate = ref(null);
    const initialization = reactive({
        configMenuLoaded: false,
        ready: false,
        attempts: 0,
        lastInitMessage: '',
        model: '',
        softVersion: '',
        supportTimerPhoto: false,
        supportAebPhoto: false
    });
    const photoMode = reactive({
        loaded: false,
        childMode: 0,
        intervalTime: 0,
        photoCount: 0,
        isTimeTaking: false
    });
    const manualMode = reactive({
        loaded: false,
        manual: false,
        shutterDen: 100,
        iso: 100,
        manualWb: false,
        wb: 5600,
        raw: false,
        photoOsd: false,
        photoGps: false
    });
    const sd = reactive({
        state: null,
        freeMb: null,
        totalMb: null,
        lastStatus: ''
    });
    const configState = reactive({
        videoOsd: false,
        remainCapture: null
    });
    const galleryEntered = ref(false);
    const galleryState = ref('CLOSED');
    const galleryError = ref('');
    const photos = ref([]);
    const videos = ref([]);
    const galleryLoading = ref(false);
    const recording = ref(false);
    const recordingPending = ref(false);
    const captureMode = ref('UNKNOWN');
    const captureFlowState = ref('IDLE');
    const capturePending = computed(() => !['IDLE', 'ERROR'].includes(captureFlowState.value));
    const lastCaptureMessage = ref('');
    const download = reactive({
        fileName: '',
        progress: 0,
        active: false,
        error: ''
    });
    const lastResponse = ref('');
    const media = computed(() => [...videos.value, ...photos.value]);
    function timestampFromCameraName(name) {
        // Common camera filename forms: ...YYYYMMDD_HHMMSS..., ...YYYY-MM-DD_HH-MM-SS...
        // and compact ...YYYYMMDDHHMMSS.... Keep this filename-derived only; do not invent a time.
        const separated = name.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[T_ -]?(\d{2})[-_:]?(\d{2})[-_:]?(\d{2})/);
        if (!separated)
            return undefined;
        const [, y, mo, d, h, mi, sec] = separated;
        const ts = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)).getTime();
        return Number.isFinite(ts) ? ts : undefined;
    }
    function parseCameraCreateTime(value) {
        if (typeof value !== 'string' || !value.trim())
            return undefined;
        const raw = value.trim();
        const direct = Date.parse(raw);
        if (Number.isFinite(direct))
            return direct;
        const m = raw.match(/(20\d{2})[-/.]?(\d{2})[-/.]?(\d{2})[ T_-]?(\d{2})[:._-]?(\d{2})[:._-]?(\d{2})/);
        if (!m)
            return undefined;
        const [, y, mo, d, h, mi, sec] = m;
        const ts = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)).getTime();
        return Number.isFinite(ts) ? ts : undefined;
    }
    function setGalleryFiles(photoNames, videoNames) {
        const previous = new Map(media.value.map(item => [item.name, item]));
        const make = (name, type) => {
            const old = previous.get(name);
            if (old)
                return { ...old, type };
            const timestamp = timestampFromCameraName(name);
            return { name, type, timestamp, timestampSource: timestamp ? 'filename' : undefined };
        };
        photos.value = photoNames.map(name => make(name, 'photo'));
        videos.value = videoNames.map(name => make(name, 'video'));
        galleryLoading.value = false;
        galleryState.value = 'READY';
        galleryError.value = '';
    }
    function applyGalleryMetadata(entries) {
        const byName = new Map(entries.map(entry => [String(entry.file || '').trim(), entry]));
        const apply = (item) => {
            const entry = byName.get(item.name.trim());
            if (!entry)
                return item;
            const cameraTimestamp = parseCameraCreateTime(entry.createtime);
            return {
                ...item,
                timestamp: cameraTimestamp ?? item.timestamp,
                timestampSource: cameraTimestamp ? 'camera' : item.timestampSource,
                size: Number.isFinite(Number(entry.len)) ? Number(entry.len) : item.size,
                lrvSize: Number.isFinite(Number(entry.lrv_len)) ? Number(entry.lrv_len) : item.lrvSize,
                createTimeRaw: entry.createtime || item.createTimeRaw
            };
        };
        photos.value = photos.value.map(apply);
        videos.value = videos.value.map(apply);
    }
    function getGalleryFile(name) {
        return media.value.find(item => item.name === name);
    }
    return {
        videoResolutionIndex,
        photoResolutionIndex,
        videoEv,
        photoEv,
        zoomTarget,
        zoomActual,
        zoomMax,
        zoomMaxSource,
        zoomPending,
        zoomLastUpdate,
        initialization,
        photoMode,
        manualMode,
        sd,
        configState,
        galleryEntered,
        galleryState,
        galleryError,
        photos,
        videos,
        media,
        galleryLoading,
        recording,
        recordingPending,
        captureMode,
        captureFlowState,
        capturePending,
        lastCaptureMessage,
        download,
        lastResponse,
        setGalleryFiles,
        applyGalleryMetadata,
        getGalleryFile
    };
});
