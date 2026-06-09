import { useState } from 'react';

interface ShareSheetProps {
  title: string;
  url: string;
  pdfUrl?: string;
  csvUrl?: string;
  onClose: () => void;
}

export function ShareSheet({ title, url, pdfUrl, csvUrl, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(url), '_blank');
  };

  const handleEmail = () => {
    window.open(
      'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url)
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl p-4 shadow-elevated z-50 sm:fixed sm:inset-auto sm:right-4 sm:bottom-4 sm:w-64 sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Share options"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Share</p>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-1">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="text-base">🔗</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {copied ? 'Copied!' : 'Copy Link'}
            </span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="text-base">💬</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">WhatsApp</span>
          </button>

          <button
            onClick={handleEmail}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="text-base">✉️</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
          </button>

          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-base">📄</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">Download PDF</span>
            </a>
          )}

          {csvUrl && (
            <a
              href={csvUrl}
              download
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-base">📊</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">Download CSV</span>
            </a>
          )}
        </div>
      </div>
    </>
  );
}
