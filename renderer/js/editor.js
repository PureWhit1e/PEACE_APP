/**
 * TipTap Editor Module — Peace
 *
 * Block-style Notion-like editor with:
 *   - Paragraphs, Headings (H1-H3)
 *   - Images (resizable via drag handles)
 *   - Videos (inline block)
 *   - Dividers (horizontal rule)
 *   - Task lists (checkboxes)
 *   - Export to HTML / Markdown
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TurndownService from 'turndown';

// ── Resizable Image Extension ───────────────────────────────────────────────
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, renderHTML: (a) => (a.width ? { width: a.width } : {}) },
      align: { default: 'center' },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('image-resizable');
      wrapper.dataset.align = node.attrs.align || 'center';

      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      if (node.attrs.width) img.style.width = node.attrs.width;
      img.draggable = false;

      // Resize handle
      const handle = document.createElement('div');
      handle.classList.add('image-resize-handle');

      wrapper.append(img, handle);

      // Drag to resize
      let startX, startW;
      const onMouseMove = (e) => {
        const newW = Math.max(100, startW + (e.clientX - startX));
        img.style.width = newW + 'px';
      };
      const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.chain().focus()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                width: img.style.width,
              });
              return true;
            })
            .run();
        }
      };

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = img.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      return {
        dom: wrapper,
        contentDOM: null,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false;
          img.src = updatedNode.attrs.src;
          if (updatedNode.attrs.width) img.style.width = updatedNode.attrs.width;
          wrapper.dataset.align = updatedNode.attrs.align || 'center';
          return true;
        },
        destroy: () => {},
      };
    };
  },
});

// ── Video Block Extension ───────────────────────────────────────────────────
import { Node, mergeAttributes } from '@tiptap/core';

const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      width: { default: '100%' },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, {
      controls: true,
      style: `width: ${HTMLAttributes.width || '100%'}; border-radius: 8px;`,
    })];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('video-block');

      const video = document.createElement('video');
      video.src = node.attrs.src;
      video.controls = true;
      video.style.width = node.attrs.width || '100%';
      video.style.borderRadius = '8px';

      wrapper.append(video);

      return {
        dom: wrapper,
        contentDOM: null,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'videoBlock') return false;
          video.src = updatedNode.attrs.src;
          video.style.width = updatedNode.attrs.width || '100%';
          return true;
        },
        destroy: () => {},
      };
    };
  },
});

// ── Turndown (HTML → Markdown) ──────────────────────────────────────────────
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Custom rule: video → markdown link
turndown.addRule('video', {
  filter: 'video',
  replacement: (_content, node) => `\n![video](${node.getAttribute('src')})\n`,
});

// Custom rule: task list items
turndown.addRule('taskListItem', {
  filter: (node) => node.nodeName === 'LI' && node.hasAttribute('data-checked'),
  replacement: (content, node) => {
    const checked = node.getAttribute('data-checked') === 'true' ? 'x' : ' ';
    return `- [${checked}] ${content.trim()}\n`;
  },
});

// ── Create Editor ───────────────────────────────────────────────────────────
export function createEditor(element, options = {}) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
      }),
      VideoBlock,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: options.placeholder || 'Begin writing...',
      }),
    ],
    content: options.content || '',
    editorProps: {
      attributes: {
        class: 'peace-editor',
        spellcheck: 'false',
      },
    },
    onUpdate: options.onUpdate || (() => {}),
  });

  return editor;
}

// ── Export Helpers ───────────────────────────────────────────────────────────
export function exportHTML(editor) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Peace Writing</title>
  <style>
    body { max-width: 720px; margin: 2rem auto; font-family: Georgia, serif; line-height: 1.8; color: #222; padding: 0 1rem; }
    h1, h2, h3 { margin-top: 2rem; }
    img { max-width: 100%; border-radius: 8px; }
    video { max-width: 100%; border-radius: 8px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
    ul[data-type="taskList"] li::before { content: none; }
  </style>
</head>
<body>
${editor.getHTML()}
</body>
</html>`;
}

export function exportMarkdown(editor) {
  const html = editor.getHTML();
  return turndown.turndown(html);
}

// ── Toolbar Commands ────────────────────────────────────────────────────────
export const toolbarActions = {
  heading1: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  heading2: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  heading3: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  bold: (editor) => editor.chain().focus().toggleBold().run(),
  italic: (editor) => editor.chain().focus().toggleItalic().run(),
  taskList: (editor) => editor.chain().focus().toggleTaskList().run(),
  divider: (editor) => editor.chain().focus().setHorizontalRule().run(),

  async insertImage(editor) {
    // Electron path
    if (window.peace?.pickImage) {
      const result = await window.peace.pickImage();
      if (result.success) {
        editor.chain().focus().setImage({ src: result.dataUrl }).run();
      }
    } else {
      // Web fallback: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          editor.chain().focus().setImage({ src: e.target.result }).run();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  },

  async insertVideo(editor) {
    // Electron path
    if (window.peace?.pickVideo) {
      const result = await window.peace.pickVideo();
      if (result.success) {
        editor.chain().focus().insertContent({
          type: 'videoBlock',
          attrs: { src: result.dataUrl },
        }).run();
      }
    } else {
      // Web fallback: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          editor.chain().focus().insertContent({
            type: 'videoBlock',
            attrs: { src: e.target.result },
          }).run();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  },
};
