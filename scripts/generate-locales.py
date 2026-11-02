# Static catalog generation only; never called by the website.
import concurrent.futures,json,os,re,time,urllib.parse,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
os.chdir(root)
en=json.load(open('src/locales/en.json'))
langs=['ar','hy','zh','nl','fr','de','kl','he','hi','it','ja','ko','fa','pl','pt','ru','es','tr','uk']
batches=[]; batch=[]; n=0
for s in en:
 if n+len(s)>3200 and batch: batches.append(batch);batch=[];n=0
 batch.append(s);n+=len(s)+12
if batch:batches.append(batch)
print('messages',len(en),'batches',len(batches),'languages',len(langs),flush=True)
def translate(lang, strings):
 q='\n'.join(re.sub(r'__VAR_(\d+)__',lambda m: ' '+str(987650000+int(m[1]))+' ',s) for i,s in enumerate(strings))
 url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'dict-chrome-ex','sl':'en','tl':lang,'dt':'t','q':q})
 for attempt in range(5):
  try:
   data=json.loads(subprocess.check_output(['curl','-fsSL','--max-time','45',url],stderr=subprocess.DEVNULL))
   text=''.join(row[0] or '' for row in data[0]); lines=text.strip().split('\n')
   if len(lines)!=len(strings):
    if len(strings)>1:
     mid=len(strings)//2; return translate(lang,strings[:mid])|translate(lang,strings[mid:])
    lines=[text]
   out={}
   for source,target in zip(strings,lines):
    target=re.sub(r'^\s*\[\s*\d+\s*\]\s*','',target).strip()
    target=re.sub(r'98765000(\d)',r'__VAR_\1__',target)
    if sorted(re.findall(r'__VAR_\d+__',target))!=sorted(re.findall(r'__VAR_\d+__',source)):
     # Some engines insert spaces inside placeholder tokens.
     target=re.sub(r'__\s*VAR\s*_\s*(\d+)\s*__',r'__VAR_\1__',target,flags=re.I)
     if sorted(re.findall(r'__VAR_\d+__',target))!=sorted(re.findall(r'__VAR_\d+__',source)):
      print('PLACEHOLDER',lang,source,flush=True)
      continue
    if not target:
     print('EMPTY',lang,source,flush=True)
     continue
    out[source]=target
   return out
  except Exception as e:
   if attempt==4: raise
   time.sleep(1+attempt*2)
results={lang:json.load(open('src/locales/'+lang+'.json')) if os.path.exists('src/locales/'+lang+'.json') else {} for lang in langs}
jobs=[]
for l in langs:
 b=[];n=0
 for item in en:
  if item in results[l]: continue
  if n+len(item)>3200 and b: jobs.append((l,b));b=[];n=0
  b.append(item);n+=len(item)+12
 if b:jobs.append((l,b))
def run(job):
 l,b=job
 try:return l,translate(l,b),None
 except Exception as e:return l,{},str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,future in enumerate(concurrent.futures.as_completed([pool.submit(run,j) for j in jobs])):
  l,d,e=future.result()
  results[l].update(d)
  json.dump(results[l],open('src/locales/'+l+'.json','w'),ensure_ascii=False,indent=2)
  if e: print('ERROR',l,e,flush=True)
  if i%10==0:print(i+1,'/',len(jobs),l,len(results[l]),flush=True)
print('coverage', {l:len(results[l]) for l in langs},flush=True)

for lang in langs:
 for source in en:
  if results[lang].get(source) or '__VAR_' not in source: continue
  pieces=[]
  for part in re.split(r'(__VAR_\d+__)',source):
   if re.fullmatch(r'__VAR_\d+__',part) or not re.search('[A-Za-z]{2}',part): pieces.append(part); continue
   translated=translate(lang,[part.strip()]).get(part.strip())
   if not translated: raise ValueError((lang,part))
   pieces.append((' ' if part.startswith(' ') else '')+translated+(' ' if part.endswith(' ') else ''))
  results[lang][source]=''.join(pieces)
 json.dump(results[lang],open('src/locales/'+lang+'.json','w'),ensure_ascii=False,indent=2)
