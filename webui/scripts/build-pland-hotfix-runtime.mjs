import fs from 'node:fs';
import {parse, compileScript} from '@vue/compiler-sfc';
import ts from 'typescript';
const base='../app/src/main/assets/web/assets/modules/';
const mapping = new Map([
  ['vue','../../../vendor/vue.js'],
  ['../../stores/useDroneStore','../../stores/useDroneStore.js'],
  ['../../stores/useCameraStore','../../stores/useCameraStore.js'],
  ['../../stores/usePrecisionStartStore','../../stores/usePrecisionStartStore.js'],
  ['../../services/DroneControlService','../../services/DroneControlService.js'],
  ['../../services/PrecisionStartService','../../services/PrecisionStartService.js'],
  ['../../protocol/VideoExtractor','../../protocol/VideoExtractor.js'],
  ['../../video/WebCodecsPlayer','../../video/WebCodecsPlayer.js'],
  ['../../i18n','../../i18n/index.js'],
  ['../../composables/useLandingAssistSettings','../../composables/useLandingAssistSettings.js'],
]);
for(const name of ['FlightActions','VideoPlayer']){
  const file=`src/components/cockpit/${name}.vue`;
  const {descriptor}=parse(fs.readFileSync(file,'utf8'),{filename:file});
  const compiled=compileScript(descriptor,{id:'pland-pport-9845-6',inlineTemplate:true});
  let code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
  code=code.replace(/from (['"])([^'"]+)\1/g,(all,q,from)=>`from '${mapping.get(from) ?? from}'`);
  if(/from ['"](?:vue|\.\.\/\.\.\/(?!.*\.js))/.test(code)) throw Error(`Unmapped import in ${file}`);
  fs.writeFileSync(`${base}components/cockpit/${name}.js`,code);
  console.log('rebuilt',name,code.length);
}
const service='src/services/PStartPostProcessingService.ts';
let code=ts.transpileModule(fs.readFileSync(service,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
fs.writeFileSync(`${base}services/PStartPostProcessingService.js`,code);
