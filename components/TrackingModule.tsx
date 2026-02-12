
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultsMessage(null);
    setScannedItems([]);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const extracted = await geminiService.scanItemsFromImage(base64, type === 'BLOCK');
      
      // Filter out duplicate scans within the same photo result
      const uniqueExtracted = extracted.filter((item, index, self) =>
        index === self.findIndex((t) => (
          t.caseId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === item.caseId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() &&
          t.part.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === item.part.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        ))
      );
      
      setScannedItems(uniqueExtracted);
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

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
      if (wasSaved) {
        savedCount++;
      } else {
        duplicateCount++;
      }
    }

    if (savedCount > 0) {
      setResultsMessage({ 
        type: 'success', 
        text: `Successfully imported ${savedCount} new items. ${duplicateCount > 0 ? `(${duplicateCount} duplicates skipped).` : ''} Recorded by ${user}.` 
      });
    } else if (duplicateCount > 0) {
      setResultsMessage({ 
        type: 'info', 
        text: `All ${duplicateCount} scanned items already exist in the system. No duplicate records were created.` 
      });
    }

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
    let autoImportCount = 0;

    for (const item of scannedItems) {
      let existing = await storageService.findByScannedData(type, item.caseId, item.part);
      
      if (!existing) {
        const newItem: PathoItem = {
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
        await storageService.saveItem(newItem);
        existing = newItem;
        autoImportCount++;
      }

      await storageService.updateItemStatus(existing.id, {
        status: 'BORROWED',
        borrower: borrowerInfo.name,
        borrowQuantity: borrowerInfo.quantity,
        borrowReason: borrowerInfo.reason
      }, user);
      successCount++;
    }

    setResultsMessage({ 
      type: 'success', 
      text: `Checkout of ${successCount} items logged by ${user}.${autoImportCount > 0 ? ` (${autoImportCount} items were new and auto-registered).` : ''}` 
    });
    
    setScannedItems([]);
    setBorrowerInfo({ name: '', quantity: 1, reason: '' });
    setIsProcessing(false);
  };

  const processReturn = async () => {
    setIsProcessing(true);
    let successCount = 0;
    let notFoundCount = 0;

    for (const item of scannedItems) {
      const existing = await storageService.findByScannedData(type, item.caseId, item.part);
      if (existing) {
        await storageService.updateItemStatus(existing.id, {
          status: 'IN_STOCK',
          borrower: undefined,
          borrowQuantity: undefined,
          borrowReason: undefined
        }, user);
        successCount++;
      } else {
        notFoundCount++;
      }
    }

    setResultsMessage({ 
      type: 'info', 
      text: `Returned ${successCount} items. ${notFoundCount > 0 ? `(${notFoundCount} items not found in registry).` : ''} Handler: ${user}.` 
    });
    
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
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg ${type === 'BLOCK' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-500 shadow-emerald-200'}`}>
              <i className={`fas ${type === 'BLOCK' ? 'fa-cube' : 'fa-vial'} text-3xl`}></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">{type} Operations</h2>
              <p className="text-slate-500 font-medium">Select an action to start tracking</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <button 
              onClick={() => setAction('IN')} 
              className="group relative flex flex-col items-center p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-xl hover:shadow-indigo-100 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <i className="fas fa-sign-in-alt text-4xl"></i>
              </div>
              <span className="text-xl font-black text-slate-800 group-hover:text-indigo-700">Check-In</span>
              <span className="text-sm text-slate-500 mt-2 font-medium">Add to Stock</span>
            </button>

            <button 
              onClick={() => setAction('OUT')} 
              className="group relative flex flex-col items-center p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-orange-500 hover:bg-orange-50 hover:shadow-xl hover:shadow-orange-100 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
              <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                <i className="fas fa-sign-out-alt text-4xl"></i>
              </div>
              <span className="text-xl font-black text-slate-800 group-hover:text-orange-700">Check-Out</span>
              <span className="text-sm text-slate-500 mt-2 font-medium">Lend / Borrow</span>
            </button>

            <button 
              onClick={() => setAction('RETURN')} 
              className="group relative flex flex-col items-center p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-100 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <i className="fas fa-undo text-4xl"></i>
              </div>
              <span className="text-xl font-black text-slate-800 group-hover:text-emerald-700">Return</span>
              <span className="text-sm text-slate-500 mt-2 font-medium">Update to Stock</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const actionTheme = action === 'IN' ? 'indigo' : action === 'OUT' ? 'orange' : 'emerald';
  const actionLabel = action === 'IN' ? 'Import Records' : action === 'OUT' ? 'Borrow Request' : 'Process Return';

  return (
    <div className="w-full max-w-5xl animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setAction(null)} className="flex items-center space-x-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
          <i className="fas fa-arrow-left"></i>
          <span>Change Action</span>
        </button>
        <div className="text-right">
          <span className={`bg-${actionTheme}-100 px-4 py-2 rounded-xl text-sm font-black text-${actionTheme}-700 uppercase tracking-widest block shadow-sm border border-${actionTheme}-200`}>
            {type} / {action === 'IN' ? 'Check-In' : action === 'OUT' ? 'Check-Out' : 'Return'}
          </span>
          <span className="text-xs text-slate-400 mt-1 block font-bold">User: {user}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8">
            <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl bg-${actionTheme}-500 flex items-center justify-center text-white text-sm`}>
                <i className={`fas ${action === 'IN' ? 'fa-plus' : action === 'OUT' ? 'fa-minus' : 'fa-check'}`}></i>
              </div>
              <span>{actionLabel}</span>
            </h3>

            <div 
              onClick={() => fileInputRef.current?.click()} 
              className={`border-4 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-${actionTheme}-400 hover:bg-${actionTheme}-50 transition-all cursor-pointer group mb-8`}
            >
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-lg transition-all duration-300">
                <i className="fas fa-camera text-4xl"></i>
              </div>
              <p className="font-black text-slate-700 text-xl mb-2">Tap to Scan</p>
              <p className="text-slate-400 font-medium">Take a photo of the {type.toLowerCase()} label</p>
            </div>

            {action === 'OUT' && (
              <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest mb-4">Borrower Details</h4>
                <div className="relative">
                   <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                   <input type="text" value={borrowerInfo.name} onChange={e => setBorrowerInfo({...borrowerInfo, name: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold text-black" placeholder="Staff Name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <i className="fas fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="number" value={borrowerInfo.quantity} onChange={e => setBorrowerInfo({...borrowerInfo, quantity: parseInt(e.target.value)})} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold text-black" placeholder="Qty" />
                  </div>
                  <div className="relative">
                    <i className="fas fa-info-circle absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" value={borrowerInfo.reason} onChange={e => setBorrowerInfo({...borrowerInfo, reason: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold text-black" placeholder="Reason" />
                  </div>
                </div>
              </div>
            )}

            <button 
              disabled={isProcessing || scannedItems.length === 0} 
              onClick={action === 'IN' ? processImport : action === 'OUT' ? processCheckout : processReturn} 
              className={`w-full py-5 rounded-2xl font-black text-lg shadow-2xl transition-all flex items-center justify-center space-x-3 text-white ${scannedItems.length === 0 ? 'bg-slate-300 cursor-not-allowed opacity-50' : `bg-${actionTheme}-600 hover:bg-${actionTheme}-700 shadow-${actionTheme}-200`}`}
            >
              {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <span>Save & Record Transaction</span>}
            </button>

            {resultsMessage && (
              <div className={`mt-8 p-5 rounded-[1.5rem] font-bold text-sm flex items-start space-x-4 border-2 ${resultsMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                <i className={`fas ${resultsMessage.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'} text-lg`}></i>
                <span>{resultsMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[650px]">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-black text-slate-800">Scan Results ({scannedItems.length})</h3>
            {scannedItems.length > 0 && <button onClick={() => setScannedItems([])} className="text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest">Clear All</button>}
          </div>
          <div className="flex-grow overflow-y-auto p-8 space-y-4">
            {scannedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4">
                <i className="fas fa-qrcode text-6xl opacity-20"></i>
                <p className="font-bold text-slate-400">No items scanned yet</p>
              </div>
            ) : (
              scannedItems.map((item, idx) => (
                <div key={idx} className="bg-white border-2 border-slate-100 rounded-3xl p-5 flex items-start justify-between group hover:border-indigo-200 hover:shadow-md transition-all">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">{item.caseId}</h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 font-bold">
                         <span className="bg-slate-100 px-2 py-0.5 rounded">Part: {item.part}</span>
                         <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors p-2">
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
