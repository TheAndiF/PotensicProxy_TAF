import { useCameraStore } from '../stores/useCameraStore'
import { useDroneStore } from '../stores/useDroneStore'
import { AndroidMediaService, type AndroidStoredImage } from './AndroidMediaService'
import { CameraMediaService } from './CameraMediaService'
import { DroneControlService } from './DroneControlService'
import { RecognitionMetadataService } from './RecognitionMetadataService'

export class RecognitionCaptureService {
  static async captureLiveReco(): Promise<AndroidStoredImage> {
    const drone = useDroneStore()
    const metadata = RecognitionMetadataService.build('LIVE_RECO')
    drone.addLog('INFO', 'Live Reco capture: save current decoded LiveView frame to Android')
    const saved = await AndroidMediaService.saveLiveSnapshot(metadata)
    if (!saved.verified) throw new Error('Live Reco image was stored but MediaStore verification failed')
    drone.addLog('INFO', `Live Reco ready: ${saved.relativePath}/${saved.name}`)
    return saved
  }

  static async captureDroneReco(): Promise<AndroidStoredImage> {
    const drone = useDroneStore()
    const camera = useCameraStore()
    if (camera.download.active) throw new Error('Camera download is already active')

    const galleryWasOpen = camera.galleryEntered

    try {
      // Capture an authoritative pre-shot file list. This avoids guessing which existing
      // camera image is the newly created Recognition source.
      if (!camera.galleryEntered) {
        CameraMediaService.enterGallery()
      } else {
        CameraMediaService.refreshGallery()
      }
      await this.waitFor(() => camera.galleryEntered && !camera.galleryLoading, 8000, 'initial camera gallery list')
      const before = new Set(camera.photos.map(item => item.name))

      // Leave gallery/playback mode before asking the camera to create a new still image.
      CameraMediaService.quitGallery()
      await this.waitFor(() => !camera.galleryEntered, 5000, 'leaving camera gallery')

      const metadata = RecognitionMetadataService.build('DRONE_RECO')
      drone.addLog('INFO', 'Drone Reco capture: take full camera photo, transfer, verify, then delete drone source')
      DroneControlService.takePhoto()
      await this.sleep(1200)

      CameraMediaService.enterGallery()
      await this.waitFor(() => camera.galleryEntered && !camera.galleryLoading, 8000, 'post-shot camera gallery list')

      let newPhotos = camera.photos.map(item => item.name).filter(name => !before.has(name))
      for (let attempt = 0; newPhotos.length === 0 && attempt < 4; attempt++) {
        await this.sleep(700)
        CameraMediaService.refreshGallery()
        await this.waitFor(() => !camera.galleryLoading, 8000, 'camera gallery refresh')
        newPhotos = camera.photos.map(item => item.name).filter(name => !before.has(name))
      }

      if (newPhotos.length === 0) {
        throw new Error('No new camera photo appeared after the Drone Reco capture; nothing was deleted')
      }

      // Prefer a directly decodable still image when RAW+JPEG created more than one file.
      // Any additional file (for example DNG) is deliberately left untouched on the drone.
      const directlyDecodable = newPhotos.filter(name => /\.(jpg|jpeg|png)$/i.test(name))
      const sortedNewPhotos = [...(directlyDecodable.length ? directlyDecodable : newPhotos)].sort()
      const sourceFile = sortedNewPhotos[sortedNewPhotos.length - 1]
      drone.addLog('INFO', `Drone Reco source identified: ${sourceFile}`)

      const saved = await CameraMediaService.downloadFile(sourceFile, {
        library: 'recognition',
        source: 'drone-reco',
        metadata,
        deleteAfterVerified: true
      })
      if (!saved) throw new Error('Drone Reco transfer completed without a saved image record')
      return saved
    } finally {
      // Preserve the user's previous gallery state. The delete acknowledgement may start
      // one final list refresh, so do not close the gallery in the middle of it.
      if (!galleryWasOpen && camera.galleryEntered) {
        try {
          if (camera.galleryLoading) await this.waitFor(() => !camera.galleryLoading, 5000, 'final camera gallery refresh')
        } catch (_) {
          // Closing the gallery is best-effort; never turn this into deletion/retry logic.
        }
        CameraMediaService.quitGallery()
      } else if (galleryWasOpen && !camera.galleryEntered) {
        CameraMediaService.enterGallery()
      }
    }
  }

  private static waitFor(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
    if (predicate()) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const started = Date.now()
      const timer = window.setInterval(() => {
        if (predicate()) {
          window.clearInterval(timer)
          resolve()
        } else if (Date.now() - started >= timeoutMs) {
          window.clearInterval(timer)
          reject(new Error(`Timed out waiting for ${label}`))
        }
      }, 100)
    })
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms))
  }
}
