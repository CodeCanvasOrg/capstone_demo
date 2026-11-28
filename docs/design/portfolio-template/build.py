from pathlib import Path
import base64
p=Path(__file__).parent
font=base64.b64encode(Path('node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2').read_bytes()).decode()
css='''
:root {
 --navy:#14213d; --gold:#f2a900; --paper:#f6f4ee; --white:#ffffff;
 --light:#c9d0e0; --muted:#6b7280; --ink-secondary:#3a4560; --line:#e3e0d6;
 --green:#1f7a5a; --red:#b23a3a; --gold-dark:#8a6a10;
 --hex-outer:#be890e; --hex-middle:#81641e; --hex-inner:#594b29; --hex-fill:#c88f0b;
 --font:'Inter'; --text-footer:7pt; --text-small:7.5pt; --text-eyebrow:8.5pt;
 --text-row:8.8pt; --text-secondary:9pt; --text-meta:10pt; --text-body:11pt;
 --text-subtitle:13pt; --text-heading:24pt; --text-cover:38pt;
 --leading-footer:10pt; --leading-small:12pt; --leading-row:13.2pt; --leading-meta:13.5pt;
 --leading-body:16.5pt; --leading-subtitle:18.75pt; --leading-heading:29pt; --leading-cover:39.4pt;
 --space-0:0pt; --space-1:3pt; --space-2:6pt; --space-3:9pt; --space-4:12pt;
 --space-5:15pt; --space-6:18pt; --space-7:24pt; --space-8:30pt; --space-9:36pt;
 --page-width:210mm; --page-height:297mm; --margin:51pt; --content-width:493.5pt;
 --cover-left:56.68pt; --cover-top:260pt; --cover-title-top:278pt; --cover-subtitle-top:415pt;
 --cover-navy-height:666pt; --cover-meta-top:738.2pt; --cover-meta-width:155pt; --cover-meta-gap:15.08pt;
 --tag-top:57pt; --tag-width:20.25pt; --tag-height:13.5pt; --tag-gap:8.14pt;
 --heading-top:75.5pt; --rule-top:114pt; --rule-width:79.5pt; --rule-height:3pt;
 --intro-top:128pt; --body-top:207pt; --figure-width:221.25pt; --figure-height:309.75pt;
 --column-gap:12pt; --rows-width:260.25pt; --footer-top:819pt;
 --hairline:.75pt; --radius:3.5pt; --tracking-label:1.05pt; --tracking-eyebrow:1.53pt;
 --tracking-display:-1.25pt; --tracking-heading:-.75pt;
 --sources-top:207pt; --source-row-height:63pt; --source-number-width:24pt;
 --evidence-top:493pt; --callout-top:660pt;
}
*{box-sizing:border-box}html,body{margin:var(--space-0);padding:var(--space-0)}
body{font-family:var(--font),sans-serif;color:var(--navy);font-size:var(--text-body);font-optical-sizing:none;font-variation-settings:'opsz' 14}
@page{size:A4;margin:0}
.page{width:var(--page-width);height:var(--page-height);position:relative;overflow:hidden;background:var(--white);break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.page:last-child{break-after:auto}h1,h2,h3,p,figure{margin:var(--space-0)}
.cover{background:var(--navy)}.cover-band{position:absolute;inset:var(--cover-navy-height) var(--space-0) var(--space-0);background:var(--paper)}
.hexagons{position:absolute;inset:var(--space-0);width:100%;height:100%;pointer-events:none}
.eyebrow{position:absolute;left:var(--cover-left);top:var(--cover-top);color:var(--gold);font-size:var(--text-eyebrow);line-height:var(--leading-small);font-weight:600;letter-spacing:var(--tracking-eyebrow)}
.cover h1{position:absolute;left:var(--cover-left);top:var(--cover-title-top);font-size:var(--text-cover);line-height:var(--leading-cover);font-weight:700;letter-spacing:var(--tracking-display);color:var(--white);width:350pt;font-variation-settings:'opsz' 32}
.cover-subtitle{position:absolute;left:var(--cover-left);top:var(--cover-subtitle-top);width:390pt;font-size:var(--text-subtitle);line-height:var(--leading-subtitle);color:var(--light)}
.cover-rule{position:absolute;left:57pt;top:488.25pt;width:84.75pt;height:3.75pt;background:var(--gold)}
.meta{position:absolute;left:var(--cover-left);top:var(--cover-meta-top);display:grid;grid-template-columns:repeat(3,var(--cover-meta-width));gap:var(--cover-meta-gap)}
.meta-label{font-size:var(--text-small);line-height:var(--leading-small);letter-spacing:var(--tracking-label);font-weight:700;color:var(--gold-dark)}
.meta-value{font-size:var(--text-meta);line-height:var(--leading-meta);font-weight:600;margin-top:var(--space-1)}
.meta-secondary{font-size:var(--text-secondary);line-height:var(--leading-meta);color:var(--ink-secondary)}
.tag{position:absolute;left:var(--margin);top:var(--tag-top);height:var(--tag-height);display:flex;align-items:center;gap:var(--tag-gap);font-size:var(--text-small);font-weight:600;line-height:var(--leading-small)}
.tag-number{width:var(--tag-width);height:var(--tag-height);border-radius:var(--radius);background:var(--navy);color:var(--white);display:flex;align-items:center;justify-content:center}
.tag-label{color:var(--gold);letter-spacing:var(--tracking-label)}
.page-heading{position:absolute;left:var(--margin);top:var(--heading-top);width:var(--content-width);font-size:var(--text-heading);line-height:var(--leading-heading);font-weight:700;letter-spacing:var(--tracking-heading);font-variation-settings:'opsz' 32}
.rule{position:absolute;left:var(--margin);top:var(--rule-top);width:var(--rule-width);height:var(--rule-height);background:var(--gold)}
.intro{position:absolute;left:var(--margin);top:var(--intro-top);width:430pt;font-size:var(--text-body);line-height:var(--leading-body)}
.entry-body{position:absolute;left:var(--margin);top:var(--body-top);display:grid;grid-template-columns:var(--figure-width) var(--rows-width);gap:var(--column-gap)}
.figure{width:var(--figure-width);height:var(--figure-height);border:var(--hairline) solid var(--line);border-radius:var(--radius);overflow:hidden}.figure svg{display:block;width:100%;height:100%}
.row{border-bottom:var(--hairline) solid var(--line);padding:var(--space-2) var(--space-0) var(--space-3);font-size:var(--text-row);line-height:var(--leading-row)}
.row:first-child{padding-top:var(--space-2)}.row:nth-child(1){height:52.5pt}.row:nth-child(2){height:51.75pt}.row:nth-child(3){height:66pt}.row:nth-child(4){height:39pt}.row:nth-child(5){height:52.5pt}.row:nth-child(6){height:51.75pt}.row:nth-child(7){height:39.75pt}.row:nth-child(8){height:52.5pt}.row-label{font-weight:700;line-height:var(--leading-row)}.row-body{font-weight:600;line-height:var(--leading-row);color:var(--green)}
.row-body .constraint{color:var(--red)}sup{font-size:var(--text-footer);line-height:var(--space-0);vertical-align:super;color:var(--gold-dark)}
.footer{position:absolute;left:var(--margin);top:var(--footer-top);width:var(--content-width);display:flex;justify-content:space-between;font-size:var(--text-footer);line-height:var(--leading-footer);color:var(--muted)}
.references{position:absolute;left:var(--margin);top:var(--sources-top);width:var(--content-width)}
.source{display:grid;grid-template-columns:var(--source-number-width) 1fr;gap:var(--space-2);min-height:var(--source-row-height);border-bottom:var(--hairline) solid var(--line);padding:var(--space-3) var(--space-0)}
.source-number{font-size:var(--text-small);color:var(--gold-dark);font-weight:700;padding-top:var(--space-1)}
.source-name{font-size:var(--text-meta);line-height:var(--leading-meta);font-weight:700}.source-locator{font-size:var(--text-small);line-height:var(--leading-small);color:var(--gold-dark);margin-top:var(--space-1)}.source-note{font-size:var(--text-secondary);line-height:var(--leading-meta);color:var(--ink-secondary);margin-top:var(--space-1)}
.evidence{position:absolute;left:var(--margin);top:var(--evidence-top);width:var(--content-width)}.evidence h3{font-size:var(--text-subtitle);line-height:var(--leading-subtitle);margin-bottom:var(--space-3)}
table{width:100%;border-collapse:collapse;font-size:var(--text-row);line-height:var(--leading-row);text-align:left}th{color:var(--gold-dark);font-size:var(--text-small);font-weight:600;border-bottom:var(--hairline) solid var(--navy);padding:var(--space-2) var(--space-3) var(--space-2) var(--space-0)}td{border-bottom:var(--hairline) solid var(--line);padding:var(--space-3) var(--space-3) var(--space-3) var(--space-0)}td:last-child{color:var(--green)}
.callout{position:absolute;left:var(--margin);top:var(--callout-top);width:var(--content-width);background:var(--paper);border-left:var(--rule-height) solid var(--gold);padding:var(--space-4);font-size:var(--text-secondary);line-height:var(--leading-meta)}.callout strong{display:block;margin-bottom:var(--space-1)}
'''
def slot(name,text,tag='span',cls='',lines=1):return f'<{tag} class="{cls}" data-slot="{name}" data-max-lines="{lines}">{text}</{tag}>'
def head(kind,num,label,title,intro):return f'<div class="tag">{slot(kind+".section_number",num,cls="tag-number")}{slot(kind+".section_label",label,cls="tag-label")}</div>'+slot(kind+'.title',title,'h2','page-heading')+'<div class="rule"></div>'+slot(kind+'.intro',intro,'p','intro',4)
def footer(kind,n):return '<footer class="footer">'+slot(kind+'.doc_title','Selected work · Research and product design')+slot(kind+'.page_counter',n+' / 3')+'</footer>'
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 221.25 309.75" role="img" aria-label="Four sample project document thumbnails">'
for i in range(4):
 x=3+(i%2)*110;y=3+(i//2)*153
 svg+=f'<rect x="{x}" y="{y}" width="105" height="150" fill="var(--white)" stroke="var(--line)" stroke-width=".5"/>'
 svg+=f'<rect x="{x+9}" y="{y+12}" width="86" height="1" fill="var(--gold)"/>'
 if i==2:
  svg+=f'<rect x="{x+12}" y="{y+26}" width="78" height="42" rx="2" fill="var(--paper)"/>'
  for j,h in enumerate([14,23,18,32]):svg+=f'<rect x="{x+22+j*15}" y="{y+62-h}" width="8" height="{h}" fill="var(--gold)"/>'
  start=82
 else:start=35
 for j in range(2):svg+=f'<rect x="{x+9}" y="{y+18+j*5}" width="{78-j*16}" height="2.3" fill="var(--navy)"/>'
 for j in range(20 if i!=2 else 13):
  yy=y+start+j*4.8
  svg+=f'<rect x="{x+9}" y="{yy}" width="{86-(j%5)*4}" height="{1 if j%7 else 1.8}" fill="var(--ink-secondary)" opacity="{.4 if j%7 else .8}"/>'
svg+='</svg>'
hexsvg='''<svg class="hexagons" viewBox="0 0 595.276 841.89" aria-hidden="true"><g fill="none" stroke-width="1.6866"><path stroke="var(--hex-outer)" d="M467.443 -36.561 633.694 59.816 633.694 252.571 467.443 348.948 301.192 252.571 301.192 59.816Z"/><path stroke="var(--hex-middle)" d="M467.443 11.627 592.734 83.910 592.734 228.476 467.443 300.759 342.153 228.476 342.153 83.910Z"/><path stroke="var(--hex-inner)" d="M467.443 59.816 550.569 108.005 550.569 204.382 467.443 252.571 384.318 204.382 384.318 108.005Z"/></g><path fill="var(--hex-fill)" d="M467.443 108.005 509.608 132.099 509.608 180.288 467.443 204.382 425.278 180.288 425.278 132.099Z"/></svg>'''
cover='<section class="page cover" data-page="cover">'+hexsvg+'<div class="cover-band"></div>'+slot('cover.eyebrow','SELECTED PROJECT PORTFOLIO','p','eyebrow')+slot('cover.title','Designing the<br>next chapter of<br>public services','h1','',3)+slot('cover.subtitle','Research, prototypes and practical outcomes: a collection<br>of work that makes everyday services clearer, faster<br>and easier for the people who use them.','p','cover-subtitle',3)+'<div class="cover-rule"></div><div class="meta">'
for i,vals in enumerate([('PROJECT','Service design and<br>digital delivery','Independent project portfolio'),('PREPARED BY','Alex Morgan','Product designer & researcher'),('DATE','26 November 2026','Selected work, 2025–2026')],1):
 cover+='<div>'+slot(f'cover.meta.{i}.label',vals[0],'p','meta-label')+slot(f'cover.meta.{i}.value',vals[1],'p','meta-value',2)+slot(f'cover.meta.{i}.secondary',vals[2],'p','meta-secondary',2)+'</div>'
cover+='</div></section>'
intro='A clearer path from request to resolution for a community service team.<br>Research connected staff interviews with real service records, then turned<br>those findings into a focused intake and triage prototype. The evidence<br>and project decisions are recorded on the following page.'
entry='<section class="page entry" data-page="entry">'+head('entry','01','SERVICE DESIGN','Entry 01: a clearer path to support',intro)+'<div class="entry-body"><figure class="figure" data-slot="entry.figure" data-max-lines="0">'+svg+'</figure><div class="rows">'
rows=[('Context','A local service team handled requests across email and shared spreadsheets. Follow-up was difficult to track.<sup data-slot="entry.rows.1.citation" data-max-lines="1">1</sup>'),('Research','Six staff interviews and a review of 40 anonymised records identified repeated handoffs and missing details.<sup data-slot="entry.rows.2.citation" data-max-lines="1">1</sup>'),('Challenge','<span class="constraint">Incomplete intake led to repeat contact.</span> The design needed to clarify the next action without adding work for staff.'),('Approach','Map the journey, simplify intake and test the triage flow.'),('Solution','A guided request form, shared queue and visible status history gave the team one place to review each case.<sup data-slot="entry.rows.5.citation" data-max-lines="1">2</sup>'),('Evaluation','Four of five participants completed the prototype task without assistance in a moderated session.<sup data-slot="entry.rows.6.citation" data-max-lines="1">3</sup>'),('Evidence','Prototype findings; production impact unmeasured.<sup data-slot="entry.rows.7.citation" data-max-lines="1">3</sup>'),('Next steps','Validate accessibility with service users, then measure repeat contact during a limited pilot.<sup data-slot="entry.rows.8.citation" data-max-lines="1">4</sup>')]
for i,(label,body) in enumerate(rows,1):entry+='<div class="row">'+slot(f'entry.rows.{i}.label',label,'h3','row-label')+slot(f'entry.rows.{i}.body',body,'p','row-body',[2,2,3,1,2,2,1,2][i-1])+'</div>'
entry+='</div></div>'+footer('entry','2')+'</section>'
sources='<section class="page sources" data-page="sources">'+head('sources','01','SOURCES & REFERENCES','Evidence behind the entry','Supporting material for “A clearer path to support”. Superscript numbers<br>in the entry point to the documents below. Locators identify the exact<br>pages or chunks used to support each statement.')+'<div class="references">'
refs=[('Discovery research summary','Pages 3–7 · chunks R01–R06','Interview themes, current journey and anonymised record review.'),('Service intake prototype','Pages 2–5 · frames P01–P08','Guided intake, shared queue and status history in the tested flow.'),('Moderated usability study','Pages 4–6 · sessions T01–T05','Task outcomes for five participants; formative findings and limitations.'),('Pilot and accessibility plan','Pages 1–2 · actions A01–A04','Proposed checks and measurement plan; no pilot outcomes claimed.')]
for i,(name,loc,note) in enumerate(refs,1):sources+='<article class="source">'+slot(f'sources.references.{i}.number',str(i),'sup','source-number')+'<div>'+slot(f'sources.references.{i}.document',name,'h3','source-name')+slot(f'sources.references.{i}.locator',loc,'p','source-locator')+slot(f'sources.references.{i}.note',note,'p','source-note')+'</div></article>'
sources+='</div><div class="evidence">'+slot('sources.evidence.title','Evidence at a glance','h3')+'<table><thead><tr>'
for i,s in enumerate(['Claim','Source / locator','Evidence type'],1):sources+=slot(f'sources.evidence.headers.{i}',s,'th')
sources+='</tr></thead><tbody>'
for i,cells in enumerate([('Repeated handoffs','1 · pp. 3–7 / R01–R06','Research finding'),('4 of 5 completed the task','3 · pp. 4–6 / T01–T05','Prototype observation'),('Reduced repeat contact','4 · pp. 1–2 / A01–A04','Pilot objective')],1):
 sources+='<tr>'+''.join(slot(f'sources.evidence.rows.{i}.{j}',s,'td') for j,s in enumerate(cells,1))+'</tr>'
sources+='</tbody></table></div><aside class="callout">'+slot('sources.note.title','Reading the evidence','strong')+slot('sources.note.body','All documents and outcomes in this sample are illustrative. In a published portfolio, include only traceable sources, preserve locator IDs and distinguish observations from future targets.','p','',3)+'</aside>'+footer('sources','3')+'</section>'
import re
root,rest=css.split('}',1)
extra={}
def measure(m):
 value=m.group(0)
 if value not in extra:extra[value]='--measure-'+str(len(extra)+1)
 return 'var('+extra[value]+')'
rest=re.sub(r'(?<![\w-])-?\d*\.?\d+pt',measure,rest)
css=root+'\n'+''.join(f' {name}:{value};\n' for value,name in extra.items())+'}'+rest
html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Selected work — portfolio template</title><style>'+css+'\n@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,'+font+') format("woff2")}\n</style></head><body>'+cover+entry+sources+'</body></html>'
(p/'template.html').write_text(html)
