export const picoLocalBaseUrl = "http://127.0.0.1:1234/v1";

export const picoLocalRequirements = {
  windows: [
    "Windows 10 or Windows 11, 64-bit",
    "24 GB RAM minimum",
    "Modern 64-bit CPU with AVX2 support",
    "Suggested: Intel Core i5/i7 or AMD Ryzen 5/7 or newer",
    "GPU optional. Recommended: NVIDIA or AMD GPU with 8 GB+ VRAM",
    "At least 20 GB free storage",
    "Recommended: 32 GB+ RAM, 8-16 GB+ VRAM, and 25-30 GB free storage",
  ],
  mac: [
    "Apple Silicon required: M1, M2, M3, M4, M5 families, or newer",
    "24 GB unified memory minimum",
    "Integrated Apple Silicon GPU",
    "Intel Macs are unsupported",
    "At least 20 GB free storage",
    "Recommended: 32 GB+ unified memory and 25-30 GB free storage",
  ],
} as const;

export function isPicoModel(model: string) {
  return model === "LingoFusion Pico";
}
