from pathlib import Path
import json,html,csv,zipfile
from collections import Counter
O=Path(__file__).resolve().parent
index=json.loads((O/'portfolio-entries-index.json').read_text());check=json.loads((O/'website-redo-verification.json').read_text());http=json.loads((O/'website-redo-http-verification.json').read_text());groups=json.loads((O/'entry-groups.json').read_text())
assert check['passed'] and http['passed']
models=dict(Counter(e.get('generationModel','unknown')for e in check['entries']))
model_note='All final entries use the website configured model ('+check['configuredModel']+'). Faster-model attempts were replaced with configured-model generations; earlier attempts remain in history.'
assets={a['chunkId']:a['localFile']for a in http['images']}
style='body{max-width:960px;margin:48px auto;padding:0 24px;font:17px/1.65 system-ui;color:#1b252d}h1,h2,h3{line-height:1.25}h1{font-size:2.25rem}h2{margin-top:2em}a{color:#075d78}img{display:block;max-width:100%;height:auto;margin:28px auto}li{margin:.4em 0}small{color:#626d75}@media print{body{margin:12mm;font-size:11pt}}'
def render(n):
 t=n.get('type');inner=''.join(render(c)for c in n.get('content',[]))
 if t=='text':
  s=html.escape(n.get('text',''))
  for m in n.get('marks',[]):
   if m['type']=='link':s='<a href="'+html.escape(m['attrs']['href'],quote=True)+'">'+s+'</a>'
   if m['type']=='bold':s='<strong>'+s+'</strong>'
   if m['type']=='italic':s='<em>'+s+'</em>'
  return s
 if t=='image':return '<img src="'+assets[n['attrs']['sourceChunkId']]+'" alt="'+html.escape(n['attrs'].get('alt',''),quote=True)+'">'
 if t=='sourceCitation':return '<small> <a href="http://localhost:3344'+html.escape(n['attrs']['fileUrl'],quote=True)+'">[PDF p. '+str(n['attrs'].get('pageNumber',''))+']</a></small>'
 if t=='heading':tag='h'+str(n['attrs']['level']);return '<'+tag+'>'+inner+'</'+tag+'>'
 tags={'paragraph':'p','bulletList':'ul','orderedList':'ol','listItem':'li','blockquote':'blockquote','codeBlock':'pre'}
 if t in tags:return '<'+tags[t]+'>'+inner+'</'+tags[t]+'>'
 if t=='hardBreak':return '<br>'
 return inner
def md(n,depth=0):
 t=n.get('type')
 if t=='text':
  link=next((m for m in n.get('marks',[])if m['type']=='link'),None)
  return '['+n['text']+']('+link['attrs']['href']+')'if link else n['text']
 if t=='image':return '\n\n!['+n['attrs'].get('alt','')+']('+assets[n['attrs']['sourceChunkId']]+')\n\n'
 if t=='sourceCitation':return ' [PDF p. '+str(n['attrs'].get('pageNumber',''))+'](http://localhost:3344'+n['attrs']['fileUrl']+')'
 inner=''.join(md(c,depth+1)for c in n.get('content',[]))
 if t=='heading':return '#'*n['attrs']['level']+' '+inner+'\n\n'
 if t=='paragraph':return inner+'\n\n'
 if t=='listItem':return '- '+inner.strip()+'\n'
 if t in ['bulletList','orderedList']:return inner+'\n'
 return inner
for e in index['entries']:
 slug=e['key'].replace(':','--');d=json.loads((O/'website-entries'/f'{slug}.json').read_text());(O/'website-entries'/f'{slug}.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>'+html.escape(e['title'])+'</title><style>'+style+'</style><article>'+render(d)+'</article></html>');(O/'website-entries'/f'{slug}.md').write_text(md(d))
links=''.join('<li><a href="website-entries/'+e['key'].replace(':','--')+'.html">'+html.escape(e['title'])+'</a> — <a href="'+e['url']+'">open in app</a> · '+' · '.join('<a href="'+html.escape(u,quote=True)+'">original source</a>'for u in e['originalUrls'])+'</li>'for e in index['entries'])
(O/'portfolio-entries-index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>HumbleBeeAI website portfolio entries</title><style>'+style+'</style><h1>HumbleBeeAI website portfolio entries</h1><p>41 entries generated through the software using the Website portfolio entry template, with bullet points and source images. The saved entry content is unchanged pipeline output.</p><ol>'+links+'</ol></html>')
with open(O/'entry-source-map.csv','w',newline='')as f:
 w=csv.writer(f);w.writerow(['entry_key','title','template','document_id','source_id','original_url','PDF_evidence_pages','merge_basis'])
 for g in groups:
  e=next(e for e in index['entries']if e['key']==g['key'])
  for s in g['sources']:w.writerow([g['key'],e['title'],'portfolio',e['documentId'],s['source_id'],s['original_url'],s['evidence_pages'],g['mergeBasis']])
(O/'README.md').write_text(f'''# HumbleBeeAI website portfolio entries

Start here: {index['indexUrl']}

Project: {index['projectUrl']}

41 entries cover the 42 primary PDFs. Every entry now uses the software's Website portfolio entry template (`portfolio`), including products, papers and company context. The model was instructed to use bullet points and relevant supplied PDF images. Each current version is the unchanged GenerationService output; no review appendix, manual rewriting or injected figures were added afterward.

{model_note}

The LumioHub profile supports its platform case entry. Other case-study PDFs remain separate. Previous drafts are preserved in the reference project. Source, metric and figure review trackers remain separate supporting documents.

- portfolio-entries-index.md / .html / .json: direct links and entry list.
- website-entries/: exact generated TipTap JSON plus Markdown and HTML exports; assets/ contains the same PDF images shown in the app.
- entry-source-map.csv: every primary PDF's allocated entry.
- website-redo-verification.json: template, required sections, task/version provenance, selected PDFs, bullet and image checks.
- website-redo-http-verification.json: authenticated editor and image retrieval checks.
- source-review-tracker.*, metric-review-tracker.*, figure-review-tracker.*: evidence and feedback records separate from portfolio content.

No external sharing occurred. The bundle excludes local login credentials, environment files, operational logs and database backups.
''')
(O/'verification.md').write_text(f'''# Website portfolio regeneration verification

- {check['ready']}/41 entries use the Website portfolio entry template and its required headings.
- {model_note}
- Current versions match the software generation tasks' mutation identity and request hash; no manual post-generation content save was used.
- All 42 primary PDFs remain allocated to their source groups.
- Generated content contains {check['bulletLists']} bullet lists and {check['images']} source images.
- Every image and citation resolves to an authorized source selected for that entry.
- Authenticated HTTP checks passed for all {http['entryEditors']} entry editors and {http['imageAssets']} embedded source-image requests.
- HTML and Markdown exports preserve generated content; exact TipTap JSON is retained alongside them.
- Source-reported claims, publication approval and remote source-link availability remain covered by the separate trackers; no independent performance verification is claimed.
''')
(O/'app-gaps.md').write_text(f'''# Capstone app execution notes

The latest regeneration uses the same CreationService, Website portfolio entry template and GenerationService used by the website. All 41 entries use `portfolio`. The brief requests bullets and inline supplied images; no short-word target or editorial review appendix was added.

Entry index: {index['indexUrl']}

{model_note}

Current entry versions are unchanged pipeline outputs, verified against generation task identities. Earlier generated and manually reviewed entries are preserved in the reference project. Review trackers and company decisions remain separate.

Provider calls may time out or return malformed structured output; the application's durable task scheduler retries eligible failures. The console runner renews active leases. Source images are served through authenticated evidence routes; checked image bytes are included in the export assets.

PostgreSQL/pgvector, Redis and Mailpit remain persistent Docker services. Existing application code and templates were not changed for this regeneration.
''')
files=[]
for name in ['README.md','portfolio-entries-index.md','portfolio-entries-index.html','portfolio-entries-index.json','entry-source-map.csv','source-review-tracker.csv','source-review-tracker.json','source-review-tracker.md','metric-review-tracker.csv','metric-review-tracker.md','figure-review-tracker.csv','figure-review-tracker.md','review-decisions.md','app-gaps.md','verification.md','website-redo-verification.json','website-redo-http-verification.json','downloads-pdf-inventory.csv','docker-runbook.md']:
 if(O/name).is_file():files.append(O/name)
for folder in ['upload-pdfs','supplementary-pdfs']:files+=list((O/folder).rglob('*.pdf'))
files += [f for f in (O/'website-entries').glob('*')if f.is_file()]
files += sorted({O/'website-entries'/a['localFile']for a in http['images']})
files += sorted({O/r['preview_path'] for r in csv.DictReader(open(O/'figure-review-tracker.csv')) if r.get('preview_path') and(O/r['preview_path']).is_file()})
with zipfile.ZipFile(O.parent/'humblebee-week8-review.zip','w',zipfile.ZIP_DEFLATED)as z:
 for f in files:z.write(f,'humblebee-portfolio/'+str(f.relative_to(O)))
print('WEBSITE_EXPORT_READY',len(index['entries']),'entries;',check['bulletLists'],'bullet lists;',check['images'],'images;',len(files),'bundle files')
