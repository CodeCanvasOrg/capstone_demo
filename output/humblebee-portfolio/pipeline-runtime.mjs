import 'reflect-metadata';
import { Ignitor } from '@adonisjs/core';
export const root = new URL('../../', import.meta.url);
export async function boot() {
 const ignitor=new Ignitor(root,{importer: p=>p.startsWith('.')?import(new URL(p,root).href):import(p)}).tap(app=>{app.booting(()=>import('#start/env'));});
 const app=ignitor.createApp('console');await app.init();await app.boot();await app.start(()=>{});const queue=await app.container.make('queue.manager');await queue.loadJobs();return app;
}
