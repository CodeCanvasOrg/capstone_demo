"""Fallback geometry proof. Chromium rendering is preferred; see README."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,os
import pymupdf as f
P=Path(__file__).parent
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.slots={}
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='br':
   for x in self.stack:
    if x:x['text']+='\n'
   return
  if tag in ['meta','path','rect']:return
  v={'name':a['data-slot'],'text':'','max_lines':int(a.get('data-max-lines','1'))} if 'data-slot' in a else None
  self.stack.append(v)
  if v:self.slots[v['name']]=v
 def handle_endtag(self,tag):
  if tag not in ['meta','br','path','rect'] and self.stack:self.stack.pop()
 def handle_data(self,t):
  for x in self.stack:
   if x:x['text']+=t
h=Parser();h.feed((P/'template.html').read_text());S=h.slots
W,H=210*72/25.4,297*72/25.4
def c(s):return tuple(int(s[i:i+2],16)/255 for i in (1,3,5))
css=(P/'template.html').read_text().split(':root {')[1].split('}')[0]
tokens=dict(re.findall(r'(--[\w-]+):([^;]+)',css));colors={k:v.strip() for k,v in tokens.items() if v.strip().startswith('#')}
N=c(colors['--navy']);G=c(colors['--gold']);L=c(colors['--line']);D=c(colors['--ink-secondary']);M=c(colors['--muted']);GREEN=c(colors['--green']);PAPER=c(colors['--paper'])
fonts={}
for name,w,o in [('regular',400,14),('semi',600,14),('bold',700,14),('display',700,32)]:fonts[name]=f.Font(fontfile=str(P/f'Inter-{w}-{o}.ttf'))
pdf=f.open();pages=[]
def rect(x,y,w,h,fill,stroke=None,width=.75):page.draw_rect(f.Rect(x,y,x+w,y+h),color=stroke,fill=fill,width=width)
def line(x,y,w,color=L):rect(x,y,w,.75,color)
def txt(text,x,y,size=11,font='regular',color=N,leading=None,tracking=0,width=1000):
 leading=leading or size*1.5
 out=[]
 for para in text.split('\n'):
  words=para.split(' ');current=''
  for word in words:
   cand=(current+' '+word).strip()
   length=fonts[font].text_length(cand,fontsize=size)+max(0,len(cand)-1)*tracking
   if current and length>width:out.append(current);current=word
   else:current=cand
  out.append(current)
 for j,t in enumerate(out):
  baseline=y+size*.97+j*leading
  if tracking:
   xx=x
   for ch in t:
    page.insert_text((xx,baseline),ch,fontname=font,fontsize=size,color=color)
    xx+=fonts[font].text_length(ch,fontsize=size)+tracking
  else:page.insert_text((x,baseline),t,fontname=font,fontsize=size,color=color)
 return len(out)*leading

def slot(name,x,y,w,size=11,font='regular',color=N,leading=None,tracking=0,height=None):
 s=S[name];ht=txt(s['text'],x,y,size,font,color,leading,tracking,w)
 geo['slots'].append({'name':name,'box_pt':{'x':x,'y':y,'w':w,'h':height or ht},'font':{'family':'Inter','size_pt':size,'weight':{'regular':400,'semi':600,'bold':700,'display':700}[font],'optical_size':32 if font=='display' else 14,'line_height_pt':leading or size*1.5,'letter_spacing_pt':tracking,'color':'#'+''.join(f'{round(v*255):02x}' for v in color)},'max_lines':s['max_lines']})
 return ht

def start(kind):
 global page,geo
 page=pdf.new_page(width=W,height=H)
 for k,ff in fonts.items():page.insert_font(fontname=k,fontbuffer=ff.buffer)
 geo={'name':kind,'slots':[]};pages.append(geo)
def heading(kind):
 page.draw_rect(f.Rect(51,57,71.25,70.5),radius=.22,color=None,fill=N)
 slot(kind+'.section_number',55.9,58.8,12,7.5,'semi',(1,1,1),12)
 slot(kind+'.section_label',79.39,58.8,400,7.5,'semi',G,12,1.05)
 slot(kind+'.title',51,75.5,493.5,24,'display',N,29,-.75)
 rect(51,114,79.5,3,G)
 slot(kind+'.intro',51,128,430,11,'regular',N,16.5)
def footer(kind):
 slot(kind+'.doc_title',51,819,450,7,'regular',M,10)
 s=S[kind+'.page_counter']['text'];w=fonts['regular'].text_length(s,fontsize=7)
 slot(kind+'.page_counter',544.5-w,819,w,7,'regular',M,10)
start('cover');rect(0,0,W,H,N);rect(0,666,W,H-666,PAPER)
for pts,col in [([(467.443,-36.561),(633.694,59.816),(633.694,252.571),(467.443,348.948),(301.192,252.571),(301.192,59.816)],'--hex-outer'), ([(467.443,11.627),(592.734,83.910),(592.734,228.476),(467.443,300.759),(342.153,228.476),(342.153,83.910)],'--hex-middle'), ([(467.443,59.816),(550.569,108.005),(550.569,204.382),(467.443,252.571),(384.318,204.382),(384.318,108.005)],'--hex-inner')]:
 sh=page.new_shape();sh.draw_polyline(pts+[pts[0]]);sh.finish(color=c(colors[col]),width=1.6866);sh.commit()
sh=page.new_shape();sh.draw_polyline([(467.443,108.005),(509.608,132.099),(509.608,180.288),(467.443,204.382),(425.278,180.288),(425.278,132.099)]);sh.finish(fill=c(colors['--hex-fill']),color=None,closePath=True);sh.commit()
slot('cover.eyebrow',56.68,260,400,8.5,'semi',G,12,1.53)
slot('cover.title',56.68,278,350,38,'display',(1,1,1),39.4,-1.25)
slot('cover.subtitle',56.68,415,390,13,'regular',c(colors['--light']),18.75)
rect(57,488.25,84.75,3.75,G)
for i in range(1,4):
 x=56.68+(i-1)*170.08
 slot(f'cover.meta.{i}.label',x,738.2,155,7.5,'bold',c(colors['--gold-dark']),12,1.05)
 ht=slot(f'cover.meta.{i}.value',x,753.2,155,10,'semi',N,13.5)
 slot(f'cover.meta.{i}.secondary',x,753.2+ht,155,9,'regular',D,13.5)
start('entry');heading('entry')
# Four diagrammatic page thumbnails; original reference thumbnail content is intentionally replaced.
page.draw_rect(f.Rect(51.375,207.375,271.875,516.375),color=L,width=.75,radius=.012)
for i in range(4):
 x=54+(i%2)*110;y=210+(i//2)*153
 rect(x,y,105,150,(1,1,1),L,.5);rect(x+9,y+12,86,1,G)
 for j in range(2):rect(x+9,y+18+j*5,78-j*16,2.3,N)
 if i==2:
  rect(x+12,y+26,78,42,PAPER)
  for j,ht in enumerate([14,23,18,32]):rect(x+22+j*15,y+62-ht,8,ht,G)
 starty=82 if i==2 else 35
 for j in range(13 if i==2 else 20):rect(x+9,y+starty+j*4.8,86-(j%5)*4,1 if j%7 else 1.8,tuple(v*.4+.6 for v in D))
geo['slots'].append({'name':'entry.figure','box_pt':{'x':51,'y':207,'w':221.25,'h':309.75},'font':None,'max_lines':0})
y=207
row_heights=[52.5,51.75,66,39,52.5,51.75,39.75,52.5]
for i in range(1,9):
 row_start=y
 y+=6;slot(f'entry.rows.{i}.label',284.25,y,260.25,8.8,'bold',N,13.2);y+=13.2
 body=S[f'entry.rows.{i}.body']['text'];cit=f'entry.rows.{i}.citation'
 if cit in S: S[f'entry.rows.{i}.body']['text']=body[:-1]
 ht=slot(f'entry.rows.{i}.body',284.25,y,260.25,8.8,'semi',GREEN,13.2)
 if i==3:txt('Incomplete intake led to repeat contact.',284.25,y,8.8,'semi',c(colors['--red']),13.2,width=260.25)
 if cit in S:
  # Citation follows the final text line; width and superscript baseline remain explicit.
  words=S[f'entry.rows.{i}.body']['text'].split();last=''
  for word in words:
   cand=(last+' '+word).strip()
   if fonts['semi'].text_length(cand,fontsize=8.8)>260.25:last=word
   else:last=cand
  xx=284.25+fonts['semi'].text_length(last,fontsize=8.8)+1
  slot(cit,xx,y+ht-13.2-2,8,7,'semi',c(colors['--gold-dark']),7)
 y=row_start+row_heights[i-1]-.75;line(284.25,y,260.25);y+=.75
footer('entry')
start('sources');heading('sources');y=207
for i in range(1,5):
 slot(f'sources.references.{i}.number',51,y+12,24,7.5,'bold',c(colors['--gold-dark']),12)
 slot(f'sources.references.{i}.document',81,y+9,463.5,10,'bold',N,13.5)
 slot(f'sources.references.{i}.locator',81,y+25.5,463.5,7.5,'regular',c(colors['--gold-dark']),12)
 slot(f'sources.references.{i}.note',81,y+40.5,463.5,9,'regular',D,13.5)
 line(51,y+62.25,493.5);y+=63
slot('sources.evidence.title',51,493,493.5,13,'bold',N,18.75)
xs=[51,238,412];ws=[187,174,132.5]
for j in range(1,4):slot(f'sources.evidence.headers.{j}',xs[j-1],526.75,ws[j-1],7.5,'semi',c(colors['--gold-dark']),13.2)
line(51,546,493.5,N)
for i in range(1,4):
 for j in range(1,4):slot(f'sources.evidence.rows.{i}.{j}',xs[j-1],555+(i-1)*31.95,ws[j-1]-9,8.8,'regular',GREEN if j==3 else N,13.2)
 line(51,577.95+(i-1)*31.95,493.5)
rect(51,660,493.5,67.5,PAPER);rect(51,660,3,67.5,G)
slot('sources.note.title',66,672,466.5,9,'bold',N,13.5)
slot('sources.note.body',66,688.5,466.5,9,'regular',N,13.5)
footer('sources')
pdf.set_metadata({'title':'Selected work — portfolio template','author':'Portfolio design template','subject':'Geometry proof; fallback renderer, see README'})
pdf.subset_fonts();pdf.save(P/'template.pdf',garbage=4,deflate=True)
allnames={s['name'] for pg in pages for s in pg['slots']};missing=set(S)-allnames
assert not missing,missing
out={'name':'Navy / Gold Portfolio','renderer':'PyMuPDF fallback geometry proof; Playwright source supplied but sandbox launch blocked','colors':colors,'fonts':{'family':'Inter','source':'@fontsource-variable/inter, inter-latin-standard-normal.woff2','body_optical_size':14,'display_optical_size':32,'weights':[400,600,700]},'type_scale':{k:v.strip() for k,v in tokens.items() if k.startswith('--text-') or k.startswith('--leading-')},'spacing':{k:v.strip() for k,v in tokens.items() if k.startswith('--space-')},'css_tokens':{k:v.strip() for k,v in tokens.items()},'page_geometry':{'mm':{'w':210,'h':297},'pt':{'w':W,'h':H},'reference_pt':{'w':594.95996,'h':841.91998},'cover':{'navy_height_pt':666,'navy_height_mm':666*25.4/72},'entry':{'left_margin_pt':51,'left_margin_mm':51*25.4/72,'figure_width_pt':221.25,'figure_height_pt':309.75,'column_gap_pt':12,'row_width_pt':260.25}},'pages':pages}
(P/'tokens.json').write_text(json.dumps(out,indent=2)+'\n')
print('PDF pages:',len(pdf),'entry rows end:',612,'slots:',len(allnames))
