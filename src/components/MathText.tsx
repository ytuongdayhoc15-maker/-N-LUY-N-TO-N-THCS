import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderWithKatex(input: string): string {
  if (!input) return '';
  // Tach block $$...$$ va inline $...$
  const tokens: { isMath: boolean; display: boolean; content: string }[] = [];
  let i = 0;
  let buffer = '';

  while (i < input.length) {
    if (input[i] === '$' && input[i + 1] === '$') {
      const end = input.indexOf('$$', i + 2);
      if (end !== -1) {
        if (buffer) {
          tokens.push({ isMath: false, display: false, content: buffer });
          buffer = '';
        }
        tokens.push({ isMath: true, display: true, content: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    } else if (input[i] === '$') {
      const end = input.indexOf('$', i + 1);
      if (end !== -1) {
        if (buffer) {
          tokens.push({ isMath: false, display: false, content: buffer });
          buffer = '';
        }
        tokens.push({ isMath: true, display: false, content: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    buffer += input[i];
    i++;
  }
  if (buffer) {
    tokens.push({ isMath: false, display: false, content: buffer });
  }

  return tokens
    .map((tok) => {
      if (!tok.isMath) {
        return escapeHtml(tok.content).replace(/\n/g, '<br/>');
      }
      try {
        return katex.renderToString(tok.content, {
          displayMode: tok.display,
          throwOnError: false,
          strict: false
        });
      } catch {
        return escapeHtml(tok.content);
      }
    })
    .join('');
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  const html = useMemo(() => renderWithKatex(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};
