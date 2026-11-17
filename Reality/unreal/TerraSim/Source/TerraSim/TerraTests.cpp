#include "TerraScience.h"
#include "Misc/AutomationTest.h"
#include "Engine/StaticMesh.h"
#include "StaticMeshResources.h"
#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTerraGeodesyTest,"TerraSim.Science.Geodesy",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTerraGeodesyTest::RunTest(const FString&){using namespace TerraScience;TestTrue(TEXT("Quarter circumference"),FMath::Abs(Distance(0,0,0,90)-10007.557)<.01);TestTrue(TEXT("Two metre horizon"),FMath::Abs(Horizon(2)-5.048)<.01);TestTrue(TEXT("WGS84 normal gravity"),FMath::Abs(Gravity(0,0)-9.7803253)<.00001);TestTrue(TEXT("East longitude follows Unreal reflected Earth frame"),Geo(0,90,1).Y<-.999);return true;}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTerraSunTest,"TerraSim.Science.Sun",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTerraSunTest::RunTest(const FString&){using namespace TerraScience;FDateTime t(2026,6,21,12);TestTrue(TEXT("Solstice declination"),FMath::Abs(Sun(t).X-23.44)<.03);TestTrue(TEXT("Polar daylight"),FMath::Abs(Daylight(80,t)-24)<.001);TestTrue(TEXT("Polar night"),Daylight(-80,t)==0);TestTrue(TEXT("Flat local Sun above horizon"),Elevation(45,-73,t,true,5000)>0);return true;}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTerraTerrainTest,"TerraSim.Assets.RealTerrain",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTerraTerrainTest::RunTest(const FString&){auto*mesh=LoadObject<UStaticMesh>(nullptr,TEXT("/Game/TerraSim/Terrain/SM_MontBlanc.SM_MontBlanc"));TestNotNull(TEXT("Real terrain mesh exists"),mesh);if(mesh){auto*data=mesh->GetRenderData();TestTrue(TEXT("Terrain has real triangles"),data&&data->LODResources.Num()>0&&data->LODResources[0].GetNumTriangles()>100000);if(data&&data->LODResources.Num()){auto&vb=data->LODResources[0].VertexBuffers.StaticMeshVertexBuffer;FVector2f low(1e9,1e9),high(-1e9,-1e9);double nz=0;for(uint32 i=0;i<vb.GetNumVertices();i++){auto uv=vb.GetVertexUV(i,0);low.X=FMath::Min(low.X,uv.X);low.Y=FMath::Min(low.Y,uv.Y);high.X=FMath::Max(high.X,uv.X);high.Y=FMath::Max(high.Y,uv.Y);nz+=vb.VertexTangentZ(i).Z;}AddInfo(FString::Printf(TEXT("TERRASIM_UV_RANGE %.6f %.6f -> %.6f %.6f NORMAL_Z %.3f"),low.X,low.Y,high.X,high.Y,nz/vb.GetNumVertices()));for(const auto&section:data->LODResources[0].Sections){TestNotNull(TEXT("Every rendered section has a material"),mesh->GetMaterial(section.MaterialIndex));TestTrue(TEXT("Every section uses the satellite material"),mesh->GetMaterial(section.MaterialIndex)==mesh->GetMaterial(0));}TestTrue(TEXT("Terrain normals face upward"),nz/vb.GetNumVertices()>.5);TestTrue(TEXT("Satellite UVs cover the image"),high.X-low.X>.99f&&high.Y-low.Y>.99f);}auto e=mesh->GetBounds().BoxExtent;TestTrue(TEXT("Valid mesh units; scene actor normalizes to 27 km"),e.X>1e4&&e.X<2e6);TestTrue(TEXT("Correct up axis and 1x elevation"),e.Z/e.X>.1&&e.Z/e.X<.2);}return true;}
#endif

#if WITH_DEV_AUTOMATION_TESTS
#include "TerraCameraMath.h"
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTerraCameraSafetyTest,"TerraSim.Controls.TerrainSafety",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTerraCameraSafetyTest::RunTest(const FString&){
 for(double pitch:{-500.,0.,20.,75.,500.})for(double distance:{-1000.,1.,450000.,1600000.,1e9}){
  auto p=TerraCameraMath::TerrainPosition(FVector(75000,-638000,330000),-45,pitch,distance);
  TestTrue(TEXT("Guided camera stays above all terrain"),p.Z>=530000.&&!p.ContainsNaN());
 }
 auto p=TerraCameraMath::SafeFlightPosition(FVector(1e9,-1e9,-1e9));
 TestTrue(TEXT("Free flight stays inside the available patch and above terrain"),p.X==1250000.&&p.Y==-1250000.&&p.Z==530000.);return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTerraZoomSafetyTest,"TerraSim.Controls.ZoomLimits",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTerraZoomSafetyTest::RunTest(const FString&){double d=750000.;for(int i=0;i<1000;i++)d=TerraCameraMath::ZoomTerrain(d,.88);TestEqual(TEXT("Repeated trackpad zoom cannot enter the mountain"),d,450000.);for(int i=0;i<1000;i++)d=TerraCameraMath::ZoomTerrain(d,1./.88);TestEqual(TEXT("Repeated zoom out cannot lose the terrain"),d,1600000.);return true;}
#endif
