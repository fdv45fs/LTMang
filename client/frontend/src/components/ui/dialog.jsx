import React from 'react';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onOpenChange) onOpenChange(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleBackdropClick}>
      {children}
    </div>
  );
}

export function DialogContent({ children }) {
  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
      {children}
    </div>
  );
}

export function DialogHeader({ children }) {
  return (
    <div className="border-b px-4 py-3">
      {children}
    </div>
  );
}

export function DialogTitle({ children }) {
  return (
    <h2 className="text-lg font-semibold">{children}</h2>
  );
}
