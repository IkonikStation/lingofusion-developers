#pragma once
#include "CoreMinimal.h"
namespace TerraCameraMath {
 inline double ZoomTerrain(double Distance,double Factor){return FMath::Clamp(Distance*Factor,450000.,1600000.);}
 inline FVector SafeFlightPosition(FVector p){p.X=FMath::Clamp(p.X,-1250000.,1250000.);p.Y=FMath::Clamp(p.Y,-1250000.,1250000.);p.Z=FMath::Clamp(p.Z,530000.,1800000.);return p;}
 inline FVector TerrainPosition(FVector Target,double Yaw,double Pitch,double Distance){auto p=Target+FRotator(FMath::Clamp(Pitch,20.,75.),Yaw,0).Vector()*FMath::Clamp(Distance,450000.,1600000.);p.Z=FMath::Max(p.Z,530000.);return p;}
}
