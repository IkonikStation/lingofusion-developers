import React, { useMemo, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { highlightCode } from "../lib/highlightCode";

interface MarkdownViewProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

export function MarkdownView({ content, className = "", streaming = false }: MarkdownViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const blocks = useMemo(() => {
    return parseMarkdownBlocks(content);
  }, [content]);

  return (
    <div className={`prose-like text-base leading-7 text-neutral-900 dark:text-neutral-100 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          const highlighted = highlightCode(block.content, block.language);
          return (
            <div
              key={idx}
              className="my-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900 font-mono text-xs shadow-xs dark:border-white/10 dark:bg-black/80"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5 text-neutral-400">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-neutral-300">
                  {block.language || "text"}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.content, idx)}
                  className="inline-flex items-center gap-1 text-[11px] hover:text-white"
                >
                  {copiedIndex === idx ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <ClipboardCopy className="h-3 w-3" />
                  )}
                  {copiedIndex === idx ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto p-3.5 text-neutral-100">
                <code
                  className={`hljs ${block.language ? `language-${block.language}` : ""}`}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </pre>
            </div>
          );
        }

        if (block.type === "heading") {
          const sizeClass =
            block.level === 1
              ? "text-xl font-bold mt-4 mb-2 text-neutral-950 dark:text-white"
              : block.level === 2
                ? "text-lg font-bold mt-3 mb-1.5 text-neutral-950 dark:text-white"
                : "text-base font-semibold mt-2.5 mb-1 text-neutral-950 dark:text-white";
          if (block.level === 1) {
            return (
              <h1 key={idx} className={sizeClass}>
                <InlineMarkdown text={block.content} />
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={idx} className={sizeClass}>
                <InlineMarkdown text={block.content} />
              </h2>
            );
          }
          if (block.level === 3) {
            return (
              <h3 key={idx} className={sizeClass}>
                <InlineMarkdown text={block.content} />
              </h3>
            );
          }
          return (
            <h4 key={idx} className={sizeClass}>
              <InlineMarkdown text={block.content} />
            </h4>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={idx}
              className="my-2.5 border-l-4 border-neutral-300 pl-3.5 py-0.5 italic text-neutral-700 dark:border-neutral-600 dark:text-neutral-300"
            >
              <InlineMarkdown text={block.content} />
            </blockquote>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={idx} className="my-2 list-disc pl-5 space-y-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={idx} className="my-2 list-decimal pl-5 space-y-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <div key={idx} className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-neutral-300 text-xs dark:border-neutral-700">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800">
                    {block.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="border border-neutral-300 px-3 py-2 text-left font-semibold dark:border-neutral-700"
                      >
                        <InlineMarkdown text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 1 ? "bg-neutral-50 dark:bg-white/[0.02]" : ""}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="border border-neutral-300 px-3 py-2 dark:border-neutral-700"
                        >
                          <InlineMarkdown text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "hr") {
          return <hr key={idx} className="my-4 border-neutral-200 dark:border-white/10" />;
        }

        // Default paragraph
        return (
          <p key={idx} className="my-1.5 whitespace-pre-wrap">
            <InlineMarkdown text={block.content} />
            {streaming && idx === blocks.length - 1 && (
              <span className="inline-block animate-pulse font-mono font-bold text-neutral-500 dark:text-neutral-300">
                ▋
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}

// Inline Markdown & HTML Renderer
export function InlineMarkdown({ text }: { text: string }) {
  const elements = useMemo(() => {
    return parseInlineTokens(text);
  }, [text]);

  return <>{elements}</>;
}

// Block Types
type Block =
  | { type: "p"; content: string }
  | { type: "code"; content: string; language?: string }
  | { type: "heading"; level: number; content: string }
  | { type: "quote"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

function parseMarkdownBlocks(text: string): Block[] {
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block
    const codeMatch = line.match(/^```(\w*)/);
    if (codeMatch) {
      const language = codeMatch[1]?.toLowerCase() || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
        language,
      });
      continue;
    }

    // Horizontal Rule
    if (/^(---|___|\*\*\*)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading (# through ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote (> )
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "quote",
        content: quoteLines.join("\n"),
      });
      continue;
    }

    // Table
    if (line.includes("|") && lines[i + 1] && /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(lines[i + 1])) {
      const rawHeader = line.split("|").map((c) => c.trim()).filter((_, idx, arr) => !(idx === 0 && _ === "") && !(idx === arr.length - 1 && _ === ""));
      i += 2; // skip header and delimiter
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i].split("|").map((c) => c.trim()).filter((_, idx, arr) => !(idx === 0 && _ === "") && !(idx === arr.length - 1 && _ === ""));
        if (row.length > 0) rows.push(row);
        i++;
      }
      blocks.push({
        type: "table",
        headers: rawHeader,
        rows,
      });
      continue;
    }

    // Unordered List
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered List
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular Paragraph
    const pLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: "p",
      content: pLines.join("\n"),
    });
  }

  return blocks;
}

function parseInlineTokens(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match bold (** or __), italic (* or _), inline code (`), strike (~~), links ([text](url)), tags in square brackets ([tag]), and safe HTML tags
  const tokenRegex =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~|\[([^\]]+)\]\(([^)]+)\)|\[([^\]\n]+)\]|<span[^>]*>(.*?)<\/span>|<strong[^>]*>(.*?)<\/strong>|<em[^>]*>(.*?)<\/em>|<b[^>]*>(.*?)<\/b>|<i[^>]*>(.*?)<\/i>|<code[^>]*>(.*?)<\/code>|<mark[^>]*>(.*?)<\/mark>|<br\s*\/?>)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    // Inline Code
    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={match.index}
          className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.875em] font-medium text-neutral-800 dark:bg-white/10 dark:text-neutral-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // Bold (** or __)
    else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-neutral-950 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    // Italic (* or _)
    else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      nodes.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    // Strikethrough (~~)
    else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(
        <del key={match.index} className="line-through text-neutral-400">
          {token.slice(2, -2)}
        </del>
      );
    }
    // Markdown Link [text](url)
    else if (token.startsWith("[") && match[2] && match[3]) {
      nodes.push(
        <a
          key={match.index}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          {match[2]}
        </a>
      );
    }
    // Tag in square brackets e.g. [Laughing], [sound of (thing)]
    else if (token.startsWith("[") && token.endsWith("]") && match[4]) {
      nodes.push(
        <span
          key={match.index}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium text-[0.9em] border border-purple-200/70 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40"
        >
          {token}
        </span>
      );
    }
    // HTML <mark>
    else if (token.startsWith("<mark")) {
      nodes.push(
        <mark key={match.index} className="bg-amber-100 px-1 py-0.5 text-neutral-900 rounded dark:bg-amber-500/20 dark:text-amber-200">
          {token.replace(/<\/?mark[^>]*>/g, "")}
        </mark>
      );
    }
    // HTML <strong> or <b>
    else if (token.startsWith("<strong") || token.startsWith("<b")) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-neutral-950 dark:text-white">
          {token.replace(/<\/?(strong|b)[^>]*>/g, "")}
        </strong>
      );
    }
    // HTML <em> or <i>
    else if (token.startsWith("<em") || token.startsWith("<i")) {
      nodes.push(
        <em key={match.index} className="italic">
          {token.replace(/<\/?(em|i)[^>]*>/g, "")}
        </em>
      );
    }
    // HTML <code>
    else if (token.startsWith("<code")) {
      nodes.push(
        <code
          key={match.index}
          className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.875em] font-medium text-neutral-800 dark:bg-white/10 dark:text-neutral-200"
        >
          {token.replace(/<\/?code[^>]*>/g, "")}
        </code>
      );
    }
    // HTML <br>
    else if (token.startsWith("<br")) {
      nodes.push(<br key={match.index} />);
    }
    // HTML <span>
    else if (token.startsWith("<span")) {
      nodes.push(
        <span key={match.index}>
          {token.replace(/<\/?span[^>]*>/g, "")}
        </span>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
