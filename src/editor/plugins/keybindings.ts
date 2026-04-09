/**
 * Keybindings Plugin for Proof
 *
 * Provides keyboard shortcuts:
 * - Cmd+Alt+M: Open comment composer (Google Docs-style)
 * - Cmd+Shift+P: Invoke agent on selection (opens input dialog)
 * - Cmd+Shift+K: Add comment for Proof to review later
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { keymap } from '@milkdown/kit/prose/keymap';
import {
  comment as addComment,
  getMarks,
  getActiveMarkId,
  setActiveMark,
  resolve,
} from './marks';
import {
  getUnresolvedComments,
} from '../../formats/marks';
import { openCommentComposer } from './mark-popover';
import { getCurrentActor } from '../actor';
import { getTextForRange } from '../utils/text-range';

// ============================================================================
// Types
// ============================================================================

export interface AgentInputContext {
  selection: string;
  range: { from: number; to: number };
  position: { top: number; left: number };
}

export interface AgentInputCallbacks {
  onSubmit: (prompt: string) => Promise<void>;
  onCancel: () => void;
}

// ============================================================================
// Plugin State
// ============================================================================

const keybindingsKey = new PluginKey('keybindings');

// Callbacks for showing the agent input dialog
let showAgentInputCallback: ((context: AgentInputContext, callbacks: AgentInputCallbacks) => void) | null = null;

/**
 * Set the callback for showing the agent input dialog
 */
export function setShowAgentInputCallback(
  callback: (context: AgentInputContext, callbacks: AgentInputCallbacks) => void
): void {
  showAgentInputCallback = callback;
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Invoke agent on selection (Cmd+Shift+P)
 * Opens a floating input dialog for the user to type their prompt
 */
function invokeAgentCommand(
  state: Parameters<typeof keymap>[0] extends Record<string, infer F> ? (F extends (s: infer S, ...args: unknown[]) => boolean ? S : never) : never,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined
): boolean {
  if (!view) return false;

  const { from, to } = state.selection;
  const selectedText = getTextForRange(state.doc, { from, to });

  // Get coordinates at selection start for positioning the dialog
  const coords = view.coordsAtPos(from);

  const context: AgentInputContext = {
    selection: selectedText,
    range: { from, to },
    position: { top: coords.top, left: coords.left },
  };

  if (showAgentInputCallback) {
    showAgentInputCallback(context, {
      onSubmit: async (prompt: string) => {
        // This will be wired up by the editor to trigger the agent
        const event = new CustomEvent('proof:invoke-agent', {
          detail: { prompt, context },
        });
        window.dispatchEvent(event);
      },
      onCancel: () => {
        // Dialog cancelled, nothing to do
      },
    });
  } else {
    // Fallback: dispatch event directly if no UI callback set
    const event = new CustomEvent('proof:invoke-agent', {
      detail: { prompt: '', context, showDialog: true },
    });
    window.dispatchEvent(event);
  }

  return true;
}

/**
 * Add comment for Proof to review (Cmd+Shift+K)
 * Tags the selection with a comment for the agent to review later
 */
function addProofCommentCommand(
  state: Parameters<typeof keymap>[0] extends Record<string, infer F> ? (F extends (s: infer S, ...args: unknown[]) => boolean ? S : never) : never,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined
): boolean {
  if (!view) return false;

  const { from, to } = state.selection;
  const selectedText = getTextForRange(state.doc, { from, to });

  if (!selectedText.trim()) {
    // No selection, don't create empty comment
    return false;
  }

  // Create comment mark tagged for Proof review
  const actor = getCurrentActor();
  addComment(view, selectedText, actor, '[For @proof to review]', { from, to });

  return true;
}

/**
 * Open comment composer on selection (Cmd+Alt+M, Google Docs-style)
 * If text is selected, comments on that range.
 * If no selection (cursor), comments on the current block.
 */
function openCommentComposerCommand(
  state: EditorState,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined
): boolean {
  if (!view) return false;

  let { from, to } = state.selection;

  if (from === to) {
    // No selection — expand to current text block
    const $pos = state.doc.resolve(from);
    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);
      if (node.isTextblock) {
        from = $pos.start(depth);
        to = $pos.end(depth);
        break;
      }
    }
  }

  if (from >= to) return false;

  openCommentComposer(view, { from, to }, getCurrentActor());
  return true;
}

/**
 * Navigate to the next unresolved comment (Mod-])
 * Cycles through comments sorted by document position, wrapping around.
 */
function navigateNextComment(
  state: EditorState,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined
): boolean {
  if (!view) return false;

  const allMarks = getMarks(state);
  const comments = getUnresolvedComments(allMarks);
  if (comments.length === 0) return false;

  const sorted = [...comments].sort((a, b) => (a.range?.from ?? 0) - (b.range?.from ?? 0));
  const activeId = getActiveMarkId(state);
  const currentIndex = sorted.findIndex((comment) => comment.id === activeId);
  const nextIndex = (currentIndex + 1) % sorted.length;
  const mark = sorted[nextIndex];

  setActiveMark(view, mark.id);

  // Scroll to the mark
  if (mark.range) {
    const coords = view.coordsAtPos(mark.range.from);
    if (coords) {
      const editorRect = view.dom.getBoundingClientRect();
      const scrollTop = view.dom.scrollTop;
      const targetY = coords.top - editorRect.top + scrollTop - (editorRect.height / 3);
      view.dom.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }
  }

  return true;
}

/**
 * Navigate to the previous unresolved comment (Mod-[)
 * Cycles backwards through comments sorted by document position, wrapping around.
 */
function navigatePrevComment(
  state: EditorState,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined
): boolean {
  if (!view) return false;

  const allMarks = getMarks(state);
  const comments = getUnresolvedComments(allMarks);
  if (comments.length === 0) return false;

  const sorted = [...comments].sort((a, b) => (a.range?.from ?? 0) - (b.range?.from ?? 0));
  const activeId = getActiveMarkId(state);
  const currentIndex = sorted.findIndex((comment) => comment.id === activeId);
  const prevIndex = currentIndex <= 0
    ? sorted.length - 1
    : currentIndex - 1;
  const mark = sorted[prevIndex];

  setActiveMark(view, mark.id);

  // Scroll to the mark
  if (mark.range) {
    const coords = view.coordsAtPos(mark.range.from);
    if (coords) {
      const editorRect = view.dom.getBoundingClientRect();
      const scrollTop = view.dom.scrollTop;
      const targetY = coords.top - editorRect.top + scrollTop - (editorRect.height / 3);
      view.dom.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }
  }

  return true;
}

/**
 * Resolve the active comment (Mod-Shift-r)
 * If there's an active comment popover, resolves the entire thread.
 * Silent no-op if no active comment.
 */
function resolveActiveComment(
  state: EditorState,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined
): boolean {
  if (!view) return false;

  const activeId = getActiveMarkId(state);
  if (!activeId) return false;

  // Verify the active mark is a comment
  const allMarks = getMarks(state);
  const mark = allMarks.find(m => m.id === activeId);
  if (!mark || mark.kind !== 'comment') return false;

  resolve(view, activeId);
  setActiveMark(view, null);
  return true;
}

// ============================================================================
// Quick Actions
// ============================================================================

export type QuickAction = 'fix-grammar' | 'improve-clarity' | 'make-shorter';

const quickActionPrompts: Record<QuickAction, string> = {
  'fix-grammar': 'Fix any grammar issues in this text',
  'improve-clarity': 'Improve the clarity of this text while keeping the meaning',
  'make-shorter': 'Make this text more concise without losing important information',
};

/**
 * Execute a quick action on the selection
 */
export function executeQuickAction(view: EditorView, action: QuickAction): void {
  const { from, to } = view.state.selection;
  const selectedText = getTextForRange(view.state.doc, { from, to });

  if (!selectedText.trim()) {
    return;
  }

  const prompt = quickActionPrompts[action];
  const coords = view.coordsAtPos(from);

  const context: AgentInputContext = {
    selection: selectedText,
    range: { from, to },
    position: { top: coords.top, left: coords.left },
  };

  // Dispatch event to trigger agent with the quick action prompt
  const event = new CustomEvent('proof:invoke-agent', {
    detail: { prompt, context },
  });
  window.dispatchEvent(event);
}

// ============================================================================
// Keymap
// ============================================================================

const agentKeymap = keymap({
  'Mod-Alt-m': openCommentComposerCommand,
  'Mod-Shift-p': invokeAgentCommand,
  'Mod-Shift-k': addProofCommentCommand,
  'Mod-]': navigateNextComment,
  'Mod-[': navigatePrevComment,
  'Mod-Shift-r': resolveActiveComment,
});

// ============================================================================
// Plugin
// ============================================================================

// ============================================================================
// Cmd+K Link Dialog
// ============================================================================

/**
 * Insert link (Cmd+K). Select text, press Cmd+K, paste URL, hit Enter.
 * If text is selected, it becomes the link text.
 * If no selection, prompts for both URL and text.
 */
function insertLinkCommand(
  state: EditorState,
  _dispatch: ((tr: unknown) => void) | undefined,
  view: EditorView | undefined,
): boolean {
  if (!view) return false;

  const { from, to } = state.selection;
  const hasSelection = from !== to;
  const selectedText = hasSelection ? getTextForRange(state.doc, { from, to }) : '';

  // Create floating input near the selection/cursor
  const coords = view.coordsAtPos(from);
  const existing = document.querySelector('.proof-link-dialog');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.className = 'proof-link-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: ${coords.top + 28}px;
    left: ${Math.max(12, Math.min(coords.left - 120, window.innerWidth - 320))}px;
    z-index: 300;
    background: white;
    border: 1px solid #E0E0E0;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    display: flex;
    gap: 6px;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
  `;

  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'Paste link...';
  input.style.cssText = `
    flex: 1;
    border: 1px solid #E0E0E0;
    border-radius: 5px;
    padding: 6px 10px;
    font-size: 14px;
    outline: none;
    min-width: 220px;
    font-family: inherit;
  `;

  const applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.style.cssText = `
    background: #1A1A1A;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  `;

  const apply = () => {
    const url = input.value.trim();
    if (!url) return;

    const linkMark = view.state.schema.marks.link;
    if (!linkMark) { dialog.remove(); return; }

    const text = selectedText || url;
    const tr = view.state.tr.replaceRangeWith(
      from, hasSelection ? to : from,
      view.state.schema.text(text, [linkMark.create({ href: url })]),
    );
    view.dispatch(tr);
    dialog.remove();
    view.focus();
  };

  const dismiss = () => {
    dialog.remove();
    view.focus();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); apply(); }
    if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
  });

  applyBtn.addEventListener('click', apply);

  // Close on outside click
  const onOutside = (e: MouseEvent) => {
    if (!dialog.contains(e.target as Node)) {
      dismiss();
      document.removeEventListener('mousedown', onOutside);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onOutside), 0);

  dialog.appendChild(input);
  dialog.appendChild(applyBtn);
  document.body.appendChild(dialog);

  requestAnimationFrame(() => input.focus());
  return true;
}

const agentKeymapWithLink = keymap({
  'Mod-k': insertLinkCommand,
});

export const keybindingsPlugin = $prose(() => {
  return new Plugin({
    key: keybindingsKey,
    props: {
      handleKeyDown: (view, event) => {
        // Cmd+K link dialog first
        if (agentKeymapWithLink.props.handleKeyDown?.(view, event)) return true;
        // Then existing keybindings
        return agentKeymap.props.handleKeyDown?.(view, event) ?? false;
      },
    },
  });
});

export default keybindingsPlugin;
