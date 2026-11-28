import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
await page.goto(new URL('template.html', import.meta.url).href);
await page.emulateMedia({media:'print'});
await page.evaluate(() => document.fonts.ready);
await page.pdf({path:dir+'template.pdf',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
const geometry = await page.evaluate(() => {
 const round = x => Math.round(x*100)/100;
 return [...document.querySelectorAll('.page')].map(p=>{
 const pr=p.getBoundingClientRect();
 return {name:p.dataset.page,slots:[...p.querySelectorAll('[data-slot]')].map(e=>{
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);
 return {name:e.dataset.slot,box_pt:{x:round((r.x-pr.x)*.75),y:round((r.y-pr.y)*.75),w:round(r.width*.75),h:round(r.height*.75)},font:{family:s.fontFamily,size_pt:round(parseFloat(s.fontSize)*.75),weight:Number(s.fontWeight),line_height_pt:round(parseFloat(s.lineHeight)*.75),letter_spacing_pt:s.letterSpacing==='normal'?0:round(parseFloat(s.letterSpacing)*.75),color:s.color},max_lines:Number(e.dataset.maxLines)};
 })};});
});
const cssTokens=await page.evaluate(()=>Object.fromEntries([...document.styleSheets[0].cssRules].find(r=>r.selectorText===':root').style.cssText.split(';').filter(Boolean).map(v=>v.trim().split(/:\s*/))));
await writeFile(dir+'tokens.json',JSON.stringify({name:'Navy / Gold Portfolio',colors:Object.fromEntries(Object.entries(cssTokens).filter(([k,v])=>v.startsWith('#'))),fonts:{body:'Embedded Inter variable, opsz 14',display:'Embedded Inter variable, opsz 32',source:'@fontsource-variable/inter, inter-latin-standard-normal.woff2',weights:[400,600,700]},type_scale:Object.fromEntries(Object.entries(cssTokens).filter(([k])=>k.startsWith('--text-')||k.startsWith('--leading-'))),spacing:Object.fromEntries(Object.entries(cssTokens).filter(([k])=>k.startsWith('--space-'))),css_tokens:cssTokens,page_geometry:{mm:{w:210,h:297},pt:{w:595.2756,h:841.8898},reference_pt:{w:594.95996,h:841.91998},entry:{margin_left_pt:51,content_width_pt:493.5,figure_width_pt:221.25,figure_height_pt:309.75,column_gap_pt:12,rows_width_pt:260.25},cover:{navy_height_pt:666,footer_height_pt:175.8898}},pages:geometry},null,2)+'\n');
const issues=await page.evaluate(()=>[...document.querySelectorAll('[data-slot]')].filter(e=> e.scrollHeight>e.clientHeight+1 && getComputedStyle(e).display!=='inline').map(e=>e.dataset.slot));
console.log(JSON.stringify({pages:geometry.length,slots:geometry.map(p=>[p.name,p.slots.length]),overflow:issues}));
await browser.close();
