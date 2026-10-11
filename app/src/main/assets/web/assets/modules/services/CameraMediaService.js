import { PacketBuilder } from '../protocol/PacketBuilder.js';
import { CAMERA_USB } from '../protocol/DroneProtocol.js';
import { useCameraStore } from '../stores/useCameraStore.js';
import { useDroneStore } from '../stores/useDroneStore.js';
import { AndroidMediaService } from './AndroidMediaService.js';
export class CameraMediaService {
    static setSender(sender) {
        this.sender = sender;
    }
    /** Reset transient camera/media state when browser passthrough is interrupted. */
    static handleTransportDisconnect() {
        const cam = useCameraStore();
        this.transportReady = false;
        this.cameraInnerBuffer = new Uint8Array(0);
        if (this.cameraInitTimer)
            clearTimeout(this.cameraInitTimer);
        this.cameraInitTimer = null;
        const drone = useDroneStore();
        this.clearCaptureTimer();
        if (this.captureBackoffTimer)
            clearTimeout(this.captureBackoffTimer);
        this.captureBackoffTimer = null;
        if (this.pendingCaptureAction) {
            cam.captureFlowState = 'ERROR';
            cam.recordingPending = false;
            cam.lastCaptureMessage = 'Camera operation interrupted by passthrough disconnect';
        }
        this.pendingCaptureAction = null;
        this.pendingPhotoRequiresExplicitShutter = false;
        this.captureRetriedAfterModeError = false;
        this.resetGalleryRequestState();
        if (this.metaTimer)
            clearTimeout(this.metaTimer);
        this.metaTimer = null;
        this.metaQueue = [];
        this.currentMetaBatch = null;
        this.metadataAccumulator = '';
        for (const [, pending] of this.pendingInfo) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Camera metadata request interrupted by passthrough disconnect'));
        }
        this.pendingInfo.clear();
        if (this.pendingDelete) {
            const pending = this.pendingDelete;
            clearTimeout(pending.timer);
            this.pendingDelete = null;
            pending.reject(new Error('Camera delete interrupted by passthrough disconnect'));
        }
        if (this.activeDownload) {
            const dl = this.activeDownload;
            this.clearDownloadTimeout();
            cam.download.active = false;
            cam.download.error = `Camera download interrupted at offset ${dl.received}; restart required after reconnect`;
            this.activeDownload = null;
            this.downloadFrameBuffer = new Uint8Array(0);
            dl.reject(new Error(cam.download.error));
        }
        cam.galleryEntered = false;
        cam.galleryLoading = false;
        cam.galleryState = 'CLOSED';
        drone.addLog('WARN', '[Camera] transient capture/gallery/download state reset after passthrough disconnect');
    }
    /** Re-synchronize camera state before accepting new actions after reconnect. */
    static handleTransportReconnect() {
        const cam = useCameraStore();
        cam.captureMode = 'UNKNOWN';
        this.transportReady = true;
        const drone = useDroneStore();
        if (!cam.initialization.configMenuLoaded) {
            drone.addLog('INFO', '[Camera] passthrough reconnected; starting PotensicPro camera initialization with config menu 0x11');
            this.startManufacturerInitialization();
        }
        else {
            drone.addLog('INFO', '[Camera] passthrough reconnected; camera config already loaded, synchronizing status (0x02)');
            this.send(PacketBuilder.buildCameraGetStatus());
            this.flushDeferredPackets('passthrough became ready');
        }
    }
    static flushDeferredPackets(reason) {
        if (!this.transportReady || !this.deferredPackets.length)
            return;
        const drone = useDroneStore();
        const pending = this.deferredPackets.splice(0);
        drone.addLog('INFO', `[Camera] sending ${pending.length} deferred command(s) after ${reason}`);
        pending.forEach((packet, index) => setTimeout(() => this.sender?.(packet), index * 25));
    }
    static startManufacturerInitialization() {
        const cam = useCameraStore();
        const drone = useDroneStore();
        if (!this.transportReady || cam.initialization.configMenuLoaded || this.cameraInitTimer)
            return;
        const requestConfigMenu = () => {
            this.cameraInitTimer = null;
            if (!this.transportReady || cam.initialization.configMenuLoaded)
                return;
            cam.initialization.attempts += 1;
            cam.initialization.lastInitMessage = `Reading PotensicPro camera config menu (0x11), attempt ${cam.initialization.attempts}`;
            drone.addLog('INFO', `[Camera init] ${cam.initialization.lastInitMessage}`);
            this.send(PacketBuilder.buildCameraGetConfigMenu());
            this.cameraInitTimer = setTimeout(requestConfigMenu, this.CAMERA_INIT_RETRY_MS);
        };
        requestConfigMenu();
    }
    static completeManufacturerInitialization() {
        const cam = useCameraStore();
        const drone = useDroneStore();
        if (this.cameraInitTimer)
            clearTimeout(this.cameraInitTimer);
        this.cameraInitTimer = null;
        cam.initialization.configMenuLoaded = true;
        cam.initialization.ready = true;
        cam.initialization.lastInitMessage = 'PotensicPro camera config menu loaded; running original post-init queries';
        drone.addLog('INFO', `[Camera init] ${cam.initialization.lastInitMessage}`);
        [
            PacketBuilder.buildCameraSetTime(),
            PacketBuilder.buildCameraGetManualModeInfo(),
            PacketBuilder.buildCameraGetZoom(),
            PacketBuilder.buildCameraGetTakePhotoMode()
        ].forEach((packet, index) => setTimeout(() => this.send(packet), index * 70));
        if (this.pendingZoomAfterInit)
            this.pendingZoomAfterInit = false;
        setTimeout(() => this.flushDeferredPackets('camera initialization completed'), 300);
    }
    static send(packet) {
        const store = useDroneStore();
        if (!this.sender || !this.transportReady) {
            if (this.deferredPackets.length >= this.MAX_DEFERRED_PACKETS)
                this.deferredPackets.shift();
            this.deferredPackets.push(packet.slice());
            store.addLog('INFO', 'Camera command deferred until passthrough transport is ready');
            return;
        }
        this.sender(packet);
    }
    static refreshSettings() {
        const store = useDroneStore();
        const cam = useCameraStore();
        store.addLog('INFO', 'Read camera configuration, resolutions, EV and SD-card state');
        if (!cam.initialization.configMenuLoaded) {
            this.startManufacturerInitialization();
            return;
        }
        ;
        [
            PacketBuilder.buildCameraGetStatus(),
            PacketBuilder.buildCameraGetConfigMenu(),
            PacketBuilder.buildCameraGetVideoSizes(),
            PacketBuilder.buildCameraGetPhotoSizes(),
            PacketBuilder.buildCameraGetCurrentVideoSize(),
            PacketBuilder.buildCameraGetCurrentPhotoSize(),
            PacketBuilder.buildCameraGetManualModeInfo(),
            PacketBuilder.buildCameraGetExposureInfo(),
            PacketBuilder.buildCameraGetPhotoGps(),
            PacketBuilder.buildCameraGetSdStatus(),
            PacketBuilder.buildCameraGetZoom(),
            PacketBuilder.buildCameraGetTakePhotoMode()
        ].forEach((p, i) => setTimeout(() => this.send(p), i * 70));
    }
    static clearCaptureTimer() {
        if (this.captureTimer)
            clearTimeout(this.captureTimer);
        this.captureTimer = null;
    }
    static cameraTransferBusy() {
        const cam = useCameraStore();
        if (this.activeDownload || cam.download.active)
            return 'file download active';
        if (this.pendingInfo.size > 0)
            return 'file metadata request active';
        return null;
    }
    static prepareExclusiveCaptureState() {
        const cam = useCameraStore();
        const drone = useDroneStore();
        const busy = this.cameraTransferBusy();
        if (busy) {
            drone.addLog('WARN', `[Camera capture] cannot start while ${busy}`);
            cam.lastCaptureMessage = `Camera busy: ${busy}`;
            return false;
        }
        if (this.metaTimer)
            clearTimeout(this.metaTimer);
        this.metaTimer = null;
        this.metaQueue = [];
        this.currentMetaBatch = null;
        this.metadataAccumulator = '';
        if (cam.galleryEntered || cam.galleryLoading || this.currentListPage || this.listQueue.length) {
            drone.addLog('INFO', '[Camera capture] closing gallery/list state before capture');
            this.resetGalleryRequestState();
            this.listQueue = [];
            this.currentListPage = null;
            this.photoNames = [];
            this.videoNames = [];
            this.send(PacketBuilder.buildCameraQuitGallery());
            cam.galleryEntered = false;
            cam.galleryLoading = false;
            cam.galleryState = 'CLOSED';
        }
        return true;
    }
    static armCaptureTimer(stage, timeoutMs = this.CAPTURE_STAGE_TIMEOUT_MS) {
        this.clearCaptureTimer();
        this.captureTimer = setTimeout(() => {
            const cam = useCameraStore();
            const drone = useDroneStore();
            const action = this.pendingCaptureAction;
            if (stage === 'photo completion notification (0x2A)' && action === 'photo') {
                // PotensicPro's takingPhotoRunnable only clears the local "taking photo" UI
                // after 10 seconds. It does not synthesize a second shutter command or force
                // a VIDEO mode switch.
                cam.captureFlowState = 'IDLE';
                cam.recordingPending = false;
                cam.lastCaptureMessage = 'Photo completion timeout; shutter UI reset while camera remains in PHOTO mode';
                drone.addLog('WARN', `${cam.lastCaptureMessage}; no 0x2A received`);
                this.pendingCaptureAction = null;
                this.pendingPhotoRequiresExplicitShutter = false;
                this.captureRetriedAfterModeError = false;
                return;
            }
            cam.captureFlowState = 'ERROR';
            cam.recordingPending = false;
            cam.lastCaptureMessage = `Camera capture timeout during ${stage}`;
            drone.addLog('ERROR', `${cam.lastCaptureMessage}${action ? `; pending=${action}` : ''}`);
            this.pendingCaptureAction = null;
            this.pendingPhotoRequiresExplicitShutter = false;
            this.captureRetriedAfterModeError = false;
        }, timeoutMs);
    }
    static desiredMode(action) {
        return action === 'photo' ? 'PHOTO' : 'VIDEO';
    }
    static captureCommandInFlight() {
        const state = useCameraStore().captureFlowState;
        return state === 'PHOTO_PENDING' || state === 'VIDEO_START_PENDING' || state === 'VIDEO_STOP_PENDING';
    }
    static sendCapturePayload(action) {
        const cam = useCameraStore();
        const drone = useDroneStore();
        if (action === 'photo') {
            cam.captureFlowState = 'PHOTO_PENDING';
            cam.lastCaptureMessage = 'Photo capture command pending';
            drone.addLog('INFO', '[Camera capture] TX photo: FE 0x15 / 0x0020 / payload 01');
            this.send(PacketBuilder.buildCameraTakePhoto());
            this.armCaptureTimer('photo ACK');
        }
        else if (action === 'record-start') {
            cam.captureFlowState = 'VIDEO_START_PENDING';
            cam.recordingPending = true;
            cam.lastCaptureMessage = 'Video start command pending';
            drone.addLog('INFO', '[Camera capture] TX record start: FE 0x15 / 0x0020 / payload 00 01');
            this.send(PacketBuilder.buildCameraStartRecord());
            this.armCaptureTimer('record-start ACK');
        }
        else {
            cam.captureFlowState = 'VIDEO_STOP_PENDING';
            cam.recordingPending = true;
            cam.lastCaptureMessage = 'Video stop command pending';
            drone.addLog('INFO', '[Camera capture] TX record stop: FE 0x15 / 0x0020 / payload 00 00');
            this.send(PacketBuilder.buildCameraStopRecord());
            this.armCaptureTimer('record-stop ACK');
        }
    }
    static finishPhotoModeReady(source) {
        const cam = useCameraStore();
        const drone = useDroneStore();
        this.clearCaptureTimer();
        this.pendingCaptureAction = null;
        this.pendingPhotoRequiresExplicitShutter = false;
        this.captureRetriedAfterModeError = false;
        cam.captureMode = 'PHOTO';
        cam.captureFlowState = 'IDLE';
        cam.lastCaptureMessage = 'Photo mode ready. Press photo again to capture.';
        drone.addLog('INFO', `[Camera capture] ${source} confirms PHOTO ready; waiting for explicit shutter press`);
    }
    static applyZoomLimitForCurrentMode() {
        const cam = useCameraStore();
        const isPhoto = cam.captureMode === 'PHOTO';
        const resolution = isPhoto ? cam.photoResolutionIndex : cam.videoResolutionIndex;
        const map = isPhoto ? this.photoZoomByResolution : this.videoZoomByResolution;
        const reported = resolution != null ? map.get(resolution) : undefined;
        if (reported != null && reported >= 1) {
            cam.zoomMax = reported;
            cam.zoomMaxSource = 'camera';
            if (cam.zoomTarget > reported)
                cam.zoomTarget = reported;
            useDroneStore().addLog('INFO', `Camera max zoom=${reported}x for ${isPhoto ? 'photo' : 'video'} resolution id=${resolution}`);
        }
    }
    static applyPostModeExposureSync(mode) {
        const cam = useCameraStore();
        const drone = useDroneStore();
        this.pendingPostModeExposureSync = null;
        if (!cam.manualMode.loaded) {
            this.pendingPostModeExposureSync = mode;
            drone.addLog('INFO', `[Camera capture] manual-mode state not loaded; requesting 0x34 before ${mode} exposure sync`);
            this.send(PacketBuilder.buildCameraGetManualModeInfo());
            return;
        }
        if (cam.manualMode.manual) {
            drone.addLog('INFO', `[Camera capture] re-applying manual camera parameters after ${mode} switch (PotensicPro resetToManualMode)`);
            this.send(PacketBuilder.buildCameraSetManualMode({
                manual: cam.manualMode.manual,
                shutterDen: cam.manualMode.shutterDen,
                iso: cam.manualMode.iso,
                manualWb: cam.manualMode.manualWb,
                wb: cam.manualMode.wb
            }));
        }
        else {
            const evMode = mode === 'PHOTO' ? 1 : 0;
            drone.addLog('INFO', `[Camera capture] reading automatic ${mode} EV after mode switch (cmd 0x10, mode ${evMode})`);
            this.send(PacketBuilder.buildCameraGetEv(evMode));
        }
    }
    static runManufacturerPostModeSync(mode) {
        const drone = useDroneStore();
        drone.addLog('INFO', `[Camera capture] PotensicPro post-mode sync for ${mode}: SD status + mode EV + manual/auto exposure sync`);
        this.applyZoomLimitForCurrentMode();
        setTimeout(() => this.send(PacketBuilder.buildCameraGetSdStatus()), 0);
        setTimeout(() => this.send(mode === 'PHOTO' ? PacketBuilder.buildCameraGetTakePhotoEv() : PacketBuilder.buildCameraGetRecordEv()), 50);
        setTimeout(() => this.applyPostModeExposureSync(mode), 100);
    }
    static enterPhotoCompletingState(source, reason) {
        const cam = useCameraStore();
        const drone = useDroneStore();
        this.clearCaptureTimer();
        cam.captureMode = 'PHOTO';
        cam.captureFlowState = 'PHOTO_COMPLETING';
        cam.lastCaptureMessage = reason;
        drone.addLog('INFO', `[Camera capture] ${source}; waiting for photo-end notification 0x2A`);
        this.armCaptureTimer('photo completion notification (0x2A)', this.PHOTO_COMPLETION_TIMEOUT_MS);
    }
    static completePhotoCapture(source) {
        const cam = useCameraStore();
        const drone = useDroneStore();
        this.clearCaptureTimer();
        this.pendingCaptureAction = null;
        this.pendingPhotoRequiresExplicitShutter = false;
        this.captureRetriedAfterModeError = false;
        cam.captureMode = 'PHOTO';
        cam.captureFlowState = 'IDLE';
        cam.lastCaptureMessage = 'Photo capture completed';
        drone.addLog('INFO', `[Camera capture] photo completed (${source})`);
        this.getSdStatus();
    }
    static switchModeForPendingAction() {
        const action = this.pendingCaptureAction;
        if (!action || this.captureCommandInFlight())
            return;
        const cam = useCameraStore();
        const desired = this.desiredMode(action);
        cam.captureFlowState = desired === 'PHOTO' ? 'SWITCHING_TO_PHOTO' : 'SWITCHING_TO_VIDEO';
        cam.lastCaptureMessage = `Switching camera to ${desired.toLowerCase()} mode`;
        useDroneStore().addLog('INFO', `[Camera capture] TX mode switch ${desired}: FE 0x15 / 0x0020 / payload 03 ${desired === 'PHOTO' ? '01' : '00'}`);
        this.send(PacketBuilder.buildCameraSetMode(desired));
        this.armCaptureTimer(`${desired.toLowerCase()} mode ACK`);
    }
    static continuePendingCaptureFromKnownMode() {
        const action = this.pendingCaptureAction;
        if (!action || this.captureCommandInFlight())
            return;
        const cam = useCameraStore();
        const desired = this.desiredMode(action);
        if (cam.captureMode === desired) {
            if (action === 'photo' && this.pendingPhotoRequiresExplicitShutter)
                this.finishPhotoModeReady('status sync');
            else
                this.sendCapturePayload(action);
        }
        else
            this.switchModeForPendingAction();
    }
    static beginCapture(action, modeSwitchOnly = false) {
        const cam = useCameraStore();
        const drone = useDroneStore();
        if (!cam.initialization.ready) {
            cam.lastCaptureMessage = 'Camera initialization is not complete yet';
            drone.addLog('WARN', '[Camera capture] ignored action until PotensicPro camera initialization (0x11 config menu) completes');
            this.startManufacturerInitialization();
            return;
        }
        if (this.pendingCaptureAction || cam.capturePending) {
            drone.addLog('WARN', `[Camera capture] ignored ${action}; another capture transition is active (${cam.captureFlowState})`);
            return;
        }
        const galleryWasActive = cam.galleryEntered || cam.galleryLoading || this.currentListPage !== null || this.listQueue.length > 0;
        if (!this.prepareExclusiveCaptureState())
            return;
        this.pendingCaptureAction = action;
        this.pendingPhotoRequiresExplicitShutter = action === 'photo' && modeSwitchOnly;
        this.captureRetriedAfterModeError = false;
        cam.captureFlowState = 'SYNCING';
        cam.lastCaptureMessage = action === 'photo' && modeSwitchOnly ? 'Preparing photo mode' : `Preparing ${action}`;
        const proceed = () => {
            // PotensicPro keeps an explicit CaptureMode. If our local mode is unknown,
            // synchronize it first with getCameraStatus (command 0x02), then switch if needed.
            if (cam.captureMode === 'UNKNOWN') {
                drone.addLog('INFO', '[Camera capture] TX get camera status before capture: payload 02');
                this.send(PacketBuilder.buildCameraGetStatus());
                this.armCaptureTimer('camera-status ACK');
            }
            else {
                this.continuePendingCaptureFromKnownMode();
            }
        };
        // The gallery close command was emitted by prepareExclusiveCaptureState(). Keep the
        // existing short playback->capture settle so capture is not sent in the same turn.
        if (galleryWasActive)
            setTimeout(proceed, 250);
        else
            proceed();
    }
    static takePhoto() {
        const cam = useCameraStore();
        // TAF has one photo button instead of PotensicPro's separate mode toggle and shutter.
        // Mirror the manufacturer flow as closely as possible:
        //  - if not already in PHOTO mode: first press only switches to PHOTO
        //  - once PHOTO is ready: second press sends cmd 0x01
        this.beginCapture('photo', cam.captureMode !== 'PHOTO');
    }
    static startRecord() {
        const cam = useCameraStore();
        if (cam.recording || cam.recordingPending)
            return;
        this.beginCapture('record-start');
    }
    static stopRecord() {
        const cam = useCameraStore();
        if (!cam.recording || cam.recordingPending)
            return;
        this.beginCapture('record-stop');
    }
    static syncCaptureState() {
        const cam = useCameraStore();
        cam.captureFlowState = 'SYNCING';
        this.send(PacketBuilder.buildCameraGetStatus());
        this.armCaptureTimer('camera-status sync');
    }
    static setVideoResolution(index) {
        useDroneStore().addLog('INFO', `Set recording resolution index=${index} (Potensic camera cmd 0x0B)`);
        this.send(PacketBuilder.buildCameraSetVideoSize(index));
        setTimeout(() => this.send(PacketBuilder.buildCameraGetConfigMenu()), 120);
    }
    static setPhotoResolution(index) {
        useDroneStore().addLog('INFO', `Set photo resolution index=${index} (Potensic camera cmd 0x0D)`);
        this.send(PacketBuilder.buildCameraSetPhotoSize(index));
        setTimeout(() => this.send(PacketBuilder.buildCameraGetConfigMenu()), 120);
    }
    static setVideoEv(ev) {
        useDroneStore().addLog('INFO', `Set video EV=${ev.toFixed(1)} (Potensic camera cmd 0x0F, mode 0)`);
        this.send(PacketBuilder.buildCameraSetEv(0, ev));
    }
    static setPhotoEv(ev) {
        useDroneStore().addLog('INFO', `Set photo EV=${ev.toFixed(1)} (Potensic camera cmd 0x0F, mode 1)`);
        this.send(PacketBuilder.buildCameraSetEv(1, ev));
    }
    static getVideoEv() { this.send(PacketBuilder.buildCameraGetEv(0)); }
    static getPhotoEv() { this.send(PacketBuilder.buildCameraGetEv(1)); }
    static setZoom(zoom) {
        const cam = useCameraStore();
        if (!cam.initialization.ready) {
            useDroneStore().addLog('WARN', 'Set camera zoom ignored until PotensicPro camera initialization is complete');
            this.startManufacturerInitialization();
            return;
        }
        const maxZoom = Math.max(1, cam.zoomMax || 4);
        const value = Math.max(1, Math.min(maxZoom, Math.round(zoom * 100) / 100));
        cam.zoomTarget = value;
        cam.zoomPending = true;
        useDroneStore().addLog('INFO', `Set camera zoom=${value.toFixed(2)}x (Potensic camera cmd 0x3E)`);
        this.send(PacketBuilder.buildCameraSetZoom(value));
    }
    static getZoom() {
        const cam = useCameraStore();
        if (!cam.initialization.configMenuLoaded) {
            this.pendingZoomAfterInit = true;
            useDroneStore().addLog('INFO', 'Read camera zoom deferred until config menu 0x11 is loaded (PotensicPro init order)');
            this.startManufacturerInitialization();
            return;
        }
        useDroneStore().addLog('INFO', 'Read camera zoom (Potensic camera cmd 0x3F)');
        this.send(PacketBuilder.buildCameraGetZoom());
    }
    static getSdStatus() {
        this.send(PacketBuilder.buildCameraGetSdStatus());
    }
    static setManualMode(manual, shutterDen, iso, manualWb, wb) {
        useDroneStore().addLog('INFO', `Set camera manual mode=${manual} shutter=1/${shutterDen} ISO=${iso} WB=${wb}`);
        this.send(PacketBuilder.buildCameraSetManualMode({ manual, shutterDen, iso, manualWb, wb }));
    }
    static setRaw(enable) {
        useDroneStore().addLog('INFO', `Set RAW photo=${enable}`);
        this.send(PacketBuilder.buildCameraSetRaw(enable));
    }
    static setPhotoOsd(enable) {
        useDroneStore().addLog('INFO', `Set photo OSD=${enable}`);
        this.send(PacketBuilder.buildCameraSetPhotoOsd(enable));
    }
    static setPhotoGps(enable) {
        useDroneStore().addLog('INFO', `Set photo GPS metadata=${enable}`);
        this.send(PacketBuilder.buildCameraSetPhotoGps(enable));
    }
    static formatSd() {
        useDroneStore().addLog('WARN', 'Formatting SD card requested (Potensic camera cmd 0x04)');
        this.send(PacketBuilder.buildCameraFormatSd());
    }
    static enterGallery() {
        const cam = useCameraStore();
        this.resetGalleryRequestState();
        cam.galleryEntered = false;
        cam.galleryLoading = true;
        cam.galleryState = 'OPENING';
        cam.galleryError = '';
        useDroneStore().addLog('INFO', 'Enter camera gallery (cmd 0x21)');
        this.sendGalleryWithRetry(PacketBuilder.buildCameraEnterGallery(), 'enter gallery (0x21)');
    }
    static quitGallery() {
        const cam = useCameraStore();
        this.resetGalleryRequestState();
        this.send(PacketBuilder.buildCameraQuitGallery());
        cam.galleryEntered = false;
        cam.galleryLoading = false;
        cam.galleryState = 'CLOSED';
        cam.galleryError = '';
        this.photoNames = [];
        this.videoNames = [];
        this.listQueue = [];
        this.currentListPage = null;
        this.metadataAccumulator = '';
    }
    static refreshGallery() {
        const cam = useCameraStore();
        if (!cam.galleryEntered) {
            this.enterGallery();
            return;
        }
        this.resetGalleryRequestState();
        cam.galleryLoading = true;
        cam.galleryState = 'LOADING_COUNT';
        cam.galleryError = '';
        this.photoNames = [];
        this.videoNames = [];
        this.listQueue = [];
        this.currentListPage = null;
        this.sendGalleryWithRetry(PacketBuilder.buildCameraGetFileCount(), 'file count (0x18)');
    }
    static resetGalleryRequestState() {
        if (this.galleryTimer)
            clearTimeout(this.galleryTimer);
        this.galleryTimer = null;
        this.galleryRetryCount = 0;
        this.lastGalleryPacket = null;
        this.lastGalleryStage = '';
    }
    static sendGalleryWithRetry(packet, stage) {
        this.resetGalleryRequestState();
        this.lastGalleryPacket = packet;
        this.lastGalleryStage = stage;
        this.send(packet);
        this.armGalleryTimeout();
    }
    static armGalleryTimeout() {
        if (this.galleryTimer)
            clearTimeout(this.galleryTimer);
        this.galleryTimer = setTimeout(() => {
            const cam = useCameraStore();
            if (!this.lastGalleryPacket)
                return;
            if (this.galleryRetryCount < this.GALLERY_MAX_RETRIES) {
                this.galleryRetryCount++;
                useDroneStore().addLog('WARN', `Camera gallery timeout during ${this.lastGalleryStage}; retry ${this.galleryRetryCount}/${this.GALLERY_MAX_RETRIES}`);
                this.send(this.lastGalleryPacket);
                this.armGalleryTimeout();
                return;
            }
            this.failGallery(`Timeout while waiting for ${this.lastGalleryStage}`);
            cam.galleryLoading = false;
        }, this.GALLERY_TIMEOUT_MS);
    }
    static acknowledgeGalleryResponse() {
        if (this.galleryTimer)
            clearTimeout(this.galleryTimer);
        this.galleryTimer = null;
        this.galleryRetryCount = 0;
        this.lastGalleryPacket = null;
        this.lastGalleryStage = '';
    }
    static failGallery(message) {
        const cam = useCameraStore();
        this.resetGalleryRequestState();
        cam.galleryLoading = false;
        cam.galleryState = 'ERROR';
        cam.galleryError = message;
        useDroneStore().addLog('ERROR', `Camera gallery: ${message}`);
    }
    static deleteFile(fileName) {
        useDroneStore().addLog('WARN', `Delete camera file: ${fileName}`);
        this.send(PacketBuilder.buildCameraDeleteFile(fileName));
    }
    static deleteFileConfirmed(fileName) {
        if (this.pendingDelete)
            return Promise.reject(new Error('Another camera delete is already pending'));
        useDroneStore().addLog('WARN', `Delete verified Drone Reco source from camera: ${fileName}`);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.pendingDelete?.fileName === fileName)
                    this.pendingDelete = null;
                reject(new Error('Timed out waiting for camera delete acknowledgement'));
            }, 5000);
            this.pendingDelete = { fileName, resolve, reject, timer };
            this.send(PacketBuilder.buildCameraDeleteFile(fileName));
        });
    }
    static async downloadFile(fileName, options = {}) {
        const cam = useCameraStore();
        if (this.activeDownload)
            throw new Error('Another camera download is already active');
        cam.download.fileName = fileName;
        cam.download.progress = 0;
        cam.download.active = true;
        cam.download.error = '';
        try {
            const listed = cam.getGalleryFile(fileName);
            let info = listed && listed.size && listed.size > 0 ? { len: listed.size, lrv_len: listed.lrvSize, createtime: listed.createTimeRaw } : null;
            if (!info)
                info = await this.getFileInfo(fileName);
            const isVideo = /\.(mp4|mov)$/i.test(fileName);
            // The project requirement is the complete selected original file. PotensicPro's
            // gallery playback downloader uses LRV for videos, but TAF deliberately keeps the
            // original MP4 name here while adopting the confirmed 0x1B framing and block size.
            const remoteName = fileName;
            const totalNum = Number(info.filesize ?? info.len ?? listed?.size ?? 0);
            if (!Number.isFinite(totalNum) || totalNum <= 0)
                throw new Error('Camera returned no usable file size');
            const total = BigInt(Math.trunc(totalNum));
            const outputName = fileName.split('/').pop() || (isVideo ? 'camera-video.mp4' : 'camera-photo.jpg');
            return await new Promise((resolve, reject) => {
                this.downloadLastProgressAt = Date.now();
                this.downloadFrameBuffer = new Uint8Array(0);
                this.activeDownload = {
                    fileName: remoteName,
                    originalFileName: fileName,
                    outputName,
                    total,
                    received: 0n,
                    chunks: [],
                    library: options.library ?? 'camera',
                    source: options.source ?? 'drone-camera',
                    metadata: options.metadata,
                    deleteAfterVerified: options.deleteAfterVerified === true,
                    resolve,
                    reject
                };
                this.requestNextDownloadChunk();
            });
        }
        catch (e) {
            cam.download.active = false;
            cam.download.error = e?.message || String(e);
            throw e;
        }
    }
    static getFileInfo(fileName) {
        return new Promise((resolve, reject) => {
            const old = this.pendingInfo.get(fileName);
            if (old)
                clearTimeout(old.timer);
            const timer = setTimeout(() => {
                this.pendingInfo.delete(fileName);
                reject(new Error('Timed out waiting for camera file metadata'));
            }, 5000);
            this.pendingInfo.set(fileName, { resolve, reject, timer });
            this.send(PacketBuilder.buildCameraGetFileInfo(fileName));
        });
    }
    static clearDownloadTimeout() {
        if (this.downloadTimer)
            clearTimeout(this.downloadTimer);
        this.downloadTimer = null;
    }
    static armDownloadTimeout(offset, length) {
        this.clearDownloadTimeout();
        this.downloadTimer = setTimeout(() => {
            const dl = this.activeDownload;
            if (!dl)
                return;
            if (dl.received !== offset)
                return;
            if (Date.now() - this.downloadLastProgressAt >= this.DOWNLOAD_INACTIVITY_TIMEOUT_MS) {
                this.send(PacketBuilder.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.FILE_DOWNLOAD_CANCEL])));
                this.failDownload(`Camera file download stalled for ${this.DOWNLOAD_INACTIVITY_TIMEOUT_MS / 1000}s at offset ${offset}`);
                return;
            }
            if (this.downloadRetryCount < this.DOWNLOAD_MAX_RETRIES) {
                this.downloadRetryCount++;
                useDroneStore().addLog('WARN', `Camera download unit timeout at ${offset}; retry from current offset (${this.downloadRetryCount}/${this.DOWNLOAD_MAX_RETRIES})`);
                this.send(PacketBuilder.buildCameraDownloadChunk(dl.fileName, offset, length));
                this.armDownloadTimeout(offset, length);
                return;
            }
            this.send(PacketBuilder.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.FILE_DOWNLOAD_CANCEL])));
            this.failDownload(`Timeout waiting for camera file data at offset ${offset}`);
        }, this.DOWNLOAD_TIMEOUT_MS);
    }
    static failDownload(message) {
        const dl = this.activeDownload;
        if (!dl)
            return;
        this.clearDownloadTimeout();
        const cam = useCameraStore();
        cam.download.active = false;
        cam.download.error = message;
        this.activeDownload = null;
        this.downloadFrameBuffer = new Uint8Array(0);
        dl.reject(new Error(message));
    }
    static requestNextDownloadChunk() {
        const dl = this.activeDownload;
        if (!dl)
            return;
        const remaining = dl.total - dl.received;
        if (remaining <= 0n) {
            this.finishDownload();
            return;
        }
        const length = remaining > this.DOWNLOAD_CHUNK_SIZE ? this.DOWNLOAD_CHUNK_SIZE : remaining;
        this.downloadRetryCount = 0;
        this.send(PacketBuilder.buildCameraDownloadChunk(dl.fileName, dl.received, length));
        this.armDownloadTimeout(dl.received, length);
    }
    static async finishDownload() {
        const dl = this.activeDownload;
        if (!dl)
            return;
        this.clearDownloadTimeout();
        const cam = useCameraStore();
        const drone = useDroneStore();
        const blobParts = dl.chunks.map(chunk => chunk.slice().buffer);
        const isPhoto = /\.(jpg|jpeg|png|dng)$/i.test(dl.outputName);
        const mime = /\.png$/i.test(dl.outputName) ? 'image/png'
            : /\.dng$/i.test(dl.outputName) ? 'image/x-adobe-dng'
                : isPhoto ? 'image/jpeg'
                    : /\.mp4$/i.test(dl.outputName) ? 'video/mp4'
                        : 'application/octet-stream';
        const blob = new Blob(blobParts, { type: mime });
        try {
            let saved;
            saved = await AndroidMediaService.saveImageBytes(blob, dl.outputName, dl.source, dl.library, dl.metadata);
            if (!saved.verified || saved.size !== blob.size) {
                throw new Error('Android MediaStore verification failed; drone source will not be deleted');
            }
            drone.addLog('INFO', `Camera media verified on Android: ${saved.relativePath}/${saved.name} (${blob.size} bytes)`);
            if (isPhoto && dl.deleteAfterVerified) {
                await this.deleteFileConfirmed(dl.originalFileName);
                drone.addLog('INFO', `Drone Reco source deleted after verified Android transfer: ${dl.originalFileName}`);
            }
            cam.download.progress = 100;
            cam.download.error = '';
            dl.resolve(saved);
        }
        catch (e) {
            cam.download.error = e?.message || String(e);
            drone.addLog('ERROR', `Camera download/save pipeline failed: ${cam.download.error}`);
            dl.reject(e instanceof Error ? e : new Error(String(e)));
        }
        finally {
            cam.download.active = false;
            if (this.activeDownload === dl)
                this.activeDownload = null;
            this.downloadFrameBuffer = new Uint8Array(0);
        }
    }
    static parseConfigMenu(data) {
        // PotensicPro UsbCameraHandler.parseAllParams(), with `data` beginning immediately
        // after the command status byte. Keep the same field order so capture mode, SD state,
        // current resolution, EV values and mode-dependent zoom limits are synchronized before
        // the user can start a camera action.
        const cam = useCameraStore();
        const drone = useDroneStore();
        let pos = 0;
        if (data.length < 12)
            return false;
        // Camera state: mode, recording flag, record time (uint16 LE).
        const modeByte = data[pos++];
        const recordingByte = data[pos++];
        const recordTime = data[pos++] | (data[pos++] << 8);
        cam.captureMode = modeByte === 0 ? 'VIDEO' : modeByte === 1 ? 'PHOTO' : 'UNKNOWN';
        cam.recording = modeByte === 0 && recordingByte === 1;
        cam.recordingPending = false;
        drone.addLog('INFO', `[Camera init] config state: mode=${cam.captureMode} recording=${cam.recording} recordTime=${recordTime}s`);
        // Camera model / firmware string.
        const modelLen = data[pos++] ?? 0;
        if (pos + modelLen + 7 > data.length)
            return false;
        const modelRaw = new TextDecoder('ascii').decode(data.subarray(pos, pos + modelLen)).replace(/\0/g, '').trim();
        pos += modelLen;
        const upper = modelRaw.toUpperCase();
        const versionPos = upper.lastIndexOf('V');
        if (versionPos >= 0) {
            cam.initialization.model = modelRaw.slice(0, versionPos).trim();
            cam.initialization.softVersion = modelRaw.slice(versionPos).trim();
        }
        else {
            cam.initialization.model = modelRaw;
            cam.initialization.softVersion = '';
        }
        // SD state + 24-bit free/total space.
        cam.sd.state = data[pos++];
        cam.sd.freeMb = data[pos++] | (data[pos++] << 8) | (data[pos++] << 16);
        cam.sd.totalMb = data[pos++] | (data[pos++] << 8) | (data[pos++] << 16);
        cam.sd.lastStatus = 'SD status received from config menu';
        const readSupport = () => {
            if (pos + 2 > data.length)
                return null;
            const current = data[pos++];
            const count = data[pos++];
            if (pos + count > data.length)
                return null;
            const values = Array.from(data.subarray(pos, pos + count));
            pos += count;
            return { current, values };
        };
        const video = readSupport();
        if (!video)
            return false;
        const photo = readSupport();
        if (!photo)
            return false;
        const recordEv = readSupport();
        if (!recordEv)
            return false;
        const photoEv = readSupport();
        if (!photoEv)
            return false;
        const split = readSupport();
        if (!split)
            return false;
        void split;
        cam.videoResolutionIndex = video.current;
        cam.photoResolutionIndex = photo.current;
        cam.videoEv = (recordEv.current - 4) / 2;
        cam.photoEv = (photoEv.current - 4) / 2;
        // Newer config-menu payloads contain RAW / OSD flags and 24-bit remaining capture.
        if (pos + 6 <= data.length) {
            cam.manualMode.raw = data[pos++] === 1;
            cam.configState.videoOsd = data[pos++] === 1;
            cam.manualMode.photoOsd = data[pos++] === 1;
            cam.configState.remainCapture = data[pos++] | (data[pos++] << 8) | (data[pos++] << 16);
        }
        this.videoZoomByResolution.clear();
        this.photoZoomByResolution.clear();
        if (pos < data.length) {
            const videoPairCount = data[pos++];
            for (let n = 0; n < videoPairCount && pos + 1 < data.length; n++) {
                this.videoZoomByResolution.set(data[pos++], data[pos++]);
            }
            if (pos < data.length) {
                const photoPairCount = data[pos++];
                for (let n = 0; n < photoPairCount && pos + 1 < data.length; n++) {
                    this.photoZoomByResolution.set(data[pos++], data[pos++]);
                }
            }
        }
        if (pos < data.length) {
            const supportFlags = data[pos];
            cam.initialization.supportTimerPhoto = (supportFlags & 0x01) !== 0;
            cam.initialization.supportAebPhoto = (supportFlags & 0x02) !== 0;
        }
        this.applyZoomLimitForCurrentMode();
        drone.addLog('INFO', `[Camera init] config menu parsed: model=${cam.initialization.model || 'unknown'} firmware=${cam.initialization.softVersion || 'unknown'} SD=${cam.sd.state} free=${cam.sd.freeMb ?? '?'}MB photoRes=${cam.photoResolutionIndex} videoRes=${cam.videoResolutionIndex}`);
        return true;
    }
    static cameraLogHexPreview(bytes, maxBytes = 48) {
        const shown = bytes.subarray(0, Math.min(bytes.length, maxBytes));
        const hex = Array.from(shown, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return bytes.length > shown.length ? `${hex} ... (+${bytes.length - shown.length}B)` : hex;
    }
    static decodeLinuxCameraLog(payload) {
        // Real ATOM USB captures show Linux camera-log bytes XOR-obfuscated with 0x55.
        // Decode byte-for-byte, but escape control/non-printable bytes so one camera record
        // always remains one Live System Log entry (important for the 1000-entry ring buffer).
        const decoded = Uint8Array.from(payload, value => value ^ 0x55);
        const parts = [];
        for (let i = 0; i < decoded.length; i++) {
            const value = decoded[i];
            if (value === 0x00)
                continue;
            if (value === 0x0d) {
                if (i + 1 < decoded.length && decoded[i + 1] === 0x0a)
                    i++;
                parts.push('\\n');
            }
            else if (value === 0x0a) {
                parts.push('\\n');
            }
            else if (value === 0x09) {
                parts.push('\\t');
            }
            else if (value >= 0x20 && value <= 0x7e) {
                parts.push(String.fromCharCode(value));
            }
            else {
                parts.push(`\\x${value.toString(16).padStart(2, '0').toUpperCase()}`);
            }
        }
        return parts.join('').trim();
    }
    static decodeCameraLog(raw) {
        // PotensicPro CameraLogData layout, relative to the bytes after command 0x39:
        //   +0 source (0=Linux, 1=LiteOS, 2=Gimbal)
        //   +1..+2 payloadLength uint16 LE
        //   +3.. payloadLength raw bytes
        // The original app writes these source payloads byte-for-byte to separate log files.
        // Do not treat source/length/checksum bytes as text.
        const drone = useDroneStore();
        if (raw.length < 3) {
            drone.addLog('WARN', `[CAMERA/LOG] malformed 0x39 header: ${raw.length}B (need at least 3B)`);
            return;
        }
        const sourceId = raw[0];
        const declaredLength = raw[1] | (raw[2] << 8);
        const availableLength = raw.length - 3;
        if (declaredLength > availableLength) {
            drone.addLog('WARN', `[CAMERA/LOG] truncated 0x39 source=${sourceId} declared=${declaredLength}B available=${availableLength}B`);
            return;
        }
        const payload = raw.subarray(3, 3 + declaredLength);
        const trailingLength = availableLength - declaredLength;
        if (sourceId === 0) {
            const text = this.decodeLinuxCameraLog(payload);
            drone.addLog('INFO', `[CAMERA/LINUX] ${text || `(empty decoded record, len=${declaredLength}B)`}`);
        }
        else if (sourceId === 1) {
            // No source=1 packet is present in the validated USB capture. Preserve it as raw
            // bytes until its encoding is confirmed instead of guessing that Linux XOR applies.
            drone.addLog('INFO', `[CAMERA/LITEOS] len=${declaredLength} raw=${this.cameraLogHexPreview(payload) || '(empty)'}`);
        }
        else if (sourceId === 2) {
            // Gimbal records are binary in the validated capture. Never pass them through a
            // text decoder: that was the source of the previous replacement-character spam.
            drone.addLog('INFO', `[CAMERA/GIMBAL] len=${declaredLength} raw=${this.cameraLogHexPreview(payload) || '(empty)'}`);
        }
        else {
            drone.addLog('INFO', `[CAMERA/UNKNOWN:${sourceId}] len=${declaredLength} raw=${this.cameraLogHexPreview(payload) || '(empty)'}`);
        }
        if (trailingLength > 0) {
            drone.addLog('WARN', `[CAMERA/LOG] 0x39 source=${sourceId} has ${trailingLength} trailing byte(s) after declared payload`);
        }
    }
    static confirmCaptureReady(modeByte, source) {
        const action = this.pendingCaptureAction;
        if (!action || this.captureCommandInFlight())
            return;
        const cam = useCameraStore();
        const drone = useDroneStore();
        if (modeByte === 0)
            cam.captureMode = 'VIDEO';
        else if (modeByte === 1)
            cam.captureMode = 'PHOTO';
        const desired = this.desiredMode(action);
        if (cam.captureMode !== desired) {
            drone.addLog('WARN', `[Camera capture] ${source} reports mode=${cam.captureMode}, waiting for ${desired}`);
            this.send(PacketBuilder.buildCameraGetStatus());
            this.armCaptureTimer('mode readiness status sync');
            return;
        }
        this.clearCaptureTimer();
        if (action === 'photo' && this.pendingPhotoRequiresExplicitShutter) {
            this.finishPhotoModeReady(source);
            return;
        }
        drone.addLog('INFO', `[Camera capture] ${source} confirms ${desired} ready; sending pending ${action}`);
        this.sendCapturePayload(action);
    }
    static scheduleBusyRetry() {
        const action = this.pendingCaptureAction;
        if (!action)
            return;
        const cam = useCameraStore();
        const drone = useDroneStore();
        this.clearCaptureTimer();
        if (this.captureBackoffTimer)
            clearTimeout(this.captureBackoffTimer);
        cam.captureFlowState = 'SYNCING';
        cam.lastCaptureMessage = 'Camera busy; waiting before one controlled retry';
        drone.addLog('WARN', `[Camera capture] device busy; backoff ${this.CAPTURE_BUSY_BACKOFF_MS} ms then resync status before one retry`);
        this.captureBackoffTimer = setTimeout(() => {
            this.captureBackoffTimer = null;
            if (!this.pendingCaptureAction)
                return;
            this.send(PacketBuilder.buildCameraGetStatus());
            this.armCaptureTimer('device-busy status resync');
        }, this.CAPTURE_BUSY_BACKOFF_MS);
    }
    static looksLikeCompleteJson(text) {
        let depth = 0;
        let inString = false;
        let escaped = false;
        let seen = false;
        for (const ch of text) {
            if (inString) {
                if (escaped)
                    escaped = false;
                else if (ch === '\\')
                    escaped = true;
                else if (ch === '"')
                    inString = false;
                continue;
            }
            if (ch === '"') {
                inString = true;
                continue;
            }
            if (ch === '{' || ch === '[') {
                depth++;
                seen = true;
            }
            else if (ch === '}' || ch === ']')
                depth--;
            if (depth < 0)
                return true;
        }
        return seen && depth === 0 && !inString;
    }
    static appendDownloadBytes(bytes) {
        if (bytes.length === 0)
            return;
        const dl = this.activeDownload;
        if (dl) {
            this.downloadLastProgressAt = Date.now();
            this.clearDownloadTimeout();
        }
        if (this.downloadFrameBuffer.length === 0)
            this.downloadFrameBuffer = bytes.slice();
        else {
            const merged = new Uint8Array(this.downloadFrameBuffer.length + bytes.length);
            merged.set(this.downloadFrameBuffer, 0);
            merged.set(bytes, this.downloadFrameBuffer.length);
            this.downloadFrameBuffer = merged;
        }
        this.drainDownloadFrames();
        if (dl && this.activeDownload === dl && this.downloadFrameBuffer.length > 0) {
            const remaining = dl.total - dl.received;
            if (remaining > 0n)
                this.armDownloadTimeout(dl.received, remaining > this.DOWNLOAD_CHUNK_SIZE ? this.DOWNLOAD_CHUNK_SIZE : remaining);
        }
    }
    static downloadFrameLength(buffer) {
        if (buffer.length < 1)
            return null;
        const flag = buffer[0];
        if (flag !== 0 && flag !== 1 && flag !== 2)
            return -1;
        const base = flag === 2 ? 33 : 1;
        if (buffer.length < base + 10)
            return null;
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const payloadLen = view.getUint16(base + 8, true);
        if (payloadLen <= 0)
            return -1;
        return base + 10 + payloadLen;
    }
    static drainDownloadFrames() {
        const drone = useDroneStore();
        while (this.downloadFrameBuffer.length > 0) {
            const expected = this.downloadFrameLength(this.downloadFrameBuffer);
            if (expected == null)
                return;
            if (expected < 0 || expected > 2000000) {
                const preview = Array.from(this.downloadFrameBuffer.subarray(0, Math.min(16, this.downloadFrameBuffer.length)))
                    .map(v => v.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                drone.addLog('ERROR', `Camera download frame boundary invalid (${this.downloadFrameBuffer.length} buffered bytes, head=${preview}); aborting without byte-wise payload resync`);
                this.failDownload('Camera download stream framing invalid; restart required');
                return;
            }
            if (this.downloadFrameBuffer.length < expected) {
                drone.addLog('INFO', `Camera download partial frame buffered: ${this.downloadFrameBuffer.length}/${expected}B`);
                return;
            }
            const frame = this.downloadFrameBuffer.slice(0, expected);
            this.downloadFrameBuffer = this.downloadFrameBuffer.slice(expected);
            this.handleCompleteDownloadFrame(frame);
        }
    }
    /**
     * Handle FE 0x05 camera responses. An FE payload may contain multiple complete
     * inner FF FE frames, and an inner frame may be split across consecutive FE
     * payloads. Reassemble those boundaries first so bytes from a following camera
     * record can never leak into the current command body.
     */
    static handleIncoming(feType, payload) {
        if (feType !== 0x05 || payload.length === 0)
            return false;
        this.appendCameraInnerBytes(payload);
        return true;
    }
    static appendCameraInnerBytes(bytes) {
        if (this.cameraInnerBuffer.length === 0)
            this.cameraInnerBuffer = bytes.slice();
        else {
            const merged = new Uint8Array(this.cameraInnerBuffer.length + bytes.length);
            merged.set(this.cameraInnerBuffer, 0);
            merged.set(bytes, this.cameraInnerBuffer.length);
            this.cameraInnerBuffer = merged;
        }
        this.drainCameraInnerFrames();
    }
    static isCameraInnerHeader(buffer, offset = 0) {
        return buffer.length >= offset + 2 &&
            buffer[offset] === CAMERA_USB.RX_HEADER_0 &&
            buffer[offset + 1] === CAMERA_USB.RX_HEADER_1;
    }
    static drainCameraInnerFrames() {
        const drone = useDroneStore();
        while (this.cameraInnerBuffer.length > 0) {
            if (this.cameraInnerBuffer.length < 4)
                return;
            if (!this.isCameraInnerHeader(this.cameraInnerBuffer)) {
                let next = -1;
                for (let i = 1; i + 1 < this.cameraInnerBuffer.length; i++) {
                    if (this.isCameraInnerHeader(this.cameraInnerBuffer, i)) {
                        next = i;
                        break;
                    }
                }
                if (next < 0) {
                    const keep = this.cameraInnerBuffer[this.cameraInnerBuffer.length - 1] === CAMERA_USB.RX_HEADER_0 ? 1 : 0;
                    const dropped = this.cameraInnerBuffer.length - keep;
                    if (dropped > 0)
                        drone.addLog('WARN', `[Camera RX] discarded ${dropped} byte(s) before next inner frame header`);
                    this.cameraInnerBuffer = keep ? this.cameraInnerBuffer.slice(-1) : new Uint8Array(0);
                    return;
                }
                drone.addLog('WARN', `[Camera RX] discarded ${next} byte(s) before inner frame header`);
                this.cameraInnerBuffer = this.cameraInnerBuffer.slice(next);
                continue;
            }
            const innerLength = this.cameraInnerBuffer[2] | (this.cameraInnerBuffer[3] << 8);
            const totalLength = 4 + innerLength;
            if (innerLength < 4 || totalLength > this.MAX_CAMERA_INNER_FRAME) {
                drone.addLog('WARN', `[Camera RX] invalid inner frame length ${innerLength}; discarding header byte`);
                this.cameraInnerBuffer = this.cameraInnerBuffer.slice(1);
                continue;
            }
            if (this.cameraInnerBuffer.length < totalLength)
                return;
            const frame = this.cameraInnerBuffer.slice(0, totalLength);
            this.cameraInnerBuffer = this.cameraInnerBuffer.slice(totalLength);
            this.handleCameraInnerFrame(frame);
        }
    }
    static handleCameraInnerFrame(payload) {
        if (payload.length < 8 || !this.isCameraInnerHeader(payload))
            return false;
        const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        const msgShort = view.getUint16(4, true);
        if (msgShort !== CAMERA_USB.INNER_FUNCTION)
            return false;
        const cam = useCameraStore();
        const drone = useDroneStore();
        const cmd = payload[6];
        const commandBody = payload.subarray(7, Math.max(7, payload.length - 1));
        // 0x39 and 0x3A are asynchronous camera records, not ordinary cmd/status responses.
        // They must be handled before interpreting payload[7] as a status byte.
        if (cmd === 0x39) {
            cam.lastResponse = `camera-log 0x39 data=${commandBody.length}B`;
            this.decodeCameraLog(commandBody);
            return true;
        }
        if (cmd === 0x3a) {
            cam.lastResponse = `mode-pre-notify 0x3A data=${commandBody.length}B`;
            // PotensicPro names 0x3A MSG_ID_SWITCH_CAPTURE_MODE_PRE_NOTIFY and uses it for
            // the visual blur transition only. It is not the authoritative capture-mode ACK.
            drone.addLog('INFO', '[Camera capture] asynchronous 0x3A mode pre-notify received (UI transition only; not used as shutter readiness gate)');
            return true;
        }
        if (commandBody.length < 1) {
            drone.addLog('WARN', `Camera response 0x${cmd.toString(16).padStart(2, '0')} has no status byte`);
            return true;
        }
        const status = commandBody[0];
        const data = commandBody.subarray(1);
        cam.lastResponse = `cmd=0x${cmd.toString(16).padStart(2, '0')} status=${status} data=${data.length}B`;
        if (status !== 0) {
            const statusText = {
                1: 'Command not supported',
                2: 'Argument invalid',
                3: 'Device busy',
                4: 'Unknown error',
                5: 'No SD card',
                6: 'SD card full',
                7: 'Option invalid',
                8: 'Current mode not allowed',
                9: 'Recording already started',
                10: 'SD card needs format',
                11: 'Not enough memory',
                12: 'File system error',
                23: 'File offset error',
                24: 'File MD5 error',
                37: 'Need sync state error'
            };
            const failure = statusText[status] || `status ${status}`;
            drone.addLog('WARN', `Camera command 0x${cmd.toString(16).padStart(2, '0')} failed: ${failure}`);
            if (cmd === CAMERA_USB.RECORD)
                cam.recordingPending = false;
            if ([CAMERA_USB.TAKE_PHOTO, CAMERA_USB.RECORD, CAMERA_USB.MODE, 0x02].includes(cmd)) {
                this.clearCaptureTimer();
                const action = this.pendingCaptureAction;
                if (status === 3 && action === 'photo' && cmd === CAMERA_USB.TAKE_PHOTO) {
                    this.enterPhotoCompletingState('device busy after photo command', 'Camera busy after shutter; waiting for completion or timeout');
                    return true;
                }
                // Status 3 (device busy) is transient. Stop the ACK timer immediately, back off,
                // re-read camera status, then perform at most one controlled retry.
                if (status === 3 && action && (cmd === CAMERA_USB.TAKE_PHOTO || cmd === CAMERA_USB.RECORD) && !this.captureRetriedAfterModeError) {
                    this.captureRetriedAfterModeError = true;
                    this.scheduleBusyRetry();
                    return true;
                }
                // Recording-only recovery: status 8 means the current mode is not allowed.
                // The photo path intentionally does not auto-switch/retry, matching PotensicPro.
                if (status === 8 && action && cmd === CAMERA_USB.RECORD && !this.captureRetriedAfterModeError) {
                    this.captureRetriedAfterModeError = true;
                    drone.addLog('WARN', `[Camera capture] ${failure}; switching to required mode before one retry`);
                    this.switchModeForPendingAction();
                    return true;
                }
                cam.captureFlowState = 'ERROR';
                cam.lastCaptureMessage = `Camera capture failed: ${failure}`;
                this.pendingCaptureAction = null;
                this.pendingPhotoRequiresExplicitShutter = false;
                this.captureRetriedAfterModeError = false;
            }
            if ([CAMERA_USB.ENTER_GALLERY, CAMERA_USB.FILE_COUNT, CAMERA_USB.FILE_LIST].includes(cmd)) {
                this.failGallery(`Command 0x${cmd.toString(16).padStart(2, '0')} failed: ${failure}`);
            }
            if (this.activeDownload && cmd === CAMERA_USB.FILE_DOWNLOAD) {
                const dl = this.activeDownload;
                this.clearDownloadTimeout();
                cam.download.active = false;
                cam.download.error = `Camera download failed with status ${status}`;
                this.activeDownload = null;
                dl.reject(new Error(cam.download.error));
            }
            if (this.pendingDelete && cmd === CAMERA_USB.FILE_DELETE) {
                const pending = this.pendingDelete;
                clearTimeout(pending.timer);
                this.pendingDelete = null;
                pending.reject(new Error(`Camera delete failed with status ${status}`));
            }
            return true;
        }
        switch (cmd) {
            case 0x02: { // getCameraStatus()
                this.clearCaptureTimer();
                if (data.length) {
                    cam.captureMode = data[0] === 0 ? 'VIDEO' : data[0] === 1 ? 'PHOTO' : 'UNKNOWN';
                    if (data.length >= 2) {
                        cam.recording = data[0] === 0 && data[1] === 1;
                        cam.recordingPending = false;
                    }
                    const recordTime = data.length >= 4 ? (data[2] | (data[3] << 8)) : null;
                    drone.addLog('INFO', `[Camera capture] status: mode=${cam.captureMode} recording=${cam.recording}${recordTime != null ? ` recordTime=${recordTime}s` : ''}`);
                }
                if (this.pendingCaptureAction && !this.captureCommandInFlight())
                    this.continuePendingCaptureFromKnownMode();
                else if (!this.pendingCaptureAction)
                    cam.captureFlowState = 'IDLE';
                break;
            }
            case CAMERA_USB.MODE: {
                this.clearCaptureTimer();
                if (data.length) {
                    cam.captureMode = data[0] === 0 ? 'VIDEO' : data[0] === 1 ? 'PHOTO' : 'UNKNOWN';
                    drone.addLog('INFO', `[Camera capture] mode ACK: ${cam.captureMode}`);
                    if (cam.captureMode === 'PHOTO' || cam.captureMode === 'VIDEO')
                        this.runManufacturerPostModeSync(cam.captureMode);
                }
                if (this.pendingCaptureAction && this.captureCommandInFlight()) {
                    drone.addLog('INFO', '[Camera capture] late mode ACK received after capture command; no duplicate capture sent');
                }
                else if (this.pendingCaptureAction === 'photo' && this.pendingPhotoRequiresExplicitShutter && cam.captureMode === 'PHOTO') {
                    // PotensicPro treats the successful 0x03 response itself as
                    // EVENT_SET_CAPTURE_MODE_SUCCESS. Enable the separate shutter action now;
                    // do not add an extra 0x02/0x3A readiness gate that the original app does not use.
                    this.finishPhotoModeReady('mode ACK');
                }
                else if (this.pendingCaptureAction && cam.captureMode === this.desiredMode(this.pendingCaptureAction)) {
                    cam.captureFlowState = 'SYNCING';
                    cam.lastCaptureMessage = 'Mode ACK received; waiting for camera readiness';
                    drone.addLog('INFO', '[Camera capture] mode ACK accepted; confirming 0x02 status before recording action');
                    this.send(PacketBuilder.buildCameraGetStatus());
                    this.armCaptureTimer('mode readiness confirmation');
                }
                else if (this.pendingCaptureAction) {
                    cam.captureFlowState = 'ERROR';
                    cam.lastCaptureMessage = `Camera mode ACK did not match requested mode`;
                    drone.addLog('ERROR', `[Camera capture] ${cam.lastCaptureMessage}; mode=${cam.captureMode}`);
                    this.pendingCaptureAction = null;
                    this.pendingPhotoRequiresExplicitShutter = false;
                    this.captureRetriedAfterModeError = false;
                }
                else {
                    cam.captureFlowState = 'IDLE';
                }
                break;
            }
            case CAMERA_USB.RECORD:
                this.clearCaptureTimer();
                if (data.length) {
                    cam.recording = data[0] === 1;
                    cam.recordingPending = false;
                    cam.captureMode = 'VIDEO';
                    cam.captureFlowState = 'IDLE';
                    cam.lastCaptureMessage = cam.recording ? 'Video recording started' : 'Video recording stopped';
                    drone.addLog('INFO', cam.lastCaptureMessage);
                    this.pendingCaptureAction = null;
                    this.pendingPhotoRequiresExplicitShutter = false;
                    this.captureRetriedAfterModeError = false;
                }
                break;
            case CAMERA_USB.TAKE_PHOTO:
                // PotensicPro reacts to EVENT_TAKE_PHOTO_SUCCESS by requesting SD state
                // immediately, while the UI continues to show the in-progress photo state
                // until the asynchronous 0x2A completion notification arrives.
                this.getSdStatus();
                this.enterPhotoCompletingState('photo ACK 0x01', 'Photo acknowledged; waiting for completion');
                break;
            case 42:
                this.completePhotoCapture('cmd 0x2A');
                break;
            case 7:
                cam.initialization.lastInitMessage = 'Camera clock synchronized (0x07)';
                drone.addLog('INFO', '[Camera init] camera time set acknowledged');
                break;
            case 4: // format SD response: card state in data[0]
                if (data.length)
                    cam.sd.state = data[0];
                cam.sd.lastStatus = 'Format command acknowledged';
                this.getSdStatus();
                break;
            case 11:
                if (data.length) {
                    cam.videoResolutionIndex = data[0];
                    this.applyZoomLimitForCurrentMode();
                }
                break;
            case 13:
                if (data.length) {
                    cam.photoResolutionIndex = data[0];
                    this.applyZoomLimitForCurrentMode();
                }
                break;
            case 15: {
                if (data.length >= 2) {
                    const encoded = data[0];
                    const mode = data[1];
                    const ev = (encoded - 4) / 2;
                    if (mode === 0)
                        cam.videoEv = ev;
                    else if (mode === 1)
                        cam.photoEv = ev;
                }
                break;
            }
            case 16:
                if (data.length) {
                    const ev = (data[0] - 4) / 2;
                    // PotensicPro returns current-mode EV here; keep both synchronized when mode is unknown.
                    cam.videoEv = ev;
                    cam.photoEv = ev;
                }
                break;
            case 36:
                if (data.length)
                    cam.manualMode.raw = data[0] === 1;
                break;
            case 38:
                if (data.length)
                    cam.manualMode.photoOsd = data[data.length - 1] === 1;
                break;
            case 52:
            case 53:
                if (data.length >= 10) {
                    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    cam.manualMode.manual = data[0] === 1;
                    const up = Math.max(1, dv.getUint16(1, true));
                    const down = dv.getUint16(3, true);
                    cam.manualMode.shutterDen = Math.max(1, Math.round(down / up));
                    cam.manualMode.iso = dv.getUint16(5, true);
                    cam.manualMode.manualWb = data[7] === 1;
                    cam.manualMode.wb = dv.getUint16(8, true);
                    cam.manualMode.loaded = true;
                    if (cmd === 52 && this.pendingPostModeExposureSync) {
                        const mode = this.pendingPostModeExposureSync;
                        setTimeout(() => this.applyPostModeExposureSync(mode), 20);
                    }
                }
                break;
            case 17:
                if (this.parseConfigMenu(data))
                    this.completeManufacturerInitialization();
                break;
            case 62:
            case 63:
                if (data.length >= 4) {
                    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    const zoom = dv.getUint32(0, true) / 100;
                    if (zoom >= 1) {
                        cam.zoomActual = zoom;
                        cam.zoomLastUpdate = Date.now();
                        cam.zoomPending = false;
                        if (cmd === 63 && Math.abs(cam.zoomTarget - zoom) > 0.01)
                            cam.zoomTarget = zoom;
                    }
                }
                break;
            case 59:
            case 60:
                if (data.length)
                    cam.manualMode.photoGps = data[data.length - 1] === 1;
                break;
            case 64:
                if (data.length >= 5) {
                    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    cam.photoMode.childMode = data[0];
                    cam.photoMode.intervalTime = Math.floor(dv.getUint16(1, true) / 1000);
                    cam.photoMode.photoCount = dv.getUint16(3, true);
                    cam.photoMode.isTimeTaking = data.length >= 6 ? (data[5] & 0x0f) === 1 : false;
                    cam.photoMode.loaded = true;
                    drone.addLog('INFO', `[Camera init] photo mode: child=${cam.photoMode.childMode} interval=${cam.photoMode.intervalTime}s count=${cam.photoMode.photoCount} active=${cam.photoMode.isTimeTaking}`);
                }
                break;
            case 23:
                if (data.length >= 7) {
                    cam.sd.state = data[0];
                    cam.sd.freeMb = data[1] | (data[2] << 8) | (data[3] << 16);
                    cam.sd.totalMb = data[4] | (data[5] << 8) | (data[6] << 16);
                    cam.sd.lastStatus = 'SD status received';
                }
                break;
            case CAMERA_USB.ENTER_GALLERY:
                this.acknowledgeGalleryResponse();
                cam.galleryEntered = true;
                cam.galleryState = 'OPEN';
                this.refreshGallery();
                break;
            case CAMERA_USB.QUIT_GALLERY:
                this.acknowledgeGalleryResponse();
                cam.galleryEntered = false;
                cam.galleryLoading = false;
                cam.galleryState = 'CLOSED';
                cam.galleryError = '';
                break;
            case CAMERA_USB.FILE_COUNT:
                this.acknowledgeGalleryResponse();
                if (data.length >= 4) {
                    this.photoCount = data[0] | (data[1] << 8);
                    this.videoCount = data[2] | (data[3] << 8);
                    this.photoNames = [];
                    this.videoNames = [];
                    drone.addLog('INFO', `Camera gallery count: photos=${this.photoCount}, videos=${this.videoCount}`);
                    if (this.photoCount === 0 && this.videoCount === 0) {
                        cam.setGalleryFiles([], []);
                        break;
                    }
                    this.buildGalleryQueue();
                    cam.galleryState = 'LOADING_LIST';
                    this.requestNextGalleryPage();
                }
                else {
                    this.failGallery(`File count response too short (${data.length} B)`);
                }
                break;
            case CAMERA_USB.FILE_LIST:
                this.acknowledgeGalleryResponse();
                this.parseGalleryNames(data);
                this.currentListPage = null;
                this.requestNextGalleryPage();
                break;
            case 26: {
                const text = new TextDecoder('ascii').decode(data).replace(/\0+$/g, '').trim();
                try {
                    const info = JSON.parse(text);
                    const name = String(info.filename || info.file || '');
                    const pending = this.pendingInfo.get(name) || (this.pendingInfo.size === 1 ? [...this.pendingInfo.values()][0] : null);
                    if (pending) {
                        clearTimeout(pending.timer);
                        for (const [k, v] of this.pendingInfo)
                            if (v === pending)
                                this.pendingInfo.delete(k);
                        pending.resolve(info);
                    }
                }
                catch (e) {
                    drone.addLog('WARN', `Camera file metadata could not be parsed: ${text.slice(0, 120)}`);
                }
                break;
            }
            case CAMERA_USB.FILE_META_LIST:
                this.parseGalleryMetadata(data);
                break;
            case CAMERA_USB.FILE_DOWNLOAD:
                this.appendDownloadBytes(data);
                break;
            case CAMERA_USB.FILE_DELETE: {
                drone.addLog('INFO', 'Camera file delete acknowledged');
                const pending = this.pendingDelete;
                if (pending) {
                    clearTimeout(pending.timer);
                    this.pendingDelete = null;
                    pending.resolve();
                }
                this.refreshGallery();
                break;
            }
        }
        return true;
    }
    static buildGalleryQueue() {
        this.listQueue = [];
        const add = (type, count) => {
            for (let offset = 0; offset < count; offset += 50) {
                this.listQueue.push({ type, offset, count: Math.min(50, count - offset) });
            }
        };
        add(2, this.videoCount);
        add(1, this.photoCount);
        if (this.listQueue.length === 0)
            useCameraStore().setGalleryFiles([], []);
    }
    static requestNextGalleryPage() {
        const cam = useCameraStore();
        if (!this.listQueue.length) {
            const photosComplete = this.photoNames.length >= this.photoCount;
            const videosComplete = this.videoNames.length >= this.videoCount;
            if (!photosComplete || !videosComplete) {
                this.failGallery(`Media list incomplete: ${this.photoNames.length}/${this.photoCount} photos, ${this.videoNames.length}/${this.videoCount} videos`);
                return;
            }
            cam.setGalleryFiles(this.photoNames.slice(0, this.photoCount), this.videoNames.slice(0, this.videoCount));
            this.requestGalleryMetadata([...this.videoNames.slice(0, this.videoCount), ...this.photoNames.slice(0, this.photoCount)]);
            return;
        }
        const page = this.listQueue.shift();
        this.currentListPage = page;
        cam.galleryState = 'LOADING_LIST';
        this.sendGalleryWithRetry(PacketBuilder.buildCameraGetFileList(page.type, page.offset, page.count), `file list type=${page.type} offset=${page.offset} count=${page.count} (0x19)`);
    }
    static requestGalleryMetadata(fileNames) {
        if (this.metaTimer)
            clearTimeout(this.metaTimer);
        this.metaTimer = null;
        this.metaRetryCount = 0;
        this.currentMetaBatch = null;
        this.metadataAccumulator = '';
        this.metaQueue = [];
        for (let i = 0; i < fileNames.length; i += 25)
            this.metaQueue.push(fileNames.slice(i, i + 25));
        this.requestNextMetadataBatch();
    }
    static requestNextMetadataBatch() {
        if (this.metaTimer)
            clearTimeout(this.metaTimer);
        this.metaTimer = null;
        const batch = this.metaQueue.shift();
        if (!batch || batch.length === 0) {
            this.currentMetaBatch = null;
            return;
        }
        this.currentMetaBatch = batch;
        this.metaRetryCount = 0;
        this.send(PacketBuilder.buildCameraGetFileMetaList(batch));
        this.armMetadataTimeout();
    }
    static armMetadataTimeout() {
        if (this.metaTimer)
            clearTimeout(this.metaTimer);
        this.metaTimer = setTimeout(() => {
            if (!this.currentMetaBatch)
                return;
            if (this.metaRetryCount < this.META_MAX_RETRIES) {
                this.metaRetryCount++;
                this.metadataAccumulator = '';
                useDroneStore().addLog('WARN', `Camera metadata 0x20 timeout; retry ${this.metaRetryCount}/${this.META_MAX_RETRIES}`);
                this.send(PacketBuilder.buildCameraGetFileMetaList(this.currentMetaBatch));
                this.armMetadataTimeout();
                return;
            }
            useDroneStore().addLog('WARN', 'Camera metadata 0x20 unavailable; keeping filename timestamps as fallback');
            this.metadataAccumulator = '';
            this.currentMetaBatch = null;
            this.requestNextMetadataBatch();
        }, this.META_TIMEOUT_MS);
    }
    static parseGalleryMetadata(data) {
        if (this.metaTimer)
            clearTimeout(this.metaTimer);
        this.metaTimer = null;
        const fragment = new TextDecoder('ascii').decode(data).replace(/\0+$/g, '');
        this.metadataAccumulator += fragment;
        if (this.metadataAccumulator.length > this.MAX_METADATA_ACCUMULATOR) {
            useDroneStore().addLog('WARN', `Camera metadata 0x20 accumulator exceeded ${this.MAX_METADATA_ACCUMULATOR} bytes; discarding response`);
            this.metadataAccumulator = '';
            this.currentMetaBatch = null;
            this.requestNextMetadataBatch();
            return;
        }
        const text = this.metadataAccumulator.trim();
        if (!this.looksLikeCompleteJson(text)) {
            useDroneStore().addLog('INFO', `Camera metadata 0x20 fragment buffered (${this.metadataAccumulator.length}B)`);
            this.armMetadataTimeout();
            return;
        }
        try {
            const parsed = JSON.parse(text);
            const raw = Array.isArray(parsed?.file_info) ? parsed.file_info : [];
            const entries = raw.map((entry) => {
                if (typeof entry === 'string') {
                    try {
                        return JSON.parse(entry);
                    }
                    catch {
                        return null;
                    }
                }
                return entry;
            }).filter(Boolean);
            useCameraStore().applyGalleryMetadata(entries);
            useDroneStore().addLog('INFO', `Camera metadata 0x20 parsed for ${entries.length} files from ${this.metadataAccumulator.length}B assembled response`);
        }
        catch (e) {
            useDroneStore().addLog('WARN', `Camera metadata 0x20 complete response could not be parsed: ${e?.message || e}; payload=${text.slice(0, 160)}`);
        }
        finally {
            this.metadataAccumulator = '';
            this.currentMetaBatch = null;
            this.requestNextMetadataBatch();
        }
    }
    static parseGalleryNames(data) {
        // PotensicPro starts the NUL-separated ASCII filename data two bytes into the
        // command-specific response body (payloadIndex + 4 including cmd/status).
        const decodeNames = (bytes) => {
            const text = new TextDecoder('ascii').decode(bytes).replace(/[\x00-\x1f]+/g, '\0');
            return text.split('\0').map(v => v.trim()).filter(Boolean);
        };
        let names = data.length >= 2 ? decodeNames(data.subarray(2)) : [];
        // Preserve the previous tolerant scan only as a fallback for firmware variants.
        if (!names.some(name => /\.(jpg|jpeg|dng|mp4|mov|lrv)$/i.test(name)))
            names = decodeNames(data);
        for (const name of names) {
            const lower = name.toLowerCase();
            if (/\.jpg$/.test(lower) && !this.photoNames.includes(name))
                this.photoNames.push(name);
            else if (/\.mp4$/.test(lower) && !this.videoNames.includes(name))
                this.videoNames.push(name);
            else if (/\.(jpeg|dng)$/.test(lower) && !this.photoNames.includes(name))
                this.photoNames.push(name);
            else if (/\.(mov|lrv)$/.test(lower) && !this.videoNames.includes(name))
                this.videoNames.push(name);
        }
        useDroneStore().addLog('INFO', `Camera gallery page parsed: photos=${this.photoNames.length}/${this.photoCount}, videos=${this.videoNames.length}/${this.videoCount}`);
    }
    static handleCompleteDownloadFrame(body) {
        const dl = this.activeDownload;
        // PotensicPro DownloadData body after cmd/status:
        // flag (1B), [32B final-block digest area], offset (u64 LE), payloadLen (u16 LE), payload.
        if (!dl || body.length < 11)
            return;
        const cam = useCameraStore();
        const drone = useDroneStore();
        const flag = body[0];
        const fileEnd = flag === 2;
        const unitEnd = flag === 1;
        const base = fileEnd ? 33 : 1;
        if (body.length < base + 10) {
            drone.addLog('WARN', `Camera download frame too short: flag=${flag} body=${body.length}B`);
            return;
        }
        const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
        const offset = view.getBigUint64(base, true);
        const payloadLen = view.getUint16(base + 8, true);
        const payloadStart = base + 10;
        if (payloadLen <= 0 || payloadStart + payloadLen > body.length) {
            drone.addLog('WARN', `Camera download frame length invalid: flag=${flag} offset=${offset} len=${payloadLen} body=${body.length}B`);
            return;
        }
        this.clearDownloadTimeout();
        this.downloadRetryCount = 0;
        if (offset < dl.received) {
            const duplicateEnd = offset + BigInt(payloadLen);
            if (duplicateEnd <= dl.received) {
                drone.addLog('WARN', `Ignoring duplicate camera download block at ${offset} (${payloadLen}B)`);
                const remaining = dl.total - dl.received;
                if (remaining > 0n)
                    this.armDownloadTimeout(dl.received, remaining > this.DOWNLOAD_CHUNK_SIZE ? this.DOWNLOAD_CHUNK_SIZE : remaining);
                return;
            }
        }
        if (offset !== dl.received) {
            drone.addLog('WARN', `Camera download offset mismatch: got ${offset}, current ${dl.received}; re-requesting from current offset`);
            this.requestNextDownloadChunk();
            return;
        }
        const chunk = body.slice(payloadStart, payloadStart + payloadLen);
        dl.chunks.push(chunk);
        dl.received += BigInt(chunk.length);
        this.downloadLastProgressAt = Date.now();
        const pct = Number(dl.received) * 100 / Number(dl.total);
        cam.download.progress = Math.min(100, Math.round(pct * 10) / 10);
        drone.addLog('INFO', `Camera download block: ${chunk.length}B flag=${flag}${unitEnd ? ' unit-end' : ''}${fileEnd ? ' file-end' : ''}, ${cam.download.progress}%`);
        if (fileEnd || dl.received >= dl.total) {
            void this.finishDownload();
        }
        else if (unitEnd) {
            // flag=1 ends the current requested unit. Only now request the next unit.
            this.requestNextDownloadChunk();
        }
        else {
            // flag=0 is a continuing part of the current unit. Do not emit another 0x1B request.
            const remaining = dl.total - dl.received;
            const watchdogLength = remaining > this.DOWNLOAD_CHUNK_SIZE ? this.DOWNLOAD_CHUNK_SIZE : remaining;
            this.armDownloadTimeout(dl.received, watchdogLength);
        }
    }
}
Object.defineProperty(CameraMediaService, "sender", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "photoCount", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(CameraMediaService, "videoCount", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(CameraMediaService, "photoNames", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: []
});
Object.defineProperty(CameraMediaService, "videoNames", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: []
});
Object.defineProperty(CameraMediaService, "listQueue", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: []
});
Object.defineProperty(CameraMediaService, "currentListPage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "galleryTimer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "galleryRetryCount", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(CameraMediaService, "GALLERY_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1800
});
Object.defineProperty(CameraMediaService, "GALLERY_MAX_RETRIES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 3
});
Object.defineProperty(CameraMediaService, "lastGalleryPacket", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "lastGalleryStage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ''
});
Object.defineProperty(CameraMediaService, "pendingInfo", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Map()
});
Object.defineProperty(CameraMediaService, "activeDownload", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "downloadTimer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "downloadRetryCount", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(CameraMediaService, "DOWNLOAD_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1000
});
Object.defineProperty(CameraMediaService, "DOWNLOAD_MAX_RETRIES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 15
});
Object.defineProperty(CameraMediaService, "DOWNLOAD_CHUNK_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 102400n
});
Object.defineProperty(CameraMediaService, "DOWNLOAD_INACTIVITY_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 15000
});
Object.defineProperty(CameraMediaService, "downloadLastProgressAt", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(CameraMediaService, "downloadFrameBuffer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Uint8Array(0)
});
Object.defineProperty(CameraMediaService, "cameraInnerBuffer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Uint8Array(0)
});
Object.defineProperty(CameraMediaService, "MAX_CAMERA_INNER_FRAME", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2000000
});
Object.defineProperty(CameraMediaService, "transportReady", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: false
});
Object.defineProperty(CameraMediaService, "deferredPackets", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: []
});
Object.defineProperty(CameraMediaService, "MAX_DEFERRED_PACKETS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 32
});
Object.defineProperty(CameraMediaService, "cameraInitTimer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "CAMERA_INIT_RETRY_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1000
});
Object.defineProperty(CameraMediaService, "pendingZoomAfterInit", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: false
});
Object.defineProperty(CameraMediaService, "videoZoomByResolution", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Map()
});
Object.defineProperty(CameraMediaService, "photoZoomByResolution", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Map()
});
Object.defineProperty(CameraMediaService, "pendingPostModeExposureSync", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "metaQueue", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: []
});
Object.defineProperty(CameraMediaService, "metaTimer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "metaRetryCount", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(CameraMediaService, "currentMetaBatch", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "META_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2000
});
Object.defineProperty(CameraMediaService, "META_MAX_RETRIES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2
});
Object.defineProperty(CameraMediaService, "metadataAccumulator", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ''
});
Object.defineProperty(CameraMediaService, "MAX_METADATA_ACCUMULATOR", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1000000
});
Object.defineProperty(CameraMediaService, "pendingCaptureAction", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "pendingPhotoRequiresExplicitShutter", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: false
});
Object.defineProperty(CameraMediaService, "captureTimer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "captureRetriedAfterModeError", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: false
});
Object.defineProperty(CameraMediaService, "captureBackoffTimer", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(CameraMediaService, "CAPTURE_STAGE_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2500
});
Object.defineProperty(CameraMediaService, "CAPTURE_BUSY_BACKOFF_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 350
});
Object.defineProperty(CameraMediaService, "PHOTO_COMPLETION_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 10000
});
Object.defineProperty(CameraMediaService, "pendingDelete", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
