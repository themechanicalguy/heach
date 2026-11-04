'use client';

import { useState } from 'react';

/**
 * Copies a public contact value for desktops, where a tel: link often does nothing. Labels come
 * from the server page, so the contact page needs no extra client message namespace.
 */
export function CopyValue({
  value,
  label,
  copiedLabel,
}: Readonly<{ value: string; label: string; copiedLabel: string }>) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
      },
      () => {
        // Nothing was copied: keep the button as it was; the value stays visible to select.
        setCopied(false);
      },
    );
  };
  return (
    <span className="copy-value">
      <button type="button" className="heach-button heach-button--secondary" onClick={copy}>
        {label}
      </button>
      <span role="status">{copied ? copiedLabel : ''}</span>
    </span>
  );
}
