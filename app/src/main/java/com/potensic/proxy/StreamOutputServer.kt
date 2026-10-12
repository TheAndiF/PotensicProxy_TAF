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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
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
                // Same-origin, read-only status proxy. No browser cross-port requests.
                get("/telemetry") {
                    if (!settings.streamEnabled()) { call.respond(HttpStatusCode.ServiceUnavailable); return@get }
                    call.response.header("Cache-Control", "no-store")
                    val result = withContext(Dispatchers.IO) { readRemote("http://127.0.0.1:9090/api/status") }
                    if (result == null) call.respond(HttpStatusCode.ServiceUnavailable)
                    else call.respondBytes(result, ContentType.Application.Json)
                }
                get("/tiles/{z}/{x}/{y}") {
                    if (!settings.streamEnabled()) { call.respond(HttpStatusCode.ServiceUnavailable); return@get }
                    val z = call.parameters["z"]?.toIntOrNull()
                    val x = call.parameters["x"]?.toIntOrNull()
                    val y = call.parameters["y"]?.toIntOrNull()
                    if (z == null || z !in 0..19 || x == null || y == null || x < 0 || y < 0 || x >= (1 shl z) || y >= (1 shl z)) {
                        call.respond(HttpStatusCode.BadRequest); return@get
                    }
                    val mode = settings.get().optString("mapProvider", "main")
                    val url = if (mode == "osm") "https://tile.openstreetmap.org/$z/$x/$y.png"
                        else "http://127.0.0.1:9090/api/map/tiles/$z/$x/$y"
                    val bytes = withContext(Dispatchers.IO) { readRemote(url) }
                    call.response.header("Cache-Control", "no-store")
                    if (bytes == null) call.respond(HttpStatusCode.NotFound)
                    else call.respondBytes(bytes, ContentType.Image.PNG)
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

    private fun readRemote(address: String): ByteArray? = try {
        val connection = URL(address).openConnection() as HttpURLConnection
        connection.connectTimeout = 2500
        connection.readTimeout = 3500
        connection.setRequestProperty("User-Agent", "PotensicProxy-AdditionalStream/0.9834")
        try { if (connection.responseCode == 200) connection.inputStream.use { it.readBytes() } else null }
        finally { connection.disconnect() }
    } catch (_: Exception) { null }

    companion object {
        private val VIEWER_HTML = """<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
        *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}#video{width:100vw;height:100vh;object-fit:contain;display:block}
        #map{display:none;position:absolute;right:2%;top:3%;width:27vw;height:27vw;max-width:260px;max-height:260px;overflow:hidden;border:2px solid #eee;background:#ccc}
        #tiles{position:absolute;inset:0}#tiles img{position:absolute;width:33.3334%;height:33.3334%}#center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:bold 26px sans-serif;color:#fa3838;text-shadow:0 0 3px #fff}
        #hud{display:none;position:absolute;bottom:2%;left:2%;font:16px sans-serif;color:white;text-shadow:0 1px 4px black}
        </style></head><body><img id="video" src="/stream.mjpg"><div id="map"><div id="tiles"></div><span id="center">+</span></div><div id="hud"></div>
        <script>
        let cfg={}, lastTileKey='';
        const hud=document.getElementById('hud'),map=document.getElementById('map'),tiles=document.getElementById('tiles');
        const fmt=(v,d=1)=>v===null||v===undefined||!Number.isFinite(Number(v))?'–':Number(v).toFixed(d);
        async function refresh(){
          try {
            const c=await fetch('/settings',{cache:'no-store'});if(!c.ok)throw Error('settings '+c.status);cfg=await c.json();
            map.style.display=cfg.mapPip?'block':'none';
            const r=await fetch('/telemetry',{cache:'no-store'});if(!r.ok)throw Error('telemetry '+r.status);
            const j=await r.json(),s=j.state||{};
            const pick=(...keys)=>{for(const key of keys){if(s[key]!==undefined&&s[key]!==null)return s[key]}return null};
            const lat=Number(pick('latitude','lat')),lon=Number(pick('longitude','lon'));
            if(cfg.mapPip){
              if(Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180&&(lat!==0||lon!==0)){
                const z=15,n=2**z,tx=Math.floor((lon+180)/360*n),ty=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
                const tileKey=[cfg.mapProvider,tx,ty,z].join(':');
                if(tileKey!==lastTileKey){let html='';for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
                  const x=(tx+dx+n)%n,y=ty+dy;if(y<0||y>=n)continue;
                  html+='<img style="left:'+((dx+1)*100/3)+'%;top:'+((dy+1)*100/3)+'%" src="/tiles/'+z+'/'+x+'/'+y+'">';
                }tiles.innerHTML=html;lastTileKey=tileKey;}
              }else{tiles.textContent='GPS-Position nicht verfügbar';lastTileKey='';}
            }
            const rows=[];
            const add=(key,label,value)=>{if(cfg[key])rows.push(label+': '+value)};
            add('showPosition','GPS',Number.isFinite(lat)&&Number.isFinite(lon)?lat.toFixed(6)+', '+lon.toFixed(6):'–');
            add('showHeading','Kurs',fmt(pick('heading'),0)+'°');
            add('showAltitude','Höhe',fmt(pick('altitude'))+' m');
            add('showBattery','Akku',fmt(pick('battery'),0)+' %');
            add('showPhoneBattery','Handy',fmt(j.phoneBatteryPercent,0)+' %');
            add('showControllerBattery','Fernsteuerung',fmt(pick('remoterVoltage'))+' V');
            add('showDroneBattery','Drohne',fmt(pick('battery'),0)+' %');
            add('showHorizontalSpeed','Horizontal',fmt(pick('horizontalSpeed'))+' m/s');
            add('showVerticalSpeed','Vertikal',fmt(pick('verticalSpeed'))+' m/s');
            add('showHorizontalDistance','Entfernung',fmt(pick('horizontalDistance'))+' m');
            add('showSatellites','Satelliten',fmt(pick('satellites'),0));
            add('showHomepoint','Homepoint',s.homePointValid===true?'✓':s.homePointValid===false?'–':'unbekannt');
            add('showPitch','Nick',fmt(pick('pitch'),0)+'°');add('showRoll','Roll',fmt(pick('roll'),0)+'°');
            hud.textContent=rows.join('  |  ');hud.style.display=rows.length?'block':'none';
          }catch(e){ if(cfg.mapPip)tiles.textContent='Karte / Status nicht erreichbar';hud.style.display='none';}
        }
        refresh();setInterval(refresh,3000);
        </script></body></html>"""
    }
}
