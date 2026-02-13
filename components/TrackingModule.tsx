
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
type InputMode = 'AI' | 'MANUAL';

const TrackingModule: React.FC<TrackingModuleProps> = ({ type, user, onBack }) => {
  const [action, setAction] = useState<Action | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('AI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [manualData, setManualData] = useState<ScannedItem>({ 
    caseId: '', 
    date: new Date().toISOString().split('T')[0], 
    part: '', 
    additionalInfo: '' 
  });
  const [borrowerInfo, setBorrowerInfo] = useState({ name: '', quantity: 1, reason: '' });
  const [resultsMessage, setResultsMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualCaseRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const envKey = (process.env && process.env.API_KEY) ? process.env.API_KEY : '';
    if (envKey && envKey !== 'undefined' && envKey !== '') {
      setHasKey(true);
      return;
    }

    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
      if (!selected) setInputMode('MANUAL');
    } else {
      setHasKey(false);
      setInputMode('MANUAL');
    }
  };

  const handleSetupKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setInputMode('AI');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultsMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const extracted = await geminiService.scanItemsFromImage(base64, type === 'BLOCK');
        if (extracted.length === 0) {
          setResultsMessage({ type: 'info', text: 'ไม่พบข้อมูลในรูปภาพ กรุณาลองใหม่' });
        } else {
          setScannedItems(prev => [...extracted, ...prev]);
          setResultsMessage({ type: 'success', text: `AI ตรวจพบ ${extracted.length} รายการ` });
        }
      } catch (err: any) {
        setResultsMessage({ type: 'error', text: 'การสแกนล้มเหลว กรุณาตรวจสอบ API Key หรือใช้โหมด Manual' });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.caseId || !manualData.part) return;
    
    setScannedItems(prev => [manualData, ...prev]);
    // รีเซ็ตค่าเพื่อพิมพ์รายการถัดไป
    setManualData({ ...manualData, caseId: '', part: '', additionalInfo: '' });
    manualCaseRef.current?.focus();
    setResultsMessage({ type: 'success', text: 'เพิ่มรายการลงในคิวแล้ว' });
  };

  const finalizeTransaction = async () => {
    if (scannedItems.length === 0) return;
    setIsProcessing(true);

    try {
      if (action === 'IN') {
        let saved = 0;
        for (const item of scannedItems) {
          const newItem: PathoItem = {
            id: crypto.randomUUID(), type, caseId: item.caseId, date: item.date, part: item.part,
            additionalInfo: item.additionalInfo, status: 'IN_STOCK', recordedBy: user,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
          if (await storageService.saveItem(newItem)) saved++;
        }
        setResultsMessage({ type: 'success', text: `บันทึกรายการนำเข้าสำเร็จ ${saved} รายการ` });
      } else if (action === 'OUT') {
        if (!borrowerInfo.name) {
          setResultsMessage({ type: 'error', text: 'กรุณาระบุชื่อผู้ยืม' });
          setIsProcessing(false);
          return;
        }
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
        setResultsMessage({ type: 'success', text: `บันทึกการเบิกสำเร็จ ${scannedItems.length} รายการ` });
      } else if (action === 'RETURN') {
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
        setResultsMessage({ type: 'success', text: `บันทึกการคืนสำเร็จ ${count} รายการ` });
      }
      setScannedItems([]);
    } catch (err) {
      setResultsMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!action) {
    return (
      <div className="w-full max-w-4xl animate-in fade-in slide-in-from-left-4 duration-300">
        <button onClick={onBack} className="mb-6 flex items-center space-x-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
          <i className="fas fa-arrow-left"></i>
          <span>กลับไปที่ Dashboard</span>
        </button>

        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-10">
          <div className="flex items-center justify-between mb-10 border-b pb-6">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg ${type === 'BLOCK' ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
                <i className={`fas ${type === 'BLOCK' ? 'fa-cube' : 'fa-vial'} text-3xl`}></i>
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-800">ระบบจัดการ {type}</h2>
                <p className="text-slate-500 font-medium">เลือกการทำงานที่ต้องการ</p>
              </div>
            </div>
            {!hasKey && (
              <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200">
                <i className="fas fa-info-circle mr-1"></i> Manual Mode
              </div>
            )}
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
    <div className="w-full max-w-6xl animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setAction(null)} className="flex items-center space-x-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
          <i className="fas fa-arrow-left"></i>
          <span>เปลี่ยนประเภทการทำรายการ</span>
        </button>
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
          <button 
            disabled={!hasKey}
            onClick={() => setInputMode('AI')} 
            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${inputMode === 'AI' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 disabled:opacity-30'}`}
          >
            <i className="fas fa-robot mr-2"></i> AI SCAN
          </button>
          <button 
            onClick={() => setInputMode('MANUAL')} 
            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${inputMode === 'MANUAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <i className="fas fa-keyboard mr-2"></i> MANUAL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* ฝั่งคีย์ข้อมูล */}
        <div className="lg:col-span-3 bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
            {inputMode === 'AI' ? (
              <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()} 
                className={`border-4 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group mb-8 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-white transition-all shadow-sm">
                  {isProcessing ? <i className="fas fa-spinner fa-spin text-4xl text-indigo-500"></i> : <i className="fas fa-camera text-4xl text-slate-500"></i>}
                </div>
                <p className="font-black text-slate-700 text-xl">{isProcessing ? 'กำลังประมวลผลด้วย AI...' : 'ถ่ายรูปหน้าบล็อก/สไลด์เพื่อสแกน'}</p>
                <p className="text-slate-400 text-sm mt-2 font-medium">จัดเรียงรายการให้ชัดเจนก่อนถ่าย</p>
              </div>
            ) : (
              <form onSubmit={handleManualAdd} className="mb-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Case ID</label>
                    <input 
                      ref={manualCaseRef}
                      type="text" 
                      value={manualData.caseId} 
                      onChange={e => setManualData({...manualData, caseId: e.target.value.toUpperCase()})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold transition-all text-black" 
                      placeholder="เช่น S24-12345"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Part / Section</label>
                    <input 
                      type="text" 
                      value={manualData.part} 
                      onChange={e => setManualData({...manualData, part: e.target.value.toUpperCase()})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold transition-all text-black" 
                      placeholder="เช่น A1 หรือ B"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all">
                  <i className="fas fa-plus mr-2"></i> เพิ่มรายการลงคิว
                </button>
              </form>
            )}

            {action === 'OUT' && (
              <div className="space-y-4 mb-8 bg-orange-50/50 p-6 rounded-3xl border-2 border-orange-100">
                <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-2">ข้อมูลผู้เบิก</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <input type="text" value={borrowerInfo.name} onChange={e => setBorrowerInfo({...borrowerInfo, name: e.target.value})} className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl outline-none font-bold text-black" placeholder="ชื่อผู้เบิก" />
                   <input type="number" value={borrowerInfo.quantity} onChange={e => setBorrowerInfo({...borrowerInfo, quantity: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl outline-none font-bold text-black" placeholder="จำนวน" />
                </div>
                <input type="text" value={borrowerInfo.reason} onChange={e => setBorrowerInfo({...borrowerInfo, reason: e.target.value})} className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl outline-none font-bold text-black" placeholder="เหตุผลการเบิก / โปรเจกต์" />
              </div>
            )}

            <button 
              disabled={isProcessing || scannedItems.length === 0} 
              onClick={finalizeTransaction} 
              className={`w-full py-5 rounded-2xl font-black text-lg transition-all text-white ${scannedItems.length === 0 ? 'bg-slate-200 cursor-not-allowed' : `bg-${actionTheme}-600 hover:bg-${actionTheme}-700 shadow-xl shadow-${actionTheme}-100`}`}
            >
              {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : `บันทึกรายการ ${action} ทั้งหมด`}
            </button>

            {resultsMessage && (
              <div className={`mt-8 p-5 rounded-2xl font-bold text-sm border-2 animate-in slide-in-from-top-2 ${resultsMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : resultsMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                <div className="flex items-center space-x-3">
                   <i className={`fas ${resultsMessage.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                   <span>{resultsMessage.text}</span>
                </div>
              </div>
            )}
        </div>

        {/* ฝั่งรายการที่สแกนแล้ว/คีย์แล้ว */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[700px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800">คิวรายการรอส่ง <span className="text-indigo-600">({scannedItems.length})</span></h3>
            {scannedItems.length > 0 && (
              <button onClick={() => setScannedItems([])} className="text-slate-400 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">ล้างคิว</button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-3">
            {scannedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fas fa-clipboard-list text-6xl mb-4 opacity-10"></i>
                <p className="font-bold opacity-30 text-center px-8">ไม่มีรายการในคิว กรุณาสแกนหรือคีย์ข้อมูล</p>
              </div>
            ) : (
              scannedItems.map((item, idx) => (
                <div key={idx} className="bg-white border-2 border-slate-50 rounded-2xl p-4 flex justify-between items-center group hover:border-indigo-200 transition-all shadow-sm">
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-tight">{item.caseId}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Part: {item.part} • {item.date}</p>
                  </div>
                  <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-full bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">ตรวจสอบรายการก่อนกดบันทึก</p>
          </div>
        </div>
      </div>

      {/* แบนเนอร์ตั้งค่า AI หากยังไม่มี Key */}
      {!hasKey && (
        <div className="mt-12 bg-indigo-50 border border-indigo-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between">
           <div className="flex items-center space-x-4 mb-4 md:mb-0">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
               <i className="fas fa-sparkles text-2xl"></i>
             </div>
             <div>
               <h4 className="font-black text-indigo-900 underline decoration-indigo-200 underline-offset-4">ต้องการใช้ระบบสแกนอัตโนมัติ?</h4>
               <p className="text-indigo-600 text-sm font-medium">คุณสามารถเชื่อมต่อ Gemini AI เพื่อสกัดข้อมูลจากรูปถ่ายได้ทันที</p>
             </div>
           </div>
           <button onClick={handleSetupKey} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
             เปิดใช้งาน AI SCAN
           </button>
        </div>
      )}
    </div>
  );
};

export default TrackingModule;
