
import React, { useState, useRef } from 'react';
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
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultsMessage(null);
    setIsApiKeyMissing(false);
    setScannedItems([]);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const extracted = await geminiService.scanItemsFromImage(base64, type === 'BLOCK');
        
        if (extracted.length === 0 && !process.env.API_KEY) {
          setIsApiKeyMissing(true);
          setResultsMessage({ type: 'error', text: 'Gemini API Key is missing. Please check Vercel environment variables.' });
        } else if (extracted.length === 0) {
          setResultsMessage({ type: 'info', text: 'No items detected. Please try a clearer photo.' });
        }

        const uniqueExtracted = extracted.filter((item, index, self) =>
          index === self.findIndex((t) => (
            t.caseId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === item.caseId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() &&
            t.part.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === item.part.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
          ))
        );
        
        setScannedItems(uniqueExtracted);
      } catch (err) {
        setResultsMessage({ type: 'error', text: 'Error communicating with Gemini AI. Check console for details.' });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ... (rest of the processing logic remains the same but ensure storageService.saveItem is used)
  const processImport = async () => {
    setIsProcessing(true);
    let savedCount = 0;
    let duplicateCount = 0;

    for (const item of scannedItems) {
      const newPathoItem: PathoItem = {
        id: crypto.randomUUID(),
        type,
        caseId: item.caseId,
        date: item.date,
        part: item.part,
        additionalInfo: item.additionalInfo,
        status: 'IN_STOCK',
        recordedBy: user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const wasSaved = await storageService.saveItem(newPathoItem);
      if (wasSaved) savedCount++; else duplicateCount++;
    }

    setResultsMessage({ 
      type: 'success', 
      text: `Imported ${savedCount} items. ${duplicateCount > 0 ? `Skipped ${duplicateCount} duplicates.` : ''}` 
    });
    setScannedItems([]);
    setIsProcessing(false);
  };

  const processCheckout = async () => {
    if (!borrowerInfo.name) {
      setResultsMessage({ type: 'error', text: 'Borrower name is required.' });
      return;
    }
    setIsProcessing(true);
    let successCount = 0;
    for (const item of scannedItems) {
      let existing = await storageService.findByScannedData(type, item.caseId, item.part);
      if (!existing) {
        const newItem: PathoItem = {
          id: crypto.randomUUID(),
          type, caseId: item.caseId, date: item.date, part: item.part,
          additionalInfo: item.additionalInfo, status: 'IN_STOCK',
          recordedBy: user, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        await storageService.saveItem(newItem);
        existing = newItem;
      }
      await storageService.updateItemStatus(existing.id, {
        status: 'BORROWED',
        borrower: borrowerInfo.name,
        borrowQuantity: borrowerInfo.quantity,
        borrowReason: borrowerInfo.reason
      }, user);
      successCount++;
    }
    setResultsMessage({ type: 'success', text: `Checkout of ${successCount} items logged.` });
    setScannedItems([]);
    setIsProcessing(false);
  };

  const processReturn = async () => {
    setIsProcessing(true);
    let successCount = 0;
    for (const item of scannedItems) {
      const existing = await storageService.findByScannedData(type, item.caseId, item.part);
      if (existing) {
        await storageService.updateItemStatus(existing.id, {
          status: 'IN_STOCK', borrower: undefined, borrowQuantity: undefined, borrowReason: undefined
        }, user);
        successCount++;
      }
    }
    setResultsMessage({ type: 'success', text: `Returned ${successCount} items.` });
    setScannedItems([]);
    setIsProcessing(false);
  };

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
              <p className="text-slate-500 font-medium">Select an action to start tracking</p>
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
        <div className="text-right">
          <span className={`bg-${actionTheme}-100 px-4 py-2 rounded-xl text-sm font-black text-${actionTheme}-700 border border-${actionTheme}-200`}>
            {type} / {action}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
           {isApiKeyMissing && (
             <div className="mb-6 p-4 bg-red-50 border-2 border-red-100 rounded-2xl text-red-700 text-sm font-bold flex items-center space-x-3">
               <i className="fas fa-exclamation-triangle text-xl"></i>
               <span>API Key is missing. Scanning will not work. Add API_KEY to Vercel Environment Variables.</span>
             </div>
           )}

            <div 
              onClick={() => !isProcessing && fileInputRef.current?.click()} 
              className={`border-4 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-${actionTheme}-400 hover:bg-${actionTheme}-50 transition-all cursor-pointer group mb-8 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-white transition-all">
                {isProcessing ? <i className="fas fa-spinner fa-spin text-4xl text-indigo-500"></i> : <i className="fas fa-camera text-4xl"></i>}
              </div>
              <p className="font-black text-slate-700 text-xl">{isProcessing ? 'Processing Label...' : 'Tap to Scan Label'}</p>
            </div>

            {action === 'OUT' && (
              <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                <input type="text" value={borrowerInfo.name} onChange={e => setBorrowerInfo({...borrowerInfo, name: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold" placeholder="Staff Name" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" value={borrowerInfo.quantity} onChange={e => setBorrowerInfo({...borrowerInfo, quantity: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold" placeholder="Qty" />
                  <input type="text" value={borrowerInfo.reason} onChange={e => setBorrowerInfo({...borrowerInfo, reason: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold" placeholder="Reason" />
                </div>
              </div>
            )}

            <button 
              disabled={isProcessing || scannedItems.length === 0} 
              onClick={action === 'IN' ? processImport : action === 'OUT' ? processCheckout : processReturn} 
              className={`w-full py-5 rounded-2xl font-black text-lg transition-all text-white ${scannedItems.length === 0 ? 'bg-slate-300' : `bg-${actionTheme}-600 hover:bg-${actionTheme}-700 shadow-xl shadow-${actionTheme}-100`}`}
            >
              {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : 'Complete Transaction'}
            </button>

            {resultsMessage && (
              <div className={`mt-8 p-5 rounded-2xl font-bold text-sm border-2 ${resultsMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                {resultsMessage.text}
              </div>
            )}
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800">Scan Results ({scannedItems.length})</h3>
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {scannedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fas fa-qrcode text-6xl mb-4 opacity-20"></i>
                <p className="font-bold">Waiting for scan...</p>
              </div>
            ) : (
              scannedItems.map((item, idx) => (
                <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl p-4 flex justify-between items-center group">
                  <div>
                    <h4 className="font-black text-slate-800">{item.caseId}</h4>
                    <p className="text-xs text-slate-500 font-bold">Part: {item.part} • {item.date}</p>
                  </div>
                  <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500">
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
