import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {boot} from '../humblebee-portfolio/pipeline-runtime.mjs';
const app=await boot();
try {
 const {default:db}=await import('@adonisjs/lucid/services/db');
 const {default:Access}=await import('#services/workspaces/access_service');
 const {default:Evidence}=await import('#services/documents/evidence_service');
 const {default:Exports}=await import('#services/exports/document_export_service');
 const {default:Readiness}=await import('#services/documents/readiness_service');
 const {default:Document}=await import('#models/document');
 const id='08499636-03de-4b76-a7ee-82d5f663a0e6';
 const document=await Document.findOrFail(id);
 const {context}=await new Access().resolve(document.userId,document.workspaceId);
 const version=await db.from('document_versions').where('id',document.currentVersionId).first();
 const tasks=await db.from('workspace_tasks').where('document_id',id).select('id','kind','status','attempts','payload','result','stage','telemetry','provider_attempts','created_at','updated_at');
 const saves=await db.from('version_acceptances').where('document_id',id).select('version_id','mutation_id','created_at');
 const ids=new Set();let imageCount=0,citations=0;const visit=n=>{if(n.attrs?.sourceChunkId)ids.add(n.attrs.sourceChunkId);if(n.type==='image')imageCount++;if(n.type==='sourceCitation')citations++;n.content?.forEach(visit)};visit(version.content);
 const evidence=[];for(const chunkId of ids){const row=await new Evidence().chunk(context,id,chunkId);evidence.push({chunkId,fileId:row.file_id,fileName:row.file_name,chunkIndex:row.chunk_index,pageNumber:row.page_number,kind:row.kind,excerpt:row.content})}
 const state=await new Readiness().inspect(document);
 const metadata={capturedAt:new Date().toISOString(),documentId:id,workspaceId:document.workspaceId,title:document.title,currentVersionId:version.id,version:version.version,activeReviewId:document.activeReviewId,activeApprovalId:document.activeApprovalId,tasks,saves,evidence,counts:{images:imageCount,citations},readiness:{reviewRequired:state.reviewRequired,canExport:state.canExport,approved:state.approved,stages:state.stages},contentSha256:createHash('sha256').update(JSON.stringify(version.content)).digest('hex')};
 await writeFile('docs/audits/out-01/before.content.json',JSON.stringify(version.content,null,2)+'\n');
 await writeFile('docs/audits/out-01/before.trace.json',JSON.stringify(metadata,null,2)+'\n');
 const html=await new Exports().preview(context,id,'html');
 await writeFile('docs/audits/out-01/before.preview.html',html);
 console.log(JSON.stringify({documentId:id,versionId:version.id,evidence:ids.size,...metadata.counts,readiness:metadata.readiness,htmlBytes:Buffer.byteLength(html)}));
 try{const pdf=await new Exports().preview(context,id,'pdf');await writeFile('docs/audits/out-01/before.preview.pdf',pdf);console.log('pdfBytes',pdf.length)}catch(e){console.log('PDF_PREVIEW_UNVERIFIED',e.code,e.message)}
}finally{await app.terminate()}
