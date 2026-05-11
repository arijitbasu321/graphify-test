'use client';

import ReactMarkdown from 'react-markdown';

export function Markdown({ children }: { children: string }) {
  if (!children) return null;
  return (
    <div className="md text-13 text-tprimary">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
