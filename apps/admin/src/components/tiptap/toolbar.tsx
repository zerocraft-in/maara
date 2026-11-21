"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Ban,
  Bold,
  ChevronDown,
  Code,
  Code2,
  CornerDownLeft,
  ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  PlayCircle,
  Strikethrough,
  Table as TableIcon,
  Type,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MenuItem,
  MenuSeparator,
  ToolbarButton,
  ToolbarMenu,
  ToolbarSeparator,
  keepSelection,
} from "./toolbar-primitives";

export type EditorDialog = "link" | "image" | "video";

/* ───────────────────────── block styles (Paragraph dropdown) ───────────────────────── */
const BLOCKS = [
  { id: "paragraph", label: "Paragraph", preview: "text-sm" },
  { id: "h1", label: "Heading 1", preview: "text-2xl font-bold" },
  { id: "h2", label: "Heading 2", preview: "text-xl font-bold" },
  { id: "h3", label: "Heading 3", preview: "text-lg font-semibold" },
  { id: "h4", label: "Heading 4", preview: "text-base font-semibold" },
  { id: "h5", label: "Heading 5", preview: "text-sm font-semibold" },
  { id: "h6", label: "Heading 6", preview: "text-xs font-semibold" },
  { id: "blockquote", label: "Blockquote", preview: "text-sm italic" },
  { id: "pre", label: "Preformatted", preview: "font-mono text-xs" },
] as const;
type BlockId = (typeof BLOCKS)[number]["id"];

function currentBlock(editor: Editor): BlockId {
  for (let level = 1; level <= 6; level++) {
    if (editor.isActive("heading", { level })) return `h${level}` as BlockId;
  }
  if (editor.isActive("codeBlock")) return "pre";
  if (editor.isActive("blockquote")) return "blockquote";
  return "paragraph";
}

function applyBlock(editor: Editor, id: BlockId) {
  const chain = editor.chain().focus();
  switch (id) {
    case "paragraph": {
      chain.setParagraph();
      if (editor.isActive("blockquote")) chain.lift("blockquote");
      chain.run();
      break;
    }
    case "blockquote":
      chain.toggleBlockquote().run();
      break;
    case "pre":
      chain.toggleCodeBlock().run();
      break;
    default:
      chain.setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  }
}

/* ───────────────────────── colors ───────────────────────── */
const COLORS = [
  "#000000", "#4b5563", "#9ca3af", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0d9488",
  "#2563eb", "#7c3aed", "#db2777", "#ffffff",
];

/* ───────────────────────── alignment ───────────────────────── */
const ALIGNMENTS = [
  { id: "left", label: "Align left", Icon: AlignLeft },
  { id: "center", label: "Align center", Icon: AlignCenter },
  { id: "right", label: "Align right", Icon: AlignRight },
  { id: "justify", label: "Justify", Icon: AlignJustify },
] as const;

/* ───────────────────────── table ───────────────────────── */
const TABLE_ACTIONS: { label: string; run: (e: Editor) => void; danger?: boolean; sepBefore?: boolean }[] = [
  { label: "Add row above", run: (e) => e.chain().focus().addRowBefore().run() },
  { label: "Add row below", run: (e) => e.chain().focus().addRowAfter().run() },
  { label: "Add column left", run: (e) => e.chain().focus().addColumnBefore().run() },
  { label: "Add column right", run: (e) => e.chain().focus().addColumnAfter().run() },
  { label: "Delete row", run: (e) => e.chain().focus().deleteRow().run(), sepBefore: true },
  { label: "Delete column", run: (e) => e.chain().focus().deleteColumn().run() },
  { label: "Toggle header row", run: (e) => e.chain().focus().toggleHeaderRow().run(), sepBefore: true },
  { label: "Delete table", run: (e) => e.chain().focus().deleteTable().run(), danger: true, sepBefore: true },
];

function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const N = 6;
  const [hover, setHover] = React.useState({ r: 0, c: 0 });
  return (
    <div className="p-2">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, 1.25rem)` }}>
        {Array.from({ length: N * N }, (_, i) => {
          const r = Math.floor(i / N) + 1;
          const c = (i % N) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Insert ${c} by ${r} table`}
              onMouseDown={keepSelection}
              onMouseEnter={() => setHover({ r, c })}
              onFocus={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              className={cn(
                "size-5 rounded-sm border transition-colors",
                on ? "border-primary bg-primary/20" : "border-border bg-background",
              )}
            />
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {hover.r ? `${hover.c} × ${hover.r}` : "Insert table"}
      </p>
    </div>
  );
}

/* ───────────────────────── toolbar ───────────────────────── */
interface ToolbarProps {
  editor: Editor;
  disabled?: boolean;
  htmlMode: boolean;
  onToggleHtml: () => void;
  onOpenDialog: (dialog: EditorDialog) => void;
}

export function EditorToolbar({ editor, disabled, htmlMode, onToggleHtml, onOpenDialog }: ToolbarProps) {
  const off = disabled || htmlMode;

  const block = currentBlock(editor);
  const blockLabel = BLOCKS.find((b) => b.id === block)?.label ?? "Paragraph";
  const color = editor.getAttributes("textStyle").color as string | undefined;
  const AlignIcon =
    ALIGNMENTS.find((a) => editor.isActive({ textAlign: a.id }))?.Icon ?? AlignLeft;
  const inTable = editor.isActive("table");
  const canLink = !editor.state.selection.empty || editor.isActive("link");

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-1.5 py-1"
    >
      {/* more text formatting */}
      <ToolbarMenu label="More formatting" disabled={off} trigger={<Type className="size-4" />}>
        {(close) => (
          <>
            <MenuItem
              icon={<Strikethrough className="size-4" />}
              active={editor.isActive("strike")}
              onSelect={() => {
                editor.chain().focus().toggleStrike().run();
                close();
              }}
            >
              Strikethrough
            </MenuItem>
            <MenuItem
              icon={<Code className="size-4" />}
              active={editor.isActive("code")}
              onSelect={() => {
                editor.chain().focus().toggleCode().run();
                close();
              }}
            >
              Inline code
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Minus className="size-4" />}
              onSelect={() => {
                editor.chain().focus().setHorizontalRule().run();
                close();
              }}
            >
              Horizontal line
            </MenuItem>
            <MenuItem
              icon={<CornerDownLeft className="size-4" />}
              onSelect={() => {
                editor.chain().focus().setHardBreak().run();
                close();
              }}
            >
              Line break
            </MenuItem>
          </>
        )}
      </ToolbarMenu>

      <ToolbarSeparator />

      {/* paragraph / headings */}
      <ToolbarMenu
        label="Text style"
        disabled={off}
        triggerClassName="w-[6.75rem] justify-between px-2"
        contentClassName="w-48"
        trigger={
          <>
            <span className="truncate text-[13px] font-medium">{blockLabel}</span>
            <ChevronDown className="size-3.5 shrink-0" />
          </>
        }
      >
        {(close) =>
          BLOCKS.map((b) => (
            <MenuItem
              key={b.id}
              active={b.id === block}
              onSelect={() => {
                applyBlock(editor, b.id);
                close();
              }}
            >
              <span className={b.preview}>{b.label}</span>
            </MenuItem>
          ))
        }
      </ToolbarMenu>

      <ToolbarSeparator />

      {/* B I U + color */}
      <ToolbarButton
        label="Bold (Ctrl+B)"
        active={editor.isActive("bold")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" strokeWidth={2.75} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        active={editor.isActive("italic")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>

      <ToolbarMenu
        label="Text color"
        disabled={off}
        contentClassName="w-[11.5rem] p-2"
        trigger={
          <>
            <span className="flex flex-col items-center leading-none">
              <span className="text-[15px] font-semibold">A</span>
              <span
                className="mt-0.5 h-[3px] w-4 rounded-full border border-border/50"
                style={{ background: color ?? "currentColor" }}
              />
            </span>
            <ChevronDown className="size-3.5" />
          </>
        }
      >
        {(close) => (
          <div className="space-y-2">
            <div className="grid grid-cols-6 gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onMouseDown={keepSelection}
                  onClick={() => {
                    editor.chain().focus().setColor(c).run();
                    close();
                  }}
                  className={cn(
                    "size-6 rounded-md border border-border transition-transform hover:scale-110",
                    color?.toLowerCase() === c && "ring-2 ring-ring ring-offset-1",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-sm px-1 py-1 text-sm hover:bg-accent">
              Custom color
              <input
                type="color"
                aria-label="Custom color"
                value={color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
              />
            </label>
            <MenuItem
              onSelect={() => {
                editor.chain().focus().unsetColor().run();
                close();
              }}
            >
              Default color
            </MenuItem>
          </div>
        )}
      </ToolbarMenu>

      <ToolbarSeparator />

      {/* alignment */}
      <ToolbarMenu
        label="Alignment"
        disabled={off}
        trigger={
          <>
            <AlignIcon className="size-4" />
            <ChevronDown className="size-3.5" />
          </>
        }
      >
        {(close) =>
          ALIGNMENTS.map(({ id, label, Icon }) => (
            <MenuItem
              key={id}
              icon={<Icon className="size-4" />}
              active={editor.isActive({ textAlign: id }) || (id === "left" && !editor.getAttributes("paragraph").textAlign && !editor.getAttributes("heading").textAlign)}
              onSelect={() => {
                editor.chain().focus().setTextAlign(id).run();
                close();
              }}
            >
              {label}
            </MenuItem>
          ))
        }
      </ToolbarMenu>

      <ToolbarSeparator />

      {/* link / image / video / table */}
      <ToolbarButton
        label="Link (Ctrl+K)"
        active={editor.isActive("link")}
        disabled={off || !canLink}
        onClick={() => onOpenDialog("link")}
      >
        <LinkIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Insert image" disabled={off} onClick={() => onOpenDialog("image")}>
        <ImageIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Insert video" disabled={off} onClick={() => onOpenDialog("video")}>
        <PlayCircle className="size-4" />
      </ToolbarButton>
      <ToolbarMenu
        label="Table"
        disabled={off}
        active={inTable}
        contentClassName="w-auto min-w-[10rem]"
        trigger={
          <>
            <TableIcon className="size-4" />
            <ChevronDown className="size-3.5" />
          </>
        }
      >
        {(close) =>
          inTable ? (
            <>
              {TABLE_ACTIONS.map((a) => (
                <React.Fragment key={a.label}>
                  {a.sepBefore && <MenuSeparator />}
                  <MenuItem
                    danger={a.danger}
                    onSelect={() => {
                      a.run(editor);
                      close();
                    }}
                  >
                    {a.label}
                  </MenuItem>
                </React.Fragment>
              ))}
            </>
          ) : (
            <TableGridPicker
              onPick={(rows, cols) => {
                editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
                close();
              }}
            />
          )
        }
      </ToolbarMenu>

      <ToolbarSeparator />

      {/* lists + indent */}
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        disabled={off}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Decrease indent (Ctrl+[)"
        disabled={off}
        onClick={() => editor.chain().focus().outdent().run()}
      >
        <IndentDecrease className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Increase indent (Ctrl+])"
        disabled={off}
        onClick={() => editor.chain().focus().indent().run()}
      >
        <IndentIncrease className="size-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        label="Clear formatting"
        disabled={off}
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run()
        }
      >
        <Ban className="size-4" />
      </ToolbarButton>

      {/* html source */}
      <ToolbarButton
        label={htmlMode ? "Back to editor" : "Show HTML"}
        active={htmlMode}
        disabled={disabled}
        onClick={onToggleHtml}
        className="ml-auto"
      >
        <Code2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}
