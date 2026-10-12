<template>
  <section class="output-settings">
    <p>Alle Ausgaben sind unabhängig schaltbar. Der Webcam-Schalter ist eine Vorbereitung; ein Android-Kameraadapter ist noch nicht installiert.</p>
    <label><input v-model="form.streamEnabled" type="checkbox"> Stream auf Port 9091 aktivieren</label>
    <label><input v-model="form.webcamEnabled" type="checkbox"> Virtuelle Webcam vormerken (noch nicht verfügbar)</label>
    <hr>
    <label><input v-model="form.mapPip" type="checkbox"> Karte als PiP</label>
    <label> Kartenprovider <select v-model="form.mapProvider"><option value="main">Wie Hauptansicht (mit Cache)</option><option value="osm">OpenStreetMap (separat)</option></select></label>
    <label><input v-model="form.showPosition" type="checkbox"> GPS-Position</label>
    <label><input v-model="form.showHeading" type="checkbox"> Flugrichtung</label>
    <label><input v-model="form.showAltitude" type="checkbox"> Flughöhe</label>
    <label><input v-model="form.showBattery" type="checkbox"> Akkustand</label>
    <h4>Weitere Werte der Statusleiste (nur Zusatzstream)</h4>
    <label v-for="item in extra" :key="item.key"><input v-model="form[item.key]" type="checkbox"> {{ item.label }}</label>
    <p v-if="message" role="status">{{ message }}</p>
    <div class="actions"><el-button @click="enableAll">Alle auswählen</el-button><el-button @click="disableAll">Alles abwählen</el-button><el-button type="primary" @click="save">Speichern</el-button><el-button v-if="form.streamEnabled" @click="openStream">Stream öffnen</el-button></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
const extra = [
  {key:'showPhoneBattery',label:'Handy-Akku'}, {key:'showControllerBattery',label:'Fernsteuerungsspannung'},
  {key:'showDroneBattery',label:'Drohnen-Akku'}, {key:'showHorizontalSpeed',label:'Horizontale Geschwindigkeit'},
  {key:'showVerticalSpeed',label:'Vertikale Geschwindigkeit'}, {key:'showHorizontalDistance',label:'Horizontale Entfernung'},
  {key:'showSatellites',label:'Satelliten'}, {key:'showHomepoint',label:'Homepoint'},
  {key:'showPitch',label:'Nickwinkel'}, {key:'showRoll',label:'Rollwinkel'}
] as const
const keys=['streamEnabled','webcamEnabled','mapPip','showPosition','showHeading','showAltitude','showBattery',...extra.map(x=>x.key)]
const form=reactive<Record<string,boolean|string>>(Object.fromEntries([...keys.map(k=>[k,false]),['mapProvider','main']]))
const message=ref('')
onMounted(async()=>{try{const r=await fetch('/api/output/config');if(!r.ok)throw new Error(String(r.status));const data=await r.json();for(const key of keys)form[key]=data[key]===true;form.mapProvider=data.mapProvider==='osm'?'osm':'main'}catch(e){message.value='Einstellungen konnten nicht geladen werden: '+String(e)}})
function disableAll(){for(const key of keys)if(key!=='streamEnabled'&&key!=='webcamEnabled')form[key]=false}
function enableAll(){for(const key of keys)if(key!=='webcamEnabled')form[key]=true}
async function save(){try{const r=await fetch('/api/output/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});if(!r.ok)throw new Error(await r.text());message.value='Gespeichert'}catch(e){message.value='Speichern fehlgeschlagen: '+String(e)}}
function openStream(){window.open(location.protocol+'//'+location.hostname+':9091/','_blank','noopener,noreferrer')}
</script>
<style scoped>.output-settings{display:flex;flex-direction:column;gap:11px}.output-settings label{display:flex;align-items:center;gap:9px}.output-settings input{accent-color:#139b77}.actions{display:flex;flex-wrap:wrap;gap:7px}</style>
