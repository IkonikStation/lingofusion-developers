using UnrealBuildTool;
public class TerraSim : ModuleRules {
 public TerraSim(ReadOnlyTargetRules Target) : base(Target) {
  PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
  PublicDependencyModuleNames.AddRange(new string[] {"Core", "CoreUObject", "Engine", "InputCore", "ProceduralMeshComponent", "Slate", "SlateCore", "UMG", "Json", "JsonUtilities"});
 }
}
