import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { CalendarClock } from 'lucide-react';

// A non-editable marker the admin can insert into an event description.
// Nothing about the schedule is stored here — renderEventDescriptionHtml
// (frontend/src/lib/eventDescriptionBlocks.ts) replaces this marker with a
// freshly generated table at display time, so it always reflects the
// event's current children.
export const SCHEDULE_BLOCK_SELECTOR = 'div[data-event-block="schedule"]';

export const ScheduleBlockExtension = Node.create({
  name: 'eventScheduleBlock',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: SCHEDULE_BLOCK_SELECTOR }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-event-block': 'schedule' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScheduleBlockView);
  },
});

function ScheduleBlockView() {
  return (
    <NodeViewWrapper
      contentEditable={false}
      className="my-2 flex items-center gap-2 rounded-md border border-dashed border-[#d4b896] bg-[#d4b896]/10 px-3 py-2 text-sm text-[#2b2b2b] select-none"
    >
      <CalendarClock className="size-4 text-[#e67e22]" />
      Schedule — updates automatically
    </NodeViewWrapper>
  );
}
