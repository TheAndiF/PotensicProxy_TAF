/**
 * Packet Construction Engine
 * Implements binary packet creation for all drone commands in pure TypeScript/Vue.
 */
import { FeTransport } from './FeTransport.js';
import { FfFdCommand } from './FfFdCommand.js';
import { PROTOCOL_HEX, CAMERA_CMDS, CAMERA_USB, CMD_SHORTS } from './DroneProtocol.js';
import { ByteUtils } from '../utils/ByteUtils.js';
export class PacketBuilder {
    static nextSequence() {
        const s = this.sequence;
        this.sequence = (this.sequence + 1) % 65536;
        return s;
    }
    // === Flight Commands ===
    static buildFlightCommand(group, subcmd) {
        const seq = this.nextSequence();
        const data = new Uint8Array([0x04, seq & 0xFF, (seq >> 8) & 0xFF, group & 0xFF, subcmd & 0xFF]);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FLIGHT, data);
        return FeTransport.wrap(inner, 0x14);
    }
    static buildTakeoff() {
        return this.buildCtrlType(3, 0);
    }
    static buildLand() {
        return this.buildCtrlType(4, 0x55);
    }
    static buildCancelLand() {
        return this.buildCtrlType(4, 0xaa);
    }
    static buildRTH() {
        return this.buildCtrlType(8, 0);
    }
    static buildCancelRTH() {
        return this.buildCancelAutoFly();
    }
    static buildEmergencyStop() {
        return this.buildFlightCommand(0x01, 0x00);
    }
    // === PotensicPro-compatible flight settings / intelligent modes ===
    static buildFlightData(functionCode, payload) {
        return FeTransport.wrap(FfFdCommand.buildWithShort(functionCode & 0xffff, payload), 0x14);
    }
    static buildFlightSettings(v) {
        // New-FC SendFlightSetData layout (function code 3). Last GPS fields are intentionally omitted exactly as PotensicPro does.
        const data = new Uint8Array(13);
        const view = new DataView(data.buffer);
        view.setUint16(0, v.limitHeight & 0xffff, true);
        view.setUint16(2, v.limitDistance & 0xffff, true);
        view.setUint16(4, v.returnHeight & 0xffff, true);
        data[6] = v.beginnerMode ? 0xff : 0x00;
        data[7] = v.americaRockerMode ? 0x00 : 0x01;
        view.setUint16(8, v.surroundRadius & 0xffff, true);
        data[10] = v.clockwise ? 1 : 0;
        data[11] = v.surroundSpeed & 0xff;
        data[12] = v.speedMode & 0xff;
        return this.buildFlightData(3, data);
    }
    static buildCtrlType(command, resultParam2 = 0) {
        const data = new Uint8Array(32);
        const view = new DataView(data.buffer);
        view.setUint16(2, command & 0xffff, true);
        view.setInt32(20, resultParam2 | 0, true);
        return this.buildFlightData(20, data);
    }
    static buildFollowToggle() { return this.buildCtrlType(7); }
    static buildCircleToggle() { return this.buildCtrlType(6); }
    static buildPointFlyToggle() { return this.buildCtrlType(5); }
    static buildCancelAutoFly() { return this.buildCtrlType(99); }
    static buildMultiPoint(points) {
        const pts = points.slice(0, 31);
        const data = new Uint8Array(1 + pts.length * 8);
        const view = new DataView(data.buffer);
        data[0] = pts.length;
        pts.forEach((p, idx) => {
            view.setInt32(1 + idx * 8, Math.round(p.lat * 1e7), true);
            view.setInt32(5 + idx * 8, Math.round(p.lng * 1e7), true);
        });
        return this.buildFlightData(6, data);
    }
    static buildCompassCalibrationPulse() { return this.buildFlightData(18, new Uint8Array([1, 1, 0, 0])); }
    static buildEnterCalibration(enter) { return this.buildFlightData(24, new Uint8Array([enter ? 1 : 2])); }
    static buildGeneralCommand(command, param = 0) {
        const data = new Uint8Array(21);
        const view = new DataView(data.buffer);
        view.setUint16(0, command & 0xffff, true);
        data[2] = param & 0xff;
        return this.buildFlightData(27, data);
    }
    static buildImuCalibrationOfficial(start) { return this.buildGeneralCommand(6, start ? 1 : 0); }
    static buildFindDroneBeep(start) { return this.buildGeneralCommand(2, start ? 2 : 0); }
    static buildGimbalSettings(v) {
        const data = new Uint8Array(11);
        const view = new DataView(data.buffer);
        data[0] = v.pitchControl & 0xff;
        view.setInt16(1, v.pitchSpeed, true);
        data[3] = v.stableMode ? 0 : 1;
        data[4] = v.fpvSmooth & 0xff;
        data[5] = v.calibration & 0xff;
        view.setInt16(6, v.tuningRoll, true);
        view.setInt16(8, v.tuningYaw, true);
        data[10] = v.reset & 0xff;
        return this.buildFlightData(26, data);
    }
    static buildRemoteCalibration(open) {
        // SendOthersData: remoter channel function 113. PotensicPro uses FlightConfig.P1_SELF = 0xA0 to enter calibration; 0xF0 exits.
        // FE type 0x17 + FF FE inner marker matches the manufacturer remoter path.
        const inner = FfFdCommand.buildWithShort(113, new Uint8Array([open ? 0xa0 : 0xf0]));
        inner[1] = 0xfe;
        return FeTransport.wrap(inner, 0x17);
    }
    // === Camera Commands ===
    /** @deprecated Use buildCameraTakePhoto(); retained as a compatibility alias. */
    static buildTakePhoto() { return this.buildCameraTakePhoto(); }
    /** @deprecated Recording is not a toggle in PotensicPro; this compatibility alias starts recording. */
    static buildToggleRecord() { return this.buildCameraStartRecord(); }
    /**
     * PotensicPro USB camera protocol (2022/new FC):
     * outer FE type 0x15 + inner FF FD frame with message short 0x0020.
     * This is byte-compatible with UsbPayloadWrapper.wrap((short) 32, payload)
     * followed by UsbDataWrapper.wrap(..., USB_TYPE_APP_TO_CAMERA).
     */
    static buildLegacyCameraUsb(payload) {
        const inner = FfFdCommand.buildWithShort(CAMERA_USB.INNER_FUNCTION, payload);
        return FeTransport.wrap(inner, 0x15);
    }
    static buildCameraGetConfigMenu() { return this.buildLegacyCameraUsb(new Uint8Array([17])); }
    static buildCameraSetTime(date = new Date()) {
        return this.buildLegacyCameraUsb(new Uint8Array([
            7,
            Math.max(0, Math.min(255, date.getFullYear() - 2000)),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds()
        ]));
    }
    static buildCameraGetSdStatus() { return this.buildLegacyCameraUsb(new Uint8Array([23])); }
    static buildCameraFormatSd() { return this.buildLegacyCameraUsb(new Uint8Array([4])); }
    static buildCameraGetVideoSizes() { return this.buildLegacyCameraUsb(new Uint8Array([8])); }
    static buildCameraGetPhotoSizes() { return this.buildLegacyCameraUsb(new Uint8Array([9])); }
    static buildCameraGetCurrentVideoSize() { return this.buildLegacyCameraUsb(new Uint8Array([10])); }
    static buildCameraSetVideoSize(index) { return this.buildLegacyCameraUsb(new Uint8Array([11, index & 0xff])); }
    static buildCameraGetCurrentPhotoSize() { return this.buildLegacyCameraUsb(new Uint8Array([12])); }
    static buildCameraSetPhotoSize(index) { return this.buildLegacyCameraUsb(new Uint8Array([13, index & 0xff])); }
    static buildCameraGetRecordEv() { return this.buildLegacyCameraUsb(new Uint8Array([14, 0])); }
    static buildCameraGetTakePhotoEv() { return this.buildLegacyCameraUsb(new Uint8Array([14, 1])); }
    static buildCameraGetEv(mode) { return this.buildLegacyCameraUsb(new Uint8Array([16, mode])); }
    static buildCameraGetManualModeInfo() { return this.buildLegacyCameraUsb(new Uint8Array([52])); }
    static buildCameraGetExposureInfo() { return this.buildLegacyCameraUsb(new Uint8Array([54])); }
    static buildCameraSetRaw(enable) { return this.buildLegacyCameraUsb(new Uint8Array([36, enable ? 1 : 0])); }
    static buildCameraSetPhotoOsd(enable) { return this.buildLegacyCameraUsb(new Uint8Array([38, 2, enable ? 1 : 0])); }
    static buildCameraSetPhotoGps(enable) { return this.buildLegacyCameraUsb(new Uint8Array([59, enable ? 1 : 0])); }
    static buildCameraGetPhotoGps() { return this.buildLegacyCameraUsb(new Uint8Array([60])); }
    static buildCameraSetZoom(zoom) {
        const clamped = Math.max(1, Math.min(255, Number.isFinite(zoom) ? zoom : 1));
        const encoded = Math.round(clamped * 100);
        const data = new Uint8Array(5);
        const view = new DataView(data.buffer);
        data[0] = 0x3e;
        view.setUint32(1, encoded >>> 0, true);
        return this.buildLegacyCameraUsb(data);
    }
    static buildCameraGetZoom() { return this.buildLegacyCameraUsb(new Uint8Array([0x3f])); }
    static buildCameraGetTakePhotoMode() { return this.buildLegacyCameraUsb(new Uint8Array([0x40])); }
    static buildCameraSetManualMode(info) {
        const data = new Uint8Array(32);
        const view = new DataView(data.buffer);
        data[0] = 53;
        data[1] = info.manual ? 1 : 0;
        view.setUint16(2, 1, true);
        view.setUint16(4, Math.max(1, info.shutterDen) & 0xffff, true);
        view.setUint16(6, Math.max(0, info.iso) & 0xffff, true);
        data[8] = info.manualWb ? 1 : 0;
        view.setUint16(9, Math.max(0, info.wb) & 0xffff, true);
        return this.buildLegacyCameraUsb(data);
    }
    static buildCameraSetEv(mode, ev) {
        const encoded = Math.max(0, Math.min(255, Math.round(ev * 2 + 4)));
        return this.buildLegacyCameraUsb(new Uint8Array([15, mode, encoded]));
    }
    static buildCameraGetStatus() { return this.buildLegacyCameraUsb(new Uint8Array([0x02])); }
    static buildCameraSetMode(mode) {
        return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.MODE, mode === 'PHOTO' ? 0x01 : 0x00]));
    }
    static buildCameraTakePhoto() { return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.TAKE_PHOTO])); }
    static buildCameraStartRecord() { return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.RECORD, 0x01])); }
    static buildCameraStopRecord() { return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.RECORD, 0x00])); }
    static buildCameraRecord() { return this.buildCameraStartRecord(); }
    static buildCameraEnterGallery() { return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.ENTER_GALLERY])); }
    static buildCameraQuitGallery() { return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.QUIT_GALLERY])); }
    static buildCameraGetFileCount() { return this.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.FILE_COUNT])); }
    static buildCameraGetFileList(type, offset = 0, count = 50) {
        const data = new Uint8Array(6);
        const view = new DataView(data.buffer);
        data[0] = CAMERA_USB.FILE_LIST;
        data[1] = type;
        view.setUint16(2, offset & 0xffff, true);
        view.setUint16(4, count & 0xffff, true);
        return this.buildLegacyCameraUsb(data);
    }
    static buildCameraGetFileInfo(fileName) {
        const name = new TextEncoder().encode(fileName);
        const data = new Uint8Array(1 + name.length);
        data[0] = CAMERA_USB.FILE_INFO;
        data.set(name, 1);
        return this.buildLegacyCameraUsb(data);
    }
    static buildCameraGetFileMetaList(fileNames) {
        const json = JSON.stringify({ filelist: fileNames });
        const encoded = new TextEncoder().encode(json);
        const data = new Uint8Array(1 + encoded.length);
        data[0] = CAMERA_USB.FILE_META_LIST;
        data.set(encoded, 1);
        return this.buildLegacyCameraUsb(data);
    }
    static buildCameraDeleteFile(fileName) {
        const name = new TextEncoder().encode(fileName);
        const data = new Uint8Array(2 + name.length);
        data[0] = CAMERA_USB.FILE_DELETE;
        data[1] = 0;
        data.set(name, 2);
        return this.buildLegacyCameraUsb(data);
    }
    static buildCameraDownloadChunk(fileName, offset, length) {
        const name = new TextEncoder().encode(fileName);
        const data = new Uint8Array(17 + name.length);
        const view = new DataView(data.buffer);
        data[0] = CAMERA_USB.FILE_DOWNLOAD;
        view.setBigUint64(1, offset, true);
        view.setBigUint64(9, length, true);
        data.set(name, 17);
        return this.buildLegacyCameraUsb(data);
    }
    static buildIdrRequest() {
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.REQUEST_IDR, null, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    static buildCameraGetAllParams() {
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.GET_ALL_PARAMS, null, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * Set Camera Function Switch (0x1200 / Subcmd 0x16)
     * Official implementation: i80.C4(boolean z) -> CameraFunction
     * Byte 0: mask (0x34 for preview + h265)
     * Byte 1: values (bit 2 = isPreviewOpen, bit 4 = isH265Open, bit 5 = isH265PreviewOpen)
     */
    static buildCameraFunction(enablePreview = true, enableH265 = true) {
        const mask = (enablePreview ? 0x04 : 0) | (enableH265 ? 0x30 : 0x00) | 0x04;
        const bits = (enablePreview ? 0x04 : 0) | (enableH265 ? 0x30 : 0x00);
        const data = new Uint8Array([mask & 0xff, bits & 0xff, 0x00, 0x00]);
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.CAMERA_FUNCTION, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * Set LiveView Parameters (0x1200 / Subcmd 0xD8)
     * Official implementation: sd3.java -> h264Level(1B), h264Rate LE(2B), h265Level(1B), h265Rate LE(2B)
     */
    static buildLiveViewParams(h265 = true, bitrateKbps = 10240) {
        const data = new Uint8Array(6);
        data[0] = 0x00; // 1080P
        data[1] = bitrateKbps & 0xff; // Little-Endian low byte
        data[2] = (bitrateKbps >> 8) & 0xff; // Little-Endian high byte
        data[3] = 0x00; // 1080P
        data[4] = bitrateKbps & 0xff; // Little-Endian low byte
        data[5] = (bitrateKbps >> 8) & 0xff; // Little-Endian high byte
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.LIVEVIEW_PARAMS, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * Camera LiveView Start (0x1200 / Subcmd 0x73, data = 0x00 0x64)
     * Official sequence packet #20: fe000000000000150000000000000009 fffd05000012730064
     */
    static buildLiveViewStart() {
        const data = new Uint8Array([0x00, 0x64]);
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.LIVEVIEW_START, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    static buildFpvSyncVersion() {
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_SYNC_VERSION, null);
        return FeTransport.wrap(inner, 0x16);
    }
    // === System & Protocol ===
    static buildHandshake() {
        return ByteUtils.hexToBytes(PROTOCOL_HEX.HANDSHAKE);
    }
    static buildHeartbeat() {
        return ByteUtils.hexToBytes(PROTOCOL_HEX.HEARTBEAT);
    }
    /**
     * Full official initialization & camera wake-up sequence
     */
    static buildInitSequence(enableH265 = true) {
        return [
            PacketBuilder.buildFpvSyncVersion(), // 1. FPV: Sync Version (0x1600)
            PacketBuilder.buildCameraGetAllParams(), // 2. CAMERA: Get All Params (0x1200 / 0x01)
            ByteUtils.hexToBytes('fe000000000000170000000000000008fffe04007310006700'), // 3. REMOTER: Get Info
            ByteUtils.hexToBytes('fe000000000000160000000000000007fffd030035162000'), // 4. FPV: Get Settings
            ByteUtils.hexToBytes('fe00000000000014000000000000000afffd06000103007e007a'), // 5. FLIGHT: Init
            PacketBuilder.buildCameraFunction(true, enableH265), // 6. CAMERA: Enable Preview + H265/H264
            PacketBuilder.buildLiveViewStart(), // 7. CAMERA: Start LiveView Stream (0x73)
            PacketBuilder.buildLiveViewParams(enableH265, 10240), // 8. CAMERA: Set 1080P 10240Kbps
            PacketBuilder.buildIdrRequest() // 9. CAMERA: Request IDR Keyframe
        ];
    }
    static buildRfProbe(enable = true) {
        const data = new Uint8Array([enable ? 0x01 : 0x00]);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.RF_PROBE, data);
        return FeTransport.wrap(inner, 0x14);
    }
    static buildWifiDirectSwitch(enter = true) {
        const data = new Uint8Array(17);
        data[0] = enter ? 0x01 : 0x00;
        for (let i = 1; i <= 16; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.WIFI_SWITCH, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    // === Engineering & Debugging Commands ===
    /**
     * Camera Interactive Debug Console (0x1200 / Subcmd 0x6F)
     * Sends OpCode (1 byte) + Command String (UTF-8)
     */
    static buildCameraTerminalCommand(opcode = 0, paramStr = '') {
        const strBytes = new TextEncoder().encode(paramStr);
        const data = new Uint8Array(1 + strBytes.length);
        data[0] = opcode & 0xFF;
        data.set(strBytes, 1);
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.DEBUG_TERMINAL, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * FPV Custom Hex Command Injection (CMD 5696 / 0x1640)
     * Sends arbitrary hex payload directly to FPV MCU
     */
    static buildFpvCustomHex(hexStr) {
        const rawBytes = ByteUtils.hexToBytes(hexStr.replace(/[\s\r\n]/g, ''));
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_CUSTOM_DEBUG, rawBytes);
        return FeTransport.wrap(inner, 0x16);
    }
    /**
     * Factory Flight Mode Toggle (CMD 5640 / 0x1608)
     */
    static buildFpvFactoryFlyMode(enable = true) {
        const data = new Uint8Array([enable ? 0x01 : 0x00]);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_SET_FACTORY_FLY, data);
        return FeTransport.wrap(inner, 0x16);
    }
    /**
     * Set FPV Bandwidth (CMD 5652 / 0x1614)
     * payload: [isOpen (1B), bandwidth uint32 LE (4B)]
     */
    static buildFpvBandwidth(isOpen = true, bandwidthMhz = 20) {
        const data = new Uint8Array(5);
        data[0] = isOpen ? 0x01 : 0x00;
        const view = new DataView(data.buffer);
        view.setUint32(1, bandwidthMhz, true);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_SET_BANDWIDTH, data);
        return FeTransport.wrap(inner, 0x16);
    }
    /**
     * Allow All RF Frequencies / Unlock Full Bands (CMD 5658 / 0x161A)
     */
    static buildRfAllowAllFrequencies() {
        const data = new Uint8Array([0x01]);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_ALLOW_ALL_FREQS, data);
        return FeTransport.wrap(inner, 0x16);
    }
    /**
     * RF Hardware Reset & Reboot (CMD 5650 / 0x1612)
     * Sends ASCII "reset\n" [114, 101, 115, 101, 116, 10]
     */
    static buildRfReset() {
        const data = new Uint8Array([114, 101, 115, 101, 116, 10]); // "reset\n"
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_RF_RESET, data);
        return FeTransport.wrap(inner, 0x16);
    }
    /**
     * Enter RF Test Mode (CMD 5642 / 0x160A)
     */
    static buildEnterRfTest() {
        const data = new Uint8Array([0x00]);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_ENTER_RF_TEST, data);
        return FeTransport.wrap(inner, 0x16);
    }
    /**
     * IMU Calibration Control (CMD 0x0301 / Subcmd 23 / 0x17)
     * action: 3 = start calibration, 2 = stop calibration
     */
    static buildImuCalibration(action = 3) {
        const data = new Uint8Array([action & 0xFF]);
        const inner = FfFdCommand.buildWithCmdByte(23, data, CMD_SHORTS.FLIGHT);
        return FeTransport.wrap(inner, 0x14);
    }
    /**
     * Gimbal Reset / Clear IMU Calibration (CMD 0x0801)
     */
    static buildGimbalClearImu() {
        const data = new Uint8Array([0x05]);
        const inner = FfFdCommand.buildWithShort(CMD_SHORTS.GIMBAL_CONTROL, data);
        return FeTransport.wrap(inner, 0x14);
    }
    /**
     * Camera DPC Bad Pixel Calibration (CMD 0x1200 / Subcmd 0x6E)
     * isDark: false = light field test, true = dark field test
     */
    static buildCameraDpcCheck(isDark = false, step = 0) {
        const data = new Uint8Array([isDark ? 0x00 : 0x01, step & 0xFF, 0xA0, 0x0F]); // 40000 threshold
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.DPC_CALIBRATION, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * Camera FPN Fixed Pattern Noise Calibration (CMD 0x1200 / Subcmd 0x74)
     */
    static buildCameraFpnCheck() {
        const data = new Uint8Array([0x00, 0x00, 0x10]);
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.FPN_CALIBRATION, data, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * Remote ID Configuration Query (CMD 0x1200 / Subcmd 115 / 0x73)
     */
    static buildRemoteIdQuery() {
        const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.REMOTE_ID_CONFIG, null, CMD_SHORTS.CAMERA);
        return FeTransport.wrap(inner, 0x15);
    }
    /**
     * GPS Test Mode Control (CMD 0x0301 / Subcmd 23)
     */
    static buildGpsTestControl(enable = true) {
        const data = new Uint8Array([enable ? 0x01 : 0x00]);
        const inner = FfFdCommand.buildWithCmdByte(23, data, CMD_SHORTS.FLIGHT);
        return FeTransport.wrap(inner, 0x14);
    }
    /**
     * Beidou Satellite Switch (CMD 0x0301 / Subcmd 24)
     */
    static buildBeidouSwitch(enable = true) {
        const data = new Uint8Array([enable ? 0x01 : 0x00]);
        const inner = FfFdCommand.buildWithCmdByte(24, data, CMD_SHORTS.FLIGHT);
        return FeTransport.wrap(inner, 0x14);
    }
    // === Joysticks & Controls ===
    /**
     * PotensicPro Send4AxisData (function code 0x0001).
     * Browser axes use -1000..1000; the official app serializes each axis as
     * an unsigned byte 0..250 with neutral=125. The payload is sent on the
     * APP_TO_FLIGHT transport (FE 0x14).
     */
    static buildFourAxisControl(throttle = 0, yaw = 0, pitch = 0, roll = 0, gimbal = 0, channel = 4) {
        const axisByte = (value) => {
            const clamped = Math.max(-1000, Math.min(1000, Math.round(value)));
            return Math.max(0, Math.min(250, Math.trunc((clamped * 125) / 1000) + 125));
        };
        const data = new Uint8Array(11);
        data[0] = channel & 0xff;
        data[1] = axisByte(throttle);
        data[2] = axisByte(yaw);
        data[3] = axisByte(pitch);
        data[4] = axisByte(roll);
        data[5] = axisByte(gimbal);
        data[6] = 125; // camera axis neutral, matching Send4AxisData constructor
        // data[7..10] remain zero: light/other/calibration/photo-record toggles
        return this.buildFlightData(0x0001, data);
    }
    /**
     * HighFrequencyData3 Control Packet (37 bytes)
     * Values range: -1000..1000
     */
    static buildControlPacket(throttle = 0, yaw = 0, pitch = 0, roll = 0, gimbal = 0) {
        const out = new Uint8Array(37);
        const view = new DataView(out.buffer);
        out[0] = 3; // ID=3
        view.setUint16(1, 34, true);
        view.setInt16(17, Math.max(-1000, Math.min(1000, throttle)), true);
        view.setInt16(19, Math.max(-1000, Math.min(1000, yaw)), true);
        view.setInt16(21, Math.max(-1000, Math.min(1000, pitch)), true);
        view.setInt16(23, Math.max(-1000, Math.min(1000, roll)), true);
        view.setInt16(25, Math.max(-1000, Math.min(1000, gimbal)), true);
        return out;
    }
    /**
     * Combined HFD2(35) + HFD1(55) + HFD3(37) = 127 bytes RAW
     * Sent without FE encapsulation (direct to AOA)
     */
    static buildCombinedControl(throttle = 0, yaw = 0, pitch = 0, roll = 0, gimbal = 0) {
        const out = new Uint8Array(127);
        const view = new DataView(out.buffer);
        out[0] = 2;
        view.setUint16(1, 32, true); // HFD2
        out[35] = 1;
        view.setUint16(36, 52, true); // HFD1
        out.set(this.buildControlPacket(throttle, yaw, pitch, roll, gimbal), 90); // HFD3
        return out;
    }
}
Object.defineProperty(PacketBuilder, "sequence", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 125
});
