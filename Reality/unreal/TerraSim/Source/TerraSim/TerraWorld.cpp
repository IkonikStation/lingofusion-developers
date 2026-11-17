#include "TerraWorld.h"
#include "TerraScience.h"
#include "ProceduralMeshComponent.h"
#include "Camera/CameraComponent.h"
#include "Components/InputComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/PointLight.h"
#include "Components/PointLightComponent.h"
#include "Engine/SkyLight.h"
#include "Engine/PostProcessVolume.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/VolumetricCloudComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/Canvas.h"
#include "Framework/Application/SlateApplication.h"
#include "Engine/GameViewportClient.h"
#include "UnrealClient.h"
#include "HAL/IConsoleManager.h"
#include "TerraCameraMath.h"
#include "CanvasItem.h"
#include "Fonts/SlateFontInfo.h"
#include "Misc/Paths.h"
#include "Engine/Engine.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/UnrealType.h"
using namespace TerraScience;
namespace {
 const FLinearColor Accent(.68f,.86f,.48f),Text(.86f,.9f,.87f),Muted(.35f,.42f,.39f),Panel(.025f,.035f,.04f,.92f);
 void FloatProperty(UObject*o,const TCHAR*name,float value){if(auto*p=FindFProperty<FFloatProperty>(o->GetClass(),name))p->SetPropertyValue_InContainer(o,value);}
 void ByteProperty(UObject*o,const TCHAR*name,uint8 value){if(auto*p=FindFProperty<FByteProperty>(o->GetClass(),name))p->SetPropertyValue_InContainer(o,value);else if(auto*e=FindFProperty<FEnumProperty>(o->GetClass(),name))e->GetUnderlyingProperty()->SetIntPropertyValue(e->ContainerPtrToValuePtr<void>(o),int64(value));}
 void MakeMesh(UProceduralMeshComponent*mesh,bool flat,bool cloud){
  TArray<FVector> V,N;TArray<FVector2D> UV;TArray<int32>I;TArray<FLinearColor>C;TArray<FProcMeshTangent>T;
  int32 W=512,H=256;double radius=EquatorialCm+(cloud?1200000.:0.);
  for(int32 y=0;y<=H;y++)for(int32 x=0;x<=W;x++){
   double lat=90.-180.*y/H,lon=-180.+360.*x/W;
   FVector p,n;
   if(flat){auto q=Disc(lat,lon);p=FVector(q.X*100000.,q.Y*100000.,cloud?1200000.:0.);n=FVector::UpVector;}
   else {p=Geo(lat,lon,radius);p.Z*=1-Flattening;n=FVector(p.X,p.Y,p.Z/FMath::Square(1-Flattening)).GetSafeNormal();}
   V.Add(p);N.Add(n);UV.Add(FVector2D(double(x)/W,double(y)/H));C.Add(FLinearColor::White);T.Add(FProcMeshTangent(-FMath::Sin(Rad(lon)),-FMath::Cos(Rad(lon)),0));
   if(x<W&&y<H){int32 a=y*(W+1)+x,b=a+1,c=a+W+1,d=c+1;I.Append({a,c,b,b,c,d});}
  }
  mesh->CreateMeshSection_LinearColor(0,V,I,N,UV,C,T,false);mesh->SetCastShadow(!cloud);
 }
}
ATerraWorld::ATerraWorld(){PrimaryActorTick.bCanEverTick=true;Planet=CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("WGS84 Earth"));SetRootComponent(Planet);Clouds=CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Cloud layer"));Clouds->SetupAttachment(Planet);Planet->bUseAsyncCooking=true;}
void ATerraWorld::BeginPlay(){Super::BeginPlay();bTerrainWorld=GetWorld()->GetMapName().Contains(TEXT("Alps"));if(bTerrainWorld){Latitude=45.890008;Longitude=6.855469;Time=FDateTime(2026,6,21,12,30);}
 if(!bTerrainWorld){
 auto* material=LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/TerraSim/Materials/M_Earth.M_Earth"));
 auto* cloud=LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/TerraSim/Materials/M_Clouds.M_Clouds"));
 if(material){PlanetMaterial=UMaterialInstanceDynamic::Create(material,this);Planet->SetMaterial(0,PlanetMaterial);}
 if(cloud){CloudMaterial=UMaterialInstanceDynamic::Create(cloud,this);Clouds->SetMaterial(0,CloudMaterial);}
 }
 Sun=GetWorld()->SpawnActor<ADirectionalLight>();auto* light=Sun->FindComponentByClass<UDirectionalLightComponent>();light->SetMobility(EComponentMobility::Movable);light->SetIntensity(110000);light->SetLightColor(FLinearColor(1.,.975,.94));light->bAtmosphereSunLight=true;light->AtmosphereSunLightIndex=0;light->SetCastShadows(true);if(bTerrainWorld){light->SetDynamicShadowDistanceMovableLight(5000000.f);light->SetDynamicShadowCascades(4);light->bCastCloudShadows=true;}
 LocalSun=GetWorld()->SpawnActor<APointLight>();auto* local=LocalSun->FindComponentByClass<UPointLightComponent>();local->SetMobility(EComponentMobility::Movable);local->IntensityUnits=ELightUnits::Lumens;local->SetAttenuationRadius(6e9f);local->SetSourceRadius(5e6f);local->SetVisibility(false);
 Atmosphere=GetWorld()->SpawnActor<ASkyAtmosphere>();auto* sky=Atmosphere->GetComponent();FloatProperty(sky,TEXT("BottomRadius"),6378.137f);FloatProperty(sky,TEXT("AtmosphereHeight"),100.f);ByteProperty(sky,TEXT("TransformMode"),bTerrainWorld?0:2);sky->MarkRenderStateDirty();
 Ambient=GetWorld()->SpawnActor<ASkyLight>();Ambient->GetLightComponent()->SetMobility(EComponentMobility::Movable);Ambient->GetLightComponent()->SetIntensity(bTerrainWorld?.8f:.025f);Ambient->GetLightComponent()->bRealTimeCapture=true;
 auto* post=GetWorld()->SpawnActor<APostProcessVolume>();post->bUnbound=true;auto& s=post->Settings;s.bOverride_AutoExposureMethod=true;s.AutoExposureMethod=EAutoExposureMethod::AEM_Manual;s.bOverride_AutoExposureApplyPhysicalCameraExposure=true;s.AutoExposureApplyPhysicalCameraExposure=false;s.bOverride_AutoExposureBias=true;s.AutoExposureBias=-14.f;s.bOverride_BloomIntensity=true;s.BloomIntensity=.12f;s.bOverride_VignetteIntensity=true;s.VignetteIntensity=.12f;s.bOverride_MotionBlurAmount=true;s.MotionBlurAmount=0;s.bOverride_ColorSaturation=true;s.ColorSaturation=FVector4(.9,.9,.9,1.);
 if(bTerrainWorld){Planet->SetVisibility(false);Clouds->SetVisibility(false);auto* volume=GetWorld()->SpawnActor<AVolumetricCloud>();auto* component=volume->FindComponentByClass<UVolumetricCloudComponent>();component->SetLayerBottomAltitude(8.5f);component->SetLayerHeight(5.f);if(auto* mat=LoadObject<UMaterialInterface>(nullptr,TEXT("/Engine/EngineSky/VolumetricClouds/m_SimpleVolumetricCloud_Inst.m_SimpleVolumetricCloud_Inst")))component->SetMaterial(mat);}else BuildPlanet();UpdateSun();
}
void ATerraWorld::BuildPlanet(){MakeMesh(Planet,bFlat,false);MakeMesh(Clouds,bFlat,true);Clouds->SetVisibility(bClouds);if(Atmosphere)Atmosphere->GetComponent()->SetVisibility(!bFlat);}
void ATerraWorld::SetModel(bool Flat){bFlat=Flat;BuildPlanet();UpdateSun();}
void ATerraWorld::Tick(float Delta){Super::Tick(Delta);if(bPlaying){auto Next=Time+FTimespan::FromSeconds(Delta*Speed);if(Next.GetYear()>=1900&&Next.GetYear()<=2100)Time=Next;}UpdateSun();}
void ATerraWorld::UpdateSun(){if(!Sun)return;auto s=TerraScience::Sun(Time,Tilt);auto direction=Geo(s.X,s.Y,1.);if(bTerrainWorld){FVector up=Geo(Latitude,Longitude,1.),east(-FMath::Sin(Rad(Longitude)),-FMath::Cos(Rad(Longitude)),0),north(-FMath::Sin(Rad(Latitude))*FMath::Cos(Rad(Longitude)),FMath::Sin(Rad(Latitude))*FMath::Sin(Rad(Longitude)),FMath::Cos(Rad(Latitude)));direction=FVector(FVector::DotProduct(direction,east),FVector::DotProduct(direction,north),FVector::DotProduct(direction,up));}Sun->SetActorRotation((-direction).Rotation());Sun->FindComponentByClass<UDirectionalLightComponent>()->SetVisibility(!bFlat);if(LocalSun){auto q=Disc(s.X,s.Y);LocalSun->SetActorLocation(FVector(q.X*100000.,q.Y*100000.,SunHeightKm*100000.));LocalSun->FindComponentByClass<UPointLightComponent>()->SetIntensity(4*PI*110000.*FMath::Square(5000000.));LocalSun->FindComponentByClass<UPointLightComponent>()->SetVisibility(false);FLinearColor localPosition(LocalSun->GetActorLocation().X,LocalSun->GetActorLocation().Y,LocalSun->GetActorLocation().Z,1.);if(PlanetMaterial)PlanetMaterial->SetVectorParameterValue(TEXT("LocalSunPosition"),localPosition);if(CloudMaterial)CloudMaterial->SetVectorParameterValue(TEXT("LocalSunPosition"),localPosition);}if(PlanetMaterial){PlanetMaterial->SetVectorParameterValue(TEXT("SunDirection"),FLinearColor(direction.X,direction.Y,direction.Z,1.));PlanetMaterial->SetScalarParameterValue(TEXT("FlatModel"),bFlat?1:0);}if(CloudMaterial){CloudMaterial->SetVectorParameterValue(TEXT("SunDirection"),FLinearColor(direction.X,direction.Y,direction.Z,1.));CloudMaterial->SetScalarParameterValue(TEXT("FlatModel"),bFlat?1:0);}}
void ATerraWorld::Visit(int index){const double lats[]={45.5019,51.5074,35.6762,-33.8688,45.8326,90.,-90.};const double lons[]={-73.5674,-.1278,139.6503,151.2093,6.8652,0.,0.};index=FMath::Clamp(index,0,6);Latitude=lats[index];Longitude=lons[index];auto*pc=Cast<ATerraController>(UGameplayStatics::GetPlayerController(this,0));if(pc){pc->OrbitLat=Latitude;pc->OrbitLon=Longitude;pc->Distance=5.2;pc->SelectedPlace=index;if(bFlat){auto q=Disc(Latitude,Longitude);pc->FlatTarget=FVector(q.X*100000.,q.Y*100000.,0);pc->Distance=3.8;}}}
FString ATerraWorld::ExperimentName()const{static const TCHAR*Names[]={TEXT("Horizon & curvature"),TEXT("Beyond the horizon"),TEXT("Sunrise & sunset"),TEXT("Sun angles & shadows"),TEXT("Measure the Earth"),TEXT("Seasons & solstices"),TEXT("Midnight Sun"),TEXT("Gravity & free fall"),TEXT("Foucault pendulum"),TEXT("Flight paths"),TEXT("Satellite orbits"),TEXT("Lunar shadow"),TEXT("Celestial rotation"),TEXT("Over the water"),TEXT("Solar time")};return Names[FMath::Clamp(Experiment,0,14)];}
FString ATerraWorld::Prediction(bool Flat)const{double e=Elevation(Latitude,Longitude,Time,Flat,SunHeightKm,Tilt),h=ObserverHeight;switch(Experiment){
 case 0:return Flat?TEXT("No curvature horizon"):FString::Printf(TEXT("%.2f km"),Horizon(h));
 case 1:case 13:return FString::Printf(TEXT("%.2f m hidden"),Flat?0.:Hidden(TargetDistance,h));
 case 2:return FString::Printf(TEXT("%.2f degrees elevation"),e);
 case 3:return e<=0?TEXT("Sun below horizon"):FString::Printf(TEXT("%.2f m shadow (2 m pole)"),2/FMath::Tan(Rad(e)));
 case 4:return FString::Printf(TEXT("%.2f degrees (London baseline)"),FMath::Abs(e-Elevation(51.5074,-.1278,Time,Flat,SunHeightKm,Tilt)));
 case 5:case 6:return FString::Printf(TEXT("%.2f h daylight"),Flat?24.:Daylight(Latitude,Time,Tilt));
 case 7:return FString::Printf(TEXT("%.3f seconds"),FMath::Sqrt(2*h/(Flat?9.81:Gravity(Latitude,h))));
 case 8:return Flat?TEXT("Stationary disc: no precession"):FMath::Abs(Latitude)<.001?TEXT("No precession at equator"):FString::Printf(TEXT("%.2f h precession"),23.9344696/FMath::Abs(FMath::Sin(Rad(Latitude))));
 case 9:return FString::Printf(TEXT("%.1f km to London"),Flat?(Disc(Latitude,Longitude)-Disc(51.5074,-.1278)).Size():Distance(Latitude,Longitude,51.5074,-.1278));
 case 10:return Flat?TEXT("No specified orbital mechanism"):FString::Printf(TEXT("%.3f km/s at 400 km altitude"),FMath::Sqrt(398600.4418/(RadiusKm+400)));
 case 11:return TEXT("Use the verified web ephemeris laboratory");
 case 12:return Flat?TEXT("No stellar-dome mechanism specified"):FString::Printf(TEXT("%.2f degrees NCP altitude"),Latitude);
 case 14:return FString::Printf(TEXT("%.2f mean solar hours to London"),Wrap(-.1278-Longitude)/15.);
 default:return TEXT("Select an experiment");}}
ATerraCameraPawn::ATerraCameraPawn(){Camera=CreateDefaultSubobject<UCameraComponent>(TEXT("Planetary camera"));SetRootComponent(Camera);Camera->FieldOfView=40.;Camera->SetWorldLocation(Geo(18,-25,EquatorialCm*5.8));}
void ATerraController::BeginPlay(){
 Super::BeginPlay();bTerrain=GetWorld()->GetMapName().Contains(TEXT("Alps"));
 bShowMouseCursor=true;bEnableClickEvents=false;
 FInputModeGameAndUI input;input.SetHideCursorDuringCapture(false);input.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);SetInputMode(input);
 TArray<AActor*> actors;UGameplayStatics::GetAllActorsOfClass(this,ATerraWorld::StaticClass(),actors);
 Simulation=actors.Num()?Cast<ATerraWorld>(actors[0]):GetWorld()->SpawnActor<ATerraWorld>();
 if(auto* pawn=Cast<ATerraCameraPawn>(GetPawn()))pawn->Camera->FieldOfView=bTerrain?55.:40.;
 ResetCamera();ApplyGraphics();
 static bool HelpShownThisSession=false;bHelpOpen=!HelpShownThisSession;HelpShownThisSession=true;
}
void ATerraController::SetupInputComponent(){
 Super::SetupInputComponent();
 InputComponent->BindAxisKey(EKeys::MouseX);InputComponent->BindAxisKey(EKeys::MouseY);
 InputComponent->BindKey(EKeys::LeftMouseButton,IE_Pressed,this,&ATerraController::MouseDown);
 InputComponent->BindKey(EKeys::LeftMouseButton,IE_Released,this,&ATerraController::MouseUp);
 InputComponent->BindKey(EKeys::RightMouseButton,IE_Pressed,this,&ATerraController::RightMouseDown);
 InputComponent->BindKey(EKeys::RightMouseButton,IE_Released,this,&ATerraController::RightMouseUp);
 InputComponent->BindKey(EKeys::MouseScrollUp,IE_Pressed,this,&ATerraController::WheelIn);
 InputComponent->BindKey(EKeys::MouseScrollDown,IE_Pressed,this,&ATerraController::WheelOut);
 InputComponent->BindKey(EKeys::Equals,IE_Pressed,this,&ATerraController::ZoomIn);
 InputComponent->BindKey(EKeys::Add,IE_Pressed,this,&ATerraController::ZoomIn);
 InputComponent->BindKey(EKeys::Hyphen,IE_Pressed,this,&ATerraController::ZoomOut);
 InputComponent->BindKey(EKeys::Subtract,IE_Pressed,this,&ATerraController::ZoomOut);
 InputComponent->BindKey(EKeys::SpaceBar,IE_Pressed,this,&ATerraController::TogglePlay);
 InputComponent->BindKey(EKeys::M,IE_Pressed,this,&ATerraController::ToggleModel);
 InputComponent->BindKey(EKeys::I,IE_Pressed,this,&ATerraController::ToggleImmersive);
 InputComponent->BindKey(EKeys::R,IE_Pressed,this,&ATerraController::ResetCamera);
 InputComponent->BindKey(EKeys::Home,IE_Pressed,this,&ATerraController::ResetCamera);
 InputComponent->BindKey(EKeys::F,IE_Pressed,this,&ATerraController::FocusLocation);
 InputComponent->BindKey(EKeys::T,IE_Pressed,this,&ATerraController::OpenTerrain);
 InputComponent->BindKey(EKeys::H,IE_Pressed,this,&ATerraController::ToggleHelp);
 InputComponent->BindKey(EKeys::F1,IE_Pressed,this,&ATerraController::ToggleHelp);
 InputComponent->BindKey(EKeys::Escape,IE_Pressed,this,&ATerraController::Escape);
 InputComponent->BindKey(EKeys::Enter,IE_Pressed,this,&ATerraController::ActivateControl);
 InputComponent->BindKey(EKeys::Tab,IE_Pressed,this,&ATerraController::NextControl);
}
FVector ATerraController::TerrainCameraPosition()const{return TerraCameraMath::TerrainPosition(TerrainTarget,TerrainYaw,TerrainPitch,TerrainDistance);}
void ATerraController::PlayerTick(float Delta){
 Super::PlayerTick(Delta);if(!Simulation||!GetPawn())return;
 FrameMs=FMath::Lerp(FrameMs,FMath::Clamp(Delta*1000.f,1.f,200.f),.05f);
 const float dt=FMath::Min(Delta,.05f);float mx=0,my=0,dx=0,dy=0;
 const bool focused=FSlateApplication::IsInitialized()&&FSlateApplication::Get().IsActive();
 const bool mouseHere=focused&&GetMousePosition(mx,my);
 if(!focused){Dragging=false;DragGestureThisFrame=false;PressedButton=INDEX_NONE;HasMouse=false;}
 if(mouseHere){if(HasMouse){dx=FMath::Clamp(mx-LastMouseX,-35.f,35.f);dy=FMath::Clamp(my-LastMouseY,-35.f,35.f);}LastMouseX=mx;LastMouseY=my;HasMouse=true;}else HasMouse=false;
 if(!IsInputKeyDown(EKeys::LeftMouseButton)&&!IsInputKeyDown(EKeys::RightMouseButton))Dragging=false;
 const bool navigation=focused&&!bHelpOpen&&!Simulation->bLaboratory;
 if(navigation&&(Dragging||DragGestureThisFrame)){
  // Axis values retain queued motion even when a fast press/release arrives in one frame.
  float ax=0,ay=0;GetInputMouseDelta(ax,ay);
  if(!FMath::IsNearlyZero(ax)||!FMath::IsNearlyZero(ay))RotateView(-FMath::Clamp(ax,-35.f,35.f)*.14f,-FMath::Clamp(ay,-35.f,35.f)*.12f);
  else RotateView(-dx*.14f,dy*.12f);
 }
 DragGestureThisFrame=false;
 if(navigation){float h=0,v=0;
  if(IsInputKeyDown(EKeys::Left))h-=1;if(IsInputKeyDown(EKeys::Right))h+=1;
  if(IsInputKeyDown(EKeys::Up))v+=1;if(IsInputKeyDown(EKeys::Down))v-=1;
  if(!bFreeFlight){if(IsInputKeyDown(EKeys::A))h-=1;if(IsInputKeyDown(EKeys::D))h+=1;if(IsInputKeyDown(EKeys::W))v+=1;if(IsInputKeyDown(EKeys::S))v-=1;}
  RotateView(h*36.f*dt,v*24.f*dt);
 }
 APawn* pawn=GetPawn();
 if(bTerrain&&bFreeFlight){
  if(navigation){FRotator heading(0,pawn->GetActorRotation().Yaw,0);FVector move=FVector::ZeroVector;
   if(IsInputKeyDown(EKeys::W))move+=heading.Vector();if(IsInputKeyDown(EKeys::S))move-=heading.Vector();
   FVector right=FRotationMatrix(heading).GetUnitAxis(EAxis::Y);if(IsInputKeyDown(EKeys::D))move+=right;if(IsInputKeyDown(EKeys::A))move-=right;
   if(IsInputKeyDown(EKeys::E))move.Z+=1;if(IsInputKeyDown(EKeys::Q))move.Z-=1;
   const float speed=FlySpeed*(IsInputKeyDown(EKeys::LeftShift)?2.f:1.f);
   pawn->SetActorLocation(TerraCameraMath::SafeFlightPosition(pawn->GetActorLocation()+move.GetSafeNormal()*speed*dt));
  }
 }else{
  FVector target=FVector::ZeroVector,desired;
  if(bTerrain){target=TerrainTarget;desired=TerrainCameraPosition();}
  else if(Simulation->bFlat){target=FlatTarget;desired=target+FRotator(FlatPitch,FlatYaw,0).Vector()*(EquatorialCm*Distance*2.6);}
  else desired=Geo(OrbitLat,OrbitLon,EquatorialCm*Distance);
  const float blend=1.f-FMath::Exp(-10.f*dt);pawn->SetActorLocation(FMath::Lerp(pawn->GetActorLocation(),desired,blend));
  pawn->SetActorRotation((target-pawn->GetActorLocation()).Rotation());
 }
 Simulation->Altitude=bTerrain?pawn->GetActorLocation().Z/100000.:(pawn->GetActorLocation().Size()-EquatorialCm)/100000.;
}
void ATerraController::MouseDown(){
 float x,y;if(!GetMousePosition(x,y))return;LastMouseX=x;LastMouseY=y;HasMouse=true;
 if(auto* hud=Cast<ATerraHUD>(GetHUD())){PressedButton=hud->ButtonAt(x,y);UE_LOG(LogTemp,Display,TEXT("TERRASIM_POINTER_DOWN %.0f %.0f button=%d"),x,y,PressedButton);if(PressedButton!=INDEX_NONE||hud->IsOverInterface(x,y))return;}
 if(!bHelpOpen&&Simulation&&!Simulation->bLaboratory){Dragging=true;DragGestureThisFrame=true;}
}
void ATerraController::MouseUp(){
 Dragging=false;float x,y;int32 pressed=PressedButton;UE_LOG(LogTemp,Display,TEXT("TERRASIM_POINTER_UP button=%d"),pressed);PressedButton=INDEX_NONE;
 if(pressed!=INDEX_NONE&&GetMousePosition(x,y))if(auto* hud=Cast<ATerraHUD>(GetHUD()))if(hud->ButtonAt(x,y)==pressed)hud->Click(x,y);
}
void ATerraController::RightMouseDown(){float x,y;if(GetMousePosition(x,y)){if(auto*h=Cast<ATerraHUD>(GetHUD()))if(h->IsOverInterface(x,y))return;LastMouseX=x;LastMouseY=y;HasMouse=true;}if(!bHelpOpen&&Simulation&&!Simulation->bLaboratory){Dragging=true;DragGestureThisFrame=true;}}
void ATerraController::RightMouseUp(){Dragging=false;}
void ATerraController::RotateView(float horizontal,float vertical){
 if(bTerrain){if(bFreeFlight){auto r=GetPawn()->GetActorRotation();r.Yaw-=horizontal;r.Pitch=FMath::Clamp(r.Pitch-vertical,-70.,70.);GetPawn()->SetActorRotation(r);}else{TerrainYaw=FRotator::NormalizeAxis(TerrainYaw+horizontal);TerrainPitch=FMath::Clamp(TerrainPitch+vertical,20.,75.);}}
 else if(Simulation&&Simulation->bFlat){FlatYaw=FRotator::NormalizeAxis(FlatYaw+horizontal);FlatPitch=FMath::Clamp(FlatPitch+vertical,20.,75.);}
 else{OrbitLon=Wrap(OrbitLon+horizontal);OrbitLat=FMath::Clamp(OrbitLat+vertical,-80.,80.);}
}
void ATerraController::ZoomIn(){if(bHelpOpen)return;if(bTerrain){if(bFreeFlight){auto p=GetPawn();p->SetActorLocation(TerraCameraMath::SafeFlightPosition(p->GetActorLocation()+p->GetActorForwardVector()*40000.));}else TerrainDistance=TerraCameraMath::ZoomTerrain(TerrainDistance,.88);}else Distance=FMath::Clamp(Distance*.88,1.25,12.);}
void ATerraController::ZoomOut(){if(bHelpOpen)return;if(bTerrain){if(bFreeFlight){auto p=GetPawn();p->SetActorLocation(TerraCameraMath::SafeFlightPosition(p->GetActorLocation()-p->GetActorForwardVector()*40000.));}else TerrainDistance=TerraCameraMath::ZoomTerrain(TerrainDistance,1./.88);}else Distance=FMath::Clamp(Distance/.88,1.25,12.);}
void ATerraController::WheelIn(){double now=GetWorld()->GetRealTimeSeconds();if(now-LastWheelTime<.055)return;LastWheelTime=now;ZoomIn();}
void ATerraController::WheelOut(){double now=GetWorld()->GetRealTimeSeconds();if(now-LastWheelTime<.055)return;LastWheelTime=now;ZoomOut();}
void ATerraController::TogglePlay(){if(Simulation&&!bHelpOpen)Simulation->bPlaying=!Simulation->bPlaying;}
void ATerraController::ToggleModel(){if(Simulation&&!bTerrain&&!bHelpOpen){Simulation->SetModel(!Simulation->bFlat);ResetCamera();}}
void ATerraController::ToggleImmersive(){if(Simulation&&!bHelpOpen)Simulation->bImmersive=!Simulation->bImmersive;}
void ATerraController::ResetCamera(){
 Dragging=false;HasMouse=false;PressedButton=INDEX_NONE;FocusedButton=INDEX_NONE;bFreeFlight=false;bHelpOpen=false;
 if(Simulation){Simulation->bLaboratory=false;Simulation->bImmersive=false;}
 if(bTerrain){SetTerrainPreset(0);if(GetPawn()){GetPawn()->SetActorLocation(TerrainCameraPosition());GetPawn()->SetActorRotation((TerrainTarget-GetPawn()->GetActorLocation()).Rotation());}}
 else{OrbitLat=18;OrbitLon=-25;Distance=5.8;FlatYaw=-90;FlatPitch=45;FlatTarget=FVector::ZeroVector;SelectedPlace=INDEX_NONE;}
 UE_LOG(LogTemp,Display,TEXT("TERRASIM_HOME terrain=%d"),bTerrain);
}
void ATerraController::SetTerrainPreset(int32 index){
 bFreeFlight=false;Dragging=false;SelectedPreset=FMath::Clamp(index,0,3);
 switch(SelectedPreset){
 case 1:TerrainTarget=FVector(100000,-450000,280000);TerrainYaw=25;TerrainPitch=35;TerrainDistance=700000;break;
 case 2:TerrainTarget=FVector(-250000,100000,190000);TerrainYaw=-110;TerrainPitch=45;TerrainDistance=900000;break;
 case 3:TerrainTarget=FVector(0,-100000,200000);TerrainYaw=-70;TerrainPitch=65;TerrainDistance=1400000;break;
 default:TerrainTarget=FVector(75000,-638000,330000);TerrainYaw=-45;TerrainPitch=30;TerrainDistance=750000;break;
 }
 UE_LOG(LogTemp,Display,TEXT("TERRASIM_PRESET %d"),SelectedPreset);
}
void ATerraController::ToggleFlight(){bHelpOpen=false;Dragging=false;HasMouse=false;if(bFreeFlight)SetTerrainPreset(0);else bFreeFlight=true;}
void ATerraController::VisitPlace(int32 index){if(Simulation){Simulation->Visit(index);Dragging=false;}}
void ATerraController::FocusLocation(){if(bTerrain)SetTerrainPreset(0);else VisitPlace(0);}
void ATerraController::OpenTerrain(){if(!bHelpOpen)UGameplayStatics::OpenLevel(this,bTerrain?TEXT("Earth"):TEXT("Alps"));}
void ATerraController::ToggleHelp(){bHelpOpen=!bHelpOpen;Dragging=false;PressedButton=INDEX_NONE;}
void ATerraController::CloseHelp(){bHelpOpen=false;Dragging=false;FocusedButton=INDEX_NONE;}
void ATerraController::NextControl(){auto*h=Cast<ATerraHUD>(GetHUD());if(!h||h->Buttons.IsEmpty())return;int32 count=h->Buttons.Num();if(IsInputKeyDown(EKeys::LeftShift)||IsInputKeyDown(EKeys::RightShift))FocusedButton=FocusedButton<=0?count-1:FocusedButton-1;else FocusedButton=(FocusedButton+1)%count;Dragging=false;}
void ATerraController::ActivateControl(){if(bHelpOpen){CloseHelp();return;}auto*h=Cast<ATerraHUD>(GetHUD());int32 focused=FocusedButton;FocusedButton=INDEX_NONE;if(h)h->ActivateButton(focused);}

void ATerraController::Escape(){FocusedButton=INDEX_NONE;Dragging=false;HasMouse=false;PressedButton=INDEX_NONE;if(bHelpOpen)bHelpOpen=false;else if(Simulation&&Simulation->bLaboratory)Simulation->bLaboratory=false;else if(Simulation&&Simulation->bImmersive)Simulation->bImmersive=false;else if(bFreeFlight)SetTerrainPreset(0);}
void ATerraController::SetSunHour(int32 hour){if(Simulation){auto t=Simulation->Time;Simulation->Time=FDateTime(t.GetYear(),t.GetMonth(),t.GetDay(),hour,0);Simulation->bPlaying=false;}}
void ATerraController::ToggleGraphics(){bSmoothGraphics=!bSmoothGraphics;ApplyGraphics();}
void ATerraController::ApplyGraphics(){
 auto set=[](const TCHAR* name,float v){if(auto*c=IConsoleManager::Get().FindConsoleVariable(name))c->Set(v,ECVF_SetByGameSetting);};
 set(TEXT("r.ScreenPercentage"),bSmoothGraphics?75:100);set(TEXT("r.VolumetricCloud.ViewRaySampleMaxCount"),bSmoothGraphics?64:128);set(TEXT("t.MaxFPS"),60);
 UE_LOG(LogTemp,Display,TEXT("TERRASIM_GRAPHICS smooth=%d"),bSmoothGraphics);
}
ATerraSimGameMode::ATerraSimGameMode(){DefaultPawnClass=ATerraCameraPawn::StaticClass();PlayerControllerClass=ATerraController::StaticClass();HUDClass=ATerraHUD::StaticClass();}
void ATerraHUD::Label(const FString&t,float x,float y,float size,FLinearColor c){FCanvasTextItem item(FVector2D(x,y),FText::FromString(t),FSlateFontInfo(FPaths::EngineContentDir()/TEXT("Slate/Fonts/Roboto-Regular.ttf"),FMath::RoundToInt(size*.75f)),c);item.Font=GEngine->GetSmallFont();Canvas->DrawItem(item);}
void ATerraHUD::Box(float x,float y,float w,float h,FLinearColor c){DrawRect(c,x,y,w,h);Panels.Add(FVector4(x,y,w,h));}
int32 ATerraHUD::ButtonAt(float x,float y)const{for(int32 i=Buttons.Num()-1;i>=0;i--){const auto&r=Buttons[i].Rect;if(x>=r.X&&x<=r.X+r.Z&&y>=r.Y&&y<=r.Y+r.W)return i;}return INDEX_NONE;}
bool ATerraHUD::IsOverInterface(float x,float y)const{for(const auto&r:Panels)if(x>=r.X&&x<=r.X+r.Z&&y>=r.Y&&y<=r.Y+r.W)return true;return false;}
void ATerraHUD::Control(const FString&t,float x,float y,float w,float h,TFunction<void()>action,bool active){
 float mx=0,my=0;bool hover=PlayerOwner->GetMousePosition(mx,my)&&mx>=x&&mx<=x+w&&my>=y&&my<=y+h;
 bool keyboardFocus=Cast<ATerraController>(PlayerOwner)->FocusedButton==Buttons.Num();hover=hover||keyboardFocus;
 FLinearColor fill=active?FLinearColor(.18,.28,.14,.98):hover?FLinearColor(.13,.18,.19,.98):FLinearColor(.065,.09,.10,.98);
 Box(x,y,w,h,fill);Label(t,x+13,y+(h-16)/2,14,active?Accent:Text);Buttons.Add({FVector4(x,y,w,h),MoveTemp(action)});
}
bool ATerraHUD::Click(float x,float y){return ActivateButton(ButtonAt(x,y));}
bool ATerraHUD::ActivateButton(int32 i){if(!Buttons.IsValidIndex(i))return false;auto action=Buttons[i].Action;UE_LOG(LogTemp,Display,TEXT("TERRASIM_UI_CLICK %d"),i);action();return true;}
void ATerraHUD::DrawHUD(){
 Super::DrawHUD();Buttons.Reset();Panels.Reset();auto*pc=Cast<ATerraController>(PlayerOwner);if(!pc||!pc->Simulation)return;auto*s=pc->Simulation.Get();float W=Canvas->SizeX,H=Canvas->SizeY;
 if(s->bImmersive){Control(TEXT("Exit full view [Esc]"),W-222,20,202,42,[s]{s->bImmersive=false;});Control(TEXT("Home [R]"),22,20,118,42,[pc]{pc->ResetCamera();});return;}
 Box(0,0,W,76,Panel);Label(TEXT("TERRASIM"),24,21,24,Text);Label(pc->bTerrain?TEXT("Mont Blanc"):TEXT("Explore Earth"),184,29,13,Accent);
 Control(TEXT("Earth"),W/2-240,18,86,42,[this,pc]{if(pc->bTerrain)UGameplayStatics::OpenLevel(this,TEXT("Earth"));else pc->ResetCamera();},!pc->bTerrain);
 Control(TEXT("Mont Blanc"),W/2-146,18,124,42,[this,pc]{if(pc->bTerrain)pc->ResetCamera();else UGameplayStatics::OpenLevel(this,TEXT("Alps"));},pc->bTerrain);
 Control(TEXT("Science"),W/2-14,18,96,42,[s]{s->bLaboratory=!s->bLaboratory;},s->bLaboratory);
 Control(pc->bSmoothGraphics?TEXT("Smooth"):TEXT("Detailed"),W-366,18,108,42,[pc]{pc->ToggleGraphics();});
 Control(TEXT("Help [H]"),W-248,18,100,42,[pc]{pc->ToggleHelp();});Control(TEXT("Home [R]"),W-138,18,114,42,[pc]{pc->ResetCamera();});
 Label(pc->bFreeFlight?TEXT("Drag to look  |  W A S D move  |  Q / E height  |  Esc returns to easy navigation"):TEXT("Drag to rotate  |  Scroll to zoom  |  Home restores the view"),280,101,13,Text);
 Box(24,98,228,pc->bTerrain?348:390,Panel);Label(pc->bTerrain?TEXT("CHOOSE A VIEW"):TEXT("GO SOMEWHERE"),40,116,14,Accent);
 if(pc->bTerrain){const TCHAR*names[]={TEXT("Summit"),TEXT("Glaciers"),TEXT("Valley"),TEXT("Whole area")};for(int32 i=0;i<4;i++)Control(names[i],40,153+i*48,196,40,[pc,i]{pc->SetTerrainPreset(i);},!pc->bFreeFlight&&pc->SelectedPreset==i);Control(pc->bFreeFlight?TEXT("Back to easy navigation"):TEXT("Fly (advanced)"),40,365,196,42,[pc]{pc->ToggleFlight();},pc->bFreeFlight);}
 else{const TCHAR*names[]={TEXT("Montreal"),TEXT("London"),TEXT("Tokyo"),TEXT("Sydney"),TEXT("North Pole"),TEXT("South Pole")};const int32 locations[]={0,1,2,3,5,6};for(int32 i=0;i<6;i++)Control(names[i],40,153+i*48,196,40,[pc,i]{const int32 ids[]={0,1,2,3,5,6};pc->VisitPlace(ids[i]);},pc->SelectedPlace==locations[i]);}
 // Navigation is always visible and uses the same actions as mouse/keyboard input.
 float nx=W-290,ny=H-258;Box(nx,ny,266,232,Panel);Label(TEXT("MOVE THE VIEW"),nx+16,ny+12,12,Accent);
 Control(TEXT("Up"),nx+98,ny+36,70,38,[pc]{pc->RotateView(0,12);});Control(TEXT("Left"),nx+16,ny+80,70,38,[pc]{pc->RotateView(-18,0);});Control(TEXT("Right"),nx+180,ny+80,70,38,[pc]{pc->RotateView(18,0);});Control(TEXT("Down"),nx+98,ny+124,70,38,[pc]{pc->RotateView(0,-12);});
 Control(TEXT("Zoom +"),nx+16,ny+176,112,40,[pc]{pc->ZoomIn();});Control(TEXT("Zoom -"),nx+138,ny+176,112,40,[pc]{pc->ZoomOut();});
 Box(24,H-112,W-338,86,Panel);Label(s->Time.ToString(TEXT("%Y-%m-%d  %H:%M UTC")),40,H-102,13,Text);
 Control(s->bPlaying?TEXT("Pause sunlight"):TEXT("Play sunlight"),40,H-76,148,40,[pc]{pc->TogglePlay();});
 Control(TEXT("Morning"),198,H-76,96,40,[pc]{pc->SetSunHour(8);});Control(TEXT("Noon"),304,H-76,84,40,[pc]{pc->SetSunHour(12);});Control(TEXT("Evening"),398,H-76,96,40,[pc]{pc->SetSunHour(17);});
 Control(FString::Printf(TEXT("Time: %.0fx"),s->Speed),504,H-76,112,40,[s]{s->Speed=s->Speed<2?60:s->Speed<100?600:1;});
 Label(FString::Printf(TEXT("%.0f fps"),1000./FMath::Max(pc->FrameMs,1.f)),W-405,H-99,11,Muted);
 Label(pc->bTerrain?TEXT("EOX / Copernicus Sentinel 2016 · CC BY 4.0 | Mapzen Terrain Tiles / AWS"):TEXT("Solar System Scope / NASA · CC BY 4.0"),26,H-18,10,Muted);
 if(s->bLaboratory){
  Buttons.Reset();Panels.Reset();Box(0,76,W,H-76,FLinearColor(.005,.01,.015,.7));float x=W/2-330,y=100;Box(x,y,660,FMath::Min(550.f,H-132),Panel);
  Label(TEXT("SCIENCE & MODEL SETTINGS"),x+24,y+22,18,Accent);Control(TEXT("Close"),x+544,y+14,92,38,[s]{s->bLaboratory=false;});
  Label(s->ExperimentName(),x+24,y+80,22,Text);Label(TEXT("Spherical Earth"),x+24,y+128,13,Accent);Label(s->Prediction(false),x+24,y+155,15,Text);
  Label(TEXT("Flat-disc hypothesis"),x+24,y+204,13,FLinearColor(.9,.7,.4));Label(s->Prediction(true),x+24,y+231,15,Text);
  Control(TEXT("Previous"),x+24,y+278,132,42,[s]{s->Experiment=(s->Experiment+14)%15;});Control(TEXT("Next experiment"),x+166,y+278,168,42,[s]{s->Experiment=(s->Experiment+1)%15;});Control(FString::Printf(TEXT("Observer: %.0f m +"),s->ObserverHeight),x+346,y+278,288,42,[s]{s->ObserverHeight=FMath::Fmod(s->ObserverHeight+100.,2100.);});
  if(!pc->bTerrain){Control(s->bFlat?TEXT("Show spherical Earth"):TEXT("Show flat-disc hypothesis"),x+24,y+348,288,44,[pc]{pc->ToggleModel();});Control(s->bClouds?TEXT("Clouds: on"):TEXT("Clouds: off"),x+322,y+348,140,44,[s]{s->bClouds=!s->bClouds;s->Clouds->SetVisibility(s->bClouds);});}
  Control(TEXT("Day -"),x+472,y+348,76,44,[s]{s->Time-=FTimespan::FromDays(1);});Control(TEXT("Day +"),x+558,y+348,76,44,[s]{s->Time+=FTimespan::FromDays(1);});
  Label(FString::Printf(TEXT("Axial tilt: %.2f degrees"),s->Tilt),x+24,y+416,14,Text);Control(TEXT("Tilt -"),x+270,y+402,92,40,[s]{s->Tilt=FMath::Max(0.,s->Tilt-1.);});Control(TEXT("Tilt +"),x+372,y+402,92,40,[s]{s->Tilt=FMath::Min(45.,s->Tilt+1.);});
  Control(TEXT("Reverse time"),x+474,y+402,160,40,[s]{s->Speed=-s->Speed;});
  if(!pc->bTerrain&&s->bFlat){Control(TEXT("Sun -500 km"),x+24,y+454,180,40,[s]{s->SunHeightKm=FMath::Max(500.,s->SunHeightKm-500.);});Control(TEXT("Sun +500 km"),x+214,y+454,180,40,[s]{s->SunHeightKm=FMath::Min(20000.,s->SunHeightKm+500.);});Label(FString::Printf(TEXT("Sun height: %.0f km"),s->SunHeightKm),x+408,y+466,13,Text);}
  Label(TEXT("Esc closes this panel. Flat-disc assumptions are hypothetical."),x+24,y+514,12,Muted);
 }
 if(pc->bHelpOpen){
  Buttons.Reset();Panels.Reset();Box(0,0,W,H,FLinearColor(.005,.01,.015,.72));float x=W/2-254,y=H/2-217;Box(x,y,508,434,Panel);
  Label(TEXT("Explore at your own pace"),x+28,y+28,25,Text);Label(TEXT("No special controls to remember."),x+28,y+70,15,Muted);
  Label(TEXT("1   Drag anywhere in the scene to rotate."),x+28,y+120,16,Text);Label(TEXT("2   Scroll to zoom, or use the Zoom buttons."),x+28,y+168,16,Text);
  Label(TEXT("3   Choose a place or a preset view on the left."),x+28,y+216,16,Text);Label(TEXT("4   Home [R] always restores a safe view."),x+28,y+264,16,Text);
  Control(TEXT("Start exploring [Enter]"),x+28,y+332,452,52,[pc]{pc->CloseHelp();});Label(TEXT("Arrows rotate · Tab / Enter use buttons · Esc closes panels"),x+28,y+399,12,Muted);
 }
}
