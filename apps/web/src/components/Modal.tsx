import { useEffect, useId, useRef, type KeyboardEvent, type PropsWithChildren } from "react";

type ModalProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
  dismissible?: boolean;
}>;

export function Modal({ title, children, onClose, dismissible = true }: ModalProps) {
  const card = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const first = focusableElements(card.current)[0];
      (first ?? card.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && dismissible) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(card.current);
    if (focusable.length === 0) {
      event.preventDefault();
      card.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={card}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {dismissible && (
            <button
              className="icon-button"
              type="button"
              aria-label="Lukk"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}

function focusableElements(root: HTMLElement | null) {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hidden && element.getClientRects().length > 0);
}
