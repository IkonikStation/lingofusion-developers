#!/bin/zsh
set -e
project_root="${0:A:h:h}"
engine_root="/Users/Shared/Epic Games/UE_5.8"
map_name="${1:-Earth}"
"$engine_root/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor" \
 "$project_root/TerraSim.uproject" "/Game/TerraSim/Maps/$map_name" \
 -game -windowed -ResX=1280 -ResY=760 -WinX=80 -WinY=80 -NoSplash -NoSound -ansimalloc -stdout -FullStdOutLogOutput
