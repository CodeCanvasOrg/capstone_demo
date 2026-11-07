import{boot}from'./pipeline-runtime.mjs';import{readFile,writeFile}from'node:fs/promises';
const state=JSON.parse(await readFile(new URL('pipeline-state.json',import.meta.url),'utf8'));
const index=JSON.parse(await readFile(new URL('portfolio-entries-index.json',import.meta.url),'utf8'));
const app=await boot();try{
 const{default:Access}=await import('#services/workspaces/access_service');
 const{default:Exports}=await import('#services/exports/document_export_service');
 const{default:Doc}=await import('#models/document');
 const{context}=await new Access().resolve(state.context.actorId,state.context.workspaceId);const rows=[];
 for(let i=0;i<index.entries.length;i++){
  const e=index.entries[i],d=await Doc.findOrFail(e.documentId);if(d.currentVersionId!==e.versionId)throw Error('Version changed: '+e.key);
  const html=await new Exports().preview(context,e.documentId,'html');
  const slug=String(i+1).padStart(2,'0')+'-'+e.key.replace(':','--');
  await writeFile(new URL('../../tmp/pdfs/humblebee/'+slug+'.html',import.meta.url),html);
  rows.push({...e,slug});console.log('PDF_INPUT_READY',i+1,e.key);
 }
 await writeFile(new URL('../../tmp/pdfs/humblebee/manifest.json',import.meta.url),JSON.stringify(rows,null,2));
}finally{await app.terminate()}
