import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Ingest from './pages/Ingest';
import MeetingDetail from './pages/MeetingDetail';
import QA from './pages/QA';
import ActionItems from './pages/ActionItems';
import Agent from './pages/Agent';
import Logs from './pages/Logs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ingest" element={<Ingest />} />
        <Route path="/meetings/:meetingId" element={<MeetingDetail />} />
        <Route path="/qa" element={<QA />} />
        <Route path="/action-items" element={<ActionItems />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/logs" element={<Logs />} />
      </Route>
    </Routes>
  );
}
