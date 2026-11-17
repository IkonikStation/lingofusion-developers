"""Cache a bounded 27 km Mont Blanc terrain patch from public geodata.
Elevation: Mapzen Terrain Tiles on AWS. Imagery: EOX Sentinel-2 2016, CC BY 4.0.
Four requests at a time; existing tiles are reused. No account/token required.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,math,subprocess
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'SourceAssets'/'Alps';CACHE=OUT/'tiles';CACHE.mkdir(parents=True,exist_ok=True)
Z=12;N=4;lat,lon=45.8326,6.8652
cx=(lon+180)/360*2**Z;cy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**Z
x0,y0=math.floor(cx)-N//2,math.floor(cy)-N//2
jobs=[]
for j in range(N):
 for i in range(N):jobs.append(('dem',Z,x0+i,y0+j))
for j in range(N*2):
 for i in range(N*2):jobs.append(('image',Z+1,x0*2+i,y0*2+j))
def get(job):
 kind,z,x,y=job;file=CACHE/f'{kind}-{z}-{x}-{y}.{ "png" if kind=="dem" else "jpg"}'
 if not file.exists():
  url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png' if kind=='dem' else f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'
  subprocess.run(['curl','-fsSL','--retry','2','--max-time','45',url,'-o',str(file)],check=True)
 return file
with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(get,jobs))
dem=Image.new('RGB',(N*256,N*256));image=Image.new('RGB',(N*512,N*512))
for j in range(N):
 for i in range(N):dem.paste(Image.open(get(('dem',Z,x0+i,y0+j))),(i*256,j*256))
for j in range(N*2):
 for i in range(N*2):image.paste(Image.open(get(('image',Z+1,x0*2+i,y0*2+j))),(i*256,j*256))
image.save(OUT/'Alps-satellite.jpg',quality=94)
a=np.asarray(dem,dtype=np.float32);heights=a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768
h=np.asarray(Image.fromarray(heights).resize((513,513),Image.Resampling.BILINEAR));size=513
middle_x,middle_y=x0+N/2,y0+N/2
clon=middle_x/2**Z*360-180;clat=math.degrees(math.atan(math.sinh(math.pi*(1-2*middle_y/2**Z))))
with (OUT/'Alps.obj').open('w') as f:
 f.write('# Mont Blanc — real DEM, metres in a local east/north/up frame\no MontBlanc\n')
 for j in range(size):
  yy=y0+j/(size-1)*N;phi=math.degrees(math.atan(math.sinh(math.pi*(1-2*yy/2**Z))));north=(phi-clat)*111132
  for i in range(size):
   xx=x0+i/(size-1)*N;lam=xx/2**Z*360-180;east=(lam-clon)*111320*math.cos(math.radians(clat));height=float(h[j,i])-(east*east+north*north)/(2*6371000)
   f.write(f'v {east:.3f} {-north:.3f} {height:.3f}\n')
 for j in range(size):
  for i in range(size):f.write(f'vt {i/(size-1):.7f} {1-j/(size-1):.7f}\n')
 f.write('s 1\n')
 for j in range(size-1):
  for i in range(size-1):
   a=j*size+i+1;b=a+1;c=a+size;d=c+1
   f.write(f'f {a}/{a} {b}/{b} {c}/{c}\nf {b}/{b} {d}/{d} {c}/{c}\n')
metadata={'centerLatitude':clat,'centerLongitude':clon,'widthKm':N*2*math.pi*6371.0088/2**Z*math.cos(math.radians(clat)),'halfWidthM':N/2**Z*180*111320*math.cos(math.radians(clat)),'heightMinM':float(h.min()),'heightMaxM':float(h.max()),'resolution':size,'heightExaggeration':1,'imageryAttribution':'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) — CC BY 4.0','elevationAttribution':'Mapzen / Tilezen Terrain Tiles, accessed 2026-10-28 from https://registry.opendata.aws/terrain-tiles/','coordinates':'local approximate east/north/up metres; mean-radius curvature correction'}
(OUT/'georeference.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps(metadata,indent=2))
