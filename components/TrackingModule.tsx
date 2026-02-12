
import React, { useState, useRef, useEffect } from 'react';
import { EntityType, ScannedItem, PathoItem } from '../types';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface TrackingModuleProps {
  type: EntityType;
  user: string;
  onBack: () => void;
}

type Action = 'IN' | 'OUT' | 'RETURN';

const TrackingModule: React.FC<TrackingModuleProps> = ({ type, user, onBack }) => {
  const [action, setAction] = useState<Action | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [borrowerInfo, setBorrowerInfo] = useState({ name: '', quantity: 1, reason: '' });
  const [resultsMessage, setResultsMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    // Check if process.env.API_KEY exists or if the user has selected one via AI Studio
    const envKey = (process.env && process.env.API_KEY) ? process.env.API_KEY : '';
    if (envKey && envKey !== 'undefined') {
      setHasKey(true);
      return;
    }

    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    } else {
      setHasKey(false);
    }
  };

  const handleSetupKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setHasKey(true);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultsMessage(null);
    setScannedItems([]);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const extracted = await geminiService.scanItemsFromImage(base64, type === 'BLOCK');
        if (extracted.length === 0) {
          setResultsMessage({ type: 'info', text: 'No items detected. Please try a clearer photo.' });
        } else {
          setScannedItems(extracted);
          setResultsMessage({ type: 'success', text: `Successfully scanned ${extracted.length} items.` });
        }
      } catch (err: any) {
        if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_NOT_FOUND') {
          setHasKey(false);
          setResultsMessage({ type: 'error', text: 'AI Service configuration required. Please set up your API key.' });
        } else {
          setResultsMessage({ type: 'error', text: 'Scanning failed. Please check your internet connection.' });
        }
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const processImport = async () => {
    setIsProcessing(true);
    let savedCount = 0;
    for (const item of scannedItems) {
      const newItem: PathoItem = {
        id: crypto.randomUUID(), type, caseId: item.caseId, date: item.date, part: item.part,
        additionalInfo: item.additionalInfo, status: 'IN_STOCK', recordedBy: user,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      if (await storageService.saveItem(newItem)) savedCount++;
    }
    setResultsMessage({ type: 'success', text: `Imported ${savedCount} items to stock.` });
    setScannedItems([]);
    setIsProcessing(false);
  };

  const processCheckout = async () => {
    if (!borrowerInfo.name) {
      setResultsMessage({ type: 'error', text: 'Borrower name is required.' });
      return;
    }
    setIsProcessing(true);
    for (const item of scannedItems) {
      let existing = await storageService.findByScannedData(type, item.caseId, item.part);
      if (!existing) {
        existing = {
          id: crypto.randomUUID(), type, caseId: item.caseId, date: item.date, part: item.part,
          additionalInfo: item.additionalInfo, status: 'IN_STOCK', recordedBy: user,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        await storageService.saveItem(existing);
      }
      await storageService.updateItemStatus(existing.id, {
        status: 'BORROWED', borrower: borrowerInfo.name, borrowQuantity: borrowerInfo.quantity, borrowReason: borrowerInfo.reason
      }, user);
    }
    setResultsMessage({ type: 'success', text: `Checked out ${scannedItems.length} items.` });
    setScannedItems([]);
    setIsProcessing(false);
  };

  const processReturn = async () => {
    setIsProcessing(true);
    let count = 0;
    for (const item of scannedItems) {
      const existing = await storageService.findByScannedData(type, item.caseId, item.part);
      if (existing) {
        await storageService.updateItemStatus(existing.id, {
          status: 'IN_STOCK', borrower: undefined, borrowQuantity: undefined, borrowReason: undefined
        }, user);
        count++;
      }
    }
    setResultsMessage({ type: 'success', text: `Returned ${count} items to stock.` });
    setScannedItems([]);
    setIsProcessing(false);
  };

  // Initial key setup UI if missing
  if (hasKey === false) {
    return (
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-slate-100 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6">
            <i className="fas fa-key text-4xl"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-4">AI Setup Required</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            To use the automated scanning feature, you need to provide a Gemini API Key. 
            Please select a key from a paid GCP project.
          </p>
          <button 
            onClick={handleSetupKey}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all mb-4"
          >
            Select API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs font-bold text-indigo-500 hover:underline"
          >
            Learn about API billing & setup
          </a>
          <button onClick={onBack} className="block w-full mt-6 text-slate-400 font-bold hover:text-slate-600">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="w-full max-w-4xl animate-in fade-in slide-in-from-left-4 duration-300">
        <button onClick={onBack} className="mb-6 flex items-center space-x-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
          <i className="fas fa-arrow-left"></i>
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-10">
          <div className="flex items-center space-x-4 mb-10 border-b pb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg ${type === 'BLOCK' ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
              <i className={`fas ${type === 'BLOCK' ? 'fa-cube' : 'fa-vial'} text-3xl`}></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">{type} Operations</h2>
              <p className="text-slate-500 font-medium">AI tracking is ready</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <button onClick={() => setAction('IN')} className="flex flex-col items-center p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <i className="fas fa-sign-in-alt text-4xl"></i>
              </div>
              <span className="text-xl font-black text-slate-800">Check-In</span>
            </button>
            <button onClick={() => setAction('OUT')} className="flex flex-col items-center p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-orange-500 hover:bg-orange-50 transition-all group">
              <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-orange-600 group-hover:text-white transition-all">
                <i className="fas fa-sign-out-alt text-4xl"></i>
              </div>
              <span className="text-xl font-black text-slate-800">Check-Out</span>
            </button>
            <button onClick={() => setAction('RETURN')} className="flex flex-col items-center p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <i className="fas fa-undo text-4xl"></i>
              </div>
              <span className="text-xl font-black text-slate-800">Return</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const actionTheme = action === 'IN' ? 'indigo' : action === 'OUT' ? 'orange' : 'emerald';

  return (
    <div className="w-full max-w-5xl animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setAction(null)} className="flex items-center space-x-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
          <i className="fas fa-arrow-left"></i>
          <span>Change Action</span>
        </button>
        <div className="text-right flex items-center space-x-4">
           <button onClick={handleSetupKey} className="text-xs font-bold text-indigo-400 hover:text-indigo-600">
             Update API Key
           </button>
          <span className={`bg-${actionTheme}-100 px-4 py-2 rounded-xl text-sm font-black text-${actionTheme}-700 border border-${actionTheme}-200`}>
            {type} / {action}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
            <div 
              onClick={() => !isProcessing && fileInputRef.current?.click()} 
              className={`border-4 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-${actionTheme}-400 hover:bg-${actionTheme}-50 transition-all cursor-pointer group mb-8 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-white transition-all shadow-sm">
                {isProcessing ? <i className="fas fa-spinner fa-spin text-4xl text-indigo-500"></i> : <i className="fas fa-camera text-4xl text-slate-500"></i>}
              </div>
              <p className="font-black text-slate-700 text-xl">{isProcessing ? 'AI Processing...' : 'Tap to scan labels'}</p>
              <p className="text-slate-400 text-sm mt-2 font-medium">Ensure labels are clearly visible</p>
            </div>

            {action === 'OUT' && (
              <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                <input type="text" value={borrowerInfo.name} onChange={e => setBorrowerInfo({...borrowerInfo, name: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold text-black" placeholder="Borrower Name" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" value={borrowerInfo.quantity} onChange={e => setBorrowerInfo({...borrowerInfo, quantity: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold text-black" placeholder="Quantity" />
                  <input type="text" value={borrowerInfo.reason} onChange={e => setBorrowerInfo({...borrowerInfo, reason: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold text-black" placeholder="Reason/Project" />
                </div>
              </div>
            )}

            <button 
              disabled={isProcessing || scannedItems.length === 0} 
              onClick={action === 'IN' ? processImport : action === 'OUT' ? processCheckout : processReturn} 
              className={`w-full py-5 rounded-2xl font-black text-lg transition-all text-white ${scannedItems.length === 0 ? 'bg-slate-300' : `bg-${actionTheme}-600 hover:bg-${actionTheme}-700 shadow-xl shadow-${actionTheme}-100`}`}
            >
              {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : `Complete ${action} Transaction`}
            </button>

            {resultsMessage && (
              <div className={`mt-8 p-5 rounded-2xl font-bold text-sm border-2 animate-in slide-in-from-top-2 ${resultsMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : resultsMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                <i className={`fas ${resultsMessage.type === 'success' ? 'fa-check-circle' : resultsMessage.type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'} mr-2`}></i>
                {resultsMessage.text}
              </div>
            )}
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800">Scan Results ({scannedItems.length})</h3>
            {scannedItems.length > 0 && (
              <button onClick={() => setScannedItems([])} className="text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest">Clear List</button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {scannedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fas fa-qrcode text-6xl mb-4 opacity-10"></i>
                <p className="font-bold opacity-40 text-center px-4">AI will display scanned results here</p>
              </div>
            ) : (
              scannedItems.map((item, idx) => (
                <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl p-4 flex justify-between items-center group hover:border-indigo-200 transition-colors shadow-sm">
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-tight">{item.caseId}</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Part: {item.part} • {item.date}</p>
                  </div>
                  <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                    <i className="fas fa-times-circle text-xl"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingModule;
