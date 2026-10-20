import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';

export interface KeyboardViewport {
  baselineHeight: number;
  visibleHeight: number;
  scale: number;
  touchCapable: boolean;
  editing: boolean;
  wasOpen: boolean;
}

export function isKeyboardViewport(viewport: KeyboardViewport): boolean {
  if (!viewport.touchCapable || Math.abs(viewport.scale - 1) > 0.05) return false;
  const lostHeight = viewport.baselineHeight - viewport.visibleHeight;
  // Separate opening/closing thresholds ignore browser chrome and keyboard animation jitter.
  return viewport.wasOpen
    ? lostHeight > Math.max(80, viewport.baselineHeight * 0.12)
    : viewport.editing && lostHeight > Math.max(150, viewport.baselineHeight * 0.22);
}

export function searchScrollAdjustment(
  fieldTop: number,
  fieldBottom: number,
  viewportTop: number,
  viewportHeight: number,
  instructionHeight: number,
): number {
  const targetTop = viewportTop + instructionHeight + 8;
  const resultsBottom = fieldBottom + 64;
  return fieldTop < targetTop || resultsBottom > viewportTop + viewportHeight
    ? fieldTop - targetTop
    : 0;
}

export function additionalSearchSpace(
  scrollTop: number, adjustment: number, documentHeight: number, layoutHeight: number,
): number {
  const maxScroll = Math.max(0, documentHeight - layoutHeight);
  return Math.max(0, Math.ceil(scrollTop + adjustment - maxScroll));
}

export function useResearchViewport(
  workspace: Ref<HTMLElement | null>,
  condition: Ref<HTMLElement | null>,
  pinnedInstruction: Ref<HTMLElement | null>,
  search: Ref<HTMLElement | null>,
) {
  const keyboardOpen = ref(false);
  const instructionPinned = ref(false);
  const viewportTop = ref(0);
  const instructionHeight = ref(0);
  const appLeft = ref(0);
  const appWidth = ref(480);
  const keyboardSpace = ref(0);
  let baselineHeight = 0;
  let baselineWidth = 0;
  let touchCapable = false;
  let frame = 0;
  let alignmentFrame = 0;
  let alignSearch = false;
  let observer: ResizeObserver | undefined;
  let viewport: VisualViewport | null = null;

  const viewportStyle = computed(() => ({
    '--research-viewport-top': `${viewportTop.value}px`,
    '--research-instruction-height': `${instructionPinned.value ? instructionHeight.value : 0}px`,
    '--research-app-left': `${appLeft.value}px`,
    '--research-app-width': `${appWidth.value}px`,
    '--research-keyboard-space': `${keyboardSpace.value}px`,
  }));

  function searchInput(): HTMLInputElement | null {
    return search.value?.querySelector<HTMLInputElement>('input[type="search"]') ?? null;
  }

  function alignFocusedSearch(): void {
    alignmentFrame = 0;
    const input = searchInput();
    if (!keyboardOpen.value || !input || document.activeElement !== input) return;
    const field = input.parentElement;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const delta = searchScrollAdjustment(
      rect.top, rect.bottom, viewportTop.value,
      viewport?.height ?? window.innerHeight, instructionHeight.value,
    );
    const missingSpace = additionalSearchSpace(
      window.scrollY, delta, document.documentElement.scrollHeight, window.innerHeight,
    );
    if (delta > 1 && missingSpace > 1) {
      // A short result list still needs enough page height to scroll above the keyboard.
      keyboardSpace.value += missingSpace;
      alignmentFrame = window.requestAnimationFrame(alignFocusedSearch);
      return;
    }
    // Do not move the page when the keyboard closes or fight ordinary page scrolling.
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
  }

  function update(): void {
    frame = 0;
    const visibleHeight = viewport?.height ?? window.innerHeight;
    const scale = viewport?.scale ?? 1;
    const editing = document.activeElement === searchInput();
    if (Math.abs(window.innerWidth - baselineWidth) > 32) {
      baselineWidth = window.innerWidth;
      baselineHeight = Math.max(window.innerHeight, visibleHeight);
    }
    const wasOpen = keyboardOpen.value;
    keyboardOpen.value = isKeyboardViewport({
      baselineHeight, visibleHeight, scale, touchCapable, editing, wasOpen,
    });
    if (keyboardOpen.value) {
      keyboardSpace.value = Math.max(keyboardSpace.value, baselineHeight - visibleHeight);
    } else if (window.scrollY <= 1) {
      // Reclaim reserved space only at the top, where doing so cannot clamp the scroll position.
      keyboardSpace.value = 0;
    }
    if (!keyboardOpen.value && !editing && Math.abs(scale - 1) <= 0.05) {
      baselineHeight = Math.max(window.innerHeight, visibleHeight);
    }
    viewportTop.value = Math.max(0, viewport?.offsetTop ?? 0);
    instructionHeight.value = pinnedInstruction.value?.getBoundingClientRect().height ?? 0;
    const rect = workspace.value?.getBoundingClientRect();
    if (rect) {
      appLeft.value = rect.left;
      appWidth.value = rect.width;
    }
    const conditionTop = condition.value?.getBoundingClientRect().top ?? Infinity;
    instructionPinned.value = keyboardOpen.value || conditionTop < viewportTop.value;
    if (keyboardOpen.value && (alignSearch || !wasOpen) && !alignmentFrame) {
      alignmentFrame = window.requestAnimationFrame(alignFocusedSearch);
    }
    alignSearch = false;
  }

  function schedule(): void {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  function resize(): void {
    alignSearch = true;
    schedule();
  }

  function focus(): void {
    if (document.activeElement === searchInput()) alignSearch = true;
    schedule();
  }

  onMounted(() => {
    viewport = window.visualViewport;
    baselineWidth = window.innerWidth;
    baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
    touchCapable = window.matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    viewport?.addEventListener('resize', resize, { passive: true });
    viewport?.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', schedule);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      for (const element of [workspace.value, condition.value, pinnedInstruction.value, search.value]) {
        if (element) observer.observe(element);
      }
    }
    update();
  });

  onUnmounted(() => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', resize);
    viewport?.removeEventListener('resize', resize);
    viewport?.removeEventListener('scroll', schedule);
    document.removeEventListener('focusin', focus);
    document.removeEventListener('focusout', schedule);
    observer?.disconnect();
    window.cancelAnimationFrame(frame);
    window.cancelAnimationFrame(alignmentFrame);
  });

  return { keyboardOpen, instructionPinned, viewportStyle };
}
