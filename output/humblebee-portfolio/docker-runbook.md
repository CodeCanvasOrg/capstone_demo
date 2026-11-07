# Local capstone Docker services

The previous capstone containers and volume were absent from Docker. New persistent services were created, and repository migrations initialized the empty local development database. Previous database records were not recovered.

| Container | Purpose | Local port | Persistent volume |
| --- | --- | --- | --- |
| capstone-tenancy-pg | PostgreSQL 17 with pgvector | 55433 | capstone_postgres_data |
| capstone-redis | Dedicated authenticated Redis | 6380 | capstone_redis_data |
| capstone-mailpit | Local SMTP capture and inbox | 1026 / 8026 | capstone_mailpit_data |

All three use restart policy `unless-stopped`. Existing AMRUDE services were left running. Capstone's `.env` Redis settings point to its dedicated instance. Passwords are not recorded in this handoff.

To reactivate these containers after stopping them:

```sh
docker start capstone-tenancy-pg capstone-redis capstone-mailpit
```

The local app is served at http://localhost:3344; Mailpit is at http://localhost:8026. The app currently uses its configured sync queue adapter. Console scripts explicitly load queue jobs; they do not depend on browser sign-in. Operations use the application membership checks and normal upload, processing, task, generation and version services.

The local owner was provisioned using the repository-configured John Paul email because the restored database had no users. Local sign-in details are in `.local-owner-access.json` (mode 0600), excluded from shareable bundles. Do not publish or send that file.
