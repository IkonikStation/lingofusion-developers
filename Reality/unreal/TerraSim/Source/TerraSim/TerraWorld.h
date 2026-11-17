#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "TerraWorld.generated.h"
class UProceduralMeshComponent;class UMaterialInstanceDynamic;class UCameraComponent;class ADirectionalLight;class APointLight;class ASkyAtmosphere;class ASkyLight;class APostProcessVolume;
UCLASS()
class TERRASIM_API ATerraWorld:public AActor {
 GENERATED_BODY()
public:
 ATerraWorld();virtual void BeginPlay()override;virtual void Tick(float Delta)override;
 UPROPERTY(VisibleAnywhere) TObjectPtr<UProceduralMeshComponent> Planet;
 UPROPERTY(VisibleAnywhere) TObjectPtr<UProceduralMeshComponent> Clouds;
 UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> PlanetMaterial;
 UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> CloudMaterial;
 UPROPERTY() TObjectPtr<ADirectionalLight> Sun;
 UPROPERTY() TObjectPtr<APointLight> LocalSun;
 UPROPERTY() TObjectPtr<ASkyAtmosphere> Atmosphere;
 UPROPERTY() TObjectPtr<ASkyLight> Ambient;
 bool bTerrainWorld=false;
 bool bFlat=false,bPlaying=false,bClouds=true,bImmersive=false;
 double Tilt=23.44,SunHeightKm=5000.,Speed=60.;
 FDateTime Time=FDateTime(2026,6,21,17,30);
 double Latitude=18.,Longitude=-25.,Altitude=12000.,ObserverHeight=100.,TargetDistance=50.;
 int Experiment=0;bool bLaboratory=false;
 void SetModel(bool Flat);void UpdateSun();void BuildPlanet();void Visit(int Index);
 FString Prediction(bool Flat)const;FString ExperimentName()const;
};
UCLASS()
class TERRASIM_API ATerraCameraPawn:public APawn {
 GENERATED_BODY()
public:
 ATerraCameraPawn();UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
};
UCLASS()
class TERRASIM_API ATerraController:public APlayerController {
 GENERATED_BODY()
public:
 virtual void BeginPlay()override;virtual void SetupInputComponent()override;virtual void PlayerTick(float Delta)override;
 UPROPERTY() TObjectPtr<ATerraWorld> Simulation;
 bool bTerrain=false,bFreeFlight=false,bHelpOpen=false,bSmoothGraphics=true;
 double FlySpeed=6000.;float LastMouseX=0,LastMouseY=0;bool HasMouse=false,Dragging=false,DragGestureThisFrame=false;
 int32 PressedButton=INDEX_NONE,FocusedButton=INDEX_NONE,SelectedPreset=0,SelectedPlace=INDEX_NONE;
 double OrbitLat=18.,OrbitLon=-25.,Distance=5.8,FlatYaw=-90.,FlatPitch=45.;
 FVector TerrainTarget=FVector(75000,-638000,330000),FlatTarget=FVector::ZeroVector;
 double TerrainYaw=-45.,TerrainPitch=30.,TerrainDistance=750000.;
 double LastWheelTime=-1.;float FrameMs=16.7f;
 void MouseDown();void MouseUp();void RightMouseDown();void RightMouseUp();
 void ZoomIn();void ZoomOut();void WheelIn();void WheelOut();void TogglePlay();void ToggleModel();void ToggleImmersive();
 void ResetCamera();void FocusLocation();void OpenTerrain();void ToggleHelp();void Escape();void CloseHelp();void NextControl();void ActivateControl();
 void SetTerrainPreset(int32 Index);void RotateView(float Horizontal,float Vertical);void ToggleFlight();void ToggleGraphics();void ApplyGraphics();
 void VisitPlace(int32 Index);void SetSunHour(int32 Hour);FVector TerrainCameraPosition()const;

};
UCLASS()
class TERRASIM_API ATerraHUD:public AHUD {
 GENERATED_BODY()
public:
 virtual void DrawHUD()override;bool Click(float X,float Y);int32 ButtonAt(float X,float Y)const;bool IsOverInterface(float X,float Y)const;bool ActivateButton(int32 Index);
 struct Button {FVector4 Rect;TFunction<void()> Action;};TArray<Button> Buttons;TArray<FVector4> Panels;
 void Label(const FString&Text,float X,float Y,float Size,FLinearColor Color);
 void Box(float X,float Y,float W,float H,FLinearColor C);
 void Control(const FString&Text,float X,float Y,float W,float H,TFunction<void()> Action,bool Active=false);
};
UCLASS()
class TERRASIM_API ATerraSimGameMode:public AGameModeBase {
 GENERATED_BODY()
public:ATerraSimGameMode();
};
