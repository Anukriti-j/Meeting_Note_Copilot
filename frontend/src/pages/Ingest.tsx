import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileAudio, FileText, Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

interface IngestResult {
  meeting_id?: string;
  summary?: string;
  decisions?: string[];
  action_items?: { owner: string; task: string; due_date: string | null }[];
  run_id?: string;
}

type IngestMode = 'audio' | 'text';

export default function Ingest() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<IngestMode>('text');
  const [meetingId, setMeetingId] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  const ingestMutation = useMutation({
    mutationFn: async () => {
      if (!meetingId.trim()) throw new Error('Meeting ID is required');
      if (mode === 'text' && !transcript.trim()) throw new Error('Transcript is required');
      if (mode === 'audio' && !audioFile) throw new Error('Audio file is required');

      if (mode === 'text') {
        return api.ingestText(transcript, meetingId.trim(), meetingDate || undefined);
      } else {
        return api.ingestAudio(audioFile!, meetingId.trim(), meetingDate || undefined);
      }
    },
    onSuccess: (data) => {
      setResult(data.summary);
      toast.success('Meeting ingested successfully');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setAudioFile(accepted[0]);
      if (!meetingId) {
        const name = accepted[0].name.replace(/\.[^.]+$/, '');
        setMeetingId(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      }
    }
  }, [meetingId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.wav', '.mp3', '.m4a', '.ogg', '.flac'],
    },
    maxFiles: 1,
    multiple: false,
  });

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Ingest Meeting</h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Add a new meeting by uploading audio or pasting a transcript
        </p>
      </motion.div>

      {/* Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 p-1 bg-bg-card border border-border rounded-xl w-fit"
      >
        {[
          { key: 'text' as const, icon: FileText, label: 'Paste Transcript' },
          { key: 'audio' as const, icon: FileAudio, label: 'Upload Audio' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === key
                ? 'bg-accent/15 text-accent-light border border-accent/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-bg-card border border-border rounded-2xl p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Meeting ID *
            </label>
            <input
              type="text"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="standup-2026-07-12"
              className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Meeting Date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'text' ? (
            <motion.div
              key="text"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Transcript *
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                rows={12}
                className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all resize-none font-mono leading-relaxed"
              />
            </motion.div>
          ) : (
            <motion.div
              key="audio"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-accent bg-accent/5'
                    : audioFile
                    ? 'border-success/30 bg-success/5'
                    : 'border-border hover:border-border hover:bg-bg-hover'
                }`}
              >
                <input {...getInputProps()} />
                {audioFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                      <Check className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{audioFile.name}</p>
                      <p className="text-xs text-text-muted mt-1">
                        {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-bg-hover flex items-center justify-center">
                      <Upload className="w-6 h-6 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        Drop an audio file or click to browse
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        WAV, MP3, M4A supported
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end">
          <button
            onClick={() => ingestMutation.mutate()}
            disabled={ingestMutation.isPending || !meetingId.trim()}
            className="flex items-center gap-2.5 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 text-sm"
          >
            {ingestMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Ingest Meeting
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="bg-bg-card border border-success/20 glow-success rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-success" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">Ingestion Complete</h3>
            </div>
            <ResultView data={result!} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultView({ data }: { data: IngestResult }) {
  return (
    <div className="space-y-4">
      {data.summary && (
        <p className="text-sm text-text-secondary leading-relaxed">{data.summary}</p>
      )}
      {data.decisions && data.decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Decisions</h4>
          <ul className="space-y-1.5">
            {data.decisions.map((d, i) => (
              <li key={i} className="text-sm text-text-secondary flex gap-2">
                <span className="text-accent-light mt-0.5">•</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.action_items && data.action_items.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Action Items</h4>
          <ul className="space-y-2">
            {data.action_items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-text-muted mt-0.5">☐</span>
                <span>
                  <span className="font-medium text-text-primary">{item.owner}</span>
                  <span className="text-text-secondary">: {item.task}</span>
                  {item.due_date && (
                    <span className="text-text-muted ml-1">({item.due_date})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
