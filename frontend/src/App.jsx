import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import TrendsDashboard from './pages/TrendsDashboard';
import PickupDrop from './pages/PickupDrop';
import DraftGuide from './pages/DraftGuide';
import PlayerDetail from './pages/PlayerDetail';
import DraftBoard from './pages/DraftBoard';
import MyTeam from './pages/MyTeam';
import Compare from './pages/Compare';
import Sleepers from './pages/Sleepers';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-rink-950">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<TrendsDashboard />} />
          <Route path="/pickup-drop" element={<PickupDrop />} />
          <Route path="/draft-guide" element={<DraftGuide />} />
          <Route path="/player/:id" element={<PlayerDetail />} />
          <Route path="/draft-board" element={<DraftBoard />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/sleepers" element={<Sleepers />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
