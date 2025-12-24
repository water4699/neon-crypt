"use client";

import { useState } from "react";

interface ChatMessageProps {
  sender: string;
  message: string;
  timestamp: string;
  isEncrypted?: boolean;
  isOwn?: boolean;
  onDecrypt?: () => void;
  canDecrypt?: boolean;
  onDelete?: () => void;
  canDelete?: boolean;
  isDeleting?: boolean;
}

export const ChatMessage = ({
  sender,
  message,
  timestamp,
  isEncrypted = true,
  isOwn = false,
  onDecrypt,
  canDecrypt,
}: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (isEncrypted) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-purple-100 hover:bg-white/80 hover:shadow-md transition-all group">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
          {isOwn ? "ME" : sender.slice(0, 2).toUpperCase()}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-800">{sender}</span>
            {isEncrypted && (
              <div className="flex items-center gap-1 text-purple-600" title="Encrypted">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs">Encrypted</span>
              </div>
            )}
            <span className="text-xs text-gray-400">{timestamp}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm text-gray-600 italic truncate">{message}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEncrypted && (
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex items-center gap-1"
            title="Copy message"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        )}
        {isEncrypted && onDecrypt && (
          <button
            onClick={onDecrypt}
            disabled={!canDecrypt}
            className="px-3 py-1.5 text-xs rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 shadow-sm"
            title={canDecrypt ? "Decrypt message" : "Connect wallet to decrypt"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Decrypt
          </button>
        )}
      </div>
    </div>
  );
};

