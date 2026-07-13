import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bot, Play, Loader2, CheckCircle2, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

// .ics files are plain text (RFC 5545) -- SUMMARY and DTSTART are simple key:value lines.
function parseIcs(content: string) {
  const summary = content.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Calendar event';
  const d = content.match(/DTSTART:(\d{4})(\d{2})(\d{2})/);
  const date = d ? `${d[1]}-${d[2]}-${d[3]}` : null;
  return { summary, date };
}

export default function Agent() {
  const [selectedMeeting, setSelectedMeeting] = useState('');
  const [agentResult, setAgentResult] = useState<string | null>(null);
  const [openingFilename, setOpeningFilename] = useState<string | null>(null);

  const meetingsQuery = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.listMeetings(),
  });

  const calendarQuery = useQuery({
    queryKey: ['calendar'],
    queryFn: () => api.listCalendar(),
  });

  const agentMutation = useMutation({
    mutationFn: (meetingId: string) => api.runAgent(meetingId, true),
    onSuccess: (data) => {
      setAgentResult(data.result);
      toast.success('Agent finished');
      calendarQuery.refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const meetings = meetingsQuery.data?.meetings || [];
  const calendarEvents = calendarQuery.data?.events || [];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Agent</h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Run the ReAct tool-calling agent to file action items via MCP
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-bg-card border border-border rounded-2xl p-6 space-y-5"
      >
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Select Meeting
          </label>
          {meetingsQuery.isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <select
              value={selectedMeeting}
              onChange={(e) => { setSelectedMeeting(e.target.value); setAgentResult(null); }}
              className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all appearance-none"
            >
              <option value="">Choose a meeting...</option>
              {meetings.map((m) => (
                <option key={m.meeting_id} value={m.meeting_id}>
                  {m.meeting_id} ({m.num_action_items} items)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-bg-elevated rounded-xl border border-border-subtle p-4">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-accent-light mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-1">How it works</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The agent reads the meeting's action items, then decides which MCP tools to call
                (save action items file, create calendar events for items with due dates). Each
                tool call is auto-approved in this mode. The agent follows a Thought → Action →
                Observation loop capped at 5 iterations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            if (!selectedMeeting) return;
            setAgentResult(null);
            agentMutation.mutate(selectedMeeting);
          }}
          disabled={!selectedMeeting || agentMutation.isPending}
          className="flex items-center gap-2.5 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 text-sm"
        >
          {agentMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Agent...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Agent
            </>
          )}
        </button>
      </motion.div>

      {agentResult && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-success/20 glow-success rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h3 className="text-base font-semibold text-text-primary">Agent Output</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{agentResult}</p>
        </motion.div>
      )}

      {agentResult && calendarEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <CalendarPlus className="w-5 h-5 text-accent-light" />
            <h3 className="text-base font-semibold text-text-primary">Calendar Events</h3>
          </div>
          <p className="text-xs text-text-secondary mb-4 leading-relaxed">
            The agent wrote these as .ics files via the MCP calendar tool. Click "Add to
            Calendar" and the backend opens it directly in Calendar.app -- this only works
            because the backend runs on this same Mac, not for a hosted deployment.
          </p>
          <div className="space-y-2">
            {calendarEvents.slice(0, 6).map((event) => {
              const { summary, date } = parseIcs(event.content);
              const isOpening = openingFilename === event.filename;
              return (
                <div
                  key={event.filename}
                  className="flex items-center justify-between gap-4 bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{summary}</p>
                    {date && <p className="text-xs text-text-muted mt-0.5">{date}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      setOpeningFilename(event.filename);
                      try {
                        await api.openCalendarEvent(event.filename);
                        toast.success('Opened in Calendar');
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setOpeningFilename(null);
                      }
                    }}
                    disabled={isOpening}
                    className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 disabled:opacity-50 text-accent-light font-medium px-3 py-2 rounded-lg transition-all duration-200 text-xs flex-shrink-0"
                  >
                    {isOpening ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="w-3.5 h-3.5" />
                    )}
                    Add to Calendar
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
