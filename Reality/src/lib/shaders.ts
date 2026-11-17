export const vertex = `varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld;
void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
export const earthFragment = `uniform sampler2D dayMap;uniform sampler2D nightMap;uniform vec3 sun;uniform float intensity;uniform float nightLights;uniform float flatModel;uniform sampler2D cloudMap;uniform float showClouds;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
void main(){vec3 n=normalize(vNormal);vec3 l=flatModel>.5?normalize(sun-vWorld):normalize(sun);float light=dot(n,l);vec3 day=texture2D(dayMap,vUv).rgb;if(flatModel>.5){float cloud=texture2D(cloudMap,vUv).r*showClouds*.65;day=mix(day,vec3(.82,.87,.92),cloud);}vec3 night=texture2D(nightMap,vUv).rgb;float daylight=smoothstep(-.12,.22,light);vec3 color=day*(.018+max(light,0.)*intensity*.98);color+=night*nightLights*(1.-smoothstep(-.12,.14,light))*1.8;vec3 viewDir=normalize(cameraPosition-vWorld);float ocean=smoothstep(.02,.12,day.b-day.r)*smoothstep(.01,.08,day.b-day.g);float spec=pow(max(dot(reflect(-l,n),viewDir),0.),65.);color+=vec3(.85,.94,1.)*spec*ocean*.32*daylight;float rim=pow(1.-max(dot(n,viewDir),0.),3.);color+=vec3(.025,.13,.26)*rim*daylight;gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
