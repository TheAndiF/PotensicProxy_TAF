import fs from 'node:fs';
import {parse,compileScript} from '@vue/compiler-sfc';
import ts from 'typescript';
const file='src/components/cockpit/VideoPlayer.vue';
const {descriptor}=parse(fs.readFileSync(file,'utf8'),{filename:'VideoPlayer.vue'});
const script=compileScript(descriptor,{id:'pland-ideal-hotfix',inlineTemplate:true});
let output=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
output=output.replace(/from ['"]vue['"]/g,"from '../../../vendor/vue.js'")
.replace(/from ['"]\.\.\/\.\.\/stores\/useDroneStore['"]/g,"from '../../stores/useDroneStore.js'")
.replace(/from ['"]\.\.\/\.\.\/stores\/useCameraStore['"]/g,"from '../../stores/useCameraStore.js'")
.replace(/from ['"]\.\.\/\.\.\/services\/DroneControlService['"]/g,"from '../../services/DroneControlService.js'")
.replace(/from ['"]\.\.\/\.\.\/protocol\/VideoExtractor['"]/g,"from '../../protocol/VideoExtractor.js'")
.replace(/from ['"]\.\.\/\.\.\/video\/WebCodecsPlayer['"]/g,"from '../../video/WebCodecsPlayer.js'")
.replace(/from ['"]\.\.\/\.\.\/i18n['"]/g,"from '../../i18n/index.js'")
.replace(/from ['"]\.\.\/\.\.\/composables\/useLandingAssistSettings['"]/g,"from '../../composables/useLandingAssistSettings.js'");
if (/from ['"]vue['"]/.test(output)) throw Error('unmapped vue import');
const dest='../app/src/main/assets/web/assets/modules/components/cockpit/VideoPlayer.js';
fs.writeFileSync(dest,output);
console.log(dest,output.length);
