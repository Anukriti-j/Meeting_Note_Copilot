import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
  delay?: number;
}

export default function StatCard({ icon: Icon, label, value, color = 'text-accent-light', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border transition-all duration-300 group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-bold text-text-primary tracking-tight">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl bg-bg-hover ${color} group-hover:scale-110 transition-transform duration-200`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
