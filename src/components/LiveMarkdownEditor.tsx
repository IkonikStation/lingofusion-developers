import React, {
  useCallback,
  useEffect,
  useRef,
} from "react";

interface LiveMarkdownEditorProps {
  id?: string;
  "data-testid"?: string;
  value: string;
  onChange: (markdown: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * Serializes a DOM node tree inside the editor into clean Markdown.
 */
export function domToMarkdown(rootNode: Node): string {
  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\u200B/g, "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    const childArr = Array.from(el.childNodes);
    const inner = childArr.map(serialize).join("");

    switch (tag) {
      case "H1":
        return `\n# ${inner.trim()}\n\n`;
      case "H2":
        return `\n## ${inner.trim()}\n\n`;
      case "H3":
        return `\n### ${inner.trim()}\n\n`;
      case "H4":
      case "H5":
      case "H6":
        return `\n#### ${inner.trim()}\n\n`;
      case "STRONG":
      case "B":
        return `**${inner}**`;
      case "EM":
      case "I":
        return `*${inner}*`;
      case "DEL":
      case "S":
      case "STRIKE":
        return `~~${inner}~~`;
      case "CODE":
        if (el.parentElement?.tagName.toUpperCase() === "PRE") {
          return inner;
        }
        return `\`${inner}\``;
      case "PRE":
        return `\n\`\`\`\n${inner.trim()}\n\`\`\`\n\n`;
      case "BLOCKQUOTE":
        return `\n> ${inner.trim()}\n\n`;
      case "UL":
        return `\n${inner}\n`;
      case "OL":
        return `\n${inner}\n`;
      case "LI": {
        const isParentOl = el.parentElement?.tagName.toUpperCase() === "OL";
        if (isParentOl) {
          const index = Array.from(el.parentElement?.children || []).indexOf(el) + 1;
          return `${index}. ${inner.trim()}\n`;
        }
        return `- ${inner.trim()}\n`;
      }
      case "A": {
        const href = el.getAttribute("href") || "";
        return `[${inner}](${href})`;
      }
      case "MARK":
        return `<mark>${inner}</mark>`;
      case "BR":
        return "\n";
      case "P":
      case "DIV":
        if (!inner.trim()) return "\n";
        return `${inner}\n`;
      default:
        return inner;
    }
  }

  const raw = serialize(rootNode);
  return raw
    .replace(/\u200B/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Converts Markdown string into styled HTML suitable for contentEditable rendering.
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";

  const lines = md.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      htmlLines.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      htmlLines.push("</ol>");
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        closeLists();
        htmlLines.push(
          `<pre class="my-2 rounded-lg bg-neutral-900 p-3 font-mono text-xs text-neutral-100 dark:bg-black/80"><code>${escapeHtml(
            codeBlockContent.join("\n"),
          )}</code></pre>`,
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        closeLists();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (/^#\s+(.+)$/.test(line)) {
      closeLists();
      const content = line.replace(/^#\s+/, "");
      htmlLines.push(
        `<h1 class="my-2 text-xl font-bold text-neutral-950 dark:text-white">${formatInline(
          content,
        )}</h1>`,
      );
      continue;
    }
    if (/^##\s+(.+)$/.test(line)) {
      closeLists();
      const content = line.replace(/^##\s+/, "");
      htmlLines.push(
        `<h2 class="my-1.5 text-lg font-bold text-neutral-950 dark:text-white">${formatInline(
          content,
        )}</h2>`,
      );
      continue;
    }
    if (/^###\s+(.+)$/.test(line)) {
      closeLists();
      const content = line.replace(/^###\s+/, "");
      htmlLines.push(
        `<h3 class="my-1 text-base font-semibold text-neutral-950 dark:text-white">${formatInline(
          content,
        )}</h3>`,
      );
      continue;
    }

    if (/^>\s+(.+)$/.test(line)) {
      closeLists();
      const content = line.replace(/^>\s+/, "");
      htmlLines.push(
        `<blockquote class="my-2 border-l-4 border-neutral-300 pl-3 italic text-neutral-700 dark:border-neutral-600 dark:text-neutral-300">${formatInline(
          content,
        )}</blockquote>`,
      );
      continue;
    }

    if (/^[-*]\s+(.+)$/.test(line)) {
      if (inOl) {
        htmlLines.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        htmlLines.push('<ul class="my-1.5 list-disc pl-5 space-y-0.5">');
        inUl = true;
      }
      const content = line.replace(/^[-*]\s+/, "");
      htmlLines.push(`<li>${formatInline(content)}</li>`);
      continue;
    }

    if (/^\d+\.\s+(.+)$/.test(line)) {
      if (inUl) {
        htmlLines.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        htmlLines.push('<ol class="my-1.5 list-decimal pl-5 space-y-0.5">');
        inOl = true;
      }
      const content = line.replace(/^\d+\.\s+/, "");
      htmlLines.push(`<li>${formatInline(content)}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeLists();
      htmlLines.push("<div><br></div>");
      continue;
    }

    closeLists();
    htmlLines.push(`<div>${formatInline(line)}</div>`);
  }

  closeLists();
  return htmlLines.join("");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatInline(str: string): string {
  return str
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/([^*]|^)\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-white/10">$1</code>',
    )
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 underline dark:text-blue-400" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

/**
 * Replaces matched inline markdown inside a text node with an HTML element
 * and places the caret directly after the newly created element.
 */
function replaceMatchWithElement(
  textNode: Node,
  caretOffset: number,
  matchLength: number,
  tagName: string,
  innerContent: string,
) {
  const fullText = textNode.textContent || "";
  const matchStart = caretOffset - matchLength;
  const matchEnd = caretOffset;

  const beforeText = fullText.slice(0, matchStart);
  const afterText = fullText.slice(matchEnd);

  const parent = textNode.parentNode;
  if (!parent) return;

  const el = document.createElement(tagName);
  if (tagName === "code") {
    el.className = "rounded bg-neutral-100 dark:bg-white/10 px-1.5 py-0.5 font-mono text-xs";
  }
  el.textContent = innerContent;

  const afterNode = document.createTextNode(afterText.length > 0 ? afterText : "\u200B");

  textNode.textContent = beforeText;

  if (textNode.nextSibling) {
    parent.insertBefore(el, textNode.nextSibling);
    parent.insertBefore(afterNode, el.nextSibling);
  } else {
    parent.appendChild(el);
    parent.appendChild(afterNode);
  }

  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.setStart(afterNode, afterText.length > 0 ? 0 : 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/**
 * Inspects the text node at caret offset for completed inline markdown syntax
 * and converts it into live HTML formatting.
 */
function checkInlineMarkdown(textNode: Node, offset: number): boolean {
  if (textNode.nodeType !== Node.TEXT_NODE) return false;
  const text = textNode.textContent || "";
  const before = text.slice(0, offset);

  // 1. Inline Code: `code`
  const codeMatch = before.match(/`([^`\n]+)`$/);
  if (codeMatch && codeMatch[1].trim()) {
    replaceMatchWithElement(textNode, offset, codeMatch[0].length, "code", codeMatch[1]);
    return true;
  }

  // 2. Bold: **text**
  const boldMatch = before.match(/\*\*([^*\n]+)\*\*$/);
  if (boldMatch && boldMatch[1].trim()) {
    replaceMatchWithElement(textNode, offset, boldMatch[0].length, "strong", boldMatch[1]);
    return true;
  }

  // 3. Strikethrough: ~~text~~
  const delMatch = before.match(/~~([^~\n]+)~~$/);
  if (delMatch && delMatch[1].trim()) {
    replaceMatchWithElement(textNode, offset, delMatch[0].length, "del", delMatch[1]);
    return true;
  }

  // 4. Italic: *text* (excluding bold delimiters)
  const italicMatch = before.match(/(?:^|[^*])\*([^*\n\s][^*\n]*)\*$/);
  if (italicMatch && italicMatch[1].trim()) {
    const matchLen = italicMatch[0].startsWith("*")
      ? italicMatch[0].length
      : italicMatch[0].length - 1;
    replaceMatchWithElement(textNode, offset, matchLen, "em", italicMatch[1]);
    return true;
  }

  return false;
}

export function LiveMarkdownEditor({
  id = "playground-user-input",
  "data-testid": dataTestId = "playground-user-input",
  value,
  onChange,
  onSubmit,
  placeholder = "Enter text to translate (supports Live Markdown & HTML)...",
  className = "",
}: LiveMarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastMarkdownRef = useRef(value);

  // Synchronize incoming external changes (e.g. Clear button, initial value)
  useEffect(() => {
    if (editorRef.current && value !== lastMarkdownRef.current) {
      lastMarkdownRef.current = value;
      editorRef.current.innerHTML = markdownToHtml(value);
    }
  }, [value]);

  // Initial load
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = markdownToHtml(value);
    }
  }, []);

  const triggerUpdate = useCallback(() => {
    if (!editorRef.current) return;
    const md = domToMarkdown(editorRef.current);
    lastMarkdownRef.current = md;
    onChange(md);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
      return;
    }

    // Space key: trigger live markdown transformations
    if (e.key === " " && !isComposingRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const before = text.slice(0, offset).trim();

          // Headings
          if (before === "#") {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand("formatBlock", false, "<h1>");
            triggerUpdate();
            return;
          }
          if (before === "##") {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand("formatBlock", false, "<h2>");
            triggerUpdate();
            return;
          }
          if (before === "###") {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand("formatBlock", false, "<h3>");
            triggerUpdate();
            return;
          }

          // Lists
          if (before === "-" || before === "*") {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand("insertUnorderedList");
            triggerUpdate();
            return;
          }
          if (before === "1.") {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand("insertOrderedList");
            triggerUpdate();
            return;
          }

          // Blockquote
          if (before === ">") {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand("formatBlock", false, "<blockquote>");
            triggerUpdate();
            return;
          }

          // Inline formatting before space
          if (checkInlineMarkdown(node, offset)) {
            e.preventDefault();
            triggerUpdate();
            return;
          }
        }
      }
    }
  };

  const handleInput = () => {
    if (!isComposingRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE) {
          checkInlineMarkdown(node, offset);
        }
      }
    }
    triggerUpdate();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const hasMarkdown = /(^#|\*\*|\*|`|~~|^[-*]\s|^\d+\.\s|^>)/m.test(text);

    if (hasMarkdown) {
      const html = markdownToHtml(text);
      document.execCommand("insertHTML", false, html);
    } else {
      document.execCommand("insertText", false, text);
    }
    triggerUpdate();
  };

  const isEmpty = !value.trim();

  return (
    <div className="relative flex flex-1 flex-col">
      {isEmpty && (
        <div
          onClick={() => editorRef.current?.focus()}
          className="pointer-events-none absolute left-0 top-0 select-none text-base leading-7 text-neutral-400 dark:text-neutral-500"
        >
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        id={id}
        data-testid={dataTestId}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          triggerUpdate();
        }}
        className={`focus:outline-none ${className}`}
        style={{ minHeight: "14rem" }}
      />
    </div>
  );
}
