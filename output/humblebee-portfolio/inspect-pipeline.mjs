import {boot} from './pipeline-runtime.mjs';
const app=await boot();
try{
 const {default:db}=await import('@adonisjs/lucid/services/db');
 const {default:env}=await import('#start/env');
 const {default:em}=await import('#config/embeddings');
 const {default:or}=await import('#config/open_router');
 const url=new URL(env.get('DB_URL'));console.log('RUNTIME',JSON.stringify({databaseHost:url.hostname,databasePort:url.port,db:url.pathname,queue:env.get('QUEUE_DRIVER'),storageHost:new URL(env.get('SUPABASE_ENDPOINT')).host,embeddingProvider:em.provider,embeddingModel:em.model,embeddingEndpoint:em.baseUrl,chatModel:or.model}));
 console.log('MEMBERSHIPS',JSON.stringify(await db.from('workspace_memberships as m').join('users as u','m.user_id','u.id').join('workspaces as w','m.workspace_id','w.id').whereNull('m.revoked_at').select('u.id as actorId','u.full_name','u.email','u.last_workspace_id','w.id as workspaceId','w.name','w.owner_user_id','m.role')));
 console.log('PROJECTS',JSON.stringify(await db.from('projects').select('id','workspace_id','name','creator_id')));
}catch(e){console.error(e.message);process.exitCode=1;}finally{await app.terminate();}
