import { useEffect, useRef, type ReactNode } from "react";

export function RichTextContent({ value, empty }: { value: string | null | undefined; empty?: string }) {
  const source = value?.trim() ?? "";
  if (!source) return <div className="document-content"><span className="muted">{empty ?? "Ikke dokumentert"}</span></div>;
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) { index += 1; continue; }
    const heading = /^(#{1,5})\s+(.*)$/.exec(lines[index]);
    if (heading) {
      const text = heading[2];
      const key = `heading-${index}`;
      blocks.push(heading[1].length === 1 ? <h1 key={key}>{text}</h1> : heading[1].length === 2 ? <h2 key={key}>{text}</h2> : heading[1].length === 3 ? <h3 key={key}>{text}</h3> : heading[1].length === 4 ? <h4 key={key}>{text}</h4> : <h5 key={key}>{text}</h5>);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length) { const match = /^[-*]\s+(.*)$/.exec(lines[index]); if (!match) break; items.push(match[1]); index += 1; }
      blocks.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length) { const match = /^\d+[.)]\s+(.*)$/.exec(lines[index]); if (!match) break; items.push(match[1]); index += 1; }
      blocks.push(<ol key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ol>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,5})\s+/.test(lines[index]) && !/^[-*]\s+/.test(lines[index]) && !/^\d+[.)]\s+/.test(lines[index])) { paragraph.push(lines[index]); index += 1; }
    blocks.push(<p key={`p-${index}`}>{paragraph.map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < paragraph.length - 1 && <br />}</span>)}</p>);
  }
  return <div className="document-content rich-text-content">{blocks}</div>;
}

export function markdownToEditorHtml(value: string) {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { blocks.push(`<h${heading[1].length}>${escape(heading[2]) || "<br>"}</h${heading[1].length}>`); index += 1; continue; }
    if (/^[-*]\s+/.test(line)) { const items: string[] = []; while (index < lines.length) { const match = /^[-*]\s+(.*)$/.exec(lines[index]); if (!match) break; items.push(`<li>${escape(match[1]) || "<br>"}</li>`); index += 1; } blocks.push(`<ul>${items.join("")}</ul>`); continue; }
    if (/^\d+[.)]\s+/.test(line)) { const items: string[] = []; while (index < lines.length) { const match = /^\d+[.)]\s+(.*)$/.exec(lines[index]); if (!match) break; items.push(`<li>${escape(match[1]) || "<br>"}</li>`); index += 1; } blocks.push(`<ol>${items.join("")}</ol>`); continue; }
    blocks.push(line ? `<p>${escape(line)}</p>` : "<p><br></p>");
    index += 1;
  }
  return blocks.join("");
}

export function editorHtmlToMarkdown(element: HTMLElement) {
  const text = (node: Node) => (node.textContent ?? "").replace(/\u00a0/g, " ").trimEnd();
  const blocks: string[] = [];
  const append = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { if (text(node)) blocks.push(text(node)); return; }
    const item = node as HTMLElement;
    const tag = item.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) blocks.push(`${"#".repeat(Number(tag[1]))} ${text(item)}`.trimEnd());
    else if (tag === "ul") blocks.push(Array.from(item.children).map((child) => `- ${text(child)}`).join("\n"));
    else if (tag === "ol") blocks.push(Array.from(item.children).map((child, index) => `${index + 1}. ${text(child)}`).join("\n"));
    else if (tag === "br") blocks.push("");
    else if (Array.from(item.children).some((child) => /^(div|p|h[1-4]|ul|ol)$/.test(child.tagName.toLowerCase()))) item.childNodes.forEach(append);
    else blocks.push(text(item));
  };
  element.childNodes.forEach(append);
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function RichTextEditor({ value, onChange, maxLength = 20000, rows = 12 }: { value: string; onChange: (value: string) => void; maxLength?: number; rows?: number }) {
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const lastValue = useRef("");
  useEffect(() => {
    const element = editor.current;
    if (!element || value === lastValue.current || document.activeElement === element) return;
    element.innerHTML = markdownToEditorHtml(value);
    lastValue.current = value;
  }, [value]);
  function rememberSelection() { const current = window.getSelection(); if (current?.rangeCount && editor.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange(); }
  function restoreSelection() { const current = window.getSelection(); if (!current || !selection.current) return; current.removeAllRanges(); current.addRange(selection.current); }
  function emitChange() { const element = editor.current; if (!element) return; const next = editorHtmlToMarkdown(element); if (next.length > maxLength) { element.innerHTML = markdownToEditorHtml(value); return; } lastValue.current = next; onChange(next); rememberSelection(); }
  function insertPlainText(text: string) {
    editor.current?.focus();
    restoreSelection();
    document.execCommand("insertText", false, text.replace(/\r\n/g, "\n"));
    emitChange();
  }
  function format(kind: "normal" | "h1" | "h2" | "h3" | "h4" | "ul" | "ol") { editor.current?.focus(); restoreSelection(); if (kind === "ul") document.execCommand("insertUnorderedList"); else if (kind === "ol") document.execCommand("insertOrderedList"); else document.execCommand("formatBlock", false, kind === "normal" ? "p" : kind); emitChange(); }
  return <div className="rich-text-editor"><div className="rich-text-toolbar" role="toolbar" aria-label="Tekstformatering"><button className="secondary-button" type="button" onMouseDown={(event) => { event.preventDefault(); format("normal"); }}>Normal</button><label><span className="sr-only">Overskriftsnivå</span><select aria-label="Overskriftsnivå" value="" onChange={(event) => format(event.target.value as "h1" | "h2" | "h3" | "h4")}><option value="" disabled>Overskrift</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option></select></label><button className="secondary-button" type="button" onMouseDown={(event) => { event.preventDefault(); format("ul"); }} aria-label="Punktmerket liste">• Liste</button><button className="secondary-button" type="button" onMouseDown={(event) => { event.preventDefault(); format("ol"); }} aria-label="Nummerert liste">1. Liste</button></div><div ref={editor} className="workflow-document-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="Skriv her …" style={{ minHeight: `${Math.max(180, rows * 24)}px` }} onInput={emitChange} onPaste={(event) => { event.preventDefault(); insertPlainText(event.clipboardData.getData("text/plain")); }} onDrop={(event) => { event.preventDefault(); insertPlainText(event.dataTransfer.getData("text/plain")); }} onDragOver={(event) => event.preventDefault()} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onFocus={(event) => { if (!event.currentTarget.innerHTML) event.currentTarget.innerHTML = markdownToEditorHtml(value); rememberSelection(); }} /></div>;
}
