import { PacketBuilder } from '../protocol/PacketBuilder'
import { CAMERA_USB } from '../protocol/DroneProtocol'
import { useCameraStore } from '../stores/useCameraStore'
import { useDroneStore } from '../stores/useDroneStore'
import { AndroidMediaService, type AndroidMediaLibrary, type AndroidStoredImage, type RecognitionMetadata } from './AndroidMediaService'

export class CameraMediaService {
  private static sender: ((bytes: Uint8Array) => void) | null = null
  private static photoCount = 0
  private static videoCount = 0
  private static photoNames: string[] = []
  private static videoNames: string[] = []
  private static listQueue: Array<{ type: 1 | 2; offset: number; count: number }> = []
  private static currentListPage: { type: 1 | 2; offset: number; count: number } | null = null
  private static galleryTimer: ReturnType<typeof setTimeout> | null = null
  private static galleryRetryCount = 0
  private static readonly GALLERY_TIMEOUT_MS = 1800
  private static readonly GALLERY_MAX_RETRIES = 3
  private static lastGalleryPacket: Uint8Array | null = null
  private static lastGalleryStage = ''
  private static pendingInfo = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: any }>()
  private static activeDownload: null | {
    fileName: string
    originalFileName: string
    outputName: string
    total: bigint
    received: bigint
    chunks: Uint8Array[]
    library: AndroidMediaLibrary
    source: string
    metadata?: RecognitionMetadata
    deleteAfterVerified: boolean
    resolve: (value: AndroidStoredImage | undefined) => void
    reject: (error: Error) => void
  } = null
  private static downloadTimer: ReturnType<typeof setTimeout> | null = null
  private static downloadRetryCount = 0
  private static readonly DOWNLOAD_TIMEOUT_MS = 1000
  private static readonly DOWNLOAD_MAX_RETRIES = 15
  private static readonly DOWNLOAD_CHUNK_SIZE = 102400n
  private static readonly DOWNLOAD_TOTAL_TIMEOUT_MS = 15000
  private static downloadStartedAt = 0
  private static metaQueue: string[][] = []
  private static metaTimer: ReturnType<typeof setTimeout> | null = null
  private static metaRetryCount = 0
  private static currentMetaBatch: string[] | null = null
  private static readonly META_TIMEOUT_MS = 2000
  private static readonly META_MAX_RETRIES = 2
  private static pendingDelete: null | {
    fileName: string
    resolve: () => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  } = null

  static setSender(sender: (bytes: Uint8Array) => void) {
    this.sender = sender
  }

  private static send(packet: Uint8Array) {
    const store = useDroneStore()
    if (!this.sender) {
      store.addLog('ERROR', 'Camera command not sent: transport is not initialized')
      return
    }
    this.sender(packet)
  }

  static refreshSettings() {
    const store = useDroneStore()
    store.addLog('INFO', 'Read camera configuration, resolutions, EV and SD-card state')
    ;[
      PacketBuilder.buildCameraGetConfigMenu(),
      PacketBuilder.buildCameraGetVideoSizes(),
      PacketBuilder.buildCameraGetPhotoSizes(),
      PacketBuilder.buildCameraGetCurrentVideoSize(),
      PacketBuilder.buildCameraGetCurrentPhotoSize(),
      PacketBuilder.buildCameraGetManualModeInfo(),
      PacketBuilder.buildCameraGetExposureInfo(),
      PacketBuilder.buildCameraGetPhotoGps(),
      PacketBuilder.buildCameraGetSdStatus(),
      PacketBuilder.buildCameraGetZoom()
    ].forEach((p, i) => setTimeout(() => this.send(p), i * 70))
  }

  static setVideoResolution(index: number) {
    useDroneStore().addLog('INFO', `Set recording resolution index=${index} (Potensic camera cmd 0x0B)`)
    this.send(PacketBuilder.buildCameraSetVideoSize(index))
    setTimeout(() => this.send(PacketBuilder.buildCameraGetConfigMenu()), 120)
  }

  static setPhotoResolution(index: number) {
    useDroneStore().addLog('INFO', `Set photo resolution index=${index} (Potensic camera cmd 0x0D)`)
    this.send(PacketBuilder.buildCameraSetPhotoSize(index))
    setTimeout(() => this.send(PacketBuilder.buildCameraGetConfigMenu()), 120)
  }

  static setVideoEv(ev: number) {
    useDroneStore().addLog('INFO', `Set video EV=${ev.toFixed(1)} (Potensic camera cmd 0x0F, mode 0)`)
    this.send(PacketBuilder.buildCameraSetEv(0, ev))
  }

  static setPhotoEv(ev: number) {
    useDroneStore().addLog('INFO', `Set photo EV=${ev.toFixed(1)} (Potensic camera cmd 0x0F, mode 1)`)
    this.send(PacketBuilder.buildCameraSetEv(1, ev))
  }

  static getVideoEv() { this.send(PacketBuilder.buildCameraGetEv(0)) }
  static getPhotoEv() { this.send(PacketBuilder.buildCameraGetEv(1)) }

  static setZoom(zoom: number) {
    const cam = useCameraStore()
    const maxZoom = Math.max(1, cam.zoomMax || 4)
    const value = Math.max(1, Math.min(maxZoom, Math.round(zoom * 100) / 100))
    cam.zoomTarget = value
    cam.zoomPending = true
    useDroneStore().addLog('INFO', `Set camera zoom=${value.toFixed(2)}x (Potensic camera cmd 0x3E)`)
    this.send(PacketBuilder.buildCameraSetZoom(value))
  }

  static getZoom() {
    useDroneStore().addLog('INFO', 'Read camera zoom (Potensic camera cmd 0x3F)')
    this.send(PacketBuilder.buildCameraGetZoom())
  }

  static getSdStatus() {
    this.send(PacketBuilder.buildCameraGetSdStatus())
  }

  static setManualMode(manual: boolean, shutterDen: number, iso: number, manualWb: boolean, wb: number) {
    useDroneStore().addLog('INFO', `Set camera manual mode=${manual} shutter=1/${shutterDen} ISO=${iso} WB=${wb}`)
    this.send(PacketBuilder.buildCameraSetManualMode({ manual, shutterDen, iso, manualWb, wb }))
  }

  static setRaw(enable: boolean) {
    useDroneStore().addLog('INFO', `Set RAW photo=${enable}`)
    this.send(PacketBuilder.buildCameraSetRaw(enable))
  }

  static setPhotoOsd(enable: boolean) {
    useDroneStore().addLog('INFO', `Set photo OSD=${enable}`)
    this.send(PacketBuilder.buildCameraSetPhotoOsd(enable))
  }

  static setPhotoGps(enable: boolean) {
    useDroneStore().addLog('INFO', `Set photo GPS metadata=${enable}`)
    this.send(PacketBuilder.buildCameraSetPhotoGps(enable))
  }

  static formatSd() {
    useDroneStore().addLog('WARN', 'Formatting SD card requested (Potensic camera cmd 0x04)')
    this.send(PacketBuilder.buildCameraFormatSd())
  }

  static enterGallery() {
    const cam = useCameraStore()
    this.resetGalleryRequestState()
    cam.galleryEntered = false
    cam.galleryLoading = true
    cam.galleryState = 'OPENING'
    cam.galleryError = ''
    useDroneStore().addLog('INFO', 'Enter camera gallery (cmd 0x21)')
    this.sendGalleryWithRetry(PacketBuilder.buildCameraEnterGallery(), 'enter gallery (0x21)')
  }

  static quitGallery() {
    const cam = useCameraStore()
    this.resetGalleryRequestState()
    this.send(PacketBuilder.buildCameraQuitGallery())
    cam.galleryEntered = false
    cam.galleryLoading = false
    cam.galleryState = 'CLOSED'
    cam.galleryError = ''
    this.photoNames = []
    this.videoNames = []
    this.listQueue = []
    this.currentListPage = null
  }

  static refreshGallery() {
    const cam = useCameraStore()
    if (!cam.galleryEntered) {
      this.enterGallery()
      return
    }
    this.resetGalleryRequestState()
    cam.galleryLoading = true
    cam.galleryState = 'LOADING_COUNT'
    cam.galleryError = ''
    this.photoNames = []
    this.videoNames = []
    this.listQueue = []
    this.currentListPage = null
    this.sendGalleryWithRetry(PacketBuilder.buildCameraGetFileCount(), 'file count (0x18)')
  }

  private static resetGalleryRequestState() {
    if (this.galleryTimer) clearTimeout(this.galleryTimer)
    this.galleryTimer = null
    this.galleryRetryCount = 0
    this.lastGalleryPacket = null
    this.lastGalleryStage = ''
  }

  private static sendGalleryWithRetry(packet: Uint8Array, stage: string) {
    this.resetGalleryRequestState()
    this.lastGalleryPacket = packet
    this.lastGalleryStage = stage
    this.send(packet)
    this.armGalleryTimeout()
  }

  private static armGalleryTimeout() {
    if (this.galleryTimer) clearTimeout(this.galleryTimer)
    this.galleryTimer = setTimeout(() => {
      const cam = useCameraStore()
      if (!this.lastGalleryPacket) return
      if (this.galleryRetryCount < this.GALLERY_MAX_RETRIES) {
        this.galleryRetryCount++
        useDroneStore().addLog('WARN', `Camera gallery timeout during ${this.lastGalleryStage}; retry ${this.galleryRetryCount}/${this.GALLERY_MAX_RETRIES}`)
        this.send(this.lastGalleryPacket)
        this.armGalleryTimeout()
        return
      }
      this.failGallery(`Timeout while waiting for ${this.lastGalleryStage}`)
      cam.galleryLoading = false
    }, this.GALLERY_TIMEOUT_MS)
  }

  private static acknowledgeGalleryResponse() {
    if (this.galleryTimer) clearTimeout(this.galleryTimer)
    this.galleryTimer = null
    this.galleryRetryCount = 0
    this.lastGalleryPacket = null
    this.lastGalleryStage = ''
  }

  private static failGallery(message: string) {
    const cam = useCameraStore()
    this.resetGalleryRequestState()
    cam.galleryLoading = false
    cam.galleryState = 'ERROR'
    cam.galleryError = message
    useDroneStore().addLog('ERROR', `Camera gallery: ${message}`)
  }

  static deleteFile(fileName: string) {
    useDroneStore().addLog('WARN', `Delete camera file: ${fileName}`)
    this.send(PacketBuilder.buildCameraDeleteFile(fileName))
  }

  static deleteFileConfirmed(fileName: string): Promise<void> {
    if (this.pendingDelete) return Promise.reject(new Error('Another camera delete is already pending'))
    useDroneStore().addLog('WARN', `Delete verified Drone Reco source from camera: ${fileName}`)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingDelete?.fileName === fileName) this.pendingDelete = null
        reject(new Error('Timed out waiting for camera delete acknowledgement'))
      }, 5000)
      this.pendingDelete = { fileName, resolve, reject, timer }
      this.send(PacketBuilder.buildCameraDeleteFile(fileName))
    })
  }

  static async downloadFile(
    fileName: string,
    options: {
      library?: AndroidMediaLibrary
      source?: string
      metadata?: RecognitionMetadata
      deleteAfterVerified?: boolean
    } = {}
  ): Promise<AndroidStoredImage | undefined> {
    const cam = useCameraStore()
    if (this.activeDownload) throw new Error('Another camera download is already active')
    cam.download.fileName = fileName
    cam.download.progress = 0
    cam.download.active = true
    cam.download.error = ''
    try {
      const listed = cam.getGalleryFile(fileName)
      let info: any = listed && listed.size && listed.size > 0 ? { len: listed.size, lrv_len: listed.lrvSize, createtime: listed.createTimeRaw } : null
      if (!info) info = await this.getFileInfo(fileName)
      const isVideo = /\.(mp4|mov)$/i.test(fileName)
      // The project requirement is the complete selected original file. PotensicPro's
      // gallery playback downloader uses LRV for videos, but TAF deliberately keeps the
      // original MP4 name here while adopting the confirmed 0x1B framing and block size.
      const remoteName = fileName
      const totalNum = Number(info.filesize ?? info.len ?? listed?.size ?? 0)
      if (!Number.isFinite(totalNum) || totalNum <= 0) throw new Error('Camera returned no usable file size')
      const total = BigInt(Math.trunc(totalNum))
      const outputName = fileName.split('/').pop() || (isVideo ? 'camera-video.mp4' : 'camera-photo.jpg')
      return await new Promise<AndroidStoredImage | undefined>((resolve, reject) => {
        this.downloadStartedAt = Date.now()
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
        }
        this.requestNextDownloadChunk()
      })
    } catch (e: any) {
      cam.download.active = false
      cam.download.error = e?.message || String(e)
      throw e
    }
  }

  private static getFileInfo(fileName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const old = this.pendingInfo.get(fileName)
      if (old) clearTimeout(old.timer)
      const timer = setTimeout(() => {
        this.pendingInfo.delete(fileName)
        reject(new Error('Timed out waiting for camera file metadata'))
      }, 5000)
      this.pendingInfo.set(fileName, { resolve, reject, timer })
      this.send(PacketBuilder.buildCameraGetFileInfo(fileName))
    })
  }

  private static clearDownloadTimeout() {
    if (this.downloadTimer) clearTimeout(this.downloadTimer)
    this.downloadTimer = null
  }

  private static armDownloadTimeout(offset: bigint, length: bigint) {
    this.clearDownloadTimeout()
    this.downloadTimer = setTimeout(() => {
      const dl = this.activeDownload
      if (!dl) return
      if (dl.received !== offset) return
      if (Date.now() - this.downloadStartedAt >= this.DOWNLOAD_TOTAL_TIMEOUT_MS) {
        this.send(PacketBuilder.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.FILE_DOWNLOAD_CANCEL])))
        this.failDownload(`Camera file download timed out after ${this.DOWNLOAD_TOTAL_TIMEOUT_MS / 1000}s at offset ${offset}`)
        return
      }
      if (this.downloadRetryCount < this.DOWNLOAD_MAX_RETRIES) {
        this.downloadRetryCount++
        useDroneStore().addLog('WARN', `Camera download unit timeout at ${offset}; retry from current offset (${this.downloadRetryCount}/${this.DOWNLOAD_MAX_RETRIES})`)
        this.send(PacketBuilder.buildCameraDownloadChunk(dl.fileName, offset, length))
        this.armDownloadTimeout(offset, length)
        return
      }
      this.send(PacketBuilder.buildLegacyCameraUsb(new Uint8Array([CAMERA_USB.FILE_DOWNLOAD_CANCEL])))
      this.failDownload(`Timeout waiting for camera file data at offset ${offset}`)
    }, this.DOWNLOAD_TIMEOUT_MS)
  }

  private static failDownload(message: string) {
    const dl = this.activeDownload
    if (!dl) return
    this.clearDownloadTimeout()
    const cam = useCameraStore()
    cam.download.active = false
    cam.download.error = message
    this.activeDownload = null
    dl.reject(new Error(message))
  }

  private static requestNextDownloadChunk() {
    const dl = this.activeDownload
    if (!dl) return
    const remaining = dl.total - dl.received
    if (remaining <= 0n) {
      this.finishDownload()
      return
    }
    const length = remaining > this.DOWNLOAD_CHUNK_SIZE ? this.DOWNLOAD_CHUNK_SIZE : remaining
    this.downloadRetryCount = 0
    this.send(PacketBuilder.buildCameraDownloadChunk(dl.fileName, dl.received, length))
    this.armDownloadTimeout(dl.received, length)
  }

  private static async finishDownload() {
    const dl = this.activeDownload
    if (!dl) return
    this.clearDownloadTimeout()
    const cam = useCameraStore()
    const drone = useDroneStore()
    const blobParts = dl.chunks.map(chunk => chunk.slice().buffer as ArrayBuffer)
    const isPhoto = /\.(jpg|jpeg|png|dng)$/i.test(dl.outputName)
    const mime = /\.png$/i.test(dl.outputName) ? 'image/png'
      : /\.dng$/i.test(dl.outputName) ? 'image/x-adobe-dng'
      : isPhoto ? 'image/jpeg'
      : /\.mp4$/i.test(dl.outputName) ? 'video/mp4'
      : 'application/octet-stream'
    const blob = new Blob(blobParts, { type: mime })

    try {
      let saved: AndroidStoredImage | undefined
      saved = await AndroidMediaService.saveImageBytes(blob, dl.outputName, dl.source, dl.library, dl.metadata)
      if (!saved.verified || saved.size !== blob.size) {
        throw new Error('Android MediaStore verification failed; drone source will not be deleted')
      }
      drone.addLog('INFO', `Camera media verified on Android: ${saved.relativePath}/${saved.name} (${blob.size} bytes)`)

      if (isPhoto && dl.deleteAfterVerified) {
        await this.deleteFileConfirmed(dl.originalFileName)
        drone.addLog('INFO', `Drone Reco source deleted after verified Android transfer: ${dl.originalFileName}`)
      }
      cam.download.progress = 100
      cam.download.error = ''
      dl.resolve(saved)
    } catch (e: any) {
      cam.download.error = e?.message || String(e)
      drone.addLog('ERROR', `Camera download/save pipeline failed: ${cam.download.error}`)
      dl.reject(e instanceof Error ? e : new Error(String(e)))
    } finally {
      cam.download.active = false
      if (this.activeDownload === dl) this.activeDownload = null
    }
  }

  private static parseConfigZoomCapabilities(data: Uint8Array) {
    // PotensicPro UsbCameraHandler.parseAllParams(): data here starts at original response i+2.
    // Layout: 4B camera state, model length+model, SD state, free/total 3B, then
    // current+count+values for video/photo/recordEV/photoEV/split, six option bytes,
    // followed by [videoZoomPairCount][resolution,maxZoom]... and the photo equivalent.
    const cam = useCameraStore()
    let pos = 0
    if (data.length < 12) return
    pos += 4
    const modelLen = data[pos++] ?? 0
    if (pos + modelLen + 7 > data.length) return
    pos += modelLen
    pos += 1 + 3 + 3

    const readSupport = () => {
      if (pos + 2 > data.length) return null
      const current = data[pos++]
      const count = data[pos++]
      if (pos + count > data.length) return null
      const values = Array.from(data.subarray(pos, pos + count))
      pos += count
      return { current, values }
    }

    const video = readSupport(); if (!video) return
    const photo = readSupport(); if (!photo) return
    if (!readSupport() || !readSupport() || !readSupport()) return

    // Newer PotensicPro config-menu responses include RAW/video-OSD/photo-OSD/remain-capture (6 bytes).
    if (pos + 6 > data.length) return
    pos += 6
    if (pos >= data.length) return

    const videoPairCount = data[pos++]
    const videoZoom = new Map<number, number>()
    for (let n = 0; n < videoPairCount && pos + 1 < data.length; n++) {
      videoZoom.set(data[pos++], data[pos++])
    }
    if (pos >= data.length) return
    const photoPairCount = data[pos++]
    const photoZoom = new Map<number, number>()
    for (let n = 0; n < photoPairCount && pos + 1 < data.length; n++) {
      photoZoom.set(data[pos++], data[pos++])
    }

    // The cockpit currently controls the live/video camera path. Use the current video resolution
    // capability exactly as PotensicPro does for record mode. Fall back only when no capability is reported.
    const reported = videoZoom.get(video.current)
    if (reported != null && reported >= 1) {
      cam.zoomMax = reported
      cam.zoomMaxSource = 'camera'
      if (cam.zoomTarget > reported) cam.zoomTarget = reported
      useDroneStore().addLog('INFO', `Camera max zoom=${reported}x for current video resolution id=${video.current}`)
    }
  }

  /**
   * Handle FE 0x05 camera responses whose inner message short is 0x0020.
   * Returns true when the packet belongs to this PotensicPro-compatible camera path.
   */
  static handleIncoming(feType: number, payload: Uint8Array): boolean {
    if (feType !== 0x05 || payload.length < 8 || payload[0] !== CAMERA_USB.RX_HEADER_0 || payload[1] !== CAMERA_USB.RX_HEADER_1) return false
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
    const msgShort = view.getUint16(4, true)
    if (msgShort !== CAMERA_USB.INNER_FUNCTION) return false

    const cam = useCameraStore()
    const drone = useDroneStore()
    const cmd = payload[6]
    const status = payload[7]
    const data = payload.subarray(8, Math.max(8, payload.length - 1))
    cam.lastResponse = `cmd=0x${cmd.toString(16).padStart(2, '0')} status=${status} data=${data.length}B`

    if (status !== 0) {
      const statusText: Record<number, string> = {
        1: 'Device busy',
        2: 'No SD card',
        3: 'SD card full',
        4: 'Command not supported',
        5: 'Argument invalid'
      }
      const failure = statusText[status] || `status ${status}`
      drone.addLog('WARN', `Camera command 0x${cmd.toString(16).padStart(2, '0')} failed: ${failure}`)
      if (cmd === CAMERA_USB.RECORD) cam.recordingPending = false
      if ([CAMERA_USB.ENTER_GALLERY, CAMERA_USB.FILE_COUNT, CAMERA_USB.FILE_LIST].includes(cmd as any)) {
        this.failGallery(`Command 0x${cmd.toString(16).padStart(2, '0')} failed: ${failure}`)
      }
      if (this.activeDownload && cmd === CAMERA_USB.FILE_DOWNLOAD) {
        const dl = this.activeDownload
        this.clearDownloadTimeout()
        cam.download.active = false
        cam.download.error = `Camera download failed with status ${status}`
        this.activeDownload = null
        dl.reject(new Error(cam.download.error))
      }
      if (this.pendingDelete && cmd === CAMERA_USB.FILE_DELETE) {
        const pending = this.pendingDelete
        clearTimeout(pending.timer)
        this.pendingDelete = null
        pending.reject(new Error(`Camera delete failed with status ${status}`))
      }
      return true
    }

    switch (cmd) {
      case CAMERA_USB.RECORD:
        if (data.length) {
          cam.recording = data[0] === 1
          cam.recordingPending = false
          cam.lastCaptureMessage = cam.recording ? 'Video recording started' : 'Video recording stopped'
          drone.addLog('INFO', cam.lastCaptureMessage)
        }
        break
      case CAMERA_USB.TAKE_PHOTO:
        cam.lastCaptureMessage = 'Photo captured successfully'
        drone.addLog('INFO', cam.lastCaptureMessage)
        break
      case 4: // format SD response: card state in data[0]
        if (data.length) cam.sd.state = data[0]
        cam.sd.lastStatus = 'Format command acknowledged'
        this.getSdStatus()
        break
      case 11:
        if (data.length) cam.videoResolutionIndex = data[0]
        break
      case 13:
        if (data.length) cam.photoResolutionIndex = data[0]
        break
      case 15: {
        if (data.length >= 2) {
          const encoded = data[0]
          const mode = data[1]
          const ev = (encoded - 4) / 2
          if (mode === 0) cam.videoEv = ev
          else if (mode === 1) cam.photoEv = ev
        }
        break
      }
      case 16:
        if (data.length) {
          const ev = (data[0] - 4) / 2
          // PotensicPro returns current-mode EV here; keep both synchronized when mode is unknown.
          cam.videoEv = ev
          cam.photoEv = ev
        }
        break
      case 36:
        if (data.length) cam.manualMode.raw = data[0] === 1
        break
      case 38:
        if (data.length) cam.manualMode.photoOsd = data[data.length - 1] === 1
        break
      case 52:
      case 53:
        if (data.length >= 10) {
          const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
          cam.manualMode.manual = data[0] === 1
          const up = Math.max(1, dv.getUint16(1, true))
          const down = dv.getUint16(3, true)
          cam.manualMode.shutterDen = Math.max(1, Math.round(down / up))
          cam.manualMode.iso = dv.getUint16(5, true)
          cam.manualMode.manualWb = data[7] === 1
          cam.manualMode.wb = dv.getUint16(8, true)
          cam.manualMode.loaded = true
        }
        break
      case 17:
        this.parseConfigZoomCapabilities(data)
        break
      case 62:
      case 63:
        if (data.length >= 4) {
          const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
          const zoom = dv.getUint32(0, true) / 100
          if (zoom >= 1) {
            cam.zoomActual = zoom
            cam.zoomLastUpdate = Date.now()
            cam.zoomPending = false
            if (cmd === 63 && Math.abs(cam.zoomTarget - zoom) > 0.01) cam.zoomTarget = zoom
          }
        }
        break
      case 59:
      case 60:
        if (data.length) cam.manualMode.photoGps = data[data.length - 1] === 1
        break
      case 23:
        if (data.length >= 7) {
          cam.sd.state = data[0]
          cam.sd.freeMb = data[1] | (data[2] << 8) | (data[3] << 16)
          cam.sd.totalMb = data[4] | (data[5] << 8) | (data[6] << 16)
          cam.sd.lastStatus = 'SD status received'
        }
        break
      case CAMERA_USB.ENTER_GALLERY:
        this.acknowledgeGalleryResponse()
        cam.galleryEntered = true
        cam.galleryState = 'OPEN'
        this.refreshGallery()
        break
      case CAMERA_USB.QUIT_GALLERY:
        this.acknowledgeGalleryResponse()
        cam.galleryEntered = false
        cam.galleryLoading = false
        cam.galleryState = 'CLOSED'
        cam.galleryError = ''
        break
      case CAMERA_USB.FILE_COUNT:
        this.acknowledgeGalleryResponse()
        if (data.length >= 4) {
          this.photoCount = data[0] | (data[1] << 8)
          this.videoCount = data[2] | (data[3] << 8)
          this.photoNames = []
          this.videoNames = []
          drone.addLog('INFO', `Camera gallery count: photos=${this.photoCount}, videos=${this.videoCount}`)
          if (this.photoCount === 0 && this.videoCount === 0) {
            cam.setGalleryFiles([], [])
            break
          }
          this.buildGalleryQueue()
          cam.galleryState = 'LOADING_LIST'
          this.requestNextGalleryPage()
        } else {
          this.failGallery(`File count response too short (${data.length} B)`)
        }
        break
      case CAMERA_USB.FILE_LIST:
        this.acknowledgeGalleryResponse()
        this.parseGalleryNames(data)
        this.currentListPage = null
        this.requestNextGalleryPage()
        break
      case 26: {
        const text = new TextDecoder('ascii').decode(data).replace(/\0+$/g, '').trim()
        try {
          const info = JSON.parse(text)
          const name = String(info.filename || info.file || '')
          const pending = this.pendingInfo.get(name) || (this.pendingInfo.size === 1 ? [...this.pendingInfo.values()][0] : null)
          if (pending) {
            clearTimeout(pending.timer)
            for (const [k, v] of this.pendingInfo) if (v === pending) this.pendingInfo.delete(k)
            pending.resolve(info)
          }
        } catch (e) {
          drone.addLog('WARN', `Camera file metadata could not be parsed: ${text.slice(0, 120)}`)
        }
        break
      }
      case CAMERA_USB.FILE_META_LIST:
        this.parseGalleryMetadata(data)
        break
      case CAMERA_USB.FILE_DOWNLOAD:
        this.handleDownloadData(data)
        break
      case CAMERA_USB.FILE_DELETE: {
        drone.addLog('INFO', 'Camera file delete acknowledged')
        const pending = this.pendingDelete
        if (pending) {
          clearTimeout(pending.timer)
          this.pendingDelete = null
          pending.resolve()
        }
        this.refreshGallery()
        break
      }
    }
    return true
  }

  private static buildGalleryQueue() {
    this.listQueue = []
    const add = (type: 1 | 2, count: number) => {
      for (let offset = 0; offset < count; offset += 50) {
        this.listQueue.push({ type, offset, count: Math.min(50, count - offset) })
      }
    }
    add(2, this.videoCount)
    add(1, this.photoCount)
    if (this.listQueue.length === 0) useCameraStore().setGalleryFiles([], [])
  }

  private static requestNextGalleryPage() {
    const cam = useCameraStore()
    if (!this.listQueue.length) {
      const photosComplete = this.photoNames.length >= this.photoCount
      const videosComplete = this.videoNames.length >= this.videoCount
      if (!photosComplete || !videosComplete) {
        this.failGallery(`Media list incomplete: ${this.photoNames.length}/${this.photoCount} photos, ${this.videoNames.length}/${this.videoCount} videos`)
        return
      }
      cam.setGalleryFiles(this.photoNames.slice(0, this.photoCount), this.videoNames.slice(0, this.videoCount))
      this.requestGalleryMetadata([...this.videoNames.slice(0, this.videoCount), ...this.photoNames.slice(0, this.photoCount)])
      return
    }
    const page = this.listQueue.shift()!
    this.currentListPage = page
    cam.galleryState = 'LOADING_LIST'
    this.sendGalleryWithRetry(
      PacketBuilder.buildCameraGetFileList(page.type, page.offset, page.count),
      `file list type=${page.type} offset=${page.offset} count=${page.count} (0x19)`
    )
  }

  private static requestGalleryMetadata(fileNames: string[]) {
    if (this.metaTimer) clearTimeout(this.metaTimer)
    this.metaTimer = null
    this.metaRetryCount = 0
    this.currentMetaBatch = null
    this.metaQueue = []
    for (let i = 0; i < fileNames.length; i += 25) this.metaQueue.push(fileNames.slice(i, i + 25))
    this.requestNextMetadataBatch()
  }

  private static requestNextMetadataBatch() {
    if (this.metaTimer) clearTimeout(this.metaTimer)
    this.metaTimer = null
    const batch = this.metaQueue.shift()
    if (!batch || batch.length === 0) {
      this.currentMetaBatch = null
      return
    }
    this.currentMetaBatch = batch
    this.metaRetryCount = 0
    this.send(PacketBuilder.buildCameraGetFileMetaList(batch))
    this.armMetadataTimeout()
  }

  private static armMetadataTimeout() {
    if (this.metaTimer) clearTimeout(this.metaTimer)
    this.metaTimer = setTimeout(() => {
      if (!this.currentMetaBatch) return
      if (this.metaRetryCount < this.META_MAX_RETRIES) {
        this.metaRetryCount++
        useDroneStore().addLog('WARN', `Camera metadata 0x20 timeout; retry ${this.metaRetryCount}/${this.META_MAX_RETRIES}`)
        this.send(PacketBuilder.buildCameraGetFileMetaList(this.currentMetaBatch))
        this.armMetadataTimeout()
        return
      }
      useDroneStore().addLog('WARN', 'Camera metadata 0x20 unavailable; keeping filename timestamps as fallback')
      this.currentMetaBatch = null
      this.requestNextMetadataBatch()
    }, this.META_TIMEOUT_MS)
  }

  private static parseGalleryMetadata(data: Uint8Array) {
    if (this.metaTimer) clearTimeout(this.metaTimer)
    this.metaTimer = null
    const text = new TextDecoder('ascii').decode(data).replace(/\0+$/g, '').trim()
    try {
      const parsed = JSON.parse(text)
      const raw = Array.isArray(parsed?.file_info) ? parsed.file_info : []
      const entries = raw.map((entry: any) => {
        if (typeof entry === 'string') {
          try { return JSON.parse(entry) } catch { return null }
        }
        return entry
      }).filter(Boolean)
      useCameraStore().applyGalleryMetadata(entries)
      useDroneStore().addLog('INFO', `Camera metadata 0x20 parsed for ${entries.length} files`)
    } catch (e: any) {
      useDroneStore().addLog('WARN', `Camera metadata 0x20 parse failed: ${e?.message || e}; payload=${text.slice(0, 160)}`)
    } finally {
      this.currentMetaBatch = null
      this.requestNextMetadataBatch()
    }
  }

  private static parseGalleryNames(data: Uint8Array) {
    // PotensicPro starts the NUL-separated ASCII filename data two bytes into the
    // command-specific response body (payloadIndex + 4 including cmd/status).
    const decodeNames = (bytes: Uint8Array) => {
      const text = new TextDecoder('ascii').decode(bytes).replace(/[\x00-\x1f]+/g, '\0')
      return text.split('\0').map(v => v.trim()).filter(Boolean)
    }
    let names = data.length >= 2 ? decodeNames(data.subarray(2)) : []
    // Preserve the previous tolerant scan only as a fallback for firmware variants.
    if (!names.some(name => /\.(jpg|jpeg|dng|mp4|mov|lrv)$/i.test(name))) names = decodeNames(data)

    for (const name of names) {
      const lower = name.toLowerCase()
      if (/\.jpg$/.test(lower) && !this.photoNames.includes(name)) this.photoNames.push(name)
      else if (/\.mp4$/.test(lower) && !this.videoNames.includes(name)) this.videoNames.push(name)
      else if (/\.(jpeg|dng)$/.test(lower) && !this.photoNames.includes(name)) this.photoNames.push(name)
      else if (/\.(mov|lrv)$/.test(lower) && !this.videoNames.includes(name)) this.videoNames.push(name)
    }
    useDroneStore().addLog('INFO', `Camera gallery page parsed: photos=${this.photoNames.length}/${this.photoCount}, videos=${this.videoNames.length}/${this.videoCount}`)
  }

  private static handleDownloadData(body: Uint8Array) {
    const dl = this.activeDownload
    // PotensicPro DownloadData body after cmd/status:
    // flag (1B), [32B final-block digest area], offset (u64 LE), payloadLen (u16 LE), payload.
    if (!dl || body.length < 11) return
    const cam = useCameraStore()
    const drone = useDroneStore()
    const flag = body[0]
    const fileEnd = flag === 2
    const unitEnd = flag === 1
    const base = fileEnd ? 33 : 1
    if (body.length < base + 10) {
      drone.addLog('WARN', `Camera download frame too short: flag=${flag} body=${body.length}B`)
      return
    }
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
    const offset = view.getBigUint64(base, true)
    const payloadLen = view.getUint16(base + 8, true)
    const payloadStart = base + 10
    if (payloadLen <= 0 || payloadStart + payloadLen > body.length) {
      drone.addLog('WARN', `Camera download frame length invalid: flag=${flag} offset=${offset} len=${payloadLen} body=${body.length}B`)
      return
    }

    this.clearDownloadTimeout()
    this.downloadRetryCount = 0

    if (offset < dl.received) {
      const duplicateEnd = offset + BigInt(payloadLen)
      if (duplicateEnd <= dl.received) {
        drone.addLog('WARN', `Ignoring duplicate camera download block at ${offset} (${payloadLen}B)`)
        this.requestNextDownloadChunk()
        return
      }
    }
    if (offset !== dl.received) {
      drone.addLog('WARN', `Camera download offset mismatch: got ${offset}, current ${dl.received}; re-requesting from current offset`)
      this.requestNextDownloadChunk()
      return
    }

    const chunk = body.slice(payloadStart, payloadStart + payloadLen)
    dl.chunks.push(chunk)
    dl.received += BigInt(chunk.length)
    const pct = Number(dl.received) * 100 / Number(dl.total)
    cam.download.progress = Math.min(100, Math.round(pct * 10) / 10)
    drone.addLog('INFO', `Camera download block: ${chunk.length}B flag=${flag}${unitEnd ? ' unit-end' : ''}${fileEnd ? ' file-end' : ''}, ${cam.download.progress}%`)

    if (fileEnd || dl.received >= dl.total) void this.finishDownload()
    else this.requestNextDownloadChunk()
  }

}
