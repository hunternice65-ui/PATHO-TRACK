
import React, { useState, useEffect } from 'react';
import { AppView, EntityType } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TrackingModule from './components/TrackingModule';
import InventoryReports from './components/InventoryReports';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('LOGIN');
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('patho_user');
    if (savedUser) {
      setUser(savedUser);
      setView('DASHBOARD');
    }
  }, []);

  const handleLogin = (username: string) => {
    setUser(username);
    localStorage.setItem('patho_user', username);
    setView('DASHBOARD');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('patho_user');
    setView('LOGIN');
  };

  const renderView = () => {
    switch (view) {
      case 'LOGIN':
        return <Login onLogin={handleLogin} />;
      case 'DASHBOARD':
        return (
          <Dashboard 
            onSelect={(type) => setView(type === 'BLOCK' ? 'BLOCK_MODULE' : 'SLIDE_MODULE')} 
            onViewReports={() => setView('REPORTS')}
          />
        );
      case 'BLOCK_MODULE':
        return <TrackingModule type="BLOCK" user={user || 'admin'} onBack={() => setView('DASHBOARD')} />;
      case 'SLIDE_MODULE':
        return <TrackingModule type="SLIDE" user={user || 'admin'} onBack={() => setView('DASHBOARD')} />;
      case 'REPORTS':
        return <InventoryReports onBack={() => setView('DASHBOARD')} />;
      default:
        return <Login onLogin={handleLogin} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {view !== 'LOGIN' && (
        <Navbar user={user || 'Guest'} onLogout={handleLogout} />
      )}
      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        {renderView()}
      </main>
      <footer className="py-4 text-center text-slate-400 text-xs font-medium uppercase tracking-widest border-t bg-white">
        PathoTrack Integrated System &copy; 2024
      </footer>
    </div>
  );
};

export default App;
