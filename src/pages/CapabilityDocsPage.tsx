import { ArrowRight, BookOpen, Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { dubbingModels, imageModels, musicModels, pdfModels, textModels, transcriptionModels, ttsModels } from "../data/pricing";

type Guide = {
  title: string; eyebrow: string; intro: string; input: string; process: string; output: string;
  overview: string; uses: string[]; tips: string[]; mode?: string; endpoint?: string; sample?: string;
  prices: { name: string; amount: number | null; unit: string; note?: string }[];
};

const guides: Record<string, Guide> = {
  "Text generation": {
    title: "Text & translation", eyebrow: "Text", intro: "Translate, rewrite, and generate text with models built for multilingual workflows.",
    input: "Text + languages", process: "Choose a text model", output: "Translated text",
    overview: "Choose a model for the task, provide the text and language pair, and use the response in your application. The Playground lets you compare models before integrating the API.",
    uses: ["Translate product content and messages", "Rewrite text for a different audience or tone", "Summarize and extract information from multilingual content"],
    tips: ["Provide context when words or phrases have more than one meaning.", "Use a consistent model and review important terminology across related content.", "Estimate input and output tokens separately when comparing costs."],
    mode: "text", endpoint: "/v1/translate", sample: `curl https://api.lingofusion.dev/v1/translate \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"LingoFusion","input":"Hello, world!","from_language":"en","to_language":"fr"}'`,
    prices: textModels.filter((m) => !m.local).map((m) => ({ name: m.model, amount: m.inputUsd, unit: "/ 1M input tokens", note: `$${m.outputUsd.toFixed(2)} / 1M output tokens` })),
  },
  Transcription: {
    title: "Transcription", eyebrow: "Audio", intro: "Turn recordings or live microphone audio into text.",
    input: "Recorded or live audio", process: "Transcribe speech", output: "Text transcript",
    overview: "Use LingoFusion Transcribe for recordings at $0.01 per minute, or LingoFusion Live Transcribe for live audio at $0.03 per minute. Copy or download your transcript from Playground.",
    uses: ["Transcribe recorded notes and interviews", "Create live captions", "Make audio searchable"],
    tips: ["Playground converts supported recordings automatically; uploads support up to 3 minutes and 25 MB.", "Live Playground sessions support one minute of microphone audio. Unused reserved credit is returned after settlement.", "API file uploads require mono PCM16 WAV at 24 kHz and an Idempotency-Key. Billing uses verified audio duration, rounded up once to six decimal USD places."],
    mode: "transcription", endpoint: "/v1/audio/transcriptions", sample: `curl https://lingofusion-gateway.lingofusion-api.workers.dev/v1/audio/transcriptions \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Idempotency-Key: recording-001" \\
  -F 'model=LingoFusion Transcribe' \\
  -F 'file=@audio.wav'`,
    prices: transcriptionModels.map(m => ({ name: m.model, amount: m.priceUsd, unit: "/ minute" })),
  },
  "Speech generation": {
    title: "Audio & speech", eyebrow: "Audio", intro: "Create spoken audio from text, or turn speech into text with the transcription model family.",
    input: "Text or audio", process: "Voice or transcription", output: "Speech or transcript",
    overview: "Voice models synthesize speech from written text. Transcription models work in the other direction, turning audio into text. Choose the workflow and model that fit your application.",
    uses: ["Create spoken versions of written content", "Turn recordings into searchable text", "Build multilingual audio experiences"],
    tips: ["Write punctuation into the input to make the intended phrasing clear.", "Listen to the generated audio before publishing it.", "Voice and transcription have different billing units, shown below."],
    mode: "voice", endpoint: "/v1/audio/speech", sample: `curl https://api.lingofusion.dev/v1/audio/speech \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"LingoFusion Voice","input":"Hello, world!"}' \\
  --output speech.mp3`,
    prices: [...ttsModels.map((m) => ({ name: m.model, amount: m.priceUsd, unit: "/ 1K characters" })), ...transcriptionModels.map((m) => ({ name: m.model, amount: m.priceUsd, unit: "/ minute" }))],
  },
  Music: {
    title: "Music", eyebrow: "Audio", intro: "Generate music from a text prompt with LingoFusion Music.",
    input: "A music prompt", process: "Generate a track", output: "Audio output",
    overview: "Describe the sound you want, including the style, mood, and instruments. Generate a track in the Playground, then listen to the result and refine your prompt.",
    uses: ["Explore ideas for background music", "Create a starting point for a soundtrack", "Experiment with instrumental arrangements"],
    tips: ["Describe the genre, mood, and instruments in your prompt.", "Use the instrumental option when you do not want vocals.", "Listen to the result and adjust the prompt for another variation."],
    mode: "music", endpoint: "/v1/music", sample: `curl https://api.lingofusion.dev/v1/music \\
  -H "Authorization: Bearer $LINGOFUSION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"LingoFusion Music","prompt":"A calm piano melody","duration_seconds":30}'`,
    prices: musicModels.map((m) => ({ name: m.model, amount: m.priceUsd, unit: "/ song" })),
  },
  Dubbing: {
    title: "Dubbing", eyebrow: "Audio & video", intro: "Localize spoken audio and video for a target language with LingoFusion Dubbing.",
    input: "Audio or video", process: "Select a language", output: "Dubbed media",
    overview: "Upload source media, choose a target language, and start a dubbing job. The Playground shows job progress and provides the resulting media when it is ready.",
    uses: ["Localize videos for another language", "Create translated versions of recorded audio", "Prepare multilingual media for review"],
    tips: ["Start with a clear recording and review the translated audio.", "In the Playground, use a file smaller than 25 MB and between 15 seconds and 180 minutes.", "Choose the target language and speaker similarity before starting the job."],
    mode: "dubbing", endpoint: "/v1/dubbing",
    prices: dubbingModels.map((m) => ({ name: m.model, amount: m.priceUsd, unit: "/ second" })),
  },
  "Image translation": {
    title: "Images", eyebrow: "Vision", intro: "Translate text inside images with LingoFusion Image Translate.",
    input: "Image + languages", process: "Translate image text", output: "Localized image",
    overview: "Provide an image and a language pair to translate visible text. Choose Standard or 4K output in the Playground, then inspect the result for layout and readability.",
    uses: ["Localize screenshots and product images", "Translate text in visual material", "Compare standard and 4K output"],
    tips: ["Use a clear source image with readable text.", "Review small text, names, and the final layout.", "The Standard and 4K options have different input and output token rates."],
    mode: "image",
    prices: imageModels.map((m) => ({ name: m.label, amount: m.inputUsd, unit: "/ 1M input tokens", note: `$${m.outputUsd.toFixed(2)} / 1M output tokens` })),
  },
  "PDF text extraction": {
    title: "PDF extraction", eyebrow: "Documents", intro: "Extract text from PDF documents for downstream translation and document workflows.",
    input: "PDF document", process: "Extract text", output: "Document text",
    overview: "Use PDF text extraction to make document content available for search, review, or a translation workflow. Check extracted text against the original when layout or reading order matters.",
    uses: ["Prepare document text for translation", "Make extracted text searchable", "Review content before further processing"],
    tips: ["Check the output for missing text and reading order.", "Review tables and complex page layouts against the original.", "PDF editing and translation pricing is listed as to be determined."],
    prices: pdfModels.map((m) => ({ name: m.model, amount: m.priceUsd, unit: m.priceUsd === null ? "" : "/ 500 extractions" })),
  },
};

export function isCapabilityGuide(page: string) { return Boolean(guides[page]); }

export function CapabilityDocsPage({ page, onNavigate }: { page: string; onNavigate: (page: string, query?: Record<string, string>) => void }) {
  const guide = guides[page];
  const [copied, setCopied] = useState(false);
  const comparable = (unit: string) => guide.prices.filter((p) => p.unit === unit && p.amount !== null);
  const hasComparisons = guide.prices.some((p) => p.amount !== null && comparable(p.unit).length > 1);
  async function copySample() {
    if (!guide.sample) return;
    try { await navigator.clipboard.writeText(guide.sample); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  return (
    <div className="mx-auto grid max-w-7xl gap-12 xl:grid-cols-[minmax(0,1fr)_13rem]">
      <article className="min-w-0 max-w-4xl pb-20">
        <header className="border-b border-neutral-200 pb-10 dark:border-neutral-800">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500"><BookOpen className="h-4 w-4" /> Developer guides <span aria-hidden="true">/</span> {guide.eyebrow}</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-5xl">{guide.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-neutral-600 dark:text-neutral-400">{guide.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {guide.mode && <button type="button" onClick={() => onNavigate("Playground", { mode: guide.mode! })} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">Try in Playground <ArrowRight className="h-4 w-4" /></button>}
            <button type="button" onClick={() => onNavigate("Pricing")} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900">View pricing <ExternalLink className="h-4 w-4" /></button>
          </div>
        </header>
        <section id="overview" className="scroll-mt-24 pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600 dark:text-neutral-400">{guide.overview}</p>
          <h3 className="mt-8 text-sm font-semibold">How it works</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Workflow">
            {[guide.input, guide.process, guide.output].map((step, index) => <div key={step} className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50"><span className="text-xs font-medium text-neutral-500">0{index + 1}</span><p className="mt-3 text-sm font-semibold">{step}</p>{index < 2 && <ArrowRight aria-hidden="true" className="absolute right-4 top-5 hidden h-4 w-4 text-neutral-400 sm:block" />}</div>)}
          </div>
        </section>
        <section id="use-cases" className="scroll-mt-24 pt-12"><h2 className="text-2xl font-semibold tracking-tight">What you can build</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{guide.uses.map((item) => <div key={item} className="rounded-xl border border-neutral-200 p-5 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"><Check className="mb-4 h-4 w-4 text-emerald-600" />{item}</div>)}</div></section>
        <section id="models-pricing" className="scroll-mt-24 pt-12"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Models and pricing</h2><p className="mt-2 text-sm text-neutral-500">Compare the available options and their published rates.</p></div><button type="button" onClick={() => onNavigate("Pricing")} className="text-sm font-medium underline underline-offset-4">All pricing</button></div>
          <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"><div className="divide-y divide-neutral-200 dark:divide-neutral-800">{guide.prices.map((item) => <div key={item.name} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)] sm:items-center"><span className="text-sm font-medium">{item.name}</span><div><p className="text-sm font-semibold tabular-nums">{item.amount === null ? "To be determined" : `$${item.amount < 0.1 ? item.amount.toFixed(3).replace(/0$/, "") : item.amount.toFixed(2)}`} <span className="font-normal text-neutral-500">{item.unit}</span></p>{item.note && <p className="mt-1 text-xs text-neutral-500">{item.note}</p>}{item.amount !== null && comparable(item.unit).length > 1 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-neutral-700 dark:bg-neutral-300" style={{width: `${(item.amount / Math.max(...comparable(item.unit).map((p) => p.amount ?? 0), 0.01)) * 100}%`}} /></div>}</div></div>)}</div></div>
          {hasComparisons && <p className="mt-2 text-xs text-neutral-500">Bars compare the listed rates using the same billing unit.</p>}
        </section>
        {guide.sample && <section id="example" className="scroll-mt-24 pt-12"><h2 className="text-2xl font-semibold tracking-tight">Example request</h2><p className="mt-3 text-sm leading-6 text-neutral-500">Use an API key with access to this capability. Keep your key in an environment variable.</p><div className="mt-5 overflow-hidden rounded-xl bg-neutral-950 text-neutral-100"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-neutral-400"><span className="font-mono">POST {guide.endpoint}</span><button type="button" onClick={copySample} className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-white"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}</button></div><pre className="overflow-x-auto p-5 text-xs leading-6"><code>{guide.sample}</code></pre></div></section>}
        <section id="best-practices" className="scroll-mt-24 pt-12"><h2 className="text-2xl font-semibold tracking-tight">Best practices</h2><ul className="mt-4 space-y-3 pl-5 text-sm leading-7 text-neutral-600 dark:text-neutral-400">{guide.tips.map((tip) => <li className="list-disc" key={tip}>{tip}</li>)}</ul></section>
      </article>
      <aside className="hidden xl:block"><div className="sticky top-24 border-l border-neutral-200 pl-5 dark:border-neutral-800"><p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">On this page</p><nav className="mt-4 flex flex-col gap-3 text-sm text-neutral-500"><a href="#overview" className="hover:text-neutral-900 dark:hover:text-white">Overview</a><a href="#use-cases" className="hover:text-neutral-900 dark:hover:text-white">What you can build</a><a href="#models-pricing" className="hover:text-neutral-900 dark:hover:text-white">Models and pricing</a>{guide.sample && <a href="#example" className="hover:text-neutral-900 dark:hover:text-white">Example request</a>}<a href="#best-practices" className="hover:text-neutral-900 dark:hover:text-white">Best practices</a></nav></div></aside>
    </div>
  );
}
