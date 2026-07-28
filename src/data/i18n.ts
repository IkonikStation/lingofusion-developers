export const languages = [
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն", dir: "ltr" },
  { code: "zh", name: "Chinese", nativeName: "中文", dir: "ltr" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr" },
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "kl", name: "Greenlandic", nativeName: "Kalaallisut", dir: "ltr" },
  { code: "he", name: "Hebrew", nativeName: "עברית", dir: "rtl" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "fa", name: "Persian (Farsi)", nativeName: "فارسی", dir: "rtl" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", dir: "ltr" },
] as const;

export type LanguageCode = (typeof languages)[number]["code"];

export type TranslationKey =
  | "home"
  | "api"
  | "models"
  | "docs"
  | "resources"
  | "searchDocs"
  | "noResults"
  | "light"
  | "dark"
  | "dashboard"
  | "openNavigation"
  | "closeNavigation"
  | "language"
  | "latestModels"
  | "collapse"
  | "onThisPage"
  | "pricing"
  | "lingoFusionApi"
  | "pricingHero"
  | "openDashboard"
  | "comparePricing"
  | "textCalculator"
  | "ttsCalculator"
  | "liveTranslateCalculator"
  | "transcriptionCalculator"
  | "dubbingCalculator"
  | "musicCalculator"
  | "imageCalculator"
  | "pdfCalculator"
  | "model"
  | "inputTokens"
  | "outputTokens"
  | "characters"
  | "minutes"
  | "minuteHelp"
  | "images"
  | "workflow"
  | "extractions"
  | "documents"
  | "estimate"
  | "textModels"
  | "ttsModels"
  | "transcriptionModels"
  | "dubbingModels"
  | "musicModels"
  | "imageTranslation"
  | "pdfExtractionEditing"
  | "billingNotes"
  | "pricesPer1MTokens"
  | "pricesPer1KCharactersAndMinute"
  | "pricesPerMinute"
  | "pricesPerImage"
  | "pdfWorkflows"
  | "tableModel"
  | "tableInput"
  | "tableOutput"
  | "tablePrice"
  | "tableImageSize"
  | "recommended"
  | "billingText"
  | "billingTts"
  | "billingTranscription"
  | "billingDubbing"
  | "billingMusic"
  | "billingImage"
  | "billingPdf"
  | "developerDocs"
  | "modelReference"
  | "viewPricing"
  | "copyQuickstart"
  | "startFast"
  | "monitorUsage"
  | "shipReliably"
  | "relatedPages";

const en: Record<TranslationKey, string> = {
  home: "Home",
  api: "API",
  models: "Models",
  docs: "Docs",
  resources: "Resources",
  searchDocs: "Search docs",
  noResults: "No results found.",
  light: "Light",
  dark: "Dark",
  dashboard: "Dashboard",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  language: "Language",
  latestModels: "Latest models",
  collapse: "Collapse",
  onThisPage: "On this page",
  pricing: "Pricing",
  lingoFusionApi: "LingoFusion API",
  pricingHero: "Simple, pay-as-you-go pricing for text, speech, image, and dubbing models. Prices for text models are listed per 1M tokens.",
  openDashboard: "Open dashboard",
  comparePricing: "Compare pricing",
  textCalculator: "Text calculator",
  ttsCalculator: "TTS calculator",
  liveTranslateCalculator: "Live translate calculator",
  transcriptionCalculator: "Transcription calculator",
  dubbingCalculator: "Dubbing calculator",
  musicCalculator: "Music calculator",
  imageCalculator: "Image calculator",
  pdfCalculator: "PDF calculator",
  model: "Model",
  inputTokens: "Input tokens",
  outputTokens: "Output tokens",
  characters: "Characters",
  minutes: "Minutes (mm.ss)",
  minuteHelp: "Use minute.second format, so `1.30` means 1 minute 30 seconds.",
  images: "Images",
  workflow: "Workflow",
  extractions: "Extractions",
  documents: "Documents",
  estimate: "Estimate",
  textModels: "Text models",
  ttsModels: "TTS models",
  transcriptionModels: "Transcription models",
  dubbingModels: "Dubbing models",
  musicModels: "Music",
  imageTranslation: "Image translation",
  pdfExtractionEditing: "PDF extraction and editing",
  billingNotes: "Billing notes",
  pricesPer1MTokens: "Prices per 1M tokens",
  pricesPer1KCharactersAndMinute: "Prices per 1K characters and per minute",
  pricesPerMinute: "Prices per minute",
  pricesPerImage: "Prices per image",
  pdfWorkflows: "PDF document workflows",
  tableModel: "Model",
  tableInput: "Input",
  tableOutput: "Output",
  tablePrice: "Price",
  tableImageSize: "Image size",
  recommended: "Recommended",
  billingText: "Text models are billed per 1M tokens.",
  billingTts: "TTS models are billed per 1K characters.",
  billingTranscription: "Transcription models are billed per minute.",
  billingDubbing: "Dubbing models are billed per minute.",
  billingMusic: "Music models are billed per minute.",
  billingImage: "Image translation is billed per image based on size.",
  billingPdf: "PDF text extraction is billed per 500 extractions; PDF editing and translation pricing is TBD.",
  developerDocs: "Developer docs",
  modelReference: "Model reference",
  viewPricing: "View pricing",
  copyQuickstart: "Copy quickstart",
  startFast: "Start fast",
  monitorUsage: "Monitor usage",
  shipReliably: "Ship reliably",
  relatedPages: "Related pages",
};

const overrides: Record<LanguageCode, Partial<Record<TranslationKey, string>>> = {
  en: {},
  ar: {
    home: "الرئيسية", api: "واجهة API", models: "النماذج", docs: "المستندات", resources: "الموارد", searchDocs: "ابحث في المستندات", noResults: "لا توجد نتائج.", light: "فاتح", dark: "داكن", dashboard: "لوحة التحكم", language: "اللغة", latestModels: "أحدث النماذج", collapse: "طي", onThisPage: "في هذه الصفحة", pricing: "الأسعار", lingoFusionApi: "واجهة LingoFusion API", pricingHero: "أسعار بسيطة حسب الاستخدام لنماذج النص والكلام والصور والدبلجة. أسعار نماذج النص لكل مليون رمز.", openDashboard: "افتح لوحة التحكم", comparePricing: "قارن الأسعار", textCalculator: "حاسبة النص", ttsCalculator: "حاسبة تحويل النص إلى كلام", liveTranslateCalculator: "حاسبة الترجمة المباشرة", transcriptionCalculator: "حاسبة التفريغ", dubbingCalculator: "حاسبة الدبلجة", imageCalculator: "حاسبة الصور", pdfCalculator: "حاسبة PDF", model: "النموذج", inputTokens: "رموز الإدخال", outputTokens: "رموز الإخراج", characters: "الأحرف", minutes: "الدقائق (mm.ss)", images: "الصور", workflow: "سير العمل", extractions: "الاستخراج", documents: "المستندات", estimate: "التقدير", textModels: "نماذج النص", ttsModels: "نماذج TTS", transcriptionModels: "نماذج التفريغ", dubbingModels: "نماذج الدبلجة", imageTranslation: "ترجمة الصور", pdfExtractionEditing: "استخراج وتحرير PDF", billingNotes: "ملاحظات الفوترة", tableModel: "النموذج", tableInput: "الإدخال", tableOutput: "الإخراج", tablePrice: "السعر", recommended: "موصى به", developerDocs: "مستندات المطورين", modelReference: "مرجع النموذج", viewPricing: "عرض الأسعار", copyQuickstart: "نسخ البداية السريعة", relatedPages: "صفحات ذات صلة",
  },
  hy: { home: "Գլխավոր", api: "API", models: "Մոդելներ", docs: "Փաստաթղթեր", resources: "Ռեսուրսներ", searchDocs: "Որոնել փաստաթղթերում", light: "Լուսավոր", dark: "Մութ", dashboard: "Վահանակ", language: "Լեզու", latestModels: "Վերջին մոդելներ", pricing: "Գներ", openDashboard: "Բացել վահանակը", comparePricing: "Համեմատել գները", model: "Մոդել", estimate: "Գնահատում", textModels: "Տեքստային մոդելներ", billingNotes: "Վճարման նշումներ", recommended: "Առաջարկվող" },
  zh: { home: "首页", api: "API", models: "模型", docs: "文档", resources: "资源", searchDocs: "搜索文档", noResults: "未找到结果。", light: "浅色", dark: "深色", dashboard: "仪表板", language: "语言", latestModels: "最新模型", collapse: "折叠", onThisPage: "本页内容", pricing: "价格", lingoFusionApi: "LingoFusion API", pricingHero: "面向文本、语音、图像和配音模型的简单按量付费价格。文本模型按每 100 万 token 计价。", openDashboard: "打开仪表板", comparePricing: "比较价格", textCalculator: "文本计算器", model: "模型", inputTokens: "输入 token", outputTokens: "输出 token", characters: "字符", minutes: "分钟 (mm.ss)", estimate: "估算", textModels: "文本模型", tableModel: "模型", tableInput: "输入", tableOutput: "输出", tablePrice: "价格", recommended: "推荐" },
  nl: { home: "Home", api: "API", models: "Modellen", docs: "Docs", resources: "Bronnen", searchDocs: "Docs zoeken", light: "Licht", dark: "Donker", dashboard: "Dashboard", language: "Taal", latestModels: "Nieuwste modellen", pricing: "Prijzen", openDashboard: "Dashboard openen", comparePricing: "Prijzen vergelijken", model: "Model", estimate: "Schatting", textModels: "Tekstmodellen", billingNotes: "Factureringsnotities", recommended: "Aanbevolen" },
  fr: { home: "Accueil", api: "API", models: "Modèles", docs: "Docs", resources: "Ressources", searchDocs: "Rechercher dans la doc", noResults: "Aucun résultat.", light: "Clair", dark: "Sombre", dashboard: "Tableau de bord", language: "Langue", latestModels: "Derniers modèles", collapse: "Réduire", onThisPage: "Sur cette page", pricing: "Tarifs", lingoFusionApi: "API LingoFusion", pricingHero: "Tarification simple à l’usage pour les modèles texte, voix, image et doublage. Les modèles texte sont facturés par 1 M de jetons.", openDashboard: "Ouvrir le tableau de bord", comparePricing: "Comparer les tarifs", textCalculator: "Calculateur texte", ttsCalculator: "Calculateur TTS", liveTranslateCalculator: "Calculateur traduction en direct", transcriptionCalculator: "Calculateur transcription", dubbingCalculator: "Calculateur doublage", imageCalculator: "Calculateur image", pdfCalculator: "Calculateur PDF", model: "Modèle", inputTokens: "Jetons d’entrée", outputTokens: "Jetons de sortie", characters: "Caractères", minutes: "Minutes (mm.ss)", images: "Images", workflow: "Flux", estimate: "Estimation", textModels: "Modèles texte", ttsModels: "Modèles TTS", transcriptionModels: "Modèles de transcription", dubbingModels: "Modèles de doublage", imageTranslation: "Traduction d’image", pdfExtractionEditing: "Extraction et édition PDF", billingNotes: "Notes de facturation", tableModel: "Modèle", tableInput: "Entrée", tableOutput: "Sortie", tablePrice: "Prix", recommended: "Recommandé" },
  de: { home: "Start", api: "API", models: "Modelle", docs: "Dokumente", resources: "Ressourcen", searchDocs: "Dokumente suchen", light: "Hell", dark: "Dunkel", dashboard: "Dashboard", language: "Sprache", latestModels: "Neueste Modelle", pricing: "Preise", openDashboard: "Dashboard öffnen", comparePricing: "Preise vergleichen", model: "Modell", estimate: "Schätzung", textModels: "Textmodelle", billingNotes: "Abrechnungshinweise", recommended: "Empfohlen" },
  kl: { home: "Saqqaa", api: "API", models: "Modelit", docs: "Allagaatit", resources: "Atortussat", searchDocs: "Allagaatini ujarlerit", light: "Qaamaneq", dark: "Taartoq", dashboard: "Dashboard", language: "Oqaatsit", latestModels: "Modelit nutaat", pricing: "Akigititat", openDashboard: "Dashboard ammaruk", comparePricing: "Akigititat sanilliukkit", model: "Modeli", estimate: "Missiliuut", textModels: "Allakkatigut modelit", billingNotes: "Akiligassat pillugit", recommended: "Inassutigineqartoq" },
  he: { home: "בית", api: "API", models: "מודלים", docs: "מסמכים", resources: "משאבים", searchDocs: "חיפוש במסמכים", light: "בהיר", dark: "כהה", dashboard: "לוח בקרה", language: "שפה", latestModels: "המודלים האחרונים", pricing: "תמחור", openDashboard: "פתח לוח בקרה", comparePricing: "השווה מחירים", model: "מודל", estimate: "הערכה", textModels: "מודלי טקסט", billingNotes: "הערות חיוב", recommended: "מומלץ" },
  hi: { home: "होम", api: "API", models: "मॉडल", docs: "दस्तावेज़", resources: "संसाधन", searchDocs: "दस्तावेज़ खोजें", light: "लाइट", dark: "डार्क", dashboard: "डैशबोर्ड", language: "भाषा", latestModels: "नवीनतम मॉडल", pricing: "मूल्य", openDashboard: "डैशबोर्ड खोलें", comparePricing: "मूल्य तुलना करें", model: "मॉडल", estimate: "अनुमान", textModels: "टेक्स्ट मॉडल", billingNotes: "बिलिंग नोट्स", recommended: "अनुशंसित" },
  it: { home: "Home", api: "API", models: "Modelli", docs: "Documenti", resources: "Risorse", searchDocs: "Cerca nei documenti", light: "Chiaro", dark: "Scuro", dashboard: "Dashboard", language: "Lingua", latestModels: "Modelli recenti", pricing: "Prezzi", openDashboard: "Apri dashboard", comparePricing: "Confronta prezzi", model: "Modello", estimate: "Stima", textModels: "Modelli di testo", billingNotes: "Note di fatturazione", recommended: "Consigliato" },
  ja: { home: "ホーム", api: "API", models: "モデル", docs: "ドキュメント", resources: "リソース", searchDocs: "ドキュメントを検索", light: "ライト", dark: "ダーク", dashboard: "ダッシュボード", language: "言語", latestModels: "最新モデル", pricing: "料金", openDashboard: "ダッシュボードを開く", comparePricing: "料金を比較", model: "モデル", estimate: "見積もり", textModels: "テキストモデル", billingNotes: "請求メモ", recommended: "おすすめ" },
  ko: { home: "홈", api: "API", models: "모델", docs: "문서", resources: "리소스", searchDocs: "문서 검색", light: "라이트", dark: "다크", dashboard: "대시보드", language: "언어", latestModels: "최신 모델", pricing: "가격", openDashboard: "대시보드 열기", comparePricing: "가격 비교", model: "모델", estimate: "예상", textModels: "텍스트 모델", billingNotes: "청구 안내", recommended: "추천" },
  fa: { home: "خانه", api: "API", models: "مدل‌ها", docs: "مستندات", resources: "منابع", searchDocs: "جستجوی مستندات", light: "روشن", dark: "تیره", dashboard: "داشبورد", language: "زبان", latestModels: "جدیدترین مدل‌ها", pricing: "قیمت‌گذاری", openDashboard: "باز کردن داشبورد", comparePricing: "مقایسه قیمت‌ها", model: "مدل", estimate: "برآورد", textModels: "مدل‌های متن", billingNotes: "یادداشت‌های صورتحساب", recommended: "پیشنهادی" },
  pl: { home: "Strona główna", api: "API", models: "Modele", docs: "Dokumenty", resources: "Zasoby", searchDocs: "Szukaj w dokumentach", light: "Jasny", dark: "Ciemny", dashboard: "Panel", language: "Język", latestModels: "Najnowsze modele", pricing: "Cennik", openDashboard: "Otwórz panel", comparePricing: "Porównaj ceny", model: "Model", estimate: "Szacunek", textModels: "Modele tekstowe", billingNotes: "Uwagi rozliczeniowe", recommended: "Polecane" },
  pt: { home: "Início", api: "API", models: "Modelos", docs: "Docs", resources: "Recursos", searchDocs: "Pesquisar docs", light: "Claro", dark: "Escuro", dashboard: "Painel", language: "Idioma", latestModels: "Modelos recentes", pricing: "Preços", openDashboard: "Abrir painel", comparePricing: "Comparar preços", model: "Modelo", estimate: "Estimativa", textModels: "Modelos de texto", billingNotes: "Notas de cobrança", recommended: "Recomendado" },
  ru: { home: "Главная", api: "API", models: "Модели", docs: "Документы", resources: "Ресурсы", searchDocs: "Поиск по документам", light: "Светлая", dark: "Тёмная", dashboard: "Панель", language: "Язык", latestModels: "Новые модели", pricing: "Цены", openDashboard: "Открыть панель", comparePricing: "Сравнить цены", model: "Модель", estimate: "Оценка", textModels: "Текстовые модели", billingNotes: "Примечания к оплате", recommended: "Рекомендуется" },
  es: { home: "Inicio", api: "API", models: "Modelos", docs: "Docs", resources: "Recursos", searchDocs: "Buscar docs", noResults: "No se encontraron resultados.", light: "Claro", dark: "Oscuro", dashboard: "Panel", language: "Idioma", latestModels: "Modelos recientes", collapse: "Contraer", onThisPage: "En esta página", pricing: "Precios", lingoFusionApi: "API de LingoFusion", pricingHero: "Precios simples de pago por uso para modelos de texto, voz, imagen y doblaje. Los modelos de texto se muestran por 1 M de tokens.", openDashboard: "Abrir panel", comparePricing: "Comparar precios", textCalculator: "Calculadora de texto", model: "Modelo", inputTokens: "Tokens de entrada", outputTokens: "Tokens de salida", characters: "Caracteres", minutes: "Minutos (mm.ss)", estimate: "Estimación", textModels: "Modelos de texto", tableModel: "Modelo", tableInput: "Entrada", tableOutput: "Salida", tablePrice: "Precio", recommended: "Recomendado" },
  tr: { home: "Ana sayfa", api: "API", models: "Modeller", docs: "Belgeler", resources: "Kaynaklar", searchDocs: "Belgelerde ara", light: "Açık", dark: "Koyu", dashboard: "Panel", language: "Dil", latestModels: "En yeni modeller", pricing: "Fiyatlar", openDashboard: "Paneli aç", comparePricing: "Fiyatları karşılaştır", model: "Model", estimate: "Tahmin", textModels: "Metin modelleri", billingNotes: "Faturalandırma notları", recommended: "Önerilen" },
  uk: { home: "Головна", api: "API", models: "Моделі", docs: "Документи", resources: "Ресурси", searchDocs: "Пошук у документах", light: "Світла", dark: "Темна", dashboard: "Панель", language: "Мова", latestModels: "Нові моделі", pricing: "Ціни", openDashboard: "Відкрити панель", comparePricing: "Порівняти ціни", model: "Модель", estimate: "Оцінка", textModels: "Текстові моделі", billingNotes: "Примітки до оплати", recommended: "Рекомендовано" },
};

export function getLanguage(code: LanguageCode) {
  return languages.find((language) => language.code === code) ?? languages.find((language) => language.code === "en")!;
}

export function createTranslator(code: LanguageCode) {
  const table = { ...en, ...overrides[code] };
  return (key: TranslationKey) => table[key] ?? en[key];
}

const contentTranslations: Record<LanguageCode, Record<string, string>> = {
  en: {},
  ar: {
    "Get started": "ابدأ", Overview: "نظرة عامة", Quickstart: "البداية السريعة", "Core concepts": "المفاهيم الأساسية", "Text generation": "توليد النص", "Speech generation": "توليد الكلام", Dubbing: "الدبلجة", "SDKs and libraries": "حزم SDK والمكتبات", "Error codes": "رموز الأخطاء", Changelog: "سجل التغييرات", Support: "الدعم", Status: "الحالة",
    "Build translation, text, speech, image, and dubbing workflows with one developer platform.": "ابنِ مسارات عمل للترجمة والنص والكلام والصور والدبلجة من منصة مطورين واحدة.",
    "Create an API key, install an SDK, and make your first LingoFusion request in minutes.": "أنشئ مفتاح API وثبّت SDK وأرسل أول طلب LingoFusion خلال دقائق.",
    "Compare every LingoFusion model by modality, latency profile, and recommended use case.": "قارن كل نموذج LingoFusion حسب النوع وزمن الاستجابة وحالة الاستخدام الموصى بها.",
  },
  hy: { "Get started": "Սկսել", Overview: "Ընդհանուր ակնարկ", Quickstart: "Արագ սկիզբ", "Core concepts": "Հիմնական հասկացություններ", "Text generation": "Տեքստի ստեղծում", "Speech generation": "Խոսքի ստեղծում", Dubbing: "Դուբլյաժ", "SDKs and libraries": "SDK-ներ և գրադարաններ", "Error codes": "Սխալի կոդեր", Changelog: "Փոփոխությունների մատյան", Support: "Աջակցություն", Status: "Կարգավիճակ" },
  zh: { "Get started": "开始使用", Overview: "概览", Quickstart: "快速开始", "Core concepts": "核心概念", "Text generation": "文本生成", "Speech generation": "语音生成", Dubbing: "配音", "SDKs and libraries": "SDK 和库", "Error codes": "错误代码", Changelog: "更新日志", Support: "支持", Status: "状态" },
  nl: { "Get started": "Aan de slag", Overview: "Overzicht", Quickstart: "Snelstart", "Core concepts": "Kernconcepten", "Text generation": "Tekstgeneratie", "Speech generation": "Spraakgeneratie", Dubbing: "Nasynchronisatie", "SDKs and libraries": "SDK's en bibliotheken", "Error codes": "Foutcodes", Changelog: "Wijzigingslogboek", Support: "Ondersteuning", Status: "Status" },
  fr: { "Get started": "Bien démarrer", Overview: "Vue d’ensemble", Quickstart: "Démarrage rapide", "Core concepts": "Concepts clés", "Text generation": "Génération de texte", "Speech generation": "Génération vocale", Dubbing: "Doublage", "SDKs and libraries": "SDK et bibliothèques", "Error codes": "Codes d’erreur", Changelog: "Journal des modifications", Support: "Assistance", Status: "Statut" },
  de: { "Get started": "Erste Schritte", Overview: "Übersicht", Quickstart: "Schnellstart", "Core concepts": "Grundkonzepte", "Text generation": "Texterzeugung", "Speech generation": "Spracherzeugung", Dubbing: "Synchronisation", "SDKs and libraries": "SDKs und Bibliotheken", "Error codes": "Fehlercodes", Changelog: "Änderungsprotokoll", Support: "Support", Status: "Status" },
  kl: { "Get started": "Aallartinneq", Overview: "Takussutissiaq", Quickstart: "Sukkasuumik aallartinneq", "Core concepts": "Paasissutissat pingaarnerit", "Text generation": "Allakkat pilersinneri", "Speech generation": "Oqalunneq pilersinneq", Dubbing: "Oqalutsitsineq", "SDKs and libraries": "SDK-it atuagaasiviillu", "Error codes": "Kukkunerit koodii", Changelog: "Allannguutit", Support: "Ik الدعم", Status: "Killiffik" },
  he: { "Get started": "התחלה", Overview: "סקירה", Quickstart: "התחלה מהירה", "Core concepts": "מושגי יסוד", "Text generation": "יצירת טקסט", "Speech generation": "יצירת דיבור", Dubbing: "דיבוב", "SDKs and libraries": "SDK וספריות", "Error codes": "קודי שגיאה", Changelog: "יומן שינויים", Support: "תמיכה", Status: "סטטוס" },
  hi: { "Get started": "शुरू करें", Overview: "अवलोकन", Quickstart: "त्वरित शुरुआत", "Core concepts": "मुख्य अवधारणाएँ", "Text generation": "टेक्स्ट जनरेशन", "Speech generation": "स्पीच जनरेशन", Dubbing: "डबिंग", "SDKs and libraries": "SDK और लाइब्रेरी", "Error codes": "त्रुटि कोड", Changelog: "चेंजलॉग", Support: "सहायता", Status: "स्थिति" },
  it: { "Get started": "Inizia", Overview: "Panoramica", Quickstart: "Avvio rapido", "Core concepts": "Concetti chiave", "Text generation": "Generazione testo", "Speech generation": "Generazione vocale", Dubbing: "Doppiaggio", "SDKs and libraries": "SDK e librerie", "Error codes": "Codici errore", Changelog: "Registro modifiche", Support: "Supporto", Status: "Stato" },
  ja: { "Get started": "はじめに", Overview: "概要", Quickstart: "クイックスタート", "Core concepts": "基本概念", "Text generation": "テキスト生成", "Speech generation": "音声生成", Dubbing: "吹き替え", "SDKs and libraries": "SDK とライブラリ", "Error codes": "エラーコード", Changelog: "変更履歴", Support: "サポート", Status: "ステータス" },
  ko: { "Get started": "시작하기", Overview: "개요", Quickstart: "빠른 시작", "Core concepts": "핵심 개념", "Text generation": "텍스트 생성", "Speech generation": "음성 생성", Dubbing: "더빙", "SDKs and libraries": "SDK 및 라이브러리", "Error codes": "오류 코드", Changelog: "변경 로그", Support: "지원", Status: "상태" },
  fa: { "Get started": "شروع", Overview: "نمای کلی", Quickstart: "شروع سریع", "Core concepts": "مفاهیم اصلی", "Text generation": "تولید متن", "Speech generation": "تولید گفتار", Dubbing: "دوبله", "SDKs and libraries": "SDKها و کتابخانه‌ها", "Error codes": "کدهای خطا", Changelog: "تغییرات", Support: "پشتیبانی", Status: "وضعیت" },
  pl: { "Get started": "Pierwsze kroki", Overview: "Przegląd", Quickstart: "Szybki start", "Core concepts": "Podstawowe pojęcia", "Text generation": "Generowanie tekstu", "Speech generation": "Generowanie mowy", Dubbing: "Dubbing", "SDKs and libraries": "SDK i biblioteki", "Error codes": "Kody błędów", Changelog: "Dziennik zmian", Support: "Wsparcie", Status: "Status" },
  pt: { "Get started": "Começar", Overview: "Visão geral", Quickstart: "Início rápido", "Core concepts": "Conceitos principais", "Text generation": "Geração de texto", "Speech generation": "Geração de fala", Dubbing: "Dublagem", "SDKs and libraries": "SDKs e bibliotecas", "Error codes": "Códigos de erro", Changelog: "Registro de alterações", Support: "Suporte", Status: "Status" },
  ru: { "Get started": "Начало работы", Overview: "Обзор", Quickstart: "Быстрый старт", "Core concepts": "Основные понятия", "Text generation": "Генерация текста", "Speech generation": "Генерация речи", Dubbing: "Дубляж", "SDKs and libraries": "SDK и библиотеки", "Error codes": "Коды ошибок", Changelog: "Журнал изменений", Support: "Поддержка", Status: "Статус" },
  es: { "Get started": "Primeros pasos", Overview: "Resumen", Quickstart: "Inicio rápido", "Core concepts": "Conceptos clave", "Text generation": "Generación de texto", "Speech generation": "Generación de voz", Dubbing: "Doblaje", "SDKs and libraries": "SDK y bibliotecas", "Error codes": "Códigos de error", Changelog: "Registro de cambios", Support: "Soporte", Status: "Estado" },
  tr: { "Get started": "Başlarken", Overview: "Genel bakış", Quickstart: "Hızlı başlangıç", "Core concepts": "Temel kavramlar", "Text generation": "Metin üretimi", "Speech generation": "Konuşma üretimi", Dubbing: "Dublaj", "SDKs and libraries": "SDK'lar ve kitaplıklar", "Error codes": "Hata kodları", Changelog: "Değişiklik günlüğü", Support: "Destek", Status: "Durum" },
  uk: { "Get started": "Початок", Overview: "Огляд", Quickstart: "Швидкий старт", "Core concepts": "Основні поняття", "Text generation": "Генерація тексту", "Speech generation": "Генерація мовлення", Dubbing: "Дубляж", "SDKs and libraries": "SDK і бібліотеки", "Error codes": "Коди помилок", Changelog: "Журнал змін", Support: "Підтримка", Status: "Стан" },
};

export function createContentTranslator(code: LanguageCode) {
  const table = contentTranslations[code] ?? {};
  const keyedEntries = Object.entries(en).reduce<Record<string, string>>((entries, [key, value]) => {
    entries[value] = createTranslator(code)(key as TranslationKey);
    return entries;
  }, {});
  const glossary = contentGlossary[code] ?? {};
  const resetText = resetTranslations[code] ?? {};

  return (text: string) => {
    if (code === "en") {
      return text;
    }

    const exact = resetText[text] ?? table[text] ?? keyedEntries[text] ?? glossary[text];
    if (exact) {
      return exact;
    }

    return translateWithGlossary(text, glossary);
  };
}

const contentGlossary: Record<LanguageCode, Record<string, string>> = {
  en: {},
  ar: {
    "Developer portal": "بوابة المطورين", "Close dashboard": "إغلاق لوحة التحكم", Playground: "ساحة التجربة", Projects: "المشاريع", "API Keys": "مفاتيح API", Usage: "الاستخدام", "Request Logs": "سجلات الطلبات", "Auto-Recharge": "الشحن التلقائي", Rewards: "المكافآت", Notifications: "الإشعارات", "Loading live API platform data...": "جار تحميل بيانات منصة API الحية...", "Backend unavailable": "الخادم غير متاح", Copy: "نسخ", Create: "إنشاء", Rotate: "تدوير", Subscribe: "اشتراك", Cancel: "إلغاء", Example: "مثال", Input: "الإدخال", Project: "المشروع", Description: "الوصف", Status: "الحالة", Budget: "الميزانية", Created: "أُنشئ", Date: "التاريخ", Type: "النوع", Amount: "المبلغ", Request: "الطلب", Endpoint: "نقطة النهاية", Tokens: "الرموز", Cost: "التكلفة", Latency: "زمن الاستجابة", Service: "الخدمة", Operational: "يعمل", Enabled: "مفعّل", Disabled: "معطّل", Successful: "ناجح", Failed: "فشل", "Current balance": "الرصيد الحالي", "Pending charges": "رسوم معلّقة", "Lifetime API spend": "إجمالي إنفاق API", "Total requests": "إجمالي الطلبات", "Input tokens": "رموز الإدخال", "Output tokens": "رموز الإخراج", "API playground": "ساحة تجربة API", "API key": "مفتاح API", "From language": "لغة المصدر", "To language": "لغة الهدف", Streaming: "البث", "Run simulated API call": "تشغيل طلب API محاكى", "Create key": "إنشاء مفتاح", "Available fake balance": "الرصيد التجريبي المتاح", "What this does": "ما الذي يفعله هذا", Name: "الاسم", Permissions: "الأذونات", "Select project": "اختر مشروعًا", "Key name": "اسم المفتاح", "Expiration date": "تاريخ الانتهاء", "Spend limit": "حد الإنفاق", Billing: "الفوترة", "Paid credit": "رصيد مدفوع", "Reward credit": "رصيد مكافآت", "Total purchased": "إجمالي المشتريات", "API spend": "إنفاق API", "Add balance": "إضافة رصيد", "All projects": "كل المشاريع", "All statuses": "كل الحالات", "Export CSV": "تصدير CSV", "Usage analytics": "تحليلات الاستخدام", "Successful requests": "طلبات ناجحة", "Failed requests": "طلبات فاشلة", "Total tokens": "إجمالي الرموز", "Words processed": "الكلمات المعالجة", "Average latency": "متوسط الاستجابة", "Streaming split": "تقسيم البث", "Auto-recharge": "الشحن التلقائي", Threshold: "الحد", "Recharge amount": "مبلغ الشحن", "Monthly limit": "الحد الشهري", "Payment method": "طريقة الدفع", "Save auto-recharge": "حفظ الشحن التلقائي", "Next reward": "المكافأة التالية", Remaining: "المتبقي", "Reward balance": "رصيد المكافآت", "Progress to next reward": "التقدم نحو المكافأة التالية", "API documentation": "مستندات API", "Versioned endpoint": "نقطة نهاية بإصدار", Idempotency: "منع التكرار", Language: "اللغة", "Copy example": "نسخ المثال", "Want to spend fake balance?": "هل تريد إنفاق الرصيد التجريبي؟", "Request browser permission": "طلب إذن المتصفح", "Subscribe by email": "الاشتراك بالبريد الإلكتروني", "90-day uptime": "وقت التشغيل خلال 90 يومًا", "Text translation": "ترجمة النص", "Image translation": "ترجمة الصور", "Text-to-speech": "تحويل النص إلى كلام", Transcription: "التفريغ", "Audio dubbing": "دبلجة الصوت", "Video dubbing": "دبلجة الفيديو", "Billing access": "وصول الفوترة",
  },
  hy: {
    "Developer portal": "Մշակողների պորտալ", "Close dashboard": "Փակել վահանակը", Playground: "Փորձասրահ", Projects: "Նախագծեր", "API Keys": "API բանալիներ", Usage: "Օգտագործում", "Request Logs": "Հարցումների մատյաններ", "Auto-Recharge": "Ավտոմատ լիցքավորում", Rewards: "Պարգևներ", Notifications: "Ծանուցումներ", Copy: "Պատճենել", Create: "Ստեղծել", Rotate: "Թարմացնել", Subscribe: "Բաժանորդագրվել", Cancel: "Չեղարկել", Example: "Օրինակ", Input: "Մուտք", Project: "Նախագիծ", Description: "Նկարագրություն", Status: "Կարգավիճակ", Budget: "Բյուջե", Date: "Ամսաթիվ", Type: "Տեսակ", Amount: "Գումար", Request: "Հարցում", Endpoint: "Վերջնակետ", Tokens: "Թոքեններ", Cost: "Արժեք", Latency: "Հապաղում", Service: "Ծառայություն", Operational: "Աշխատում է", Enabled: "Միացված", Disabled: "Անջատված", Successful: "Հաջող", Failed: "Ձախողված", "Current balance": "Ընթացիկ մնացորդ", "Pending charges": "Սպասող գանձումներ", "Lifetime API spend": "Ընդհանուր API ծախս", "Total requests": "Ընդհանուր հարցումներ", "API key": "API բանալի", "From language": "Սկզբնական լեզու", "To language": "Թիրախ լեզու", Streaming: "Հոսքային", "Create key": "Ստեղծել բանալի", "Available fake balance": "Հասանելի փորձնական մնացորդ", Name: "Անուն", Permissions: "Թույլտվություններ", Billing: "Վճարում", "Paid credit": "Վճարված կրեդիտ", "Reward credit": "Պարգևային կրեդիտ", "Add balance": "Ավելացնել մնացորդ", "All projects": "Բոլոր նախագծերը", "All statuses": "Բոլոր կարգավիճակները", "Usage analytics": "Օգտագործման վերլուծություն", "Auto-recharge": "Ավտոմատ լիցքավորում", Threshold: "Շեմ", "Payment method": "Վճարման եղանակ", Language: "Լեզու", "Request browser permission": "Խնդրել զննարկչի թույլտվություն", "Subscribe by email": "Բաժանորդագրվել էլ. փոստով",
  },
  zh: {
    "Developer portal": "开发者门户", "Close dashboard": "关闭仪表板", Playground: "游乐场", Projects: "项目", "API Keys": "API 密钥", Usage: "用量", "Request Logs": "请求日志", "Auto-Recharge": "自动充值", Rewards: "奖励", Notifications: "通知", Copy: "复制", Create: "创建", Rotate: "轮换", Subscribe: "订阅", Cancel: "取消", Example: "示例", Input: "输入", Project: "项目", Description: "描述", Status: "状态", Budget: "预算", Created: "创建时间", Date: "日期", Type: "类型", Amount: "金额", Request: "请求", Endpoint: "端点", Tokens: "令牌", Cost: "费用", Latency: "延迟", Service: "服务", Operational: "正常运行", Enabled: "已启用", Disabled: "已禁用", Successful: "成功", Failed: "失败", "Current balance": "当前余额", "Pending charges": "待处理费用", "Lifetime API spend": "累计 API 支出", "Total requests": "总请求数", "API playground": "API 试验场", "API key": "API 密钥", "From language": "源语言", "To language": "目标语言", Streaming: "流式", "Run simulated API call": "运行模拟 API 调用", "Create key": "创建密钥", "Available fake balance": "可用模拟余额", "What this does": "它会做什么", Name: "名称", Permissions: "权限", Billing: "计费", "Paid credit": "付费额度", "Reward credit": "奖励额度", "Add balance": "添加余额", "All projects": "所有项目", "All statuses": "所有状态", "Export CSV": "导出 CSV", "Usage analytics": "用量分析", "Auto-recharge": "自动充值", Threshold: "阈值", "Payment method": "付款方式", Language: "语言", "Request browser permission": "请求浏览器权限", "Subscribe by email": "通过电子邮件订阅",
  },
  nl: {
    "Developer portal": "Ontwikkelaarsportaal", "Close dashboard": "Dashboard sluiten", Playground: "Speeltuin", Projects: "Projecten", "API Keys": "API-sleutels", Usage: "Gebruik", "Request Logs": "Aanvraaglogs", "Auto-Recharge": "Automatisch opwaarderen", Rewards: "Beloningen", Notifications: "Meldingen", Copy: "Kopiëren", Create: "Maken", Rotate: "Roteren", Subscribe: "Abonneren", Cancel: "Annuleren", Example: "Voorbeeld", Input: "Invoer", Project: "Project", Description: "Beschrijving", Status: "Status", Budget: "Budget", Date: "Datum", Type: "Type", Amount: "Bedrag", Request: "Aanvraag", Endpoint: "Endpoint", Tokens: "Tokens", Cost: "Kosten", Latency: "Latentie", Service: "Service", Operational: "Operationeel", Enabled: "Ingeschakeld", Disabled: "Uitgeschakeld", Successful: "Geslaagd", Failed: "Mislukt", "Current balance": "Huidig saldo", "Pending charges": "Openstaande kosten", "Lifetime API spend": "Totale API-uitgaven", "Total requests": "Totaal aanvragen", "API key": "API-sleutel", "From language": "Brontaal", "To language": "Doeltaal", Streaming: "Streaming", "Create key": "Sleutel maken", "Available fake balance": "Beschikbaar testsaldo", Name: "Naam", Permissions: "Machtigingen", Billing: "Facturering", "Paid credit": "Betaald tegoed", "Reward credit": "Beloningstegoed", "Add balance": "Saldo toevoegen", "All projects": "Alle projecten", "All statuses": "Alle statussen", "Usage analytics": "Gebruiksanalyse", "Auto-recharge": "Automatisch opwaarderen", Threshold: "Drempel", "Payment method": "Betaalmethode", Language: "Taal", "Request browser permission": "Browsertoestemming vragen", "Subscribe by email": "Abonneren per e-mail",
  },
  fr: {
    "Developer portal": "Portail développeur", "Close dashboard": "Fermer le tableau de bord", Playground: "Aire d’essai", Projects: "Projets", "API Keys": "Clés API", Usage: "Utilisation", "Request Logs": "Journaux de requêtes", "Auto-Recharge": "Recharge automatique", Rewards: "Récompenses", Notifications: "Notifications", Copy: "Copier", Create: "Créer", Rotate: "Renouveler", Subscribe: "S’abonner", Cancel: "Annuler", Example: "Exemple", Input: "Entrée", Project: "Projet", Description: "Description", Status: "Statut", Budget: "Budget", Date: "Date", Type: "Type", Amount: "Montant", Request: "Requête", Endpoint: "Point de terminaison", Tokens: "Jetons", Cost: "Coût", Latency: "Latence", Service: "Service", Operational: "Opérationnel", Enabled: "Activé", Disabled: "Désactivé", Successful: "Réussi", Failed: "Échoué", "Current balance": "Solde actuel", "Pending charges": "Frais en attente", "Lifetime API spend": "Dépenses API cumulées", "Total requests": "Requêtes totales", "API playground": "Aire d’essai API", "API key": "Clé API", "From language": "Langue source", "To language": "Langue cible", Streaming: "Diffusion", "Run simulated API call": "Lancer un appel API simulé", "Create key": "Créer une clé", "Available fake balance": "Solde fictif disponible", "What this does": "Ce que cela fait", Name: "Nom", Permissions: "Autorisations", Billing: "Facturation", "Paid credit": "Crédit payé", "Reward credit": "Crédit de récompense", "Add balance": "Ajouter du solde", "All projects": "Tous les projets", "All statuses": "Tous les statuts", "Export CSV": "Exporter CSV", "Usage analytics": "Analyses d’utilisation", "Auto-recharge": "Recharge automatique", Threshold: "Seuil", "Payment method": "Mode de paiement", Language: "Langue", "Request browser permission": "Demander l’autorisation du navigateur", "Subscribe by email": "S’abonner par e-mail",
  },
  de: {
    "Developer portal": "Entwicklerportal", "Close dashboard": "Dashboard schließen", Playground: "Playground", Projects: "Projekte", "API Keys": "API-Schlüssel", Usage: "Nutzung", "Request Logs": "Anfrageprotokolle", "Auto-Recharge": "Automatische Aufladung", Rewards: "Prämien", Notifications: "Benachrichtigungen", Copy: "Kopieren", Create: "Erstellen", Rotate: "Rotieren", Subscribe: "Abonnieren", Cancel: "Abbrechen", Example: "Beispiel", Input: "Eingabe", Project: "Projekt", Description: "Beschreibung", Status: "Status", Budget: "Budget", Date: "Datum", Type: "Typ", Amount: "Betrag", Request: "Anfrage", Endpoint: "Endpunkt", Tokens: "Token", Cost: "Kosten", Latency: "Latenz", Service: "Dienst", Operational: "Betriebsbereit", Enabled: "Aktiviert", Disabled: "Deaktiviert", Successful: "Erfolgreich", Failed: "Fehlgeschlagen", "Current balance": "Aktuelles Guthaben", "Pending charges": "Ausstehende Gebühren", "Lifetime API spend": "API-Ausgaben gesamt", "Total requests": "Anfragen gesamt", "API key": "API-Schlüssel", "From language": "Ausgangssprache", "To language": "Zielsprache", Streaming: "Streaming", "Create key": "Schlüssel erstellen", "Available fake balance": "Verfügbares Testguthaben", Name: "Name", Permissions: "Berechtigungen", Billing: "Abrechnung", "Paid credit": "Bezahltes Guthaben", "Reward credit": "Prämienguthaben", "Add balance": "Guthaben hinzufügen", "All projects": "Alle Projekte", "All statuses": "Alle Status", "Usage analytics": "Nutzungsanalyse", "Auto-recharge": "Automatische Aufladung", Threshold: "Schwelle", "Payment method": "Zahlungsmethode", Language: "Sprache", "Request browser permission": "Browserberechtigung anfordern", "Subscribe by email": "Per E-Mail abonnieren",
  },
  kl: {
    "Developer portal": " ineriartortitsisut isaaffiat", "Close dashboard": "Dashboard matuuk", Playground: "Misileraavik", Projects: "Suliniutit", "API Keys": "API-mut matuersaatit", Usage: "Atuineq", "Request Logs": "Noqqaassutinik nalunaarsuutit", "Auto-Recharge": "Imminut immersorneq", Rewards: "Akissarsiat", Notifications: "Nalunaarutit", Copy: "Kopi", Create: "Pilersiguk", Rotate: "Nutarteruk", Subscribe: "Ilanngugit", Cancel: "Unitsiguk", Example: "Assersuut", Input: "Ilanngussaq", Project: "Suliniut", Description: "Nassuiaat", Status: "Killiffik", Budget: "Aningaasa预算", Date: "Ulloq", Type: "Suussuseq", Amount: "Amerlassuseq", Request: "Noqqaassut", Endpoint: "Endpoint", Tokens: "Tokenit", Cost: "Akia", Latency: "Kinguaattoorneq", Service: "Sullississut", Operational: "Ingerlavoq", Enabled: "Atuutsinneqarpoq", Disabled: "Atuutsinneqanngilaq", Successful: "Iluatsippoq", Failed: "Ajutoorpoq", "Current balance": "Maanna sinneqartoorut", "API key": "API matuersaat", "From language": "Oqaatsit aallaaviit", "To language": "Oqaatsit ornitat", Name: "Ateq", Permissions: "Akuersissutit", Billing: "Akiligassiineq", Language: "Oqaatsit",
  },
  he: {
    "Developer portal": "פורטל מפתחים", "Close dashboard": "סגור לוח בקרה", Playground: "מגרש ניסוי", Projects: "פרויקטים", "API Keys": "מפתחות API", Usage: "שימוש", "Request Logs": "יומני בקשות", "Auto-Recharge": "טעינה אוטומטית", Rewards: "תגמולים", Notifications: "התראות", Copy: "העתק", Create: "צור", Rotate: "סובב", Subscribe: "הירשם", Cancel: "בטל", Example: "דוגמה", Input: "קלט", Project: "פרויקט", Description: "תיאור", Status: "סטטוס", Budget: "תקציב", Date: "תאריך", Type: "סוג", Amount: "סכום", Request: "בקשה", Endpoint: "נקודת קצה", Tokens: "אסימונים", Cost: "עלות", Latency: "השהיה", Service: "שירות", Operational: "פעיל", Enabled: "מופעל", Disabled: "כבוי", Successful: "הצליח", Failed: "נכשל", "Current balance": "יתרה נוכחית", "API key": "מפתח API", "From language": "שפת מקור", "To language": "שפת יעד", Streaming: "סטרימינג", "Create key": "צור מפתח", "Available fake balance": "יתרת בדיקה זמינה", Name: "שם", Permissions: "הרשאות", Billing: "חיוב", "Paid credit": "אשראי ששולם", "Reward credit": "אשראי תגמול", "Add balance": "הוסף יתרה", "All projects": "כל הפרויקטים", "All statuses": "כל הסטטוסים", "Usage analytics": "ניתוח שימוש", "Auto-recharge": "טעינה אוטומטית", Threshold: "סף", "Payment method": "אמצעי תשלום", Language: "שפה",
  },
  hi: {
    "Developer portal": "डेवलपर पोर्टल", "Close dashboard": "डैशबोर्ड बंद करें", Playground: "प्लेग्राउंड", Projects: "प्रोजेक्ट", "API Keys": "API कुंजियाँ", Usage: "उपयोग", "Request Logs": "अनुरोध लॉग", "Auto-Recharge": "ऑटो-रीचार्ज", Rewards: "रिवॉर्ड", Notifications: "सूचनाएँ", Copy: "कॉपी", Create: "बनाएँ", Rotate: "रोटेट", Subscribe: "सब्सक्राइब", Cancel: "रद्द करें", Example: "उदाहरण", Input: "इनपुट", Project: "प्रोजेक्ट", Description: "विवरण", Status: "स्थिति", Budget: "बजट", Date: "तारीख", Type: "प्रकार", Amount: "राशि", Request: "अनुरोध", Endpoint: "एंडपॉइंट", Tokens: "टोकन", Cost: "लागत", Latency: "लेटेंसी", Service: "सेवा", Operational: "चालू", Enabled: "सक्षम", Disabled: "अक्षम", Successful: "सफल", Failed: "विफल", "Current balance": "वर्तमान बैलेंस", "API key": "API कुंजी", "From language": "स्रोत भाषा", "To language": "लक्ष्य भाषा", Streaming: "स्ट्रीमिंग", "Create key": "कुंजी बनाएँ", "Available fake balance": "उपलब्ध नकली बैलेंस", Name: "नाम", Permissions: "अनुमतियाँ", Billing: "बिलिंग", "Paid credit": "भुगतान क्रेडिट", "Reward credit": "रिवॉर्ड क्रेडिट", "Add balance": "बैलेंस जोड़ें", "All projects": "सभी प्रोजेक्ट", "All statuses": "सभी स्थितियाँ", "Usage analytics": "उपयोग विश्लेषण", "Auto-recharge": "ऑटो-रीचार्ज", Threshold: "सीमा", "Payment method": "भुगतान विधि", Language: "भाषा",
  },
  it: {
    "Developer portal": "Portale sviluppatori", "Close dashboard": "Chiudi dashboard", Playground: "Area prove", Projects: "Progetti", "API Keys": "Chiavi API", Usage: "Utilizzo", "Request Logs": "Log richieste", "Auto-Recharge": "Ricarica automatica", Rewards: "Premi", Notifications: "Notifiche", Copy: "Copia", Create: "Crea", Rotate: "Ruota", Subscribe: "Iscriviti", Cancel: "Annulla", Example: "Esempio", Input: "Input", Project: "Progetto", Description: "Descrizione", Status: "Stato", Budget: "Budget", Date: "Data", Type: "Tipo", Amount: "Importo", Request: "Richiesta", Endpoint: "Endpoint", Tokens: "Token", Cost: "Costo", Latency: "Latenza", Service: "Servizio", Operational: "Operativo", Enabled: "Attivo", Disabled: "Disattivo", Successful: "Riuscito", Failed: "Fallito", "Current balance": "Saldo attuale", "API key": "Chiave API", "From language": "Lingua di origine", "To language": "Lingua di destinazione", Streaming: "Streaming", "Create key": "Crea chiave", "Available fake balance": "Saldo fittizio disponibile", Name: "Nome", Permissions: "Permessi", Billing: "Fatturazione", "Paid credit": "Credito pagato", "Reward credit": "Credito premio", "Add balance": "Aggiungi saldo", "All projects": "Tutti i progetti", "All statuses": "Tutti gli stati", "Usage analytics": "Analisi utilizzo", "Auto-recharge": "Ricarica automatica", Threshold: "Soglia", "Payment method": "Metodo di pagamento", Language: "Lingua",
  },
  ja: {
    "Developer portal": "開発者ポータル", "Close dashboard": "ダッシュボードを閉じる", Playground: "プレイグラウンド", Projects: "プロジェクト", "API Keys": "API キー", Usage: "使用量", "Request Logs": "リクエストログ", "Auto-Recharge": "自動チャージ", Rewards: "リワード", Notifications: "通知", Copy: "コピー", Create: "作成", Rotate: "ローテート", Subscribe: "登録", Cancel: "キャンセル", Example: "例", Input: "入力", Project: "プロジェクト", Description: "説明", Status: "ステータス", Budget: "予算", Date: "日付", Type: "種類", Amount: "金額", Request: "リクエスト", Endpoint: "エンドポイント", Tokens: "トークン", Cost: "コスト", Latency: "レイテンシ", Service: "サービス", Operational: "稼働中", Enabled: "有効", Disabled: "無効", Successful: "成功", Failed: "失敗", "Current balance": "現在の残高", "API key": "API キー", "From language": "元の言語", "To language": "翻訳先の言語", Streaming: "ストリーミング", "Create key": "キーを作成", "Available fake balance": "利用可能なテスト残高", Name: "名前", Permissions: "権限", Billing: "請求", "Paid credit": "有料クレジット", "Reward credit": "リワードクレジット", "Add balance": "残高を追加", "All projects": "すべてのプロジェクト", "All statuses": "すべてのステータス", "Usage analytics": "使用量分析", "Auto-recharge": "自動チャージ", Threshold: "しきい値", "Payment method": "支払い方法", Language: "言語",
  },
  ko: {
    "Developer portal": "개발자 포털", "Close dashboard": "대시보드 닫기", Playground: "플레이그라운드", Projects: "프로젝트", "API Keys": "API 키", Usage: "사용량", "Request Logs": "요청 로그", "Auto-Recharge": "자동 충전", Rewards: "리워드", Notifications: "알림", Copy: "복사", Create: "생성", Rotate: "교체", Subscribe: "구독", Cancel: "취소", Example: "예시", Input: "입력", Project: "프로젝트", Description: "설명", Status: "상태", Budget: "예산", Date: "날짜", Type: "유형", Amount: "금액", Request: "요청", Endpoint: "엔드포인트", Tokens: "토큰", Cost: "비용", Latency: "지연 시간", Service: "서비스", Operational: "정상", Enabled: "활성화", Disabled: "비활성화", Successful: "성공", Failed: "실패", "Current balance": "현재 잔액", "API key": "API 키", "From language": "원본 언어", "To language": "대상 언어", Streaming: "스트리밍", "Create key": "키 생성", "Available fake balance": "사용 가능한 테스트 잔액", Name: "이름", Permissions: "권한", Billing: "청구", "Paid credit": "유료 크레딧", "Reward credit": "리워드 크레딧", "Add balance": "잔액 추가", "All projects": "모든 프로젝트", "All statuses": "모든 상태", "Usage analytics": "사용량 분석", "Auto-recharge": "자동 충전", Threshold: "임계값", "Payment method": "결제 수단", Language: "언어",
  },
  fa: {
    "Developer portal": "درگاه توسعه‌دهندگان", "Close dashboard": "بستن داشبورد", Playground: "محیط آزمایش", Projects: "پروژه‌ها", "API Keys": "کلیدهای API", Usage: "استفاده", "Request Logs": "گزارش درخواست‌ها", "Auto-Recharge": "شارژ خودکار", Rewards: "پاداش‌ها", Notifications: "اعلان‌ها", Copy: "کپی", Create: "ایجاد", Rotate: "چرخش", Subscribe: "اشتراک", Cancel: "لغو", Example: "نمونه", Input: "ورودی", Project: "پروژه", Description: "توضیح", Status: "وضعیت", Budget: "بودجه", Date: "تاریخ", Type: "نوع", Amount: "مبلغ", Request: "درخواست", Endpoint: "نقطه پایانی", Tokens: "توکن‌ها", Cost: "هزینه", Latency: "تاخیر", Service: "سرویس", Operational: "فعال", Enabled: "فعال", Disabled: "غیرفعال", Successful: "موفق", Failed: "ناموفق", "Current balance": "موجودی فعلی", "API key": "کلید API", "From language": "زبان مبدا", "To language": "زبان مقصد", Streaming: "جریانی", "Create key": "ایجاد کلید", "Available fake balance": "موجودی آزمایشی موجود", Name: "نام", Permissions: "مجوزها", Billing: "صورتحساب", "Paid credit": "اعتبار پرداخت‌شده", "Reward credit": "اعتبار پاداش", "Add balance": "افزودن موجودی", "All projects": "همه پروژه‌ها", "All statuses": "همه وضعیت‌ها", "Usage analytics": "تحلیل استفاده", "Auto-recharge": "شارژ خودکار", Threshold: "آستانه", "Payment method": "روش پرداخت", Language: "زبان",
  },
  pl: {
    "Developer portal": "Portal dewelopera", "Close dashboard": "Zamknij panel", Playground: "Plac zabaw", Projects: "Projekty", "API Keys": "Klucze API", Usage: "Użycie", "Request Logs": "Logi żądań", "Auto-Recharge": "Automatyczne doładowanie", Rewards: "Nagrody", Notifications: "Powiadomienia", Copy: "Kopiuj", Create: "Utwórz", Rotate: "Obróć", Subscribe: "Subskrybuj", Cancel: "Anuluj", Example: "Przykład", Input: "Wejście", Project: "Projekt", Description: "Opis", Status: "Status", Budget: "Budżet", Date: "Data", Type: "Typ", Amount: "Kwota", Request: "Żądanie", Endpoint: "Punkt końcowy", Tokens: "Tokeny", Cost: "Koszt", Latency: "Opóźnienie", Service: "Usługa", Operational: "Działa", Enabled: "Włączone", Disabled: "Wyłączone", Successful: "Udane", Failed: "Nieudane", "Current balance": "Bieżące saldo", "API key": "Klucz API", "From language": "Język źródłowy", "To language": "Język docelowy", Streaming: "Strumieniowanie", "Create key": "Utwórz klucz", "Available fake balance": "Dostępne saldo testowe", Name: "Nazwa", Permissions: "Uprawnienia", Billing: "Rozliczenia", "Paid credit": "Płatny kredyt", "Reward credit": "Kredyt nagród", "Add balance": "Dodaj saldo", "All projects": "Wszystkie projekty", "All statuses": "Wszystkie statusy", "Usage analytics": "Analiza użycia", "Auto-recharge": "Automatyczne doładowanie", Threshold: "Próg", "Payment method": "Metoda płatności", Language: "Język",
  },
  pt: {
    "Developer portal": "Portal do desenvolvedor", "Close dashboard": "Fechar painel", Playground: "Área de testes", Projects: "Projetos", "API Keys": "Chaves de API", Usage: "Uso", "Request Logs": "Logs de solicitação", "Auto-Recharge": "Recarga automática", Rewards: "Recompensas", Notifications: "Notificações", Copy: "Copiar", Create: "Criar", Rotate: "Rotacionar", Subscribe: "Assinar", Cancel: "Cancelar", Example: "Exemplo", Input: "Entrada", Project: "Projeto", Description: "Descrição", Status: "Status", Budget: "Orçamento", Date: "Data", Type: "Tipo", Amount: "Valor", Request: "Solicitação", Endpoint: "Endpoint", Tokens: "Tokens", Cost: "Custo", Latency: "Latência", Service: "Serviço", Operational: "Operacional", Enabled: "Ativado", Disabled: "Desativado", Successful: "Bem-sucedido", Failed: "Falhou", "Current balance": "Saldo atual", "API key": "Chave de API", "From language": "Idioma de origem", "To language": "Idioma de destino", Streaming: "Streaming", "Create key": "Criar chave", "Available fake balance": "Saldo de teste disponível", Name: "Nome", Permissions: "Permissões", Billing: "Cobrança", "Paid credit": "Crédito pago", "Reward credit": "Crédito de recompensa", "Add balance": "Adicionar saldo", "All projects": "Todos os projetos", "All statuses": "Todos os status", "Usage analytics": "Análise de uso", "Auto-recharge": "Recarga automática", Threshold: "Limite", "Payment method": "Método de pagamento", Language: "Idioma",
  },
  ru: {
    "Developer portal": "Портал разработчика", "Close dashboard": "Закрыть панель", Playground: "Песочница", Projects: "Проекты", "API Keys": "API-ключи", Usage: "Использование", "Request Logs": "Журналы запросов", "Auto-Recharge": "Автопополнение", Rewards: "Награды", Notifications: "Уведомления", Copy: "Копировать", Create: "Создать", Rotate: "Ротировать", Subscribe: "Подписаться", Cancel: "Отмена", Example: "Пример", Input: "Ввод", Project: "Проект", Description: "Описание", Status: "Статус", Budget: "Бюджет", Date: "Дата", Type: "Тип", Amount: "Сумма", Request: "Запрос", Endpoint: "Эндпоинт", Tokens: "Токены", Cost: "Стоимость", Latency: "Задержка", Service: "Сервис", Operational: "Работает", Enabled: "Включено", Disabled: "Отключено", Successful: "Успешно", Failed: "Ошибка", "Current balance": "Текущий баланс", "API key": "API-ключ", "From language": "Исходный язык", "To language": "Целевой язык", Streaming: "Потоковый режим", "Create key": "Создать ключ", "Available fake balance": "Доступный тестовый баланс", Name: "Название", Permissions: "Разрешения", Billing: "Оплата", "Paid credit": "Оплаченный кредит", "Reward credit": "Бонусный кредит", "Add balance": "Добавить баланс", "All projects": "Все проекты", "All statuses": "Все статусы", "Usage analytics": "Аналитика использования", "Auto-recharge": "Автопополнение", Threshold: "Порог", "Payment method": "Способ оплаты", Language: "Язык",
  },
  es: {
    "Developer portal": "Portal de desarrolladores", "Close dashboard": "Cerrar panel", Playground: "Zona de pruebas", Projects: "Proyectos", "API Keys": "Claves API", Usage: "Uso", "Request Logs": "Registros de solicitudes", "Auto-Recharge": "Recarga automática", Rewards: "Recompensas", Notifications: "Notificaciones", Copy: "Copiar", Create: "Crear", Rotate: "Rotar", Subscribe: "Suscribirse", Cancel: "Cancelar", Example: "Ejemplo", Input: "Entrada", Project: "Proyecto", Description: "Descripción", Status: "Estado", Budget: "Presupuesto", Date: "Fecha", Type: "Tipo", Amount: "Importe", Request: "Solicitud", Endpoint: "Endpoint", Tokens: "Tokens", Cost: "Costo", Latency: "Latencia", Service: "Servicio", Operational: "Operativo", Enabled: "Activado", Disabled: "Desactivado", Successful: "Correcto", Failed: "Fallido", "Current balance": "Saldo actual", "API key": "Clave API", "From language": "Idioma de origen", "To language": "Idioma de destino", Streaming: "Streaming", "Run simulated API call": "Ejecutar llamada API simulada", "Create key": "Crear clave", "Available fake balance": "Saldo falso disponible", "What this does": "Qué hace esto", Name: "Nombre", Permissions: "Permisos", Billing: "Facturación", "Paid credit": "Crédito pagado", "Reward credit": "Crédito de recompensa", "Add balance": "Agregar saldo", "All projects": "Todos los proyectos", "All statuses": "Todos los estados", "Export CSV": "Exportar CSV", "Usage analytics": "Analítica de uso", "Auto-recharge": "Recarga automática", Threshold: "Umbral", "Payment method": "Método de pago", Language: "Idioma", "Request browser permission": "Solicitar permiso del navegador", "Subscribe by email": "Suscribirse por correo",
  },
  tr: {
    "Developer portal": "Geliştirici portalı", "Close dashboard": "Paneli kapat", Playground: "Deneme alanı", Projects: "Projeler", "API Keys": "API anahtarları", Usage: "Kullanım", "Request Logs": "İstek günlükleri", "Auto-Recharge": "Otomatik yükleme", Rewards: "Ödüller", Notifications: "Bildirimler", Copy: "Kopyala", Create: "Oluştur", Rotate: "Döndür", Subscribe: "Abone ol", Cancel: "İptal", Example: "Örnek", Input: "Girdi", Project: "Proje", Description: "Açıklama", Status: "Durum", Budget: "Bütçe", Date: "Tarih", Type: "Tür", Amount: "Tutar", Request: "İstek", Endpoint: "Uç nokta", Tokens: "Tokenlar", Cost: "Maliyet", Latency: "Gecikme", Service: "Servis", Operational: "Çalışıyor", Enabled: "Etkin", Disabled: "Devre dışı", Successful: "Başarılı", Failed: "Başarısız", "Current balance": "Mevcut bakiye", "API key": "API anahtarı", "From language": "Kaynak dil", "To language": "Hedef dil", Streaming: "Akış", "Create key": "Anahtar oluştur", "Available fake balance": "Kullanılabilir test bakiyesi", Name: "Ad", Permissions: "İzinler", Billing: "Faturalandırma", "Paid credit": "Ücretli kredi", "Reward credit": "Ödül kredisi", "Add balance": "Bakiye ekle", "All projects": "Tüm projeler", "All statuses": "Tüm durumlar", "Usage analytics": "Kullanım analitiği", "Auto-recharge": "Otomatik yükleme", Threshold: "Eşik", "Payment method": "Ödeme yöntemi", Language: "Dil",
  },
  uk: {
    "Developer portal": "Портал розробника", "Close dashboard": "Закрити панель", Playground: "Майданчик", Projects: "Проєкти", "API Keys": "API-ключі", Usage: "Використання", "Request Logs": "Журнали запитів", "Auto-Recharge": "Автопоповнення", Rewards: "Винагороди", Notifications: "Сповіщення", Copy: "Копіювати", Create: "Створити", Rotate: "Оновити", Subscribe: "Підписатися", Cancel: "Скасувати", Example: "Приклад", Input: "Вхід", Project: "Проєкт", Description: "Опис", Status: "Стан", Budget: "Бюджет", Date: "Дата", Type: "Тип", Amount: "Сума", Request: "Запит", Endpoint: "Кінцева точка", Tokens: "Токени", Cost: "Вартість", Latency: "Затримка", Service: "Сервіс", Operational: "Працює", Enabled: "Увімкнено", Disabled: "Вимкнено", Successful: "Успішно", Failed: "Помилка", "Current balance": "Поточний баланс", "API key": "API-ключ", "From language": "Мова джерела", "To language": "Цільова мова", Streaming: "Потоково", "Create key": "Створити ключ", "Available fake balance": "Доступний тестовий баланс", Name: "Назва", Permissions: "Дозволи", Billing: "Оплата", "Paid credit": "Оплачений кредит", "Reward credit": "Бонусний кредит", "Add balance": "Додати баланс", "All projects": "Усі проєкти", "All statuses": "Усі стани", "Usage analytics": "Аналітика використання", "Auto-recharge": "Автопоповнення", Threshold: "Поріг", "Payment method": "Спосіб оплати", Language: "Мова",
  },
};

const resetTranslations: Record<LanguageCode, Record<string, string>> = {
  en: {},
  ar: {
    "Reset all test data": "إعادة ضبط كل بيانات الاختبار",
    "Local test data reset": "تمت إعادة ضبط بيانات الاختبار المحلية",
    "Reset all local test data?": "إعادة ضبط كل بيانات الاختبار المحلية؟",
    "Reset all data": "إعادة ضبط كل البيانات",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "سيجعل هذا كل الأموال التجريبية وإجماليات الحساب 0 دولار، ويمسح دفتر الأستاذ وسجلات الطلبات وإحصاءات الاستخدام وسجل منع التكرار والمهام ومطالبات المكافآت. ستظل المشاريع ومفاتيح API متاحة.",
  },
  hy: {
    "Reset all test data": "Զրոյացնել բոլոր փորձնական տվյալները",
    "Local test data reset": "Տեղական փորձնական տվյալները զրոյացվեցին",
    "Reset all local test data?": "Զրոյացնե՞լ բոլոր տեղական փորձնական տվյալները",
    "Reset all data": "Զրոյացնել բոլոր տվյալները",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Սա բոլոր փորձնական գումարներն ու հաշվի ընդհանուրները դարձնում է $0, մաքրում է մատյանը, հարցումների մատյանները, օգտագործման վիճակագրությունը, idempotency պատմությունը, աշխատանքներն ու պարգևների պահանջները։ Նախագծերն ու API բանալիները կմնան հասանելի։",
  },
  zh: {
    "Reset all test data": "重置所有测试数据",
    "Local test data reset": "本地测试数据已重置",
    "Reset all local test data?": "重置所有本地测试数据？",
    "Reset all data": "重置所有数据",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "这会将所有模拟金额和账户总计设为 $0，并清空账本、请求日志、用量统计、幂等历史、任务和奖励记录。项目和 API 密钥会保留。",
  },
  nl: {
    "Reset all test data": "Alle testgegevens resetten",
    "Local test data reset": "Lokale testgegevens gereset",
    "Reset all local test data?": "Alle lokale testgegevens resetten?",
    "Reset all data": "Alle gegevens resetten",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Dit zet al het testsaldo en alle accounttotalen op $0 en wist het grootboek, aanvraaglogs, gebruiksstatistieken, idempotentiegeschiedenis, taken en beloningsclaims. Projecten en API-sleutels blijven beschikbaar.",
  },
  fr: {
    "Reset all test data": "Réinitialiser toutes les données de test",
    "Local test data reset": "Données de test locales réinitialisées",
    "Reset all local test data?": "Réinitialiser toutes les données de test locales ?",
    "Reset all data": "Réinitialiser toutes les données",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Cela met tout l’argent fictif et les totaux du compte à 0 $, puis efface le registre, les journaux de requêtes, les statistiques d’utilisation, l’historique d’idempotence, les tâches et les demandes de récompense. Les projets et les clés API restent disponibles.",
  },
  de: {
    "Reset all test data": "Alle Testdaten zurücksetzen",
    "Local test data reset": "Lokale Testdaten zurückgesetzt",
    "Reset all local test data?": "Alle lokalen Testdaten zurücksetzen?",
    "Reset all data": "Alle Daten zurücksetzen",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Dies setzt das gesamte Testguthaben und alle Kontosummen auf $0 und löscht Ledger, Anfrageprotokolle, Nutzungsstatistiken, Idempotenzverlauf, Jobs und Prämienansprüche. Projekte und API-Schlüssel bleiben verfügbar.",
  },
  kl: {
    "Reset all test data": "Misileraarnermi paasissutissat tamaasa nulstilikkit",
    "Local test data reset": "Najukkami misileraarnermi paasissutissat nulstilinneqarput",
    "Reset all local test data?": "Najukkami misileraarnermi paasissutissat tamaasa nulstilissavigit?",
    "Reset all data": "Paasissutissat tamaasa nulstilikkit",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Tamanna misileraarnermi aningaasat kontollu katinneri $0-imut inississavai, ledger, noqqaassutit nalunaarsuutaat, atuinermut kisitsisit, idempotency oqaluttuarisaanera, suliassat akissarsiassanillu piumasaqaatit piiassallugit. Suliniutit API-mullu matuersaatit suli atorneqarsinnaapput.",
  },
  he: {
    "Reset all test data": "איפוס כל נתוני הבדיקה",
    "Local test data reset": "נתוני הבדיקה המקומיים אופסו",
    "Reset all local test data?": "לאפס את כל נתוני הבדיקה המקומיים?",
    "Reset all data": "אפס את כל הנתונים",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "זה מגדיר את כל הכסף המדומה וסיכומי החשבון ל-$0, ומנקה את ספר החשבונות, יומני הבקשות, סטטיסטיקות השימוש, היסטוריית האידמפוטנטיות, המשימות ותביעות התגמול. פרויקטים ומפתחות API נשארים זמינים.",
  },
  hi: {
    "Reset all test data": "सारा टेस्ट डेटा रीसेट करें",
    "Local test data reset": "लोकल टेस्ट डेटा रीसेट हो गया",
    "Reset all local test data?": "सारा लोकल टेस्ट डेटा रीसेट करें?",
    "Reset all data": "सारा डेटा रीसेट करें",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "यह सारी नकली राशि और अकाउंट टोटल को $0 कर देता है, और लेजर, अनुरोध लॉग, उपयोग आँकड़े, idempotency इतिहास, jobs और reward claims साफ कर देता है। प्रोजेक्ट और API keys उपलब्ध रहती हैं।",
  },
  it: {
    "Reset all test data": "Reimposta tutti i dati di test",
    "Local test data reset": "Dati di test locali reimpostati",
    "Reset all local test data?": "Reimpostare tutti i dati di test locali?",
    "Reset all data": "Reimposta tutti i dati",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Imposta tutto il denaro fittizio e i totali dell’account a $0, cancella ledger, log richieste, statistiche di utilizzo, cronologia di idempotenza, job e richieste premio. Progetti e chiavi API restano disponibili.",
  },
  ja: {
    "Reset all test data": "すべてのテストデータをリセット",
    "Local test data reset": "ローカルテストデータをリセットしました",
    "Reset all local test data?": "すべてのローカルテストデータをリセットしますか？",
    "Reset all data": "すべてのデータをリセット",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "すべてのテスト用残高とアカウント合計を $0 にし、台帳、リクエストログ、使用統計、冪等性履歴、ジョブ、リワード請求を消去します。プロジェクトと API キーは残ります。",
  },
  ko: {
    "Reset all test data": "모든 테스트 데이터 초기화",
    "Local test data reset": "로컬 테스트 데이터가 초기화되었습니다",
    "Reset all local test data?": "모든 로컬 테스트 데이터를 초기화할까요?",
    "Reset all data": "모든 데이터 초기화",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "모든 테스트 금액과 계정 합계를 $0으로 만들고 원장, 요청 로그, 사용 통계, 멱등성 기록, 작업, 리워드 청구를 지웁니다. 프로젝트와 API 키는 유지됩니다.",
  },
  fa: {
    "Reset all test data": "بازنشانی همه داده‌های آزمایشی",
    "Local test data reset": "داده‌های آزمایشی محلی بازنشانی شد",
    "Reset all local test data?": "همه داده‌های آزمایشی محلی بازنشانی شود؟",
    "Reset all data": "بازنشانی همه داده‌ها",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "این همه پول آزمایشی و مجموع حساب را به ۰ دلار تغییر می‌دهد و دفتر کل، گزارش درخواست‌ها، آمار استفاده، تاریخچه idempotency، کارها و درخواست‌های پاداش را پاک می‌کند. پروژه‌ها و کلیدهای API باقی می‌مانند.",
  },
  pl: {
    "Reset all test data": "Zresetuj wszystkie dane testowe",
    "Local test data reset": "Lokalne dane testowe zresetowane",
    "Reset all local test data?": "Zresetować wszystkie lokalne dane testowe?",
    "Reset all data": "Zresetuj wszystkie dane",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Ustawia wszystkie testowe środki i sumy konta na $0 oraz czyści księgę, logi żądań, statystyki użycia, historię idempotencji, zadania i roszczenia nagród. Projekty i klucze API pozostają dostępne.",
  },
  pt: {
    "Reset all test data": "Redefinir todos os dados de teste",
    "Local test data reset": "Dados de teste locais redefinidos",
    "Reset all local test data?": "Redefinir todos os dados de teste locais?",
    "Reset all data": "Redefinir todos os dados",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Isso define todo o dinheiro fictício e os totais da conta como $0 e limpa o livro-razão, logs de solicitação, estatísticas de uso, histórico de idempotência, jobs e reivindicações de recompensa. Projetos e chaves de API continuam disponíveis.",
  },
  ru: {
    "Reset all test data": "Сбросить все тестовые данные",
    "Local test data reset": "Локальные тестовые данные сброшены",
    "Reset all local test data?": "Сбросить все локальные тестовые данные?",
    "Reset all data": "Сбросить все данные",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Это установит все тестовые деньги и итоги аккаунта в $0, очистит ledger, журналы запросов, статистику использования, историю идемпотентности, задания и заявки на награды. Проекты и API-ключи останутся доступны.",
  },
  es: {
    "Reset all test data": "Restablecer todos los datos de prueba",
    "Local test data reset": "Datos de prueba locales restablecidos",
    "Reset all local test data?": "¿Restablecer todos los datos de prueba locales?",
    "Reset all data": "Restablecer todos los datos",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Esto pone todo el dinero falso y los totales de la cuenta en $0, y borra el libro mayor, los registros de solicitudes, estadísticas de uso, historial de idempotencia, trabajos y reclamos de recompensa. Los proyectos y claves API siguen disponibles.",
  },
  tr: {
    "Reset all test data": "Tüm test verilerini sıfırla",
    "Local test data reset": "Yerel test verileri sıfırlandı",
    "Reset all local test data?": "Tüm yerel test verileri sıfırlansın mı?",
    "Reset all data": "Tüm verileri sıfırla",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Bu, tüm sahte parayı ve hesap toplamlarını $0 yapar; defteri, istek günlüklerini, kullanım istatistiklerini, idempotency geçmişini, işleri ve ödül taleplerini temizler. Projeler ve API anahtarları kullanılabilir kalır.",
  },
  uk: {
    "Reset all test data": "Скинути всі тестові дані",
    "Local test data reset": "Локальні тестові дані скинуто",
    "Reset all local test data?": "Скинути всі локальні тестові дані?",
    "Reset all data": "Скинути всі дані",
    "This sets all fake money and account totals to $0, clears the ledger, request logs, usage stats, idempotency history, jobs, and reward claims. Projects and API keys stay available.": "Це встановить усі тестові гроші та підсумки акаунта на $0, очистить ledger, журнали запитів, статистику використання, історію ідемпотентності, jobs і заявки на винагороди. Проєкти та API-ключі залишаться доступними.",
  },
};

function translateWithGlossary(text: string, glossary: Record<string, string>) {
  if (!text || !/[A-Za-z]/.test(text)) {
    return text;
  }

  const entries = Object.entries(glossary).sort((a, b) => b[0].length - a[0].length);
  let translated = text;

  for (const [source, target] of entries) {
    translated = translated.split(source).join(target);
  }

  return translated;
}
