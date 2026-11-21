import { Extension, Node, type CommandProps } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

/* ───────────────────────── URL helpers ───────────────────────── */

/** "example.com" -> "https://example.com", "a@b.com" -> "mailto:a@b.com". Returns null when invalid. */
export function normalizeLinkUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  let candidate: string;
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(v)) candidate = v;
  else if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) candidate = `mailto:${v}`;
  else candidate = `https://${v}`;

  if (candidate.startsWith("#") || candidate.startsWith("/")) return candidate;
  try {
    const u = new URL(candidate);
    if (!["http:", "https:", "mailto:", "tel:"].includes(u.protocol)) return null;
    if (
      (u.protocol === "http:" || u.protocol === "https:") &&
      !u.hostname.includes(".") &&
      u.hostname !== "localhost"
    )
      return null;
    return candidate;
  } catch {
    return null;
  }
}

/** http(s) or root-relative image url only */
export function normalizeImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

export interface VideoAttrs {
  src: string;
  kind: "iframe" | "video";
}

/** YouTube / Vimeo links become embed urls, direct files (.mp4 .webm .ogg .mov) become <video> */
export function parseVideoUrl(raw: string): VideoAttrs | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, "");

  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = u.pathname.slice(1);
  } else if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1];
  }
  if (id && /^[\w-]{6,}$/.test(id)) {
    return { src: `https://www.youtube.com/embed/${id}`, kind: "iframe" };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{5,})/);
    if (m) return { src: `https://player.vimeo.com/video/${m[1]}`, kind: "iframe" };
  }

  if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) {
    return { src: u.toString(), kind: "video" };
  }
  return null;
}

/* ───────────────────────── Indent (paragraph + heading + list items) ───────────────────────── */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create<{ types: string[]; step: number; max: number }>({
  name: "indent",

  addOptions() {
    return { types: ["paragraph", "heading"], step: 24, max: 8 };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const px = parseInt(el.style.marginLeft || "0", 10);
              return px > 0 ? Math.min(Math.round(px / this.options.step), this.options.max) : 0;
            },
            renderHTML: (attrs) =>
              attrs.indent > 0 ? { style: `margin-left: ${attrs.indent * this.options.step}px` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const { types, max } = this.options;

    const shift =
      (dir: 1 | -1) =>
      ({ state, tr, commands, editor }: CommandProps) => {
        // inside a list -> nest / un-nest the list item
        if (editor.isActive("listItem")) {
          return dir > 0 ? commands.sinkListItem("listItem") : commands.liftListItem("listItem");
        }
        let changed = false;
        const { from, to } = state.selection;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!types.includes(node.type.name)) return true;
          const cur = (node.attrs.indent as number) || 0;
          const next = Math.min(Math.max(cur + dir, 0), max);
          if (next !== cur) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
          return false;
        });
        return changed;
      };

    return { indent: () => shift(1), outdent: () => shift(-1) };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-]": () => this.editor.commands.indent(),
      "Mod-[": () => this.editor.commands.outdent(),
    };
  },
});

/* ───────────────────────── Video / embed node ───────────────────────── */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      kind: { default: "iframe" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "iframe[src]",
        getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute("src"), kind: "iframe" }),
      },
      {
        tag: "video[src]",
        getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute("src"), kind: "video" }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, kind } = HTMLAttributes as VideoAttrs;
    if (kind === "video") {
      return ["video", { src, controls: "true", style: "max-width:100%;border-radius:6px" }];
    }
    return [
      "iframe",
      {
        src,
        allowfullscreen: "true",
        frameborder: "0",
        loading: "lazy",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        style: "width:100%;aspect-ratio:16/9;border:0;border-radius:6px",
      },
    ];
  },

  // iframe gets a transparent overlay inside the editor so a click selects the node
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "relative my-3 w-full";
      const { src, kind } = node.attrs as VideoAttrs;

      if (kind === "video") {
        const v = document.createElement("video");
        v.src = src;
        v.controls = true;
        v.className = "w-full rounded-md";
        dom.appendChild(v);
      } else {
        const f = document.createElement("iframe");
        f.src = src;
        f.className = "aspect-video w-full rounded-md border-0";
        f.allowFullscreen = true;
        f.setAttribute("loading", "lazy");
        const overlay = document.createElement("div");
        overlay.className = "absolute inset-0";
        dom.append(f, overlay);
      }
      return { dom };
    };
  },
});

/* ───────────────────────── extension set ───────────────────────── */
export function getExtensions(placeholder: string) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      protocols: ["mailto", "tel"],
      HTMLAttributes: { rel: "noopener noreferrer nofollow" },
    }),
    Image.configure({ allowBase64: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyle,
    Color,
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Indent,
    Video,
  ];
}
