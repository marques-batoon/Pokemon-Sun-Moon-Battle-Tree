import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog> modal: focus trapping, Escape to close, backdrop for free. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  // No close() on cleanup: it fires the dialog's close event (-> onClose), which
  // StrictMode's simulated unmount would trigger immediately. Unmounting removes
  // the element, which also takes it out of the top layer.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }}>
      <header className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-foot">{footer}</footer>}
    </dialog>
  );
}
