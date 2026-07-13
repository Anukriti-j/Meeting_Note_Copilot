import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  MessageCircleQuestion,
  CheckSquare,
  Bot,
  ScrollText,
  Zap,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ingest', icon: Upload, label: 'Ingest' },
  { to: '/qa', icon: MessageCircleQuestion, label: 'Ask' },
  { to: '/action-items', icon: CheckSquare, label: 'Action Items' },
  { to: '/agent', icon: Bot, label: 'Agent' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-bg-elevated border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-accent-light" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text-primary tracking-tight">
              Meeting Notes
            </h1>
            <p className="text-[11px] text-text-muted font-medium">Copilot</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative block"
            >
              <motion.div
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }
                `}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-accent/10 border border-accent/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon
                  className={`w-[18px] h-[18px] relative z-10 ${
                    isActive ? 'text-accent-light' : ''
                  }`}
                />
                <span className="relative z-10">{item.label}</span>
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border-subtle">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>Backend connected</span>
        </div>
      </div>
    </aside>
  );
}
