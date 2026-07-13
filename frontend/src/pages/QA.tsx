import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Loader2, Quote } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { QAHit } from '../api/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  hits?: QAHit[];
  streaming?: boolean;
  timestamp: Date;
}

export default function QA() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const question = input.trim();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const { citations, hits } = await api.askStream(question, (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
        );
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, citations, hits, streaming: false } : m)),
      );
    } catch (err) {
      toast.error((err as Error).message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Ask</h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Query across all past meetings using grounded RAG
        </p>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
              <MessageCircle className="w-7 h-7 text-accent-light" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Ask anything</h3>
            <p className="text-sm text-text-secondary max-w-sm">
              Questions are answered using only the context from your stored meetings.
              Citations are always provided.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-lg">
              {[
                'What did we decide about the billing migration?',
                'Who is responsible for the ICM tickets?',
                'What is the notifications architecture?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="text-xs text-text-secondary bg-bg-card border border-border hover:border-accent/30 rounded-lg px-3 py-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-accent/15 border border-accent/20'
                    : 'bg-bg-card border border-border'
                }`}
              >
                {msg.role === 'assistant' && msg.streaming && !msg.content ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent-light" />
                    <span className="text-sm text-text-muted">Thinking...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                      {msg.streaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-accent-light animate-pulse align-middle" />}
                    </p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
                        <Quote className="w-3.5 h-3.5 text-text-muted" />
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] font-medium text-accent-light bg-accent/10 px-2 py-0.5 rounded-full"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.hits && msg.hits.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                          View {msg.hits.length} retrieved chunks
                        </summary>
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                          {msg.hits.map((h, i) => (
                            <div
                              key={i}
                              className="text-[11px] bg-bg-elevated rounded-lg p-3 border border-border-subtle"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-text-secondary">{h.meeting_id}</span>
                                <span className="text-text-muted">|</span>
                                <span className="text-text-muted">{h.chunk_type}</span>
                                <span className="ml-auto text-text-muted">
                                  {(h.similarity * 100).toFixed(0)}% match
                                </span>
                              </div>
                              <p className="text-text-muted leading-relaxed">{h.text}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border-t border-border pt-4"
      >
        <div className="relative bg-bg-card border border-border rounded-2xl focus-within:border-accent/30 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your meetings..."
            rows={1}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted px-5 py-4 pr-14 resize-none focus:outline-none"
            style={{ minHeight: '56px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-accent hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
