import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Eye, AlertTriangle,
  Package, DollarSign, TrendingUp, Upload, BarChart3, Wallet, Activity, Calculator
} from 'lucide-react';

const navItems = [
  { section: 'MAIN', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/current-performance', icon: Activity, label: 'Current Deal Performance' },
    { to: '/deal-financials', icon: Calculator, label: 'Deal Financials' },
  ]},
  { section: 'DEALS', items: [
    { to: '/calendar', icon: Calendar, label: 'Deal Calendar' },
    { to: '/overview', icon: Eye, label: 'Overview' },
    { to: '/excluded', icon: AlertTriangle, label: 'Excluded SKUs' },
    { to: '/stock', icon: Package, label: 'Stock Allocation' },
    { to: '/performance', icon: DollarSign, label: 'Sales Performance' },
    { to: '/historical', icon: BarChart3, label: 'Historical Performance' },
  ]},
  { section: 'ADVERTISING', items: [
    { to: '/ppc', icon: TrendingUp, label: 'PPC Spend' },
  ]},
  { section: 'FINANCIALS', items: [
    { to: '/financials', icon: Wallet, label: 'Product Financials' },
  ]},
  { section: 'DATA', items: [
    { to: '/upload', icon: Upload, label: 'Upload Data' },
  ]},
];

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-sidebar text-gray-300 flex flex-col shrink-0">
      <div className="px-5 py-5">
        <h1 className="text-2xl font-bold">
          <span className="text-brand-orange">Deal</span>
          <span className="text-white">MIS</span>
        </h1>
      </div>

      <nav className="flex-1 px-3 space-y-6 mt-2">
        {navItems.map(section => (
          <div key={section.section}>
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.section}
            </p>
            <ul className="space-y-1">
              {section.items.map(item => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-active text-white'
                          : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
