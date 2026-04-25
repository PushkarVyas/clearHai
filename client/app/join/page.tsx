"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

function JoinSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadCode = searchParams.get('code') || "";
  
  const [code, setCode] = useState(preloadCode);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preloadCode) {
      setCode(preloadCode.toUpperCase());
    }
  }, [preloadCode]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6 && name.trim()) {
      setLoading(true);
      router.push(`/student/${code.toUpperCase()}?name=${encodeURIComponent(name.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 max-w-sm w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full z-0 pointer-events-none" />
        
        <h1 className="relative z-10 text-3xl font-extrabold text-slate-800 mb-2 tracking-tight text-center">Join Class</h1>
        <p className="relative z-10 text-slate-500 mb-8 font-medium text-center">Enter your name and class code.</p>
        
        <form onSubmit={handleJoin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 ml-1">Your Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g. John Doe"
              required
              className="w-full text-lg p-4 bg-slate-50 border border-slate-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 ml-1">Session Code</label>
            <input 
              type="text" 
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              required
              className="w-full text-2xl p-4 text-center tracking-[0.3em] font-mono font-black bg-slate-50 border border-slate-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-700 transition-shadow uppercase"
            />
          </div>
          <button 
            type="submit"
            disabled={code.length !== 6 || !name.trim() || loading}
            className="w-full mt-6 bg-indigo-600 text-white font-extrabold text-lg py-4 rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95"
          >
            {loading ? "Joining..." : "Enter Class"} <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinSession() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <JoinSessionContent />
    </Suspense>
  );
}
