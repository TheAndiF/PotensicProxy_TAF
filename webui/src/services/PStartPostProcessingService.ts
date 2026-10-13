import { AndroidMediaService } from './AndroidMediaService'

export type PStartAnalysisState = 'WAITING' | 'READING_XMP' | 'CHECKING_IMAGES' | 'DETECTING_MARKER' | 'SAVING_RESULT' | 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED'
export interface PStartReference {
  imageId: string; imagePath: string; imageSha256: string | null
  targetHeightM: number | null; actualHeightM: number | null; zoomRole: string
  captureTimestampMs: number | null; telemetryTimestampMs: number | null; timestampDeltaMs: number | null
  centerPx: [number, number] | null; outerCornersPx: [number, number][] | null; homography: number[][] | null
  markerWidthPx: number | null; quality: { sharpness: number | null; contrast: number | null; detectionConfidence: number | null }
  status: 'candidate' | 'unverified' | 'metadata_only' | 'error'; warnings: string[]
  patternScore?: number | null; candidateAmbiguous?: boolean; seriesRole?: 'anchor' | 'corroborated' | 'unverified'; seriesReferenceImageId?: string | null; seriesQualityScore?: number | null
}
export interface PStartProfile {
  schemaVersion: '1.0'; algorithmVersion: 'series-worktree-1'; sessionId: string; analysisStatus: string
  marker: { modelId: 'cross-800-v1'; widthMm: 800; heightMm: 800; blackLineWidthMm: 50; targetMm: [400, 400] }
  camera: { calibrationId: null; gimbalTargetDeg: -90 }
  references: PStartReference[]
  landingReadiness: { status: 'LIMITED' | 'NOT_READY'; reasons: string[] }
  generatedAt: string
  seriesAnalysis?: { anchorImageId: string | null; anchorHeightM: number | null; anchorPatternScore: number | null; evaluatedImages: number; warnings: string[] }
}
export interface PStartProgress { state: PStartAnalysisState; completed: number; total: number; message: string; profile?: PStartProfile }
export class PStartPostProcessingService {
  private static busy = false
  private static logLines: string[] = []
  private static record(level: string, step: string, image: string, detail: string) {
    this.logLines.push(JSON.stringify({ at: new Date().toISOString(), level, step, image, detail }))
  }
  static exportLog() {
    this.download(`PStart_analysis_${Date.now()}_log.jsonl`, new Blob([this.logLines.join('\n') + '\n'], { type: 'application/x-ndjson' }))
  }
  private static download(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  /** XMP APP1 is appended to a *copy* by inserting a valid APP1 block after the SOI. */
  private static annotatedJpeg(raw: ArrayBuffer, image: PStartReference, runId: string): Blob {
    const payload = JSON.stringify({ schemaVersion: 1, algorithmVersion: 'series-worktree-1', runId, imageId: image.imageId,
      sourceSha256: image.imageSha256, timestampDeltaMs: image.timestampDeltaMs, targetHeightM: image.targetHeightM, actualHeightM: image.actualHeightM,
      centerPx: image.centerPx, outerCornersPx: image.outerCornersPx, homography: image.homography,
      quality: image.quality, status: image.status, warnings: image.warnings, patternScore: image.patternScore, candidateAmbiguous: image.candidateAmbiguous, seriesRole: image.seriesRole, seriesReferenceImageId: image.seriesReferenceImageId, seriesQualityScore: image.seriesQualityScore })
    const escaped = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const xml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:taf="https://potensicproxy.local/ns/pstart-analysis/1.0/" taf:SchemaVersion="1"><taf:AnalysisJson>${escaped}</taf:AnalysisJson></rdf:Description></rdf:RDF></x:xmpmeta>`
    const xmp = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xml)
    if (xmp.length > 65533) throw new Error('XMP analysis segment exceeds JPEG APP1 limit')
    const src = new Uint8Array(raw)
    if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) throw new Error('Invalid JPEG start of image')
    const out = new Uint8Array(src.length + xmp.length + 4)
    out.set(src.subarray(0, 2))
    out[2] = 0xff; out[3] = 0xe1
    const len = xmp.length + 2
    out[4] = len >>> 8; out[5] = len & 255
    out.set(xmp, 6); out.set(src.subarray(2), 6 + xmp.length)
    return new Blob([out], { type: 'image/jpeg' })
  }
  private static async saveAndroid(sessionId: string, name: string, blob: Blob): Promise<void> {
    const params = new URLSearchParams({ session: sessionId, name })
    const host = window.location.origin
    const response = await fetch(`${host}/api/pstart/analysis/artifact?${params}`, { method: 'POST', body: blob })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.verified) throw new Error(`Android artifact save: ${result.error || response.status}`)
  }
  // Uses the File System Access API only where the browser provides explicit write consent.
  static async analyzeWritableFolder(): Promise<PStartProfile> {
    const picker = (window as any).showDirectoryPicker
    if (typeof picker !== 'function') throw new Error('Dieser Browser unterstützt keine beschreibbare Ordnerauswahl. Bitte den Android-Sitzungsordner verwenden.')
    const dir = await picker.call(window, { mode: 'readwrite' })
    const items: { name: string; load: () => Promise<Blob> }[] = []
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && /\.jpe?g$/i.test(name) && !/_analysis_/i.test(name))
        items.push({ name, load: () => handle.getFile() })
    }
    return this.run('offline-import', items.sort((a,b) => a.name.localeCompare(b.name)), async (name, blob) => {
      const file = await dir.getFileHandle(name, { create: true })
      const stream = await file.createWritable(); await stream.write(blob); await stream.close()
    })
  }

  /** Android SAF: the folder stays on the device; no zip or browser File System Access API required. */
  static async requestAndroidFolder(): Promise<void> {
    const r = await fetch('/api/pstart/saf/select', { method: 'POST' })
    if (!r.ok) throw new Error(`Android Ordnerdialog: ${await r.text()}`)
  }
  static async analyzeAndroidFolder(): Promise<PStartProfile> {
    const statusResponse = await fetch('/api/pstart/saf/status', { cache: 'no-store' })
    const status = await statusResponse.json()
    if (status.state !== 'READY') throw new Error('Bitte den Ordner auf dem Android-Handy zuerst freigeben (Status: ' + status.state + ').')
    const response = await fetch('/api/pstart/saf/files', { cache: 'no-store' })
    if (!response.ok) throw new Error('SAF-Dateiliste: ' + await response.text())
    const listing = await response.json() as { files: string[] }
    const names = listing.files.sort((a,b) => a.localeCompare(b))
    const first = names.map(n => n.match(/^PStart_(.+?)_(?:STEP0|REF_\d+|REF0[0-5])_/i)).find(Boolean)
    return this.run(first?.[1] || 'offline-saf', names.map(name => ({ name, load: async () => {
      const r = await fetch('/api/pstart/saf/image?' + new URLSearchParams({ name }), { cache: 'no-store' })
      if (!r.ok) throw new Error('SAF JPEG ' + name + ': ' + await r.text())
      return r.blob()
    } })), async (name, blob) => {
      const r = await fetch('/api/pstart/saf/artifact?' + new URLSearchParams({ name }), { method: 'POST', body: blob })
      const result = await r.json()
      if (!r.ok || !result.verified) throw new Error('SAF save ' + name + ': ' + (result.error || r.status))
    })
  }

  private static subscribers = new Set<(value: PStartProgress) => void>()
  static progress: PStartProgress = { state: 'WAITING', completed: 0, total: 0, message: '' }
  static subscribe(cb: (value: PStartProgress) => void): () => void { this.subscribers.add(cb); cb(this.progress); return () => { this.subscribers.delete(cb) } }
  private static emit(value: PStartProgress) { this.progress = value; this.subscribers.forEach(cb => cb(value)) }

  /** Both triggers use the same SAF-backed analysis workflow, without a PC browser picker. */
  static async listAndroidSessions(): Promise<string[]> {
    const response = await fetch('/api/pstart/sessions', { cache: 'no-store' })
    if (!response.ok) throw new Error('Android sessions: ' + await response.text())
    const data = await response.json() as { sessions: string[] }
    return data.sessions.sort().reverse()
  }
  static async analyzeAndroidSession(sessionId: string): Promise<PStartProfile> {
    if (!/^[A-Za-z0-9_.-]{1,190}$/.test(sessionId) || sessionId.includes('..')) throw new Error('Invalid session')
    const response = await fetch(`/api/pstart/sessions/${encodeURIComponent(sessionId)}/images`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Android session: ' + await response.text())
    const data = await response.json() as { files: string[] }
    return this.run(sessionId, data.files.map(name => ({ name, load: async () => {
      const image = await fetch(`/api/pstart/sessions/${encodeURIComponent(sessionId)}/image?` + new URLSearchParams({ name }), { cache: 'no-store' })
      if (!image.ok) throw new Error(`Android JPEG ${name}: ${await image.text()}`)
      return image.blob()
    } })), (name, blob) => this.saveAndroid(sessionId, name, blob))
  }
  private static async sha256(bytes: ArrayBuffer): Promise<string> {
    // Always use Android SHA-256; crypto.subtle can be undefined on Android WebView over HTTP.
    this.record('INFO', 'HASH_METHOD', '', 'ANDROID_SHA256')
    const response = await fetch('/api/pstart/analysis/sha256', { method: 'POST', body: bytes })
    if (!response.ok) throw new Error('SHA-256 Android: ' + await response.text())
    const data = await response.json() as { sha256: string }
    if (!/^[a-f0-9]{64}$/.test(data.sha256)) throw new Error('Invalid SHA-256 response')
    return data.sha256
  }

  /** Automatic mode reads only images belonging to the completed session. Never sends flight commands. */
  static async analyzeSavedSession(sessionId: string): Promise<PStartProfile> {
    return this.analyzeAndroidSession(sessionId)
  }

  /** The browser's directory selector works offline, with no filesystem permission outside the chosen files. */
  static async analyzeFolder(files: FileList | File[]): Promise<PStartProfile> {
    const selected = Array.from(files).sort((a,b) => a.name.localeCompare(b.name)).filter(f => /\.jpe?g$/i.test(f.name) && !/_analysis_/i.test(f.name))
    const first = selected[0]?.name.match(/^PStart_(.+?)_(?:STEP0|REF_\d+|REF0[0-5])_/i)
    return this.run(first?.[1] || 'offline-import', selected.map(f => ({ name: f.webkitRelativePath || f.name, load: async () => f })))
  }

  static exportProfile(profile: PStartProfile) {
    this.download(`PStart_${profile.sessionId}_reference_${Date.now()}.json`, new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }))
  }

  private static async run(sessionId: string, items: { name: string; load: () => Promise<Blob> }[], save?: (name: string, blob: Blob) => Promise<void>): Promise<PStartProfile> {
    if (this.busy) throw new Error('Eine Referenzauswertung läuft bereits.')
    this.busy = true
    this.logLines = []
    const runId = new Date().toISOString().replace(/[^0-9]/g, '')
    this.record('INFO', 'START', '', `session=${sessionId}; images=${items.length}; writeAccess=${!!save}`)
    try {
      const r = await fetch('/api/version', { cache: 'no-store' })
      const v = await r.json()
      this.record('INFO', 'BACKEND_VERSION', '', JSON.stringify(v))
      if (!r.ok || !JSON.stringify(v).includes('0.9845')) this.record('ERROR', 'VERSION_MISMATCH', '', 'Expected backend 0.9845: ' + JSON.stringify(v))
    } catch (e) { this.record('ERROR', 'VERSION_CHECK_FAILED', '', String(e)) }
    this.record('INFO', 'FRONTEND_ANALYZER', '', 'webui-ts-v0.9845')
    if (!items.length) this.record('WARN', 'EMPTY_INPUT', '', 'No JPEG images found')
    const refs: PStartReference[] = []
    const pendingCopies: { name: string; bytes: ArrayBuffer; ref: PStartReference }[] = []
    try {
      this.emit({ state: 'READING_XMP', completed: 0, total: items.length, message: 'JPEG und XMP prüfen' })
      const seen = new Set<string>()
      for (const item of items) {
        const warnings: string[] = []
        const ref: PStartReference = { imageId: item.name, imagePath: item.name, imageSha256: null, targetHeightM: null, actualHeightM: null, zoomRole: 'UNKNOWN', captureTimestampMs: null, telemetryTimestampMs: null, timestampDeltaMs: null, centerPx: null, outerCornersPx: null, homography: null, markerWidthPx: null, quality: { sharpness: null, contrast: null, detectionConfidence: null }, status: 'unverified', warnings }
        refs.push(ref)
        try {
          const blob = await item.load()
          const bytes = await blob.arrayBuffer()
          if (bytes.byteLength < 4 || new DataView(bytes).getUint16(0) !== 0xffd8) throw new Error('Ungültiger JPEG-Header')
          ref.imageSha256 = await this.sha256(bytes)
          if (seen.has(ref.imageSha256)) { warnings.push('Duplikat (SHA-256)'); this.record('WARN', 'DUPLICATE', item.name, ref.imageSha256) }
          seen.add(ref.imageSha256)
          this.record('INFO', 'JPEG_CHECK', item.name, `bytes=${bytes.byteLength}; sha256=${ref.imageSha256}`)
          const metadata = this.readXmp(bytes)
          if (!metadata) warnings.push('XMP PayloadJson fehlt oder ist nicht lesbar')
          const p = metadata?.pstart || {}
          const fileZoom = /_(min|max|zero)\.jpe?g$/i.exec(item.name)?.[1]?.toUpperCase()
          ref.zoomRole = fileZoom === 'MIN' || fileZoom === 'ZERO' ? 'MIN' : fileZoom === 'MAX' ? 'MAX' : String(p.zoomRole || 'UNKNOWN').toUpperCase()
          ref.targetHeightM = this.num(p.targetHeight)
          ref.actualHeightM = this.num(p.relativeHeight)
          ref.captureTimestampMs = this.num(metadata?.capture?.timestampUnixMs)
          ref.telemetryTimestampMs = this.num(metadata?.telemetry?.timestampUnixMs ?? metadata?.telemetry?.timestamp)
          if (ref.captureTimestampMs != null && ref.telemetryTimestampMs != null) {
            ref.timestampDeltaMs = ref.captureTimestampMs - ref.telemetryTimestampMs
            // Timing offsets are diagnostic only, never an image-quality warning.
          }
          if (ref.actualHeightM != null && ref.targetHeightM != null && Math.abs(ref.actualHeightM - ref.targetHeightM) > 1) warnings.push(`Hoehenabweichung ${Math.round((ref.actualHeightM - ref.targetHeightM)*100)/100} m`)
          if (p.sessionId && p.sessionId !== sessionId) warnings.push('Abweichende Sitzungskennung im XMP')
          if (p.referenceEligible === false) warnings.push('Laut PStart nicht als Referenz geeignet')
          if (ref.captureTimestampMs == null) warnings.push('Aufnahmezeitstempel fehlt')
          if (ref.targetHeightM == null) warnings.push('Sollhöhe fehlt')
          // REF00 is XMP-only, including both MIN and MAX; REF01..REF05 use the same native detector.
          const metadataOnly = /(?:^|_)(?:STEP0|REF00)(?:_|\.)/i.test(item.name) || ref.targetHeightM === 0
          const opticalReference = !metadataOnly
          if (metadataOnly) {
            ref.status = 'metadata_only'
            this.record('INFO', 'METADATA_ONLY', item.name, 'REF00 XMP only; optical analysis skipped')
          } else if (!opticalReference) {
            warnings.push('Nicht erkannte Referenzrolle; keine optische Analyse')
            this.record('WARN', 'UNKNOWN_ROLE', item.name, 'REF01..REF05 expected')
          } else {
            this.emit({ state: 'DETECTING_MARKER', completed: refs.length - 1, total: items.length, message: item.name })
            this.record('INFO', 'OPTICAL_ANALYSIS', item.name, `zoom=${ref.zoomRole}`)
            await this.measure(blob, ref)
          }
          if (ref.timestampDeltaMs != null) this.record('INFO','TIMESTAMP_DELTA',item.name,`${ref.timestampDeltaMs} ms`)
          this.record('INFO', 'MEASURE', item.name, `status=${ref.status}; center=${JSON.stringify(ref.centerPx)}; warnings=${warnings.join(';')}`)
          // Do not persist image-specific results until the complete series is ranked.
          if (save) pendingCopies.push({ name: item.name, bytes, ref })
        } catch (e) { ref.status = 'error'; warnings.push(e instanceof Error ? e.message : String(e)); this.record('ERROR', 'IMAGE', item.name, String(e)) }
        this.emit({ state: 'CHECKING_IMAGES', completed: refs.length, total: items.length, message: item.name })
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      this.record('INFO','HOTFIX_VERSION','', 'PStart model publishing hotfix v0.9845.2')
      // A single ascent is one dataset. Select its strongest eligible close image;
      // never transfer pixel positions between altitudes or zoom roles.
      const series = this.evaluateSeries(refs)
      this.record(series.anchorImageId ? 'INFO' : 'WARN', 'SERIES_ANCHOR', series.anchorImageId || '', JSON.stringify(series))
      // Save a single normalized image from the strongest complete OpenCV candidate.
      // Candidate is deliberately not promoted to verified by successful warping.
      const ranked = pendingCopies.filter(c => c.ref.status === 'candidate' && c.ref.outerCornersPx?.length === 4)
        .sort((a,b) => Number(a.ref.candidateAmbiguous) - Number(b.ref.candidateAmbiguous) ||
          (b.ref.patternScore ?? 0) - (a.ref.patternScore ?? 0))
      let modelPublished = false
      let modelFailure = ''
      if (save && ranked.length) {
        const chosen = ranked[0]
        try {
          const result = await fetch('/api/pstart/analysis/opencv/normalize', {
            method: 'POST', body: new Blob([chosen.bytes], { type: 'image/jpeg' }) })
          if (!result.ok) throw new Error(`OpenCV normalize HTTP ${result.status}: ${await result.text()}`)
          const output = await result.json() as { pngBase64?: string; [key: string]: unknown }
          const binary = atob(output.pngBase64 || "")
          const pixels = Uint8Array.from(binary, c => c.charCodeAt(0))
          await save('reference_marker_analysis_normalized.png', new Blob([pixels], { type: 'image/png' }))
          // The normalized candidate is the sole pattern source; never blend multiple photographs.
          const scalePoints = refs.filter(r => r.status === 'candidate' && r.outerCornersPx?.length === 4 &&
            (r.actualHeightM ?? r.targetHeightM) != null && (r.actualHeightM ?? r.targetHeightM)! > 0 &&
            ['MIN','MAX'].includes(r.zoomRole)).map(r => {
            const c = r.outerCornersPx!
            const dist = (a: number[], b: number[]) => Math.hypot(a[0]-b[0],a[1]-b[1])
            const widthPx = (dist(c[0],c[1])+dist(c[1],c[2])+dist(c[2],c[3])+dist(c[3],c[0])) / 4
            return { imageId:r.imageId, heightM:(r.actualHeightM ?? r.targetHeightM) as number, zoomRole:r.zoomRole,
              widthPx, ambiguous:!!r.candidateAmbiguous, patternScore:r.patternScore ?? null }
          })
          const groups: Record<string, any> = {}
          for (const role of ['MIN','MAX']) {
            const points = scalePoints.filter(p=>p.zoomRole===role)
            // Least-squares p=k/h, with no fabricated observations or extrapolation claims.
            const sum = points.reduce((a,p)=>a+p.widthPx/p.heightM,0)
            const denominator = points.reduce((a,p)=>a+1/(p.heightM*p.heightM),0)
            const k = denominator > 0 ? sum/denominator : null
            groups[role] = { points, kPixelMeters:k, heightRangeM: points.length ?
              [Math.min(...points.map(p=>p.heightM)),Math.max(...points.map(p=>p.heightM))] : null,
              residuals: k == null ? [] : points.map(p=>({imageId:p.imageId,observedPx:p.widthPx,
                predictedPx:k/p.heightM,errorPx:p.widthPx-k/p.heightM})),
              status:'CANDIDATE_UNVERIFIED' }
          }
          const model = { schemaVersion:1, modelType:'normalized_square_marker', sourceImage:chosen.name,
            sourceSha256: chosen.ref.imageSha256, orientationCorner:'BOTTOM_RIGHT',
            origin:[0,0], corners:[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],
            patternFile:'marker_pattern_analysis.png', scaleFile:'marker_scale_analysis.json',
            qualityFile:'marker_quality_analysis.json', weightingFile:'marker_weighting_analysis.json',
            status:'CANDIDATE_UNVERIFIED', metricCalibration:false, flightControlEnabled:false }
          const scale = {schemaVersion:1, formula:'widthPx=kPixelMeters/heightM', groups,
            limitations:['Measured candidate corners unverified','Fit residuals are not independent validation',
              'Height must refer to marker plane; camera and zoom must match']}
          const quality = {schemaVersion:1, modelStatus:'CANDIDATE_UNVERIFIED',
            sourceImage:chosen.name, observations:scalePoints, independentValidation:false,
            note:'In-sample checks only. No geometry or GPS/optical accuracy certified.'}
          const weighting = {schemaVersion:1, formula:'Q*p*p/(p*p+p0*p0)',
            gpsFormula:'1-opticalWeight',p0Px:100,qualitySource:'LIVE_GEOMETRY_REQUIRED',
            qualityWhenUnverified:0,status:'PROVISIONAL_NOT_VALIDATED',use:'DISPLAY_ONLY'}
          const jsonBlob = (data:unknown)=>new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
          await save('marker_pattern_analysis.png',new Blob([pixels],{type:'image/png'}))
          await save('marker_model_analysis.json',jsonBlob(model))
          await save('marker_scale_analysis.json',jsonBlob(scale))
          await save('marker_quality_analysis.json',jsonBlob(quality))
          await save('marker_weighting_analysis.json',jsonBlob(weighting))
          this.record('INFO','MODEL_CANDIDATE',chosen.name,`scalePoints=${scalePoints.length}; status=CANDIDATE_UNVERIFIED`)
          if (sessionId !== 'offline-import' && sessionId !== 'offline-saf') {
            try {
              const files: Record<string,string> = {}
              for (const [name,data] of [['marker_pattern.png',new Blob([pixels],{type:'image/png'})],
                  ['marker_model.json',jsonBlob({...model,patternFile:'marker_pattern.png',scaleFile:'marker_scale.json',qualityFile:'marker_quality.json',weightingFile:'marker_weighting.json'})],['marker_scale.json',jsonBlob(scale)],
                  ['marker_quality.json',jsonBlob(quality)],['marker_weighting.json',jsonBlob(weighting)]] as const) {
                const arr = new Uint8Array(await data.arrayBuffer())
                let raw=''; for (let i=0;i<arr.length;i+=8192) raw += String.fromCharCode(...arr.subarray(i,i+8192))
                files[name]=btoa(raw)
              }
              const copy = await fetch('/api/pport/models/'+encodeURIComponent(sessionId),{method:'POST',
                headers:{'Content-Type':'application/json'},body:JSON.stringify({files})})
              if (!copy.ok) throw new Error(await copy.text())
              modelPublished = true
              this.record('INFO','PPORT_MODEL_COPY',chosen.name,'Stored as unverified candidate; PLand must display warning')
            } catch(e) { modelFailure = String(e); this.record('ERROR','PPORT_MODEL_COPY',chosen.name,modelFailure) }
          }
          delete output.pngBase64
          if (typeof output.diagnosticPngBase64 === 'string') {
            const diagnostic = Uint8Array.from(atob(output.diagnosticPngBase64), c => c.charCodeAt(0))
            await save('reference_marker_analysis_diagnostic.png', new Blob([diagnostic], { type: 'image/png' }))
          }
          delete output.diagnosticPngBase64
          await save('reference_marker_analysis_geometry.json', new Blob([JSON.stringify({
            ...output, sourceImage: chosen.name, sourceSha256: chosen.ref.imageSha256,
            runId, selectedBy: 'nonambiguous-first-then-pattern-score',
            landingReadiness: 'NOT_READY'
          }, null, 2)], { type: 'application/json' }))
          this.record('INFO','REFERENCE_NORMALIZED',chosen.name,JSON.stringify(output))
          if (output.orientationStatus !== 'orientation_candidate')
            this.record('WARN','ORIENTATION_AMBIGUOUS',chosen.name,String(output.cornerSeparation))
        } catch(e) { modelFailure = String(e); this.record('ERROR','REFERENCE_NORMALIZATION',chosen.name,modelFailure) }
      } else { modelFailure = 'No suitable candidate or writable session folder'; this.record('WARN','REFERENCE_NORMALIZATION','',modelFailure) }
      if (save) {
        for (const copy of pendingCopies) {
          try {
            const safeName = copy.name.split('/').pop()!.replace(/\.jpe?g$/i, '')
            const name = `${safeName}_analysis_${runId}.jpg`
            await save(name, this.annotatedJpeg(copy.bytes, copy.ref, runId))
            this.record('INFO', 'SAVE_XMP_COPY', copy.name, name)
          } catch (e) {
            copy.ref.warnings.push('Analysierte XMP-Kopie konnte nicht gespeichert werden')
            this.record('ERROR', 'SAVE_XMP_COPY', copy.name, String(e))
          }
        }
      }
      const errors = refs.filter(r => r.status === 'error').length
      const valid = refs.filter(r => r.status === 'candidate').length
      this.record('INFO', 'OPTICAL_SUMMARY', '', JSON.stringify({ metadataOnly: refs.filter(r => r.status === 'metadata_only').length, optical: refs.filter(r => r.status !== 'metadata_only').length, candidates: valid }))
      const profile: PStartProfile = { schemaVersion: '1.0', algorithmVersion: 'series-worktree-1', sessionId, analysisStatus: errors === refs.length || !refs.length ? 'failed' : !modelPublished ? 'completed_with_save_errors' : 'completed', marker: { modelId: 'cross-800-v1', widthMm: 800, heightMm: 800, blackLineWidthMm: 50, targetMm: [400, 400] }, camera: { calibrationId: null, gimbalTargetDeg: -90 }, references: refs, landingReadiness: { status: 'NOT_READY', reasons: ['Geometrie ohne verifizierte Rahmenpunkte und Kamera-Kalibrierung ist nicht für automatische PLanding-Steuerung freigegeben.', ...(valid ? [] : ['Kein plausibler Kreuzmittelpunkt gefunden.'])] }, generatedAt: new Date().toISOString(), seriesAnalysis: series }
      try { localStorage.setItem('taf.pstart.analysis.latest', JSON.stringify(profile)) } catch { /* storage optional */ }
      if (!modelPublished) this.record('ERROR','MODEL_DELIVERY',sessionId,modelFailure || 'PPort model not confirmed')
      this.record('INFO', 'COMPLETE', '', `${refs.length} images; ${valid} candidates; anchor=${series.anchorImageId || "none"}`)
      if (save) {
        for (const [name, data, mime] of [
          [`PStart_analysis_${runId}_profile.json`, JSON.stringify(profile, null, 2), 'application/json'],
          [`PStart_analysis_${runId}_log.jsonl`, this.logLines.join('\n') + '\n', 'application/x-ndjson'],
        ] as const) {
          try { await save(name, new Blob([data], { type: mime })) }
          catch (e) { this.record('ERROR', 'SAVE_RESULT', name, String(e)); profile.analysisStatus = 'completed_with_save_errors' }
        }
      } else {
        this.record('WARN', 'READ_ONLY_FOLDER', '', 'Browser file input has no directory write permission; export manually or use writable-folder mode')
      }
      this.emit({ state: profile.analysisStatus === 'failed' ? 'FAILED' : profile.analysisStatus !== 'completed' || errors || refs.some(r => r.warnings.length) ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED', completed: refs.length, total: items.length, message: `${refs.length - errors} erfolgreich gelesen, ${errors} Fehler; ${valid} Kreuz-Kandidaten; keine Flugfreigabe`, profile })
      return profile
    } catch (e) {
      this.record('ERROR', 'RUN', '', String(e))
      this.emit({ state: 'FAILED', completed: refs.length, total: items.length, message: String(e) })
      throw e
    } finally { this.busy = false }
  }
  /** Ranking is observational: a clear near-image is the reference for pattern identity,
   * not a claimed camera extrinsic transform or a replacement for per-image localization. */
  private static evaluateSeries(refs: PStartReference[]): NonNullable<PStartProfile['seriesAnalysis']> {
    const measured = refs.filter(r => /(?:^|_)(?:REF_[0-4]|REF0[1-5])(?:_|\.)/i.test(r.imagePath) && r.status === 'candidate' && r.centerPx && r.outerCornersPx?.length === 4 && r.targetHeightM != null && r.targetHeightM > 0)
    for (const ref of refs) {
      ref.seriesRole = 'unverified'
      ref.seriesReferenceImageId = null
      const sharp = ref.quality.sharpness == null ? 0 : Math.min(1, ref.quality.sharpness / 40)
      const contrast = ref.quality.contrast ?? 0
      const pattern = ref.patternScore ?? 0
      ref.seriesQualityScore = ref.status === 'candidate' && ref.outerCornersPx?.length === 4
        ? Math.round(1000 * (0.70 * pattern + 0.15 * sharp + 0.15 * contrast - (ref.candidateAmbiguous ? 0.25 : 0))) / 1000
        : null
    }
    const heights = measured.map(r => r.targetHeightM!).sort((a, b) => a - b)
    const lowest = heights[0]
    const near = measured.filter(r => r.targetHeightM === lowest && !r.candidateAmbiguous)
    near.sort((a,b) => (b.seriesQualityScore ?? -1) - (a.seriesQualityScore ?? -1) || a.imageId.localeCompare(b.imageId))
    const anchor = near[0] || null
    const warnings: string[] = []
    if (!anchor) warnings.push('Keine eindeutige geometrische Nahreferenz; Serienzuordnung nicht bestaetigt')
    if (anchor) {
      anchor.seriesRole = 'anchor'; anchor.seriesReferenceImageId = anchor.imageId
      for (const ref of measured) {
        if (ref === anchor) continue
        ref.seriesReferenceImageId = anchor.imageId
        // Appearance evidence is independent of positional geometry: no false corroboration.
        if (!ref.candidateAmbiguous && (ref.patternScore ?? 0) >= 0.52) ref.seriesRole = 'corroborated'
        else ref.warnings.push('Serienreferenz vorhanden, aber lokale Markererkennung mehrdeutig oder schwach')
      }
    }
    for (const ref of refs) this.record('INFO', 'SERIES_EVALUATION', ref.imageId,
      JSON.stringify({ role: ref.seriesRole, anchor: ref.seriesReferenceImageId, score: ref.seriesQualityScore, height: ref.targetHeightM, zoom: ref.zoomRole }))
    return { anchorImageId: anchor?.imageId ?? null, anchorHeightM: anchor?.targetHeightM ?? null,
      anchorPatternScore: anchor?.patternScore ?? null, evaluatedImages: refs.length, warnings }
  }

  private static num(value: unknown): number | null { if (value == null || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null }
  private static readXmp(bytes: ArrayBuffer): any | null {
    const data = new Uint8Array(bytes)
    let at = 2
    while (at + 4 < data.length) {
      if (data[at] !== 0xff) break
      const marker = data[at + 1]
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue }
      const length = (data[at + 2] << 8) + data[at + 3]
      if (length < 2 || at + 2 + length > data.length) break
      if (marker === 0xe1) {
        const text = new TextDecoder().decode(data.subarray(at + 4, at + 2 + length))
        const match = /<(?:[\w.-]+:)?PayloadJson>([\s\S]*?)<\/(?:[\w.-]+:)?PayloadJson>/.exec(text)
        if (match) { try { return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')) } catch { return null } }
      }
      at += 2 + length
    }
    return null
  }
  /** Deliberately conservative: cross-line candidate only, not a verified fiducial pose. */
  private static async measure(blob: Blob, ref: PStartReference): Promise<void> {
    // Prefer the Android-native OpenCV detector, including for offline imported JPEGs.
    // Fail closed when geometry is incomplete or Android backend is not reachable.
    try {
      const result = await fetch('/api/pstart/analysis/opencv', { method: 'POST', body: blob })
      if (!result.ok) throw new Error(`OpenCV HTTP ${result.status}: ${(await result.text()).slice(0, 800)}`)
      const geometry = await result.json()
      this.record('INFO', 'OPENCV', ref.imageId, JSON.stringify({ status: geometry.status, engine: geometry.engine, patternScore: geometry.patternScore, candidateCount: geometry.candidateCount, candidateAmbiguous: geometry.candidateAmbiguous, warnings: geometry.warnings }))
      ref.patternScore = this.num(geometry.patternScore)
      ref.candidateAmbiguous = geometry.candidateAmbiguous === true
      if (geometry.status === 'BOUNDARY_CANDIDATE' && Array.isArray(geometry.outerCornersPx) && Array.isArray(geometry.centerPx)) {
        ref.outerCornersPx = geometry.outerCornersPx
        ref.homography = geometry.homographyImageToMarkerMm || null
        ref.centerPx = geometry.centerPx
        ref.status = 'candidate'
        if (geometry.candidateAmbiguous) ref.warnings.push('Mehrdeutige geometrische Markerkandidaten')
        ref.quality.detectionConfidence = null // uncalibrated until cross, width and orientation verified
        ref.warnings.push(...(geometry.warnings || []))
        return
      }
      ref.warnings.push('OpenCV: no geometrically suitable quadrilateral found')
    } catch (error) {
      this.record('ERROR', 'OPENCV_UNAVAILABLE', ref.imageId, String(error))
      ref.warnings.push('OpenCV backend unavailable; fallback is not a geometric verification')
    }
    await this.measureFallback(blob, ref)
  }

  private static async measureFallback(blob: Blob, ref: PStartReference): Promise<void> {
    const bitmap = await createImageBitmap(blob)
    try {
      const factor = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * factor)), h = Math.max(1, Math.round(bitmap.height * factor))
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Canvas-Kontext fehlt')
      ctx.drawImage(bitmap, 0, 0, w, h)
      const pixels = ctx.getImageData(0, 0, w, h).data
      const gray = new Uint8Array(w * h)
      let lo = 255, hi = 0, sharp = 0, count = 0
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = y * w + x, i = p * 4
        const v = Math.round(pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114)
        gray[p] = v; lo = Math.min(lo, v); hi = Math.max(hi, v)
        if (x > 0 && y > 0) { sharp += Math.abs(v - gray[p - 1]) + Math.abs(v - gray[p - w]); count += 2 }
      }
      ref.quality.sharpness = count ? Math.round(100 * sharp / count) / 100 : null
      ref.quality.contrast = (hi - lo) / 255
      const threshold = lo + (hi - lo) * .4
      const row = new Float64Array(h), col = new Float64Array(w)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (gray[y * w + x] < threshold) { row[y]++; col[x]++ } }
      // Select strongest central lines, then require strong contrast against nearby lines.
      const mx = (values: Float64Array, a: number, b: number) => { let best = a; for (let i = a + 1; i < b; i++) if (values[i] > values[best]) best = i; return best }
      const cx = mx(col, Math.floor(w * .15), Math.ceil(w * .85)), cy = mx(row, Math.floor(h * .15), Math.ceil(h * .85))
      const baselineX = col[Math.max(0, cx - Math.floor(w * .12))], baselineY = row[Math.max(0, cy - Math.floor(h * .12))]
      const strength = Math.min((col[cx] - baselineX) / Math.max(1, h), (row[cy] - baselineY) / Math.max(1, w))
      ref.quality.detectionConfidence = Math.max(0, Math.min(0.5, strength)) // candidate confidence cap
      if (strength > .12 && hi - lo > 45) { ref.centerPx = [Math.round(cx / factor * 10) / 10, Math.round(cy / factor * 10) / 10]; ref.status = 'candidate'; ref.warnings.push('Kreuz-Kandidat; Rahmen, Perspektive und Orientierung nicht verifiziert') }
      else ref.warnings.push('Kein hinreichend eindeutiges Kreuz erkannt')
    } finally { bitmap.close() }
  }
}
