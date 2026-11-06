import { readFile,writeFile,readdir } from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {boot} from './pipeline-runtime.mjs';
const O=new URL('./',import.meta.url), action=process.argv[2]??'status';
const read=async n=>readFile(new URL(n,O),'utf8');
let state=await read('pipeline-state.json').then(JSON.parse).catch(()=>({files:[],documents:{}}));
const save=()=>writeFile(new URL('pipeline-state.json',O),JSON.stringify(state,null,2));
const app=await boot();
try{
const {default:db}=await import('@adonisjs/lucid/services/db');
const {default:Access}=await import('#services/workspaces/access_service');
const {default:Users}=await import('#models/user');
const {default:Document}=await import('#models/document');
const {default:Versions}=await import('#models/document_version');
const {default:Task}=await import('#models/workspace_task');
const {default:Run}=await import('#models/processing_run');
const {default:Projects}=await import('#services/workspaces/project_service');
const {default:Docs}=await import('#services/documents/document_service');
const {default:Creation}=await import('#services/documents/creation_service');
const {default:WorkspaceService}=await import('#services/workspaces/workspace_service');
if(action==='init'){
 const email=process.env.PORTFOLIO_OWNER_EMAIL??execFileSync('git',['config','user.email'],{encoding:'utf8'}).trim();
 let user=await Users.findBy('email',email);
 if(!user){
  if(Number((await db.from('users').count('* as n').first()).n)!==0)throw Error('Existing users require explicit owner selection');
  const password=randomBytes(18).toString('base64url');
  user=await new WorkspaceService().register({email,fullName:'John Paul',password});
  await writeFile(new URL('.local-owner-access.json',O),JSON.stringify({email,password,url:'http://localhost:3344/login'},null,2),{mode:0o600});
 }
 const wid=await new Access().destination(user);if(!wid)throw Error('Owner has no active workspace');
 const {context}=await new Access().resolve(user.id,wid);state.context=context;
 let project=await db.from('projects').where({workspace_id:wid,name:'humblebee portflio'}).first();
 if(!project)project=await new Projects().save(context,{name:'humblebee portflio',description:'Week 8 HumbleBeeAI company portfolio, with 42 primary sources, claim review and publication decisions.'});
 state.projectId=project.id;state.ownerEmail=email;await save();console.log('PROJECT_READY',JSON.stringify({projectId:project.id,workspaceId:wid,owner:email}));
}
if(!state.context)throw Error('Run init first');
const {context}=await new Access().resolve(state.context.actorId,state.context.workspaceId);
if(action==='upload'){
 const inventory=JSON.parse(await read('inventory.json'));
 const tracker=JSON.parse(await read('source-review-tracker.json'));
 const sourceMd='# Source review tracker\n\n'+tracker.map(x=>'## '+x.source_id+'\n\n'+Object.entries(x).map(([k,v])=>k+': '+v).join('\n\n')).join('\n\n');
 await writeFile(new URL('source-review-tracker.md',O),sourceMd);
 const figCsv=await read('figure-review-tracker.csv');await writeFile(new URL('figure-review-tracker.md',O),'# Figure review tracker\n\n16 system/result illustrations were visually checked; all republication permissions are pending. The CSV below retains source captions, pages, URLs and editorial captions.\n\n'+figCsv);
 const metricCsv=await read('metric-review-tracker.csv');await writeFile(new URL('metric-review-tracker.md',O),'# Metric review tracker\n\nSource-reported claims, physical PDF pages, test conditions and evidence gaps.\n\n'+metricCsv);
 const entries=inventory.map(r=>({key:r.kind+':'+r.slug,path:'upload-pdfs/'+r.path,filename:r.kind+'--'+r.slug+'.pdf',role:'primary',sourceUrl:r.source_url}));
 for(const n of await readdir(new URL('supplementary-pdfs/',O)))entries.push({key:'supplement:'+n,path:'supplementary-pdfs/'+n,filename:n,role:'supplement'});
 for(const n of ['source-review-tracker.md','metric-review-tracker.md','figure-review-tracker.md','review-decisions.md','portfolio-draft.md'])entries.push({key:'editorial:'+n,path:n,filename:'HumbleBeeAI--'+n,role:'editorial'});
 const {default:Upload}=await import('#services/upload_service');
 for(const e of entries){
  if(state.files.some(x=>x.key===e.key))continue;
  const contents=await readFile(new URL(e.path.split('/').map(encodeURIComponent).join('/'),O));const hash=createHash('sha256').update(contents).digest('hex');
  const existing=await db.from('files as f').join('file_revisions as r','r.file_id','f.id').where({'f.workspace_id':context.workspaceId,'f.filename':e.filename,'r.source_hash':hash}).select('f.id').first();
  const f=existing??await new Upload().upload(context,{filename:e.filename,contents});
  state.files.push({...e,id:f.id,sha256:hash});await save();console.log('UPLOADED',state.files.length,e.filename);
 }
}
if(action==='process'){
 const {default:Job}=await import('../../app/jobs/process_file.ts');
 const jobs=await Task.query().where('workspaceId',context.workspaceId).where('kind','ingest').whereIn('fileId',state.files.map(x=>x.id)).whereIn('status',['queued','running']);
 let ix=0;const work=async()=>{while(ix<jobs.length){const task=jobs[ix++];console.log('PROCESS',task.id,state.files.find(x=>x.id===task.fileId)?.filename);await Job.dispatch({version:1,taskId:task.id});await task.refresh();console.log('PROCESS_RESULT',task.id,task.status,task.safeError??'');}};
 await Promise.all([work(),work()]);
}
if(action==='generate'){
 const runs=await db.from('processing_runs as r').join('file_revisions as fr','r.file_revision_id','fr.id').whereIn('fr.file_id',state.files.filter(x=>x.role==='primary').map(x=>x.id)).select('r.status');
 if(runs.length!==42||runs.some(x=>x.status!=='ready'))throw Error('All 42 primary PDFs must be ready before generation');
 if(!state.documents.portfolio){
 const draft=await read('portfolio-draft.md');const split=draft.indexOf('## Products');const prompt=await read('generation-prompt.txt');
 const d=await new Creation().document(context,{title:'HumbleBeeAI — Company Portfolio | Week 8 Review Draft',projectId:state.projectId,description:prompt+'\n\nThis is a company-wide portfolio. Preserve all 42 source entries and their original URLs. The reviewed brief below was extracted from these PDFs; include its complete coverage. Do not add images pending approval. The first H1 and selected flagship section can be polished, but every case, product and paper must remain identifiable.',projectInformation:{overview:'Publicly documented applied AI work, products and research. Review copy pending company approval.',workCompleted:draft.slice(0,split),results:draft.slice(split),challenges:await read('review-decisions.md')},sourceMode:'files',templateId:null},state.files.filter(x=>x.role==='primary'||x.key==='editorial:source-review-tracker.md'||x.key==='editorial:portfolio-draft.md').map(x=>x.id));
 state.documents.portfolio=d.id;state.generationTaskId=d.generationTaskId;await save();console.log('GENERATION_REQUESTED',d.id,d.generationTaskId);
 }
 const doc=await Document.findOrFail(state.documents.portfolio);
 const {default:Job}=await import('../../app/jobs/generate_document.ts');await Job.dispatch({version:1,taskId:doc.generationTaskId});await doc.refresh();console.log('GENERATION_RESULT',doc.generationStatus,doc.generationError??'',doc.currentVersionId);
}
if(action==='status'||action==='verify'){
 const runs=await db.from('file_revisions as fr').join('processing_runs as r','r.file_revision_id','fr.id').whereIn('fr.file_id',state.files.map(x=>x.id)).select('fr.file_id','r.id','r.status','r.error','r.warnings');
 const counts=runs.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});console.log('STATUS',JSON.stringify({projectId:state.projectId,workspaceId:context.workspaceId,files:state.files.length,primary:state.files.filter(x=>x.role==='primary').length,processing:counts,failed:runs.filter(x=>x.status==='failed'),documents:state.documents}));
 await writeFile(new URL('pipeline-runs.json',O),JSON.stringify(runs,null,2));
 if(state.documents.portfolio){const d=await Document.findOrFail(state.documents.portfolio);console.log('PORTFOLIO',JSON.stringify({generationStatus:d.generationStatus,currentVersionId:d.currentVersionId,error:d.generationError}));if(d.currentVersionId){const v=await Versions.findOrFail(d.currentVersionId);await writeFile(new URL('pipeline-generated-content.json',O),JSON.stringify(v.content,null,2));}}
}
}catch(e){console.error('PIPELINE_ERROR',e.message);console.error(e.stack);process.exitCode=1;}finally{const{default:Pdf}=await import('#services/documents/pdf_worker_service');await Pdf.shutdown();await app.terminate();}
