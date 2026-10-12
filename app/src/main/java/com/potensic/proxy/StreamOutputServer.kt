package com.potensic.proxy

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.writeFully
import kotlinx.coroutines.delay
import org.json.JSONObject

/** Read-only video output. No flight controls, no WebSockets and no writes. */
class StreamOutputServer(private val decoder: VideoDecoder, private val settings: StreamOutputSettings) {
    private var server: EmbeddedServer<CIOApplicationEngine, CIOApplicationEngine.Configuration>? = null

    @Synchronized fun start() {
        if (server != null) return
        server = embeddedServer(CIO, host = "0.0.0.0", port = 9091) {
            routing {
                get("/") {
                    if (!settings.streamEnabled()) { call.respond(HttpStatusCode.ServiceUnavailable); return@get }
                    call.response.header("Cache-Control", "no-store")
                    call.respondText(VIEWER_HTML, ContentType.Text.Html)
                }
                get("/stream.mjpg") {
                    if (!settings.streamEnabled()) { call.respond(HttpStatusCode.ServiceUnavailable); return@get }
                    call.response.header("Cache-Control", "no-store")
                    if (decoder.lastJpeg == null) ProxyService.instance?.activateLiveView()
                    call.respondBytesWriter(contentType = ContentType.parse("multipart/x-mixed-replace; boundary=frame")) {
                        var lastTime = 0L
                        while (settings.streamEnabled()) {
                            val frame = decoder.lastJpeg
                            val time = decoder.lastJpegTime
                            if (frame != null && time > lastTime) {
                                lastTime = time
                                writeFully("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.size}\r\n\r\n".toByteArray())
                                writeFully(frame)
                                writeFully("\r\n".toByteArray())
                                flush()
                            }
                            delay(33)
                        }
                    }
                }
                get("/settings") {
                    if (!settings.streamEnabled()) { call.respond(HttpStatusCode.ServiceUnavailable); return@get }
                    call.response.header("Cache-Control", "no-store")
                    call.respondText(settings.get().toString(), ContentType.Application.Json)
                }
            }
        }.also { it.start(wait = false) }
    }
    @Synchronized fun stop() { server?.stop(500, 1000); server = null }

    companion object {
        private val VIEWER_HTML = """<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
        *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}#video{width:100vw;height:100vh;object-fit:contain;display:block}
        #map{display:none;position:absolute;right:2%;top:3%;width:27vw;height:27vw;max-width:260px;max-height:260px;overflow:hidden;border:2px solid #eee;background:#ccc}
        #tiles{position:absolute;inset:0}#tiles img{position:absolute;width:33.3334%;height:33.3334%}#center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:bold 26px sans-serif;color:#fa3838;text-shadow:0 0 3px #fff}
        #hud{display:none;position:absolute;bottom:2%;left:2%;font:16px sans-serif;color:white;text-shadow:0 1px 4px black}
        </style></head><body><img id="video" src="/stream.mjpg"><div id="map"><div id="tiles"></div><span id="center">+</span></div><div id="hud"></div>
        <script>
        const control=location.protocol+'//'+location.hostname+':9090';let cfg={};
        async function refresh(){try{cfg=await(await fetch('/settings',{cache:'no-store'})).json();document.getElementById('map').style.display=cfg.mapPip?'block':'none';
        const r=await fetch(control+'/api/status',{cache:'no-store'});if(!r.ok)return;const j=await r.json();const s=j.state||{};
        const pick=(...keys)=>{for(const key of keys){if(s[key]!==undefined)return s[key]}return null};
        const lat=Number(pick('latitude','lat')),lon=Number(pick('longitude','lon'));
        if(cfg.mapPip&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180&&(lat!==0||lon!==0)){
          const z=15, n=2**z, tx=Math.floor((lon+180)/360*n),ty=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);let html='';
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=(tx+dx+n)%n,y=ty+dy;if(y<0||y>=n)continue;html+='<img style="left:'+((dx+1)*100/3)+'%;top:'+((dy+1)*100/3)+'%" src="'+control+'/api/map/tiles/'+z+'/'+x+'/'+y+'">'}
          document.getElementById('tiles').innerHTML=html;
        }
        const bits=[];if(cfg.showPosition)bits.push('GPS: '+(Number.isFinite(lat)?lat.toFixed(6):'–')+', '+(Number.isFinite(lon)?lon.toFixed(6):'–'));
        if(cfg.showHeading)bits.push('Kurs: '+(pick('heading')??'–')+'°');if(cfg.showAltitude)bits.push('Höhe: '+(pick('altitude')??'–')+' m');if(cfg.showBattery)bits.push('Akku: '+(pick('battery')??'–')+' %');
        const hud=document.getElementById('hud');hud.textContent=bits.join('  |  ');hud.style.display=bits.length?'block':'none';
        }catch(e){/* Keep video independent of telemetry/network errors */}}
        refresh();setInterval(refresh,3000);
        </script></body></html>"""
    }
}
