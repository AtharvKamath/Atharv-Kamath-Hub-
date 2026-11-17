import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Sparkles, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { ChatHealthResponse } from '../types';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

const MAX_INPUT_LENGTH = 1000;
const REQUEST_TIMEOUT_MS = 35000;

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Hi there! I'm Atharv's AI Guide. Ask me about his portfolio projects, content channels, Gaming Zone, digital library, or how to get in touch.",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<{
    checking: boolean;
    online: boolean | null;
    reason?: string;
  }>({
    checking: true,
    online: null,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const starterQuestions = [
    'Tell me about Atharv Kamath.',
    'What projects are available?',
    'Tell me about the Gaming Zone.',
    'How can I contact you?',
  ];

  const checkHealth = useCallback(async () => {
    setHealthState((prev) => ({ ...prev, checking: true }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/chat/health', { signal: controller.signal });
      if (!res.ok) {
        setHealthState({
          checking: false,
          online: false,
          reason: 'AI service health check failed.',
        });
        return;
      }
      const data = (await res.json()) as ChatHealthResponse;
      setHealthState({
        checking: false,
        online: Boolean(data.online),
        reason: data.reason,
      });
    } catch {
      setHealthState({
        checking: false,
        online: false,
        reason: 'Could not reach the AI Guide backend.',
      });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    if (isOpen) {
      checkHealth();
    }
  }, [isOpen, checkHealth]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, errorMsg]);

  const handleSend = async (textToSend: string, isRetry = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isTyping) return;

    if (trimmed.length > MAX_INPUT_LENGTH) {
      setErrorMsg(`Please keep your question under ${MAX_INPUT_LENGTH} characters.`);
      return;
    }

    const conversationBeforeSend = messages;
    if (!isRetry) {
      setMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
      setInput('');
    }

    setIsTyping(true);
    setErrorMsg('');
    setLastFailedMessage(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: isRetry ? conversationBeforeSend.slice(0, -1) : conversationBeforeSend,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.reply) {
        setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
        setHealthState({ checking: false, online: true });
      } else {
        const failureText =
          data?.reply ||
          (response.status >= 500
            ? 'AI Assistant Temporarily Unavailable. Please try again.'
            : 'Unable to process your question.');
        setErrorMsg(failureText);
        setLastFailedMessage(trimmed);
        if (response.status === 503 || data?.code === 'INVALID_API_KEY' || data?.code === 'MODEL_UNAVAILABLE') {
          setHealthState({ checking: false, online: false, reason: failureText });
        }
      }
    } catch (error: any) {
      const isTimeout = error?.name === 'AbortError';
      const failureText = isTimeout
        ? 'The AI request timed out. Please try again.'
        : 'Network error while reaching the AI assistant backend. Please check your connection.';
      setErrorMsg(failureText);
      setLastFailedMessage(trimmed);
      setHealthState({ checking: false, online: false, reason: failureText });
    } finally {
      clearTimeout(timeoutId);
      setIsTyping(false);
    }
  };

  const renderStatusIndicator = () => {
    if (healthState.checking && healthState.online === null) {
      return (
        <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-1">
          <Loader2 size={10} className="animate-spin text-cyan-400" />
          Checking AI status...
        </span>
      );
    }
    if (healthState.online) {
      return (
        <span className="text-[10px] text-green-400 font-mono flex items-center gap-1.5 mt-1">
          <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping" />
          Online
        </span>
      );
    }
    return (
      <span
        className="text-[10px] text-amber-400 font-mono flex items-center gap-1.5 mt-1"
        title={healthState.reason || 'AI backend health check failed'}
      >
        <span className="h-1.5 w-1.5 bg-amber-400 rounded-full" />
        AI Assistant Temporarily Unavailable
      </span>
    );
  };

  return (
    <div id="ai-chatbot" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 font-sans text-xs">
      {/* 1. Toggle Button */}
      {!isOpen && (
        <button
          id="chatbot-open-btn"
          type="button"
          onClick={() => setIsOpen(true)}
          className="p-3.5 sm:p-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center gap-2 group cursor-pointer"
          title="Open AI Guide"
          aria-label="Open Atharv's AI Guide"
        >
          <Sparkles size={18} className="animate-pulse" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 font-bold whitespace-nowrap tracking-wide uppercase text-[10px]">
            AI Guide
          </span>
          <MessageSquare size={18} />
        </button>
      )}

      {/* 2. Chat Bubble Container */}
      {isOpen && (
        <div
          id="chatbot-window"
          className="w-[calc(100vw-2rem)] sm:w-[380px] h-[min(520px,calc(100vh-3rem))] bg-[#0c1220] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        >
          {/* Header */}
          <div className="p-4 bg-[#080c16] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full flex-shrink-0">
                <Sparkles size={14} />
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold leading-none truncate">Atharv's AI Guide</h4>
                {renderStatusIndicator()}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={checkHealth}
                disabled={healthState.checking}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh AI availability"
                aria-label="Refresh AI status"
              >
                <RefreshCw size={13} className={healthState.checking ? 'animate-spin' : ''} />
              </button>
              <button
                id="chatbot-close-btn"
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close AI Guide"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap break-words ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-white rounded-tr-none'
                      : 'bg-white/5 border border-white/5 text-gray-200 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 text-gray-400 px-3.5 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[10px] font-mono text-gray-400 ml-1">Thinking...</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex justify-start">
                <div className="bg-red-500/10 border border-red-500/25 text-red-300 px-3.5 py-2.5 rounded-2xl rounded-tl-none flex items-start gap-2 max-w-[92%]">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-400" />
                  <div className="space-y-1.5">
                    <p className="font-semibold text-[11px] text-red-200">Unable to Answer</p>
                    <p className="text-[11px] opacity-95 leading-relaxed">{errorMsg}</p>
                    {lastFailedMessage && (
                      <button
                        type="button"
                        onClick={() => handleSend(lastFailedMessage, true)}
                        disabled={isTyping}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-[10px] font-bold text-red-100 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={10} /> Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Starters */}
            {messages.length === 1 && !isTyping && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">
                  Suggested queries:
                </p>
                <div className="flex flex-col gap-1.5">
                  {starterQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="text-left w-full px-3 py-2 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-xl text-gray-300 hover:text-cyan-400 transition-all text-[11px] cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Footer Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-[#080c16] border-t border-white/10 space-y-1.5"
          >
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about projects, Gaming Zone, contact..."
                value={input}
                maxLength={MAX_INPUT_LENGTH}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTyping}
                className="flex-grow px-4 py-2 bg-[#050811] border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              />
              <button
                id="chatbot-send-btn"
                type="submit"
                disabled={isTyping || !input.trim()}
                className="p-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:bg-gray-700 cursor-pointer"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>
            {input.length > 800 && (
              <div className="text-right text-[10px] font-mono text-gray-500">
                {input.length}/{MAX_INPUT_LENGTH}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
