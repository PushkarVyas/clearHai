"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, UploadCloud, ArrowRight, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function CreateSession() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/session/create`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (data.success) {
        setSessionCode(data.sessionCode);
      } else {
        alert(data.error || "Server error creating session");
      }
    } catch (e) {
      console.error(e);
      alert("Error contacting backend. Is node running?");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/join?code=${sessionCode}`;
    navigator.clipboard.writeText(link);
    alert("Join link copied!");
  };

  const goDashboard = () => {
    router.push(`/teacher/${sessionCode}`);
  };

  if (sessionCode) {
    const link = `${window.location.origin}/join?code=${sessionCode}`;
    return (
     <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 max-w-lg w-full text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-green-50 rounded-bl-full z-0 pointer-events-none" />
          
          <div className="relative z-10 w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner border border-green-200">🎉</div>
          <h1 className="relative z-10 text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Session Ready!</h1>
          <p className="relative z-10 text-slate-500 mb-8 font-medium">Students can scan to join instantly</p>
          
          <div className="relative z-10 p-5 bg-slate-50 rounded-3xl border border-slate-200 inline-block mb-8 shadow-sm">
            <QRCodeSVG value={link} size={220} className="text-slate-800" />
          </div>
          
          <div className="relative z-10 bg-indigo-50 px-6 py-5 rounded-2xl border border-indigo-100 flex items-center justify-between mb-8 text-left shadow-sm">
            <div>
              <p className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest mb-1.5">Session Code</p>
              <p className="text-4xl font-black text-indigo-700 tracking-[0.2em] font-mono leading-none">{sessionCode}</p>
            </div>
            <button onClick={copyLink} className="p-3 bg-white rounded-xl shadow-sm border border-indigo-100 hover:text-indigo-600 hover:border-indigo-300 transition-colors active:scale-95">
              <Copy className="w-5 h-5" />
            </button>
          </div>
          
          <button onClick={goDashboard} className="relative z-10 w-full bg-slate-900 text-white font-extrabold text-lg py-4 rounded-2xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-xl shadow-slate-200 active:scale-95 border border-slate-700">
            Enter Dashboard <ArrowRight className="w-5 h-5" />
          </button>
        </div>
     </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 max-w-lg w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full z-0 pointer-events-none" />
        
        <h1 className="relative z-10 text-3xl font-extrabold text-slate-800 mb-3 tracking-tight">Create a Session</h1>
        <p className="relative z-10 text-slate-500 mb-8 font-medium">Upload presentation slides (PDF only) to start a live synced class.</p>
        
        <div className="relative z-10 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-10 text-center bg-slate-50 transition-colors mb-8 cursor-pointer overflow-hidden group">
          <input 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
          />
          <div className={`transition-transform duration-500 ease-out ${file ? 'scale-90 opacity-0' : 'scale-100 opacity-100'} relative z-10`}>
            <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
               <UploadCloud className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="text-slate-700 font-extrabold mb-1 tracking-tight text-lg">Upload PDF (Export your PPT as PDF)</p>
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest mt-2">Supports .pdf</p>
          </div>
          
          {file && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-50 border border-indigo-200 z-10 p-6">
               <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-sm text-indigo-600 border border-indigo-100">
                 <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
               </div>
               <p className="font-extrabold text-indigo-800 text-lg truncate w-full px-4">{file.name}</p>
               <p className="text-xs font-bold text-indigo-400 mt-2 uppercase tracking-widest">Ready to upload</p>
               <div className="absolute top-3 right-4 z-20 cursor-pointer text-indigo-300 hover:text-indigo-600 font-bold text-sm" onClick={(e) => { e.preventDefault(); setFile(null); }}>
                 Clear
               </div>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleCreate} 
          disabled={loading || !file} // Require file for MVP per user request, though generic sessions might skip it. Let's make it required.
          className="relative z-10 w-full bg-indigo-600 text-white font-extrabold text-lg py-4 rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95"
        >
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Preparing Slides...</> : "Start Session"}
        </button>
      </div>
    </div>
  );
}
