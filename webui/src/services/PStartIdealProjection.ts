/** Display-only candidate ideal projection; no intrinsic camera calibration or flight-control use. */
export type Pt = [number, number]
export interface OpticalObservation {
  imageId: string
  corners: Pt[] | null
  homography: number[][] | null // IMAGE -> normalized marker (0..800)
  center: Pt | null
  heightM: number | null
  zoomRole: string
  metadata?: any
}
const number = (v: unknown): number | null => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
export function mapPoint(H: number[][], p: Pt): Pt | null {
  if (H.length !== 3 || H.some(r => r.length !== 3 || r.some(v => !Number.isFinite(v)))) return null
  const x = H[0][0]*p[0]+H[0][1]*p[1]+H[0][2]
  const y = H[1][0]*p[0]+H[1][1]*p[1]+H[1][2]
  const w = H[2][0]*p[0]+H[2][1]*p[1]+H[2][2]
  return Math.abs(w) < 1e-9 ? null : [x/w,y/w]
}
export function invertHomography(a: number[][]): number[][] | null {
  if (a.length!==3 || a.some(r=>r.length!==3 || r.some(v=>!Number.isFinite(v)))) return null
  const [x,y,z]=a
  const adj = [
    [y[1]*z[2]-y[2]*z[1],x[2]*z[1]-x[1]*z[2],x[1]*y[2]-x[2]*y[1]],
    [y[2]*z[0]-y[0]*z[2],x[0]*z[2]-x[2]*z[0],x[2]*y[0]-x[0]*y[2]],
    [y[0]*z[1]-y[1]*z[0],x[1]*z[0]-x[0]*z[1],x[0]*y[1]-x[1]*y[0]]
  ]
  const det=x[0]*adj[0][0]+x[1]*adj[1][0]+x[2]*adj[2][0]
  return Math.abs(det)<1e-9?null:adj.map(row=>row.map(v=>v/det))
}
export const idealFeatures: Pt[][] = [
  [[0,0],[800,0],[800,800],[0,800],[0,0]],
  [[28,28],[772,28],[772,772],[28,772],[28,28]],
  [[210,210],[590,210],[590,590],[210,590],[210,210]],
  [[400,284],[400,516]], [[284,400],[516,400]],
  [[632,632],[772,632],[772,772],[632,772],[632,632]]
]
export function candidateProjection(H: number[][]): Pt[][] | null {
  const inverse=invertHomography(H)
  if (!inverse) return null
  const paths=idealFeatures.map(path=>path.map(pt=>mapPoint(inverse,pt)))
  return paths.some(path=>path.some(pt=>!pt))?null:paths as Pt[][]
}
/** Compare projected dark feature samples with adjacent pixels. Diagnostic contrast only,
 * not pose, orientation or a verified reprojection residual. */
export function interiorContrast(ctx: CanvasRenderingContext2D, paths: Pt[][]): {contrast: number|null; samples: number} {
  const data=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height)
  const gray=(x:number,y:number)=>{
    const ix=Math.round(x),iy=Math.round(y)
    if(ix<0||iy<0||ix>=data.width||iy>=data.height)return null
    const i=(iy*data.width+ix)*4
    return (data.data[i]*.299+data.data[i+1]*.587+data.data[i+2]*.114)/255
  }
  let sum=0,count=0
  for(const path of paths.slice(2))for(let j=1;j<path.length;j++){
    const [ax,ay]=path[j-1], [bx,by]=path[j]
    const len=Math.hypot(bx-ax,by-ay)
    if(len<4)continue
    for(let t=.15;t<.9;t+=.15){
      const x=ax+(bx-ax)*t,y=ay+(by-ay)*t
      const offset=Math.max(3,Math.min(12,len*.08))
      const nx=-(by-ay)/len*offset,ny=(bx-ax)/len*offset
      const c=gray(x,y),l=gray(x+nx,y+ny),r=gray(x-nx,y-ny)
      if(c!==null && l!==null && r!==null){sum+=(l+r)/2-c;count++}
    }
  }
  return {contrast:count?Math.round(sum/count*1000)/1000:null,samples:count}
}
/** Relative, anchor-based telemetry approximation. Intrinsics and marker GPS pose are unknown.
 * Do not label this an independent 3D pose or validated metric overlay. */
export function telemetryPrediction(anchor: OpticalObservation, current: OpticalObservation): {centerPx:Pt; limitations:string[]; inputs:Record<string,unknown>} | null {
  if (!anchor.center || !anchor.corners || anchor.corners.length!==4 || !anchor.metadata || !current.metadata) return null
  const a=anchor.metadata.telemetry || {}, b=current.metadata.telemetry || {}
  const al=number(a.latitude),ao=number(a.longitude),bl=number(b.latitude),bo=number(b.longitude)
  const az=number(anchor.heightM),bz=number(current.heightM)
  const yaw=number(b.heading), gimbal=number(b.gimbalPitch)
  if ([al,ao,bl,bo,az,bz,yaw,gimbal].some(v=>v===null) || az!<=0 || bz!<=0 || (al===0&&ao===0) || (bl===0&&bo===0))return null
  const cameraA=anchor.metadata.camera||{},cameraB=current.metadata.camera||{}
  const za=number(cameraA.zoomActual ?? cameraA.zoomTarget), zb=number(cameraB.zoomActual ?? cameraB.zoomTarget)
  // No cross-zoom focal conversion without calibrated profiles. Same zoom role and stable value only.
  if(anchor.zoomRole!==current.zoomRole || (za!==null&&zb!==null&&Math.abs(za-zb)>.01))return null
  const side=(Math.hypot(anchor.corners[0][0]-anchor.corners[1][0],anchor.corners[0][1]-anchor.corners[1][1])+Math.hypot(anchor.corners[2][0]-anchor.corners[3][0],anchor.corners[2][1]-anchor.corners[3][1]))/2
  const pxPerMeter=side/.8*(az!/bz!)
  const north=(bl!-al!)*111195, east=(bo!-ao!)*111195*Math.cos(al!*Math.PI/180)
  const rad=yaw!*Math.PI/180
  const right=east*Math.cos(rad)-north*Math.sin(rad)
  const forward=east*Math.sin(rad)+north*Math.cos(rad)
  const anchorPitch=number(a.gimbalPitch)
  const dyTilt=anchorPitch===null?0:Math.tan((gimbal!-anchorPitch)*Math.PI/180)*bz!*pxPerMeter
  return {centerPx:[anchor.center[0]-right*pxPerMeter,anchor.center[1]+forward*pxPerMeter+dyTilt],
    inputs:{anchorImageId:anchor.imageId,headingDeg:yaw,gimbalPitchDeg:gimbal,zoomActual:zb,latitude:bl,longitude:bo,heightM:bz},
    limitations:['ANCHOR_DEPENDENT_NOT_INDEPENDENT_POSE','UNCALIBRATED_FOCAL_LENGTH','UNKNOWN_MARKER_WORLD_POSE','APPROXIMATE_GPS_HEADING_GIMBAL_GEOMETRY','DISPLAY_ONLY']}
}
export async function createOverlay(image:Blob, paths:Pt[][], predictedCenter?:Pt|null):Promise<{blob:Blob; contrast:{contrast:number|null;samples:number}}>{
  const bitmap=await createImageBitmap(image)
  try{
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas 2D unavailable')
    ctx.drawImage(bitmap,0,0)
    const contrast=interiorContrast(ctx,paths)
    ctx.lineWidth=Math.max(2,Math.min(7,canvas.width/800))
    ctx.strokeStyle='#06e58a';ctx.shadowColor='#003322';ctx.shadowBlur=1
    for(const path of paths){ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()}
    ctx.shadowBlur=0
    if(predictedCenter){ctx.strokeStyle='#ffb000';ctx.lineWidth=Math.max(2,canvas.width/1200);ctx.beginPath();ctx.moveTo(predictedCenter[0]-14,predictedCenter[1]);ctx.lineTo(predictedCenter[0]+14,predictedCenter[1]);ctx.moveTo(predictedCenter[0],predictedCenter[1]-14);ctx.lineTo(predictedCenter[0],predictedCenter[1]+14);ctx.stroke()}
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Overlay encode failed')),'image/png'))
    return {blob,contrast}
  } finally {bitmap.close()}
}
