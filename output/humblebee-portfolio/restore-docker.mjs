import {spawnSync} from 'node:child_process';
process.loadEnvFile('.env');
const u=new URL(process.env.DB_URL);if(!['127.0.0.1','localhost'].includes(u.hostname)||u.port!=='55433')throw Error('Expected local capstone database on 55433');
const run=(args,env=process.env)=>{const r=spawnSync('docker',args,{env,encoding:'utf8'});if(r.status)throw Error(r.stderr);console.log(r.stdout.trim());};
run(['volume','create','capstone_postgres_data']);
run(['run','-d','--name','capstone-tenancy-pg','--restart','unless-stopped','-p','127.0.0.1:55433:5432','-v','capstone_postgres_data:/var/lib/postgresql/data','-e','POSTGRES_USER','-e','POSTGRES_PASSWORD','-e','POSTGRES_DB','--health-cmd','pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"','--health-interval','5s','--health-timeout','5s','--health-retries','10','pgvector/pgvector:pg17'],{...process.env,POSTGRES_USER:decodeURIComponent(u.username),POSTGRES_PASSWORD:decodeURIComponent(u.password),POSTGRES_DB:u.pathname.slice(1)});
