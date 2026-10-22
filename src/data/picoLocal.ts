export const picoLocalBaseUrl = "http://127.0.0.1:1234/v1";

export type PicoModelId = "LingoFusion Pico-1.7B" | "LingoFusion Pico-35B";

export const picoLocalModels: Record<PicoModelId, {
  badge: string;
  downloadSize: string;
  parameters: string;
  context: string;
  maxOutput?: string;
  bestFor: string;
  modelMatcher: RegExp;
  windows: readonly string[];
  mac: readonly string[];
}> = {
  "LingoFusion Pico-1.7B": {
    badge: "Fast & Lightweight", downloadSize: "~1.3 GB", parameters: "1.7B parameters", context: "32K context", bestFor: "Everyday translation and ordinary laptops", modelMatcher: /qwen.*1\.7b/i,
    windows: ["Windows 10 or Windows 11, 64-bit", "8 GB RAM minimum", "16 GB+ RAM recommended", "Modern 64-bit Intel or AMD processor", "Dedicated GPU not required", "4 GB+ VRAM recommended when a compatible dedicated GPU is available", "3 GB minimum free storage", "5 GB+ free storage recommended"],
    mac: ["Modern 64-bit macOS", "8 GB RAM or unified memory minimum", "16 GB+ recommended", "Apple Silicon M1 or newer recommended", "Dedicated GPU not required on Apple Silicon", "3 GB minimum free storage", "5 GB+ free storage recommended"],
  },
  "LingoFusion Pico-35B": {
    badge: "Best Local Quality", downloadSize: "~15 GB", parameters: "35B total parameters · ~3B active", context: "128K context", maxOutput: "32K max output", bestFor: "Difficult translations and powerful local computers", modelMatcher: /(?:qwen|pico).*35b/i,
    windows: ["Windows 10 or Windows 11, 64-bit", "24 GB RAM minimum", "32 GB+ RAM recommended", "Modern 64-bit processor with AVX2 support", "Intel Core i5/i7 or AMD Ryzen 5/7 class processor or newer", "Dedicated GPU not required", "8 GB+ VRAM recommended; 12-16 GB+ preferred", "20 GB minimum free storage", "25-30 GB free storage recommended"],
    mac: ["Apple Silicon required: M1, M2, M3, M4, M5, or newer", "24 GB unified memory minimum", "32 GB+ unified memory recommended", "Integrated Apple Silicon GPU", "Intel Macs unsupported for Pico-35B", "20 GB minimum free storage", "25-30 GB free storage recommended"],
  },
};

export function isPicoModel(model: string) {
  return model in picoLocalModels;
}
