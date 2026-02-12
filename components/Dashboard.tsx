
import React, { useEffect, useState } from 'react';
import { EntityType } from '../types';
import { storageService } from '../services/storageService';

interface DashboardProps {
  onSelect: (type: EntityType) => void;
  onViewReports: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelect, onViewReports }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    handleSync();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await storageService.syncFromCloud();
    setIsSyncing(false);
  };

  return (
    <div className="max-w-4xl w-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Workspace</h2>
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <i className={`fas fa-sync-alt ${isSyncing ? 'fa-spin text-indigo-500' : ''}`}></i>
          <span>{isSyncing ? 'Syncing Cloud Data...' : 'Refresh from Cloud'}</span>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div 
          onClick={() => onSelect('BLOCK')}
          className="group bg-white rounded-3xl p-10 shadow-lg border border-slate-100 hover:border-indigo-300 hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 text-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="fas fa-cube text-9xl"></i>
          </div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform">
              <i className="fas fa-cube text-3xl"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Block Tracking</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">
              Manage pathology blocks, track storage locations, and oversee the borrowing lifecycle.
            </p>
            <div className="flex items-center text-indigo-600 font-bold space-x-2">
              <span>Access Modules</span>
              <i className="fas fa-chevron-right text-xs group-hover:translate-x-2 transition-transform"></i>
            </div>
          </div>
        </div>

        <div 
          onClick={() => onSelect('SLIDE')}
          className="group bg-white rounded-3xl p-10 shadow-lg border border-slate-100 hover:border-emerald-300 hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 text-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="fas fa-vial text-9xl"></i>
          </div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform">
              <i className="fas fa-microscope text-3xl"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Slide Tracking</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">
              Organize slides, perform bulk check-ins/outs, and maintain precise inventory records.
            </p>
            <div className="flex items-center text-emerald-600 font-bold space-x-2">
              <span>Access Modules</span>
              <i className="fas fa-chevron-right text-xs group-hover:translate-x-2 transition-transform"></i>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={onViewReports}
        className="w-full py-6 bg-white border border-slate-200 rounded-3xl shadow-md hover:shadow-lg hover:border-indigo-200 flex items-center justify-center space-x-4 transition-all group"
      >
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
          <i className="fas fa-chart-line text-xl"></i>
        </div>
        <div className="text-left">
          <span className="block font-bold text-slate-800">View Inventory & Reports</span>
          <span className="text-sm text-slate-500">Search items, check stats (Daily, Monthly, Yearly)</span>
        </div>
      </button>
    </div>
  );
};

export default Dashboard;
