import { PacketBuilder } from '../protocol/PacketBuilder'
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
    cam.galleryLoading = true
    useDroneStore().addLog('INFO', 'Enter camera gallery (cmd 0x21)')
    this.send(PacketBuilder.buildCameraEnterGallery())
  }

  static quitGallery() {
    this.send(PacketBuilder.buildCameraQuitGallery())
  }

  static refreshGallery() {
    const cam = useCameraStore()
    cam.galleryLoading = true
    this.photoNames = []
    this.videoNames = []
    this.send(PacketBuilder.buildCameraGetFileCount())
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
      const info = await this.getFileInfo(fileName)
      const isVideo = /\.(mp4|mov)$/i.test(fileName)
      // PotensicPro's USB gallery downloads the low-resolution LRV proxy for videos.
      // Photos are transferred using their original filename.
      const remoteName = isVideo ? fileName.replace(/[^.]{3}$/i, 'LRV') : fileName
      const totalNum = Number(isVideo ? (info.lrv_filesize ?? info.lrv_len ?? 0) : (info.filesize ?? info.len ?? 0))
      if (!Number.isFinite(totalNum) || totalNum <= 0) throw new Error('Camera returned no usable file size')
      const total = BigInt(Math.trunc(totalNum))
      const outputName = fileName.split('/').pop() || (isVideo ? 'camera-video.mp4' : 'camera-photo.jpg')
      return await new Promise<AndroidStoredImage | undefined>((resolve, reject) => {
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

  private static requestNextDownloadChunk() {
    const dl = this.activeDownload
    if (!dl) return
    const remaining = dl.total - dl.received
    if (remaining <= 0n) {
      this.finishDownload()
      return
    }
    const length = remaining > 102400n ? 102400n : remaining
    this.send(PacketBuilder.buildCameraDownloadChunk(dl.fileName, dl.received, length))
  }

  private static async finishDownload() {
    const dl = this.activeDownload
    if (!dl) return
    const cam = useCameraStore()
    const drone = useDroneStore()
    const blobParts = dl.chunks.map(chunk => chunk.slice().buffer as ArrayBuffer)
    const isPhoto = /\.(jpg|jpeg|png|dng)$/i.test(dl.outputName)
    const mime = /\.png$/i.test(dl.outputName) ? 'image/png'
      : /\.dng$/i.test(dl.outputName) ? 'image/x-adobe-dng'
      : isPhoto ? 'image/jpeg'
      : 'application/octet-stream'
    const blob = new Blob(blobParts, { type: mime })

    try {
      let saved: AndroidStoredImage | undefined
      if (isPhoto) {
        saved = await AndroidMediaService.saveImageBytes(blob, dl.outputName, dl.source, dl.library, dl.metadata)
        if (!saved.verified || saved.size !== blob.size) {
          throw new Error('Android MediaStore verification failed; drone source will not be deleted')
        }
        drone.addLog('INFO', `Camera photo verified on Android: ${saved.relativePath}/${saved.name} (${blob.size} bytes)`)

        if (dl.deleteAfterVerified) {
          await this.deleteFileConfirmed(dl.originalFileName)
          drone.addLog('INFO', `Drone Reco source deleted after verified Android transfer: ${dl.originalFileName}`)
        }
      } else {
        // Preserve the previous browser download behavior for video/LRV files.
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = dl.outputName
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        drone.addLog('INFO', `Camera video download completed in browser: ${dl.fileName} (${blob.size} bytes)`)
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
    if (feType !== 0x05 || payload.length < 8 || payload[0] !== 0xff || payload[1] !== 0xfd) return false
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
    const msgShort = view.getUint16(4, true)
    if (msgShort !== 0x0020) return false

    const cam = useCameraStore()
    const drone = useDroneStore()
    const cmd = payload[6]
    const status = payload[7]
    const data = payload.subarray(8, Math.max(8, payload.length - 1))
    cam.lastResponse = `cmd=0x${cmd.toString(16).padStart(2, '0')} status=${status} data=${data.length}B`

    if (status !== 0) {
      drone.addLog('WARN', `Camera command 0x${cmd.toString(16).padStart(2, '0')} failed with status ${status}`)
      if (this.activeDownload && cmd === 27) {
        const dl = this.activeDownload
        cam.download.active = false
        cam.download.error = `Camera download failed with status ${status}`
        this.activeDownload = null
        dl.reject(new Error(cam.download.error))
      }
      if (this.pendingDelete && cmd === 29) {
        const pending = this.pendingDelete
        clearTimeout(pending.timer)
        this.pendingDelete = null
        pending.reject(new Error(`Camera delete failed with status ${status}`))
      }
      return true
    }

    switch (cmd) {
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
      case 33:
        cam.galleryEntered = true
        this.refreshGallery()
        break
      case 34:
        cam.galleryEntered = false
        cam.galleryLoading = false
        break
      case 24:
        if (data.length >= 4) {
          this.photoCount = data[0] | (data[1] << 8)
          this.videoCount = data[2] | (data[3] << 8)
          this.photoNames = []
          this.videoNames = []
          this.buildGalleryQueue()
          this.requestNextGalleryPage()
        }
        break
      case 25:
        this.parseGalleryNames(data)
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
      case 27:
        this.handleDownloadData(payload)
        break
      case 29: {
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
    if (!this.listQueue.length) {
      useCameraStore().setGalleryFiles(this.photoNames, this.videoNames)
      return
    }
    const page = this.listQueue.shift()!
    this.send(PacketBuilder.buildCameraGetFileList(page.type, page.offset, page.count))
  }

  private static parseGalleryNames(data: Uint8Array) {
    // PotensicPro responses carry page bookkeeping before the NUL-separated ASCII names.
    // Search the response body for printable filenames instead of relying on one firmware offset.
    const text = new TextDecoder('ascii').decode(data).replace(/[\x00-\x1f]+/g, '\0')
    const names = text.split('\0').map(s => s.trim()).filter(Boolean)
    for (const name of names) {
      const lower = name.toLowerCase()
      if (/\.(jpg|jpeg|dng)$/.test(lower) && !this.photoNames.includes(name)) this.photoNames.push(name)
      if (/\.(mp4|mov|lrv)$/.test(lower) && !this.videoNames.includes(name)) this.videoNames.push(name)
    }
  }

  private static handleDownloadData(inner: Uint8Array) {
    const dl = this.activeDownload
    if (!dl || inner.length < 22) return
    const cam = useCameraStore()
    const flag = inner[8]
    const fileEnd = flag === 2
    const base = fileEnd ? 41 : 9 // cmd/status/flag + optional 32-byte trailer before offset
    if (inner.length < base + 10) return
    const view = new DataView(inner.buffer, inner.byteOffset, inner.byteLength)
    const offset = view.getBigUint64(base, true)
    const payloadLen = view.getUint16(base + 8, true)
    const start = base + 10
    if (start + payloadLen > inner.length) return
    const chunk = inner.slice(start, start + payloadLen)

    if (offset !== dl.received) {
      cam.download.active = false
      cam.download.error = `Unexpected camera file offset ${offset}; expected ${dl.received}`
      this.activeDownload = null
      dl.reject(new Error(cam.download.error))
      return
    }
    dl.chunks.push(chunk)
    dl.received += BigInt(chunk.length)
    cam.download.progress = Number((dl.received * 100n) / dl.total)

    if (fileEnd || dl.received >= dl.total) this.finishDownload()
    else if (flag === 1) this.requestNextDownloadChunk()
  }
}
