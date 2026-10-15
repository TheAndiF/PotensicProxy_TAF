/** PLand display-only frame geometry. Points are in uncropped source-frame pixel coordinates.
 * Corner order is top-left, top-right, bottom-right, bottom-left, including marker orientation.
 * Image-derived corners and a pose-derived prediction must never be conflated.
 */
export type Corner = readonly [number, number]
export type Quad = readonly [Corner, Corner, Corner, Corner]
export type H3 = readonly [number, number, number, number, number, number, number, number, number]
export interface FrameLayout {
  frameWidth: number; frameHeight: number; viewportWidth: number; viewportHeight: number
  cropX?: number; cropY?: number; cropWidth?: number; cropHeight?: number
}
/** Map pixels to a centered `object-fit: contain` viewport, accounting for crop and bars. */
export function frameToViewport(point: Corner, l: FrameLayout): Corner | null {
  const { frameWidth, frameHeight, viewportWidth, viewportHeight } = l
  const cw = l.cropWidth ?? frameWidth, ch = l.cropHeight ?? frameHeight
  if (![frameWidth,frameHeight,viewportWidth,viewportHeight,cw,ch,point[0],point[1]].every(Number.isFinite) ||
      Math.min(frameWidth,frameHeight,viewportWidth,viewportHeight,cw,ch) <= 0) return null
  const factor = Math.min(viewportWidth / cw, viewportHeight / ch)
  return [(point[0] - (l.cropX ?? 0))*factor + (viewportWidth - cw*factor)/2,
    (point[1] - (l.cropY ?? 0))*factor + (viewportHeight - ch*factor)/2]
}
/** Compute a 3x3 homography, source -> target, from four non-collinear correspondences. */
export function homography(source: Quad, target: Quad): H3 | null {
  const m: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x,y] = source[i], [u,v] = target[i]
    if (![x,y,u,v].every(Number.isFinite)) return null
    m.push([x,y,1,0,0,0,-u*x,-u*y,u])
    m.push([0,0,0,x,y,1,-v*x,-v*y,v])
  }
  for (let i = 0; i < 8; i++) {
    let pivot=i
    for (let j=i+1;j<8;j++) if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot=j
    if (Math.abs(m[pivot][i]) < 1e-9) return null
    ;[m[i],m[pivot]]=[m[pivot],m[i]]
    const d=m[i][i]
    for(let k=i;k<9;k++) m[i][k]/=d
    for(let j=0;j<8;j++) if(j!==i){ const a=m[j][i];for(let k=i;k<9;k++)m[j][k]-=a*m[i][k] }
  }
  return [...m.map(row=>row[8]),1] as unknown as H3
}
export function project(h: H3, [x,y]: Corner): Corner | null {
  const d=h[6]*x+h[7]*y+h[8]
  if (!Number.isFinite(d) || Math.abs(d)<1e-10) return null
  const u=(h[0]*x+h[1]*y+h[2])/d,v=(h[3]*x+h[4]*y+h[5])/d
  return Number.isFinite(u)&&Number.isFinite(v)?[u,v]:null
}
/** Render a perspective-warped texture using inverse mapping. Only call with validated live image corners. */
export function renderHomography(ctx: CanvasRenderingContext2D, texture: ImageData, corners: Quad, opacity = 0.4): boolean {
  const src: Quad = [[0,0],[texture.width,0],[texture.width,texture.height],[0,texture.height]]
  const inverse=homography(corners,src)
  if(!inverse || corners.some(p=>!p.every(Number.isFinite))) return false
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1])
  const minX=Math.max(0,Math.floor(Math.min(...xs))),maxX=Math.min(ctx.canvas.width,Math.ceil(Math.max(...xs)))
  const minY=Math.max(0,Math.floor(Math.min(...ys))),maxY=Math.min(ctx.canvas.height,Math.ceil(Math.max(...ys)))
  if(maxX<=minX || maxY<=minY || (maxX-minX)*(maxY-minY)>8_000_000) return false
  const out=ctx.createImageData(maxX-minX,maxY-minY)
  const alpha=Math.round(Math.max(0,Math.min(1,opacity))*255)
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const p=project(inverse,[x+.5,y+.5]);if(!p)continue
    const tx=Math.floor(p[0]),ty=Math.floor(p[1]);if(tx<0||ty<0||tx>=texture.width||ty>=texture.height)continue
    const k=(ty*texture.width+tx)*4,j=((y-minY)*out.width+x-minX)*4
    out.data[j]=texture.data[k];out.data[j+1]=texture.data[k+1];out.data[j+2]=texture.data[k+2]
    out.data[j+3]=Math.round(texture.data[k+3]*alpha/255)
  }
  ctx.putImageData(out,minX,minY)
  return true
}
