import {
  encodeInlineReferenceToken,
  extractInlineReferenceTokens,
  getInlineReferenceLabel,
} from '../../../utils/inlineReferences';

export interface InlineReferenceComposerCallbacks {
  onChange?: () => void;
}

export class InlineReferenceComposerManager {
  private inputEl: HTMLTextAreaElement;
  private wrapperEl: HTMLElement;
  private callbacks: InlineReferenceComposerCallbacks;
  private overlayEl: HTMLElement;
  private placeholderObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly inputSyncHandler = () => this.render();
  private readonly scrollSyncHandler = () => {
    this.overlayEl.scrollTop = this.inputEl.scrollTop;
    this.overlayEl.scrollLeft = this.inputEl.scrollLeft;
  };
  private readonly overlayClickHandler = (event: MouseEvent) => this.handleOverlayClick(event);
  private readonly resizeHandler = () => this.syncLayout();
  private readonly selectionSyncHandler = () => this.normalizeSelectionAndRender();
  private readonly rafRender = () => this.render();
  private isDraggingSelection = false;
  private dragAnchorPos: number | null = null;
  private dragStartX: number | null = null;
  private dragStartY: number | null = null;
  private didDragSelect = false;
  private ignoreNextClick = false;
  private readonly overlayMouseDownHandler = (event: MouseEvent) => this.handleOverlayMouseDown(event);
  private readonly windowMouseMoveHandler = (event: MouseEvent) => this.handleWindowMouseMove(event);
  private readonly windowMouseUpHandler = () => this.handleWindowMouseUp();
  private readonly keyDownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);

  constructor(
    inputEl: HTMLTextAreaElement,
    wrapperEl: HTMLElement,
    callbacks: InlineReferenceComposerCallbacks = {},
  ) {
    this.inputEl = inputEl;
    this.wrapperEl = wrapperEl;
    this.callbacks = callbacks;

    this.overlayEl = wrapperEl.createDiv({ cls: 'claudian-inline-reference-overlay' });
    this.wrapperEl.addClass('has-inline-reference-composer');
    this.bindEvents();
    this.render();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(this.rafRender);
    }
  }

  destroy(): void {
    this.placeholderObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.inputEl.removeEventListener('input', this.inputSyncHandler);
    this.inputEl.removeEventListener('scroll', this.scrollSyncHandler);
    this.inputEl.removeEventListener('keyup', this.selectionSyncHandler);
    this.inputEl.removeEventListener('click', this.selectionSyncHandler);
    this.inputEl.removeEventListener('select', this.selectionSyncHandler);
    this.inputEl.removeEventListener('focus', this.selectionSyncHandler);
    this.inputEl.removeEventListener('keydown', this.keyDownHandler);
    this.overlayEl.removeEventListener('click', this.overlayClickHandler as unknown as EventListener);
    this.overlayEl.removeEventListener('mousedown', this.overlayMouseDownHandler as unknown as EventListener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('mousemove', this.windowMouseMoveHandler as unknown as EventListener);
      window.removeEventListener('mouseup', this.windowMouseUpHandler as unknown as EventListener);
    }
    this.wrapperEl.removeClass('has-inline-reference-composer');
    this.overlayEl.remove();
  }

  render(): void {
    this.syncLayout();
    const rawValue = this.inputEl.value;
    this.overlayEl.empty();
    this.overlayEl.toggleClass('is-empty', rawValue.length === 0);

    if (rawValue.length === 0) {
      const isFocused = typeof document !== 'undefined' && document.activeElement === this.inputEl;
      if (isFocused) {
        this.overlayEl.createSpan({ cls: 'claudian-inline-reference-caret' });
      }
      this.overlayEl.createSpan({
        cls: 'claudian-inline-reference-placeholder',
        text: this.inputEl.placeholder || '',
      });
      return;
    }

    let cursor = 0;
    const references = extractInlineReferenceTokens(rawValue);
    const selStartRaw = this.inputEl.selectionStart ?? rawValue.length;
    const selEndRaw = this.inputEl.selectionEnd ?? selStartRaw;
    const selectionStart = Math.min(selStartRaw, selEndRaw);
    const selectionEnd = Math.max(selStartRaw, selEndRaw);
    const hasSelection = selectionStart !== selectionEnd;
    const caretIndex = selStartRaw;
    let caretInserted = false;

    const insertCaret = () => {
      if (caretInserted) return;
      this.overlayEl.createSpan({ cls: 'claudian-inline-reference-caret' });
      caretInserted = true;
    };

    const appendTextWithSelection = (text: string, segmentStart: number) => {
      if (text.length === 0) return;

      const segmentEnd = segmentStart + text.length;
      const overlapsSelection = !hasSelection
        ? false
        : selectionStart < segmentEnd && selectionEnd > segmentStart;

      if (overlapsSelection) {
        const localSelStart = Math.max(0, selectionStart - segmentStart);
        const localSelEnd = Math.max(0, Math.min(text.length, selectionEnd - segmentStart));
        const before = text.slice(0, localSelStart);
        const selected = text.slice(localSelStart, localSelEnd);
        const after = text.slice(localSelEnd);

        if (before) {
          this.overlayEl.createSpan({
            cls: 'claudian-inline-reference-text',
            text: before,
            attr: { 'data-raw-start': String(segmentStart) },
          });
        }
        if (selected) {
          this.overlayEl.createSpan({
            cls: 'claudian-inline-reference-text is-selected',
            text: selected,
            attr: { 'data-raw-start': String(segmentStart + localSelStart) },
          });
        }
        if (after) {
          this.overlayEl.createSpan({
            cls: 'claudian-inline-reference-text',
            text: after,
            attr: { 'data-raw-start': String(segmentStart + localSelEnd) },
          });
        }
        return;
      }

      if (!hasSelection && !caretInserted && caretIndex >= segmentStart && caretIndex <= segmentEnd) {
        const caretOffset = Math.max(0, Math.min(text.length, caretIndex - segmentStart));
        const before = text.slice(0, caretOffset);
        const after = text.slice(caretOffset);
        if (before) {
          this.overlayEl.createSpan({
            cls: 'claudian-inline-reference-text',
            text: before,
            attr: { 'data-raw-start': String(segmentStart) },
          });
        }
        insertCaret();
        if (after) {
          this.overlayEl.createSpan({
            cls: 'claudian-inline-reference-text',
            text: after,
            attr: { 'data-raw-start': String(segmentStart + caretOffset) },
          });
        }
        return;
      }

      this.overlayEl.createSpan({
        cls: 'claudian-inline-reference-text',
        text,
        attr: { 'data-raw-start': String(segmentStart) },
      });
    };

    references.forEach((reference, index) => {
      if (reference.start > cursor) {
        appendTextWithSelection(rawValue.slice(cursor, reference.start), cursor);
      }

      const chipEl = this.overlayEl.createSpan({ cls: 'claudian-inline-reference-chip' });
      chipEl.draggable = true;
      chipEl.dataset.referencePath = reference.path;
      chipEl.dataset.referenceIndex = String(index);
      chipEl.dataset.rawStart = String(reference.start);
      chipEl.dataset.rawEnd = String(reference.end);
      chipEl.toggleClass('is-selected', hasSelection && selectionStart <= reference.start && selectionEnd >= reference.end);

      const labelEl = chipEl.createSpan({ cls: 'claudian-inline-reference-chip-label' });
      labelEl.setText(getInlineReferenceLabel(reference.path));

      const removeEl = chipEl.createSpan({
        cls: 'claudian-inline-reference-chip-remove',
        attr: { 'aria-label': 'Remove reference' },
      });
      removeEl.setText('\u00D7');
      removeEl.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.removeReference(reference.path);
      });

      chipEl.addEventListener('dragstart', (event) => {
        chipEl.addClass('is-dragging');
        event.dataTransfer?.setData('text/plain', reference.path);
        event.dataTransfer?.setData('application/x-claudian-inline-ref', reference.path);
      });

      chipEl.addEventListener('dragend', () => {
        chipEl.removeClass('is-dragging');
        this.clearDropIndicators();
      });

      chipEl.addEventListener('dragover', (event) => {
        event.preventDefault();
        const draggedPath = event.dataTransfer?.getData('application/x-claudian-inline-ref');
        if (!draggedPath || draggedPath === reference.path) {
          return;
        }

        const rect = chipEl.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;
        chipEl.toggleClass('is-drop-target-before', before);
        chipEl.toggleClass('is-drop-target-after', !before);
      });

      chipEl.addEventListener('dragleave', () => {
        chipEl.removeClass('is-drop-target-before');
        chipEl.removeClass('is-drop-target-after');
      });

      chipEl.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const draggedPath = event.dataTransfer?.getData('application/x-claudian-inline-ref');
        if (!draggedPath || draggedPath === reference.path) {
          return;
        }

        const rect = chipEl.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;
        this.moveReference(draggedPath, reference.path, before);
      });

      if (!hasSelection && !caretInserted && caretIndex >= reference.start && caretIndex <= reference.end) {
        insertCaret();
      }

      cursor = reference.end;
    });

    if (cursor < rawValue.length) {
      appendTextWithSelection(rawValue.slice(cursor), cursor);
    }

    if (!hasSelection && !caretInserted) {
      insertCaret();
    }
  }

  removeReference(referencePath: string): void {
    const token = encodeInlineReferenceToken(referencePath);
    this.inputEl.value = this.inputEl.value.replaceAll(token, '').replace(/\s{2,}/g, ' ');
    this.dispatchSyntheticInput();
  }

  private bindEvents(): void {
    this.inputEl.addEventListener('input', this.inputSyncHandler);
    this.inputEl.addEventListener('scroll', this.scrollSyncHandler);
    this.inputEl.addEventListener('keydown', this.keyDownHandler);
    this.inputEl.addEventListener('keyup', this.selectionSyncHandler);
    this.inputEl.addEventListener('click', this.selectionSyncHandler);
    this.inputEl.addEventListener('select', this.selectionSyncHandler);
    this.inputEl.addEventListener('focus', this.selectionSyncHandler);
    this.overlayEl.addEventListener('click', this.overlayClickHandler as unknown as EventListener);
    this.overlayEl.addEventListener('mousedown', this.overlayMouseDownHandler as unknown as EventListener);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeHandler);
    }

    if (typeof MutationObserver !== 'undefined') {
      this.placeholderObserver = new MutationObserver(() => this.render());
      this.placeholderObserver.observe(this.inputEl, {
        attributes: true,
        attributeFilter: ['placeholder'],
      });
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(this.inputEl);
      this.resizeObserver.observe(this.wrapperEl);
    }
  }

  private normalizeSelectionAndRender(): void {
    this.normalizeSelection();
    this.render();
  }

  private normalizeSelection(): void {
    const value = this.inputEl.value;
    const pos = this.inputEl.selectionStart;
    if (pos === null) return;

    const tokens = extractInlineReferenceTokens(value);
    const token = tokens.find(t => pos > t.start && pos < t.end);
    if (!token) return;

    const toStart = pos - token.start;
    const toEnd = token.end - pos;
    const snapped = toStart <= toEnd ? token.start : token.end;

    this.inputEl.selectionStart = snapped;
    this.inputEl.selectionEnd = snapped;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      this.handleArrowKey(event);
      return;
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    this.normalizeSelection();

    const value = this.inputEl.value;
    const rawSelStart = this.inputEl.selectionStart ?? 0;
    const rawSelEnd = this.inputEl.selectionEnd ?? rawSelStart;
    let start = Math.min(rawSelStart, rawSelEnd);
    let end = Math.max(rawSelStart, rawSelEnd);

    const tokens = extractInlineReferenceTokens(value);

    if (start === end) {
      if (event.key === 'Backspace') {
        const tokenBefore = tokens.find(t => t.end === start);
        if (tokenBefore) {
          start = tokenBefore.start;
          end = tokenBefore.end;
        }
      } else if (event.key === 'Delete') {
        const tokenAfter = tokens.find(t => t.start === start);
        if (tokenAfter) {
          start = tokenAfter.start;
          end = tokenAfter.end;
        }
      }
    } else {
      for (const token of tokens) {
        const overlaps = start < token.end && end > token.start;
        if (!overlaps) continue;
        start = Math.min(start, token.start);
        end = Math.max(end, token.end);
      }
    }

    if (start === end) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const nextValue = `${value.slice(0, start)}${value.slice(end)}`.replace(/\s{2,}/g, ' ');
    this.inputEl.value = nextValue;
    this.inputEl.selectionStart = start;
    this.inputEl.selectionEnd = start;
    this.dispatchSyntheticInput();
  }

  private handleArrowKey(event: KeyboardEvent): void {
    this.normalizeSelection();
    const value = this.inputEl.value;
    const tokens = extractInlineReferenceTokens(value);
    const rawSelStart = this.inputEl.selectionStart ?? 0;
    const rawSelEnd = this.inputEl.selectionEnd ?? rawSelStart;
    const isSelecting = rawSelStart !== rawSelEnd;

    // When there is an active selection and no shift key, collapse first (native textarea behavior).
    if (isSelecting && !event.shiftKey) {
      const collapsed = event.key === 'ArrowLeft'
        ? Math.min(rawSelStart, rawSelEnd)
        : Math.max(rawSelStart, rawSelEnd);
      this.inputEl.selectionStart = collapsed;
      this.inputEl.selectionEnd = collapsed;
    }

    const caret = this.inputEl.selectionEnd ?? 0;
    if (event.key === 'ArrowRight') {
      const tokenAtStart = tokens.find(t => t.start === caret);
      if (tokenAtStart) {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          this.inputEl.selectionEnd = tokenAtStart.end;
        } else {
          this.inputEl.selectionStart = tokenAtStart.end;
          this.inputEl.selectionEnd = tokenAtStart.end;
        }
        this.normalizeSelectionAndRender();
      }
    } else if (event.key === 'ArrowLeft') {
      const tokenAtEnd = tokens.find(t => t.end === caret);
      if (tokenAtEnd) {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          this.inputEl.selectionEnd = tokenAtEnd.start;
        } else {
          this.inputEl.selectionStart = tokenAtEnd.start;
          this.inputEl.selectionEnd = tokenAtEnd.start;
        }
        this.normalizeSelectionAndRender();
      }
    }
  }

  private handleOverlayMouseDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pos = this.getRawCaretPositionForEvent(event);
    const anchor = pos ?? (this.inputEl.value.length);
    this.dragAnchorPos = anchor;
    this.isDraggingSelection = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.didDragSelect = false;

    this.inputEl.selectionStart = anchor;
    this.inputEl.selectionEnd = anchor;
    this.inputEl.focus();
    this.normalizeSelectionAndRender();

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.windowMouseMoveHandler as unknown as EventListener);
      window.addEventListener('mouseup', this.windowMouseUpHandler as unknown as EventListener);
    }
  }

  private handleWindowMouseMove(event: MouseEvent): void {
    if (!this.isDraggingSelection || this.dragAnchorPos === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!this.didDragSelect && this.dragStartX !== null && this.dragStartY !== null) {
      const dx = Math.abs(event.clientX - this.dragStartX);
      const dy = Math.abs(event.clientY - this.dragStartY);
      if (dx + dy >= 3) {
        this.didDragSelect = true;
      }
    }

    const pos = this.getRawCaretPositionForEvent(event);
    const current = pos ?? this.inputEl.value.length;
    this.inputEl.selectionStart = this.dragAnchorPos;
    this.inputEl.selectionEnd = current;
    this.normalizeSelectionAndRender();
  }

  private handleWindowMouseUp(): void {
    this.isDraggingSelection = false;
    this.dragAnchorPos = null;
    this.dragStartX = null;
    this.dragStartY = null;
    if (this.didDragSelect) {
      this.ignoreNextClick = true;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.windowMouseMoveHandler as unknown as EventListener);
      window.removeEventListener('mouseup', this.windowMouseUpHandler as unknown as EventListener);
    }
  }

  private handleOverlayClick(event: MouseEvent): void {
    if (this.ignoreNextClick) {
      this.ignoreNextClick = false;
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      this.inputEl.focus();
      return;
    }

    const chip = target.closest('.claudian-inline-reference-chip') as HTMLElement | null;
    if (chip) {
      const rawStart = Number(chip.dataset.rawStart ?? '0');
      const rawEnd = Number(chip.dataset.rawEnd ?? '0');
      const rect = chip.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      const snapped = before ? rawStart : rawEnd;
      this.inputEl.selectionStart = snapped;
      this.inputEl.selectionEnd = snapped;
      this.inputEl.focus();
      this.normalizeSelectionAndRender();
      return;
    }

    const pos = this.getOverlayCaretPositionFromPoint(event.clientX, event.clientY);
    if (pos !== null) {
      this.inputEl.selectionStart = pos;
      this.inputEl.selectionEnd = pos;
    }

    this.inputEl.focus();
    this.normalizeSelectionAndRender();
  }

  private getRawCaretPositionForEvent(event: MouseEvent): number | null {
    const target = event.target as HTMLElement | null;
    if (target) {
      const chip = target.closest('.claudian-inline-reference-chip') as HTMLElement | null;
      if (chip) {
        const rawStart = Number(chip.dataset.rawStart ?? '0');
        const rawEnd = Number(chip.dataset.rawEnd ?? '0');
        const rect = chip.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;
        return before ? rawStart : rawEnd;
      }
    }

    const pos = this.getOverlayCaretPositionFromPoint(event.clientX, event.clientY);
    if (pos !== null) {
      return pos;
    }

    return this.inputEl.selectionStart ?? 0;
  }

  private getOverlayCaretPositionFromPoint(x: number, y: number): number | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const docAny = document as any;
    const caretPos = docAny.caretPositionFromPoint?.(x, y);
    const range = caretPos
      ? { node: caretPos.offsetNode as Node, offset: caretPos.offset as number }
      : (docAny.caretRangeFromPoint?.(x, y)
        ? { node: (docAny.caretRangeFromPoint(x, y) as Range).startContainer, offset: (docAny.caretRangeFromPoint(x, y) as Range).startOffset }
        : null);

    if (!range) {
      return null;
    }

    const node = range.node;
    const offset = range.offset;
    const span = (node instanceof HTMLElement ? node : node.parentElement)?.closest?.('.claudian-inline-reference-text') as HTMLElement | null;
    if (!span) {
      return null;
    }

    const rawStart = Number(span.dataset.rawStart ?? '0');
    const localOffset = Math.max(0, Math.min(offset, span.textContent?.length ?? 0));
    return rawStart + localOffset;
  }

  private moveReference(sourcePath: string, targetPath: string, insertBefore: boolean): void {
    const references = extractInlineReferenceTokens(this.inputEl.value);
    const source = references.find(reference => reference.path === sourcePath);
    const target = references.find(reference => reference.path === targetPath);

    if (!source || !target || source === target) {
      return;
    }

    const filtered = references.filter(reference => reference !== source);
    const targetIndex = filtered.findIndex(reference => reference.path === targetPath);
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
    filtered.splice(insertIndex, 0, source);

    this.inputEl.value = this.rebuildValue(this.inputEl.value, filtered);
    this.dispatchSyntheticInput();
  }

  private rebuildValue(originalValue: string, references: Array<{ path: string }>): string {
    const originalTokens = extractInlineReferenceTokens(originalValue);
    const textSegments: string[] = [];
    let cursor = 0;

    for (const token of originalTokens) {
      textSegments.push(originalValue.slice(cursor, token.start));
      cursor = token.end;
    }
    textSegments.push(originalValue.slice(cursor));

    let rebuilt = textSegments[0] ?? '';
    for (let index = 0; index < references.length; index++) {
      rebuilt += encodeInlineReferenceToken(references[index].path);
      rebuilt += textSegments[index + 1] ?? '';
    }

    if (references.length < originalTokens.length) {
      for (let index = references.length + 1; index < textSegments.length; index++) {
        rebuilt += textSegments[index] ?? '';
      }
    }

    return rebuilt;
  }

  private dispatchSyntheticInput(): void {
    this.render();
    this.callbacks.onChange?.();
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private syncLayout(): void {
    this.overlayEl.style.top = `${this.inputEl.offsetTop}px`;
    this.overlayEl.style.left = `${this.inputEl.offsetLeft}px`;
    this.overlayEl.style.width = `${this.inputEl.clientWidth}px`;
    this.overlayEl.style.height = `${this.inputEl.clientHeight}px`;
  }

  private clearDropIndicators(): void {
    this.overlayEl.querySelectorAll('.claudian-inline-reference-chip').forEach((element) => {
      element.removeClass('is-drop-target-before');
      element.removeClass('is-drop-target-after');
    });
  }
}
