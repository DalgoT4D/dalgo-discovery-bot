'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <h1 className="text-lg font-semibold mb-2 mt-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mb-1 mt-2">{children}</h3>,
        code: ({ children, className }) => {
          const isBlock = /language-/.test(className ?? '');
          return isBlock ? (
            <pre className="bg-slate-200 rounded p-2 my-2 overflow-x-auto text-xs">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-slate-200 rounded px-1 text-[0.9em]">{children}</code>
          );
        },
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline hover:text-blue-900"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-slate-300" />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-slate-300 pl-3 italic text-slate-700 my-2">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-slate-300 px-2 py-1 bg-slate-200 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-slate-300 px-2 py-1 align-top">{children}</td>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
