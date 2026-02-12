
import React, { useState, useEffect } from 'react';
import { PathoItem, EntityType } from '../types';
import { storageService } from '../services/storageService';

interface InventoryReportsProps {
  onBack: () => void;
}

type Period = 'DAILY' | 'MONTHLY' | 'YEARLY';

const InventoryReports: React.FC<InventoryReportsProps> = ({ onBack }) => {
  const [items, setItems] = useState<PathoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('DAILY');
  const [filterType, setFilterType] = useState<EntityType | 'ALL'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const allItems = await storageService.getAllItems();
    setItems(allItems);
    setIsLoading(false);
  };

  const getFilteredItems = () => {
    let filtered = items;
    if (filterType !== 'ALL') {
      filtered = filtered.filter(i => i.type === filterType);
    }
    if (search) {
      filtered = filtered.filter(i => 
        i.caseId.toLowerCase().includes(search.toLowerCase()) || 
        i.part.toLowerCase().includes(search.toLowerCase()) ||
        i.borrower?.toLowerCase().includes(search.toLowerCase()) ||
        i.recordedBy.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Date range filtering
    const now = new Date();
    filtered = filtered.filter(i => {
      const itemDate = new Date(i.createdAt);
      if (period === 'DAILY') {
        return itemDate.toDateString() === now.toDateString();
      } else if (period === 'MONTHLY') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      } else if (period === 'YEARLY') {
        return itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    return filtered;
  };

  const filtered = getFilteredItems();
  const inStock = filtered.filter(i => i.status === 'IN_STOCK').length;
  const borrowed = filtered.filter(i => i.status === 'BORROWED').length;

  return (
    <div className="w-full max-w-6xl flex flex-col space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Inventory & Reports</h2>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
          {(['DAILY', 'MONTHLY', 'YEARLY'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <i className="fas fa-boxes-stacked text-2xl"></i>
          </div>
          <div>
            <span className="block text-slate-400 text-sm font-medium">In Stock</span>
            <span className="text-3xl font-black text-slate-800">{inStock}</span>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-6">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
            <i className="fas fa-hand-holding-medical text-2xl"></i>
          </div>
          <div>
            <span className="block text-slate-400 text-sm font-medium">Borrowed</span>
            <span className="text-3xl font-black text-slate-800">{borrowed}</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-6">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <i className="fas fa-list-check text-2xl"></i>
          </div>
          <div>
            <span className="block text-slate-400 text-sm font-medium">Total Activity</span>
            <span className="text-3xl font-black text-slate-800">{filtered.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-grow max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <i className="fas fa-search"></i>
            </span>
            <input 
              type="text"
              placeholder="Search Case ID, Part, Borrower or Handler..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-black transition-all"
            />
          </div>

          <div className="flex items-center space-x-3">
             <select 
               value={filterType}
               onChange={e => setFilterType(e.target.value as any)}
               className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none"
             >
               <option value="ALL">All Types</option>
               <option value="SLIDE">Slides Only</option>
               <option value="BLOCK">Blocks Only</option>
             </select>
             <button onClick={loadData} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100">
               <i className="fas fa-sync-alt"></i>
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Case & Part</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Borrower</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Recorded By</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Loading inventory records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">
                    No matching items found for this {period.toLowerCase()} period.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black ${
                        item.type === 'BLOCK' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.caseId}</div>
                      <div className="text-xs text-slate-400 font-medium">Part: {item.part}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center space-x-2 text-xs font-bold ${
                        item.status === 'IN_STOCK' ? 'text-emerald-600' : 'text-orange-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${item.status === 'IN_STOCK' ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                        <span>{item.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      {item.borrower || '-'}
                      {item.borrowReason && <div className="text-[10px] text-slate-400 italic">Reason: {item.borrowReason}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-bold">
                      {item.recordedBy}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryReports;
