# Capstone app execution notes

The latest regeneration uses the same CreationService, Website portfolio entry template and GenerationService used by the website. All 41 entries use `portfolio`. The brief requests bullets and inline supplied images; no short-word target or editorial review appendix was added.

Entry index: http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/760a5360-f1f7-4ca3-8f10-6bbdcc693e9d/edit

All final entries use the website configured model (openai/gpt-6-luna). Faster-model attempts were replaced with configured-model generations; earlier attempts remain in history.

Current entry versions are unchanged pipeline outputs, verified against generation task identities. Earlier generated and manually reviewed entries are preserved in the reference project. Review trackers and company decisions remain separate.

Provider calls may time out or return malformed structured output; the application's durable task scheduler retries eligible failures. The console runner renews active leases. Source images are served through authenticated evidence routes; checked image bytes are included in the export assets.

PostgreSQL/pgvector, Redis and Mailpit remain persistent Docker services. Existing application code and templates were not changed for this regeneration.
