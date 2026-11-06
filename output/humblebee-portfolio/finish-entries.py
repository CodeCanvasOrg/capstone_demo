from pathlib import Path
import json,html,zipfile,re,csv
O=Path(__file__).resolve().parent
state=json.loads((O/'pipeline-state.json').read_text()); index=json.loads((O/'portfolio-entries-index.json').read_text()); checks=json.loads((O/'entries-verification.json').read_text()); http=json.loads((O/'entries-http-verification.json').read_text())
assert checks['passed'] and http['entriesChecked']==41
project=index['projectUrl']; start=index['indexUrl']
style='body{max-width:920px;margin:48px auto;padding:0 24px;font:17px/1.65 system-ui;color:#18222a}h1,h2,h3{line-height:1.25}h1{font-size:2.25rem}h2{margin-top:2em}a{color:#075d78}aside{padding:16px;background:#fff5cf}small{font-size:.8rem;color:#59626c}@media print{body{margin:12mm;font-size:11pt}a{color:inherit}}'
def render(n):
 t=n.get('type'); children=''.join(render(c) for c in n.get('content',[]))
 if t=='text':
  val=html.escape(n.get('text',''))
  for m in n.get('marks',[]):
   if m['type']=='link':val='<a href="'+html.escape(m['attrs']['href'],quote=True)+'">'+val+'</a>'
   elif m['type']=='bold':val='<strong>'+val+'</strong>'
   elif m['type']=='italic':val='<em>'+val+'</em>'
  return val
 if t=='sourceCitation':return '<small> [PDF p. '+html.escape(str(n.get('attrs',{}).get('pageNumber','source')))+']</small>'
 tags={'paragraph':'p','bulletList':'ul','orderedList':'ol','listItem':'li','blockquote':'blockquote','codeBlock':'pre'}
 if t=='heading':tag='h'+str(n['attrs']['level']);return '<'+tag+'>'+children+'</'+tag+'>'
 if t=='hardBreak':return '<br>'
 if t in tags:return '<'+tags[t]+'>'+children+'</'+tags[t]+'>'
 return children
for e in index['entries']:
 slug=e['key'].replace(':','--'); data=json.loads((O/'entries'/f'{slug}.reviewed.json').read_text())
 (O/'entries'/f'{slug}.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>'+html.escape(e['title'])+'</title><style>'+style+'</style><aside>Review draft — company approval pending. <a href="'+html.escape(e['url'])+'">Open editable app entry</a></aside>'+render(data)+'</html>')
links=''.join('<li><a href="entries/'+e['key'].replace(':','--')+'.html">'+html.escape(e['title'])+'</a> — '+e['templateId']+' template; <a href="'+e['url']+'">open in app</a></li>' for e in index['entries'])
(O/'portfolio-entries-index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>HumbleBeeAI individual portfolio entries</title><style>'+style+'</style><h1>HumbleBeeAI portfolio entries</h1><p>41 individual template-based drafts represent 42 primary PDFs. The LumioHub profile supports its platform case entry. Distinct case studies stay separate. Papers remain standalone because no case implementation relationship is established in the supplied sources.</p><p><a href="'+start+'">Open app index</a></p><ol>'+links+'</ol></html>')
(O/'README.md').write_text(f'''# HumbleBeeAI — individual portfolio entries

Start here: {start}

Project: {project}

41 separate template-based portfolio drafts represent all 42 primary PDFs:

- 25 case studies using Website portfolio entry.
- 7 standalone product profiles using Product vision. The eighth profile, LumioHub, supports the explicitly named LumioHub platform case.
- 7 research papers using Technical portfolio entry. No case-paper implementation relationships were established, so papers remain standalone.
- 2 company updates using Website portfolio entry, labeled as company context in the index.

Each case-study PDF retains a separate case entry. Related subject matter, shared client names and bibliography references alone do not merge entries. The entry-source map records the source allocation and merge basis.

## Deliverables

- portfolio-entries-index.md / .html / .json: every entry, native app link and source mapping.
- entries/: separate editable app exports in Markdown, HTML and reviewed TipTap JSON.
- entry-source-map.csv: 42 source-to-entry rows with original URL, PDF evidence pages and grouping basis.
- source-review-tracker.csv / .json / .md: one review row per primary source.
- metric-review-tracker.csv / .md: 67 claim-level records with baselines, test conditions, pages and gaps.
- figure-review-tracker.csv / .md: sources, pages, captions and recommendations; publication approval pending.
- review-decisions.md: company decisions and an unsent meeting handoff message.
- app-gaps.md: execution findings, separate from editorial feedback.
- upload-pdfs/: all 42 primary PDFs. supplementary-pdfs/: five additional relevant Downloads PDFs.
- entries-verification.json / entries-http-verification.json: saved-document, source-lineage and authenticated-route checks.

The superseded combined draft and seven capability working sections are preserved in a separate reference project. They are not the requested individual entries.

Sources describe reported results and published statuses, with unresolved evidence gaps retained. Remote link availability and independent performance validation were not checked. No external sharing occurred. Credentials and database backups are excluded from the shareable ZIP.
''')
(O/'app-gaps.md').write_text(f'''# Capstone app execution notes and gaps

## Individual template-based entries

- Project: humblebee portflio — {project}
- Entry index: {start}
- 41 separate entries cover 42 primary PDFs. LumioHub's product profile supports the explicitly named platform case; all 25 case-study PDFs retain separate entries.
- Templates were selected through CreationService: 27 Website portfolio entries (25 cases and two updates), seven Product vision entries and seven Technical portfolio entries.
- Each entry was generated through GenerationService with immutable selected-source pins and a renewed durable task lease. Normal VersionService saved source-reviewed versions, preserving generated history.
- Each final entry retains original source URLs, native PDF citations, reported results and evidence gaps. No figures are embedded pending approval.
- The previous combined draft and seven working sections are preserved in a separate reference project.
- All 52 uploads (42 primary PDFs, five supplementary PDFs and five editorial files) remain in private storage. Primary PDF processing is reused; source files are not duplicated for each entry.

## Operational findings

- Some provider calls timed out or returned malformed structured output. The running application task scheduler retried failed calls; saved versions were reconciled from the database and the failure logs are retained.
- One Qatar image read failed transiently. A direct storage check found its derived assets present; no source evidence was replaced.
- Retrieval is scoped per entry and selects at most 20 chunks. Related subject matter does not establish a source relationship.
- The original broad combined generation missed some research/update coverage; individual scoped drafts and complete-source checks correct the output structure.
- Console runners explicitly load queue jobs and renew task leases.
- The development HMR watcher reported EMFILE; authenticated HTTP checks passed. No browser layout proof is claimed.
- The old local DB volume was absent. PostgreSQL/pgvector, Redis and Mailpit were reactivated as persistent isolated services; previous database records were not recovered.
- The installed Postman CLI does not support the skill's suggested `postman status` command. Existing authenticated HTTP checks provide the recorded endpoint evidence.

## Editorial feedback

Publication approval, preferred flagships, client naming, metric methodology, figure permissions and product statuses remain company decisions in review-decisions.md. No external message has been sent.
''')
(O/'verification.md').write_text(f'''# Individual portfolio entry verification

- 41/41 separate entries have current reviewed versions and successful generation status.
- All 42 primary PDFs are selected by and cited from their allocated entries, with original URLs present.
- Actual selected templates: {json.dumps(checks['templates'])}.
- Every required template section is retained in its corresponding generated document.
- No citation resolves to another entry's unselected source, and no unapproved image is embedded.
- Authenticated project and index routes returned HTTP 200. All 41 entry editors and 41 native evidence endpoints returned HTTP 200; editor responses contain the reviewed versions.
- Source review tracker: 42 records. Metric tracker: 67 claim-level records. Figure candidates and approval decisions remain separate.
- Numeric checks compare generated numeric tokens to the attached PDF text and reviewed source records; semantic qualifications remain explicit in each source review.
- Current remote availability, browser layout, independent result validation and publication approval remain outside this verification.
''')
# Keep the client bundle explicit: no local credentials, environment, logs, scripts, or database dumps.
files=[]
for name in ['README.md','portfolio-entries-index.md','portfolio-entries-index.html','portfolio-entries-index.json','entry-source-map.csv','source-review-tracker.csv','source-review-tracker.json','source-review-tracker.md','metric-review-tracker.csv','metric-review-tracker.md','figure-review-tracker.csv','figure-review-tracker.md','review-decisions.md','app-gaps.md','verification.md','entries-verification.json','entries-http-verification.json','downloads-pdf-inventory.csv','docker-runbook.md']:
 if (O/name).is_file():files.append(O/name)
for folder in ['upload-pdfs','supplementary-pdfs']:
 files += list((O/folder).rglob('*.pdf'))
for ext in ['*.md','*.html']:
 files += list((O/'entries').glob(ext))
figs=list((O/'figure-previews').glob('*.jpg'));files+=figs
files += sorted({O/r['preview_path'] for r in csv.DictReader(open(O/'figure-review-tracker.csv')) if r.get('preview_path') and (O/r['preview_path']).is_file()})
with zipfile.ZipFile(O.parent/'humblebee-week8-review.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in files:z.write(f,'humblebee-portfolio/'+str(f.relative_to(O)))
print('HANDOFF_READY',len(index['entries']),'entries;',len(files),'bundle files')
