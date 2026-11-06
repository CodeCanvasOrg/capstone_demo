import{boot}from'./pipeline-runtime.mjs';import{readFile,writeFile}from'node:fs/promises';import{randomUUID}from'node:crypto';
const O=new URL('./',import.meta.url);const state=JSON.parse(await readFile(new URL('pipeline-state.json',O),'utf8'));const app=await boot();let heartbeat;
try{
 const{default:Access}=await import('#services/workspaces/access_service');const{context}=await new Access().resolve(state.context.actorId,state.context.workspaceId);const{default:Doc}=await import('#models/document');const{default:Docs}=await import('#services/documents/document_service');const{default:Gen}=await import('#services/documents/generation_service');const{default:Tasks}=await import('#services/workspaces/task_service');
 let d=await Doc.findOrFail(state.documents.portfolio);
 await new Docs().update(context,d.id,{title:d.title,description:d.description+'\n\nLength and format: aim for 1,600–2,000 words total. Give every case a compact paragraph containing problem, solution and reported outcome. Keep all 42 original source links. The source tracker retains detailed evidence gaps; keep the client draft concise. No figures or images pending approval.',projectId:d.projectId,sourceMode:d.sourceMode,projectInformation:d.projectInformation,metadataRevision:d.metadataRevision});await d.refresh();
 const task=await new Gen().request(context,d.id,randomUUID(),d.currentVersionId);state.generationTaskId=task.id;await writeFile(new URL('pipeline-state.json',O),JSON.stringify(state,null,2));
 const tasks=new Tasks();const lease=await tasks.claim(task.id);if(!lease)throw Error('Task already claimed by dispatcher; inspect its result before retrying');
 heartbeat=setInterval(()=>{tasks.renew(lease).then(()=>console.log('LEASE_RENEWED',new Date().toISOString())).catch(e=>console.error('LEASE_RENEW_ERROR',e.message));},20000);
 console.log('EXECUTING_GENERATION',task.id);
 try{await new Gen().execute(lease);}catch(e){await new Gen().failed(lease,e);throw e;}
 await d.refresh();console.log('GENERATION_COMPLETE',d.generationStatus,d.currentVersionId);
}catch(e){console.error('GENERATION_ERROR',e.stack);process.exitCode=1}finally{clearInterval(heartbeat);const{default:Pdf}=await import('#services/documents/pdf_worker_service');await Pdf.shutdown();await app.terminate()}
