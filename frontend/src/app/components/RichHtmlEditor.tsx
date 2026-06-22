import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Link as LinkExt } from '@tiptap/extension-link';
import { Image as ImageExt } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link, Image, Undo, Redo, Code2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const HEADING_OPTIONS = [
  { value: 'p',  label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
];

export function RichHtmlEditor({ value, onChange }: Props) {
  const [tab, setTab] = useState<'visual' | 'html'>('visual');
  const syncing = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      TextStyle,
      Color,
      LinkExt.configure({ openOnClick: false }),
      ImageExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate({ editor }) {
      if (!syncing.current) {
        onChange(editor.getHTML());
      }
    },
  });

  // Keep editor in sync when parent changes value externally (e.g. opening a different template)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      syncing.current = true;
      editor.commands.setContent(value, false);
      syncing.current = false;
    }
  }, [value, editor]);

  const switchToHtml = () => {
    setTab('html');
  };

  const switchToVisual = () => {
    if (editor) {
      syncing.current = true;
      editor.commands.setContent(value, false);
      syncing.current = false;
    }
    setTab('visual');
  };

  const insertLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const insertImage = () => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const headingValue = (): string => {
    if (!editor) return 'p';
    for (let i = 1; i <= 4; i++) {
      if (editor.isActive('heading', { level: i })) return `h${i}`;
    }
    return 'p';
  };

  const setHeading = (val: string) => {
    if (!editor) return;
    if (val === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(val[1]) as 1 | 2 | 3 | 4;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <Tabs value={tab} onValueChange={v => v === 'html' ? switchToHtml() : switchToVisual()}>
        <div className="flex items-center justify-between border-b px-2 py-1 bg-muted/40">

          {/* --- toolbar (only in visual mode) --- */}
          {tab === 'visual' && editor && (
            <div className="flex flex-wrap items-center gap-0.5">
              {/* heading select */}
              <Select value={headingValue()} onValueChange={setHeading}>
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADING_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="w-px h-5 bg-border mx-1" />

              {/* inline marks */}
              <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
                <Bold className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
                <Italic className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
                <UnderlineIcon className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
                <Strikethrough className="size-3.5" />
              </ToolBtn>

              <div className="w-px h-5 bg-border mx-1" />

              {/* color picker */}
              <label title="Text color" className="relative cursor-pointer">
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  value={editor.getAttributes('textStyle').color ?? '#000000'}
                  onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                />
                <span
                  className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted border border-transparent hover:border-border text-xs font-bold"
                  style={{ color: editor.getAttributes('textStyle').color ?? 'inherit' }}
                >
                  A
                </span>
              </label>

              <div className="w-px h-5 bg-border mx-1" />

              {/* alignment */}
              <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
                <AlignLeft className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center">
                <AlignCenter className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">
                <AlignRight className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justify">
                <AlignJustify className="size-3.5" />
              </ToolBtn>

              <div className="w-px h-5 bg-border mx-1" />

              {/* lists */}
              <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
                <List className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
                <ListOrdered className="size-3.5" />
              </ToolBtn>

              <div className="w-px h-5 bg-border mx-1" />

              {/* link & image */}
              <ToolBtn active={editor.isActive('link')} onClick={insertLink} title="Insert link">
                <Link className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={false} onClick={insertImage} title="Insert image">
                <Image className="size-3.5" />
              </ToolBtn>

              <div className="w-px h-5 bg-border mx-1" />

              {/* undo / redo */}
              <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
                <Undo className="size-3.5" />
              </ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
                <Redo className="size-3.5" />
              </ToolBtn>
            </div>
          )}
          {tab === 'html' && <span className="text-xs text-muted-foreground px-1">HTML source</span>}

          {/* tab switcher */}
          <TabsList className="h-7 ml-auto">
            <TabsTrigger value="visual" className="text-xs h-6 px-2">Visual</TabsTrigger>
            <TabsTrigger value="html" className="text-xs h-6 px-2"><Code2 className="size-3 mr-1" />HTML</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visual" className="m-0">
          <EditorContent
            editor={editor}
            className="min-h-[420px] max-h-[420px] overflow-y-auto px-4 py-3 prose prose-sm max-w-none focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px]"
          />
        </TabsContent>

        <TabsContent value="html" className="m-0">
          <CodeMirror
            value={value}
            height="420px"
            extensions={[htmlLang()]}
            onChange={onChange}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToolBtn({
  children, active, onClick, title, disabled = false,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center h-7 w-7 rounded text-sm transition-colors
        hover:bg-muted disabled:opacity-40 disabled:pointer-events-none
        ${active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
    >
      {children}
    </button>
  );
}
