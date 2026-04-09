import { HashRouter, Routes, Route } from 'react-router-dom';
import { DealProvider } from './context/DealContext';
import { FinancialsProvider } from './context/FinancialsContext';
import Sidebar from './components/Sidebar';
import FeedbackWidget from './components/FeedbackWidget';
import AiAssistant from './components/AiAssistant';
import Dashboard from './pages/Dashboard';
import DealCalendar from './pages/DealCalendar';
import DealDetail from './pages/DealDetail';
import Overview from './pages/Overview';
import ExcludedSkus from './pages/ExcludedSkus';
import HistoricalPerformance from './pages/HistoricalPerformance';
import ProductFinancials from './pages/ProductFinancials';
import CurrentDealPerformance from './pages/CurrentDealPerformance';
import DealFinancials from './pages/DealFinancials';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <DealProvider>
      <FinancialsProvider>
        <HashRouter>
          <div className="flex min-h-screen">
            <Sidebar />
            <FeedbackWidget />
            <AiAssistant />
            <main className="flex-1 p-8 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/current-performance" element={<CurrentDealPerformance />} />
                <Route path="/deal-financials" element={<DealFinancials />} />
                <Route path="/calendar" element={<DealCalendar />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/deal/:dealId" element={<DealDetail />} />
                <Route path="/excluded" element={<ExcludedSkus />} />
                <Route path="/stock" element={<Placeholder title="Stock Allocation" />} />
                <Route path="/performance" element={<Placeholder title="Sales Performance" />} />
                <Route path="/historical" element={<HistoricalPerformance />} />
                <Route path="/financials" element={<ProductFinancials />} />
                <Route path="/ppc" element={<Placeholder title="PPC Spend" />} />
                <Route path="/upload" element={<Placeholder title="Upload Data" />} />
              </Routes>
            </main>
          </div>
        </HashRouter>
      </FinancialsProvider>
    </DealProvider>
  );
}
