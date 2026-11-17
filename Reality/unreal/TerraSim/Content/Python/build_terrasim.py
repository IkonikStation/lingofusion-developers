"""Generate licensed textures, PBR materials, and the native startup level.
Run with UnrealEditor TerraSim.uproject -ExecutePythonScript=<this file>.
This edits only assets in /Game/TerraSim.
"""
from pathlib import Path
import json
import unreal
PROJECT=Path(unreal.Paths.project_dir()).resolve()
TEXTURES=PROJECT.parents[1]/'public'/'textures'
OUT='/Game/TerraSim'
assets=unreal.AssetToolsHelpers.get_asset_tools()
for folder in ('Textures','Materials','Maps'):
    unreal.EditorAssetLibrary.make_directory(f'{OUT}/{folder}')
def import_texture(filename,name,normal=False,linear=False):
    task=unreal.AssetImportTask()
    task.filename=str(TEXTURES/filename)
    task.destination_path=f'{OUT}/Textures'
    task.destination_name=name
    task.automated=True
    task.replace_existing=True
    task.save=True
    assets.import_asset_tasks([task])
    texture=unreal.load_asset(f'{OUT}/Textures/{name}')
    if not texture:raise RuntimeError(f'Failed importing {filename}')
    texture.set_editor_property('srgb',not(linear or normal))
    texture.set_editor_property('max_texture_size',8192)
    texture.set_editor_property('never_stream',True)
    if normal:texture.set_editor_property('compression_settings',unreal.TextureCompressionSettings.TC_NORMALMAP)
    unreal.EditorAssetLibrary.save_loaded_asset(texture)
    return texture
tex={
 'day':import_texture('earth-day.jpg','T_Earth_Day'),
 'night':import_texture('earth-night.jpg','T_Earth_Night'),
 'normal':import_texture('earth-normal.tif','T_Earth_Normal',normal=True),
 'specular':import_texture('earth-specular.tif','T_Earth_WaterMask',linear=True),
 'clouds':import_texture('earth-clouds.jpg','T_Earth_Clouds',linear=True),
}
lib=unreal.MaterialEditingLibrary
def material(name):
    path=f'{OUT}/Materials/{name}'
    m=unreal.load_asset(path)
    if not m:m=assets.create_asset(name,f'{OUT}/Materials',unreal.Material,unreal.MaterialFactoryNew())
    lib.delete_all_material_expressions(m)
    return m

def node(m,cls,x=0,y=0,**props):
    n=lib.create_material_expression(m,cls,x,y)
    for k,v in props.items():n.set_editor_property(k,v)
    return n

def link(a,out,b,slot):
    if lib.connect_material_expressions(a,out,b,slot):return
    inputs=lib.get_material_expression_input_names(b);outputs=lib.get_material_expression_output_names(a)
    fallback_in='' if slot=='Input' else slot
    fallback_out='' if out=='RGB' and 'RGB' not in outputs else out
    if not lib.connect_material_expressions(a,fallback_out,b,fallback_in):raise RuntimeError(f'Material connection failed: {a.get_class().get_name()} {out} -> {b.get_class().get_name()} {slot}; inputs={inputs}, outputs={outputs}')
def prop(a,out,m,p):
    if not lib.connect_material_property(a,out,p):raise RuntimeError(f'Cannot connect material output {p}')
def sample(m,key,x,y,normal=False):
    n=node(m,unreal.MaterialExpressionTextureSample,x,y,texture=tex[key])
    if normal:n.set_editor_property('sampler_type',unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    elif key in ('specular','clouds'):n.set_editor_property('sampler_type',unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    return n

def scalar(m,v):return node(m,unreal.MaterialExpressionConstant,r=v)


def flat_radiance(m):
    # Fixed-power point Sun: reference zenith irradiance 110,000 lux at 5,000 km.
    # Analytic radiance avoids the renderer's kilometre-scale point-light limits.
    position=node(m,unreal.MaterialExpressionWorldPosition)
    sunpos=node(m,unreal.MaterialExpressionVectorParameter,parameter_name='LocalSunPosition',default_value=unreal.LinearColor(0,0,5e8,1))
    flat=node(m,unreal.MaterialExpressionScalarParameter,parameter_name='FlatModel',default_value=0.)
    n=node(m,unreal.MaterialExpressionCustom,code='float3 d=(SunPosition-Position)*1e-5; float r=max(length(d),1.0); return Flat*(110000.0/3.14159265)*(25000000.0/(r*r))*saturate(d.z/r);',output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT1)
    inputs=[]
    for name in ('Position','SunPosition','Flat'):
        i=unreal.CustomInput();i.set_editor_property('input_name',name);inputs.append(i)
    n.set_editor_property('inputs',inputs)
    link(position,'XYZ',n,'Position');link(sunpos,'RGB',n,'SunPosition');link(flat,'',n,'Flat')
    return n

def add_flat_radiance(m,color,existing=None):
    glow=node(m,unreal.MaterialExpressionMultiply);link(color,'',glow,'A');link(flat_radiance(m),'',glow,'B')
    if existing:
        total=node(m,unreal.MaterialExpressionAdd);link(existing,'',total,'A');link(glow,'',total,'B')
    else:total=glow
    prop(total,'',m,unreal.MaterialProperty.MP_EMISSIVE_COLOR)

m=material('M_Earth')
m.set_editor_property('two_sided',True)
day=sample(m,'day',-900,-400)
sat=node(m,unreal.MaterialExpressionDesaturation,-650,-400)
link(day,'RGB',sat,'Input');link(scalar(m,.16),'',sat,'Fraction')
prop(sat,'',m,unreal.MaterialProperty.MP_BASE_COLOR)
normal=sample(m,'normal',-800,100,True);prop(normal,'RGB',m,unreal.MaterialProperty.MP_NORMAL)
water=sample(m,'specular',-800,-100)
rough=node(m,unreal.MaterialExpressionLinearInterpolate,-400,-100)
link(scalar(m,.88),'',rough,'A');link(scalar(m,.11),'',rough,'B');link(water,'R',rough,'Alpha');prop(rough,'',m,unreal.MaterialProperty.MP_ROUGHNESS)
prop(scalar(m,.4),'',m,unreal.MaterialProperty.MP_SPECULAR)
night=sample(m,'night',-800,400)
normalws=node(m,unreal.MaterialExpressionVertexNormalWS,-800,650)
sun=node(m,unreal.MaterialExpressionVectorParameter,-800,800,parameter_name='SunDirection',default_value=unreal.LinearColor(1,0,0,1))
dot=node(m,unreal.MaterialExpressionDotProduct,-500,650);link(normalws,'',dot,'A');link(sun,'RGB',dot,'B')
mask=node(m,unreal.MaterialExpressionCustom,-250,600,code='return (1.0-Flat)*saturate(-Light*6.0);',output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT1)
i=unreal.CustomInput();i.set_editor_property('input_name','Light');fi=unreal.CustomInput();fi.set_editor_property('input_name','Flat');mask.set_editor_property('inputs',[i,fi]);link(dot,'',mask,'Light');flat=node(m,unreal.MaterialExpressionScalarParameter,parameter_name='FlatModel',default_value=0.);link(flat,'',mask,'Flat')
emissive=node(m,unreal.MaterialExpressionMultiply,0,400);link(night,'RGB',emissive,'A');link(mask,'',emissive,'B')
gain=node(m,unreal.MaterialExpressionMultiply,200,400);link(emissive,'',gain,'A');link(scalar(m,1200),'',gain,'B');prop(gain,'',m,unreal.MaterialProperty.MP_EMISSIVE_COLOR)
add_flat_radiance(m,sat,gain)
lib.recompile_material(m);unreal.EditorAssetLibrary.save_loaded_asset(m)

cloud=material('M_Clouds')
cloud.set_editor_property('blend_mode',unreal.BlendMode.BLEND_TRANSLUCENT)
cloud.set_editor_property('translucency_lighting_mode',unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)
cloud.set_editor_property('two_sided',False)
cloud.set_editor_property('opacity_mask_clip_value',.08)
c=sample(cloud,'clouds',-450,0)
opacity=node(cloud,unreal.MaterialExpressionMultiply,-200,100);link(c,'R',opacity,'A');link(scalar(cloud,.9),'',opacity,'B')
prop(opacity,'',cloud,unreal.MaterialProperty.MP_OPACITY)
color=node(cloud,unreal.MaterialExpressionConstant3Vector,constant=unreal.LinearColor(.85,.89,.94,1))
prop(color,'',cloud,unreal.MaterialProperty.MP_BASE_COLOR)
prop(scalar(cloud,1),'',cloud,unreal.MaterialProperty.MP_ROUGHNESS)
add_flat_radiance(cloud,color)
lib.recompile_material(cloud);unreal.EditorAssetLibrary.save_loaded_asset(cloud)

sub=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if unreal.EditorAssetLibrary.does_asset_exist(f'{OUT}/Maps/Earth'):sub.load_level(f'{OUT}/Maps/Earth')
else:sub.new_level(f'{OUT}/Maps/Earth')
actor_sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for existing in actor_sub.get_all_level_actors():
    if existing.get_actor_label().startswith('Mont Blanc'):actor_sub.destroy_actor(existing)
settings=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world().get_world_settings()
settings.set_editor_property('enable_world_bounds_checks',False)
sub.save_current_level()
unreal.EditorAssetLibrary.save_directory(OUT)
unreal.log('TERRASIM_ASSET_BUILD_COMPLETE')

# A real, bounded Mont Blanc DEM/satellite scene. Geometry remains at 1x relief.
terrain_dir=PROJECT/'SourceAssets'/'Alps'
if (terrain_dir/'Alps.obj').exists():
    task=unreal.AssetImportTask()
    task.filename=str(terrain_dir/'Alps.obj')
    task.destination_path=f'{OUT}/Terrain'
    task.destination_name='SM_MontBlanc'
    task.automated=True;task.replace_existing=True;task.save=True
    options=unreal.FbxImportUI()
    options.set_editor_property('import_mesh',True)
    options.set_editor_property('import_textures',False)
    options.set_editor_property('import_materials',False)
    options.set_editor_property('automated_import_should_detect_type',False)
    options.set_editor_property('mesh_type_to_import',unreal.FBXImportType.FBXIT_STATIC_MESH)
    options.static_mesh_import_data.set_editor_property('import_uniform_scale',100.)
    options.static_mesh_import_data.set_editor_property('generate_lightmap_u_vs',False)
    options.static_mesh_import_data.set_editor_property('auto_generate_collision',False)
    task.options=options
    task.factory=unreal.FbxFactory()
    assets.import_asset_tasks([task])
    mesh=unreal.load_asset(f'{OUT}/Terrain/SM_MontBlanc')
    if not mesh:raise RuntimeError('Terrain OBJ failed to import')
    image_task=unreal.AssetImportTask()
    image_task.filename=str(terrain_dir/'Alps-satellite.jpg');image_task.destination_path=f'{OUT}/Terrain';image_task.destination_name='T_MontBlanc_Sentinel';image_task.automated=True;image_task.replace_existing=True;image_task.save=True
    assets.import_asset_tasks([image_task])
    terrain_mat=material('M_MontBlanc')
    terrain_mat.set_editor_property('two_sided',True)
    image=unreal.load_asset(f'{OUT}/Terrain/T_MontBlanc_Sentinel')
    image.set_editor_property('never_stream',True)
    unreal.EditorAssetLibrary.save_loaded_asset(image)
    n=node(terrain_mat,unreal.MaterialExpressionTextureSample,texture=image)
    prop(n,'RGB',terrain_mat,unreal.MaterialProperty.MP_BASE_COLOR)
    prop(scalar(terrain_mat,.9),'',terrain_mat,unreal.MaterialProperty.MP_ROUGHNESS)
    lib.recompile_material(terrain_mat)
    unreal.EditorAssetLibrary.save_loaded_asset(terrain_mat)
    for slot in range(len(mesh.get_editor_property('static_materials'))):mesh.set_material(slot,terrain_mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    if unreal.EditorAssetLibrary.does_asset_exist(f'{OUT}/Maps/Alps'):sub.load_level(f'{OUT}/Maps/Alps')
    else:sub.new_level(f'{OUT}/Maps/Alps')
    actor_sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for existing in actor_sub.get_all_level_actors():
        if existing.get_actor_label().startswith('Mont Blanc'):actor_sub.destroy_actor(existing)
    terrain=actor_sub.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(0,0,0))
    terrain.static_mesh_component.set_static_mesh(mesh)
    terrain.static_mesh_component.set_material(0,terrain_mat)
    # Interchange reimports can ignore the legacy import-unit option.
    # Normalize the actor from measured asset bounds to the known source span.
    extent=mesh.get_bounds().box_extent
    target_half_width_cm=json.loads((terrain_dir/'georeference.json').read_text())['halfWidthM']*100.
    unit_scale=target_half_width_cm/extent.x
    terrain.set_actor_scale3d(unreal.Vector(unit_scale,unit_scale,unit_scale))
    assert abs(terrain.get_actor_bounds(False)[1].x-target_half_width_cm)<100.
    unreal.log(f'TERRASIM_TERRAIN_UNIT_SCALE {unit_scale}')
    terrain.set_actor_label('Mont Blanc — real DEM / 1x relief / EOX Sentinel 2016')
    # Imported OBJ axes may be changed by the importer. The console reports its
    # bounds for camera verification before delivery.
    unreal.log(f'TERRASIM_TERRAIN_BOUNDS {terrain.get_actor_bounds(False)}')
    sub.save_current_level()
    unreal.EditorAssetLibrary.save_directory(OUT)
    unreal.log('TERRASIM_TERRAIN_BUILD_COMPLETE')

for name in ('M_Earth','M_MontBlanc'):
    m=unreal.load_asset(f'{OUT}/Materials/{name}')
    source=lib.get_material_property_input_node(m,unreal.MaterialProperty.MP_BASE_COLOR)
    unreal.log(f'TERRASIM_MATERIAL_AUDIT {name} source={source}')
unreal.log('TERRASIM_ALL_ASSETS_READY')
unreal.SystemLibrary.quit_editor()
