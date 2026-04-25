"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const REACTIONS = ["👍", "❓", "😕", "✅", "👍"];

export default function LandingPage() {
  const [demoStats, setDemoStats] = useState({ u: 72, n: 28 });
  const [floatingItems, setFloatingItems] = useState<{id: number, emoji: string, x: number}[]>([]);

  // Simulate live demo activity
  useEffect(() => {
    const interval = setInterval(() => {
      setDemoStats(prev => {
        const jump = Math.floor(Math.random() * 5) - 2; 
        let newU = prev.u + jump;
        if (newU > 95) newU = 95;
        if (newU < 60) newU = 60;
        return { u: newU, n: 100 - newU };
      });

      if (Math.random() > 0.4) {
        setFloatingItems(fi => [...fi, { 
          id: Date.now(), 
          emoji: REACTIONS[Math.floor(Math.random() * REACTIONS.length)],
          x: Math.floor(Math.random() * 80) + 10 // keep inside bounds
        }].slice(-6));
      }
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden w-full">
      
      {/* 1. HERO SECTION */}
      <section className="relative w-full max-w-[1400px] mx-auto px-6 py-20 lg:py-32 flex flex-col lg:flex-row items-center justify-between gap-16 z-10">
        
        {/* Left: Copy & CTA */}
        <div className="flex-1 w-full max-w-2xl text-center lg:text-left z-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-600 font-semibold text-sm mb-6 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              Real-time Feedback Platform
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
              Class me sabko <br className="hidden lg:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600">
                clear hai?
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              See confusion live. Fix it instantly. No signups or complex tools. Give your students a voice without the noise.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center gap-4 pt-8 justify-center lg:justify-start"
          >
            <Link href="/create-session" className="w-full sm:w-auto">
              <button className="group relative w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-[0_0_40px_-10px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.7)] hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                Start Session
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/join" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg shadow-sm hover:shadow-md transition-all active:scale-95">
                Join Session
              </button>
            </Link>
          </motion.div>
        </div>

        {/* Right: Live Demo Mock */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, x: 20 }} 
          animate={{ opacity: 1, scale: 1, x: 0 }} 
          transition={{ duration: 0.7, type: "spring", bounce: 0.4 }}
          className="flex-1 w-full max-w-[500px] relative z-20 perspective-[1000px] mx-auto lg:mx-0 shrink-0"
        >
          {/* Floating Reactions overlay container */}
          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-[2rem]">
            <AnimatePresence>
              {floatingItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: '100%', left: `${item.x}%`, scale: 0.5 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0], 
                    y: ['100%', '30%', '-20%', '-40%'], 
                    scale: [0.5, 1.2, 1, 0.8], 
                    left: [`${item.x}%`, `${item.x + (Math.random() * 20 - 10)}%`] 
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 3.5, ease: "easeOut" }}
                  className="absolute bottom-0 text-4xl filter drop-shadow-md"
                  style={{ transformOrigin: 'center bottom' }}
                >
                  {item.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] p-8 sm:p-10 rounded-[2.5rem] transform lg:-rotate-2 hover:rotate-0 transition-transform duration-500 ease-out z-20 relative">
            <div className="flex justify-between items-center mb-10">
              <div className="h-4 w-32 bg-slate-200/60 rounded-full animate-pulse" />
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-1">Slide</p>
                <p className="text-4xl font-extrabold text-indigo-600 leading-none">5</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex justify-between items-end px-2">
                <div>
                  <motion.p className="text-5xl font-extrabold text-green-500 leading-none"
                    key={demoStats.u} initial={{ scale: 1.15, color: '#22c55e' }} animate={{ scale: 1, color: '#16a34a' }} transition={{ duration: 0.3 }}
                  >
                    {demoStats.u}%
                  </motion.p>
                  <p className="text-sm font-semibold text-slate-500 mt-2">Understood</p>
                </div>
                <div className="text-right">
                  <motion.p className="text-5xl font-extrabold text-red-500 leading-none"
                    key={demoStats.n} initial={{ scale: 1.15, color: '#ef4444' }} animate={{ scale: 1, color: '#dc2626' }} transition={{ duration: 0.3 }}
                  >
                    {demoStats.n}%
                  </motion.p>
                  <p className="text-sm font-semibold text-slate-500 mt-2">Need Help</p>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="h-10 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner relative p-1 pb-1">
                <motion.div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full shrink-0"
                  animate={{ width: `${demoStats.u}%` }}
                  transition={{ type: "spring", bounce: 0, duration: 0.8 }}
                />
                <div className="w-1 shrink-0 bg-transparent" />
                <motion.div 
                  className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full min-w-0"
                  animate={{ width: `${demoStats.n}%` }}
                  transition={{ type: "spring", bounce: 0, duration: 0.8 }}
                />
              </div>

              {/* Mock Incoming avatars */}
              <div className="pt-6 flex items-center justify-center -space-x-3">
                {[...Array(6)].map((_, i) => (
                  <motion.div 
                    key={i} 
                    animate={{ y: [0, -8, 0] }} 
                    transition={{ delay: i * 0.15, repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    className="w-12 h-12 rounded-full border-[3px] border-white bg-slate-200 z-10 shadow-sm flex items-center justify-center overflow-hidden bg-white"
                  >
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+25}&backgroundColor=c0aede,b6e3f4,ffdfbf`} alt="avatar" className="w-full h-full object-cover" />
                  </motion.div>
                ))}
                <div className="w-12 h-12 rounded-full border-[3px] border-white bg-indigo-100 z-10 shadow-sm flex items-center justify-center text-sm font-bold text-indigo-700">
                  +42
                </div>
              </div>
            </div>
          </div>
          
          {/* Background Ambient Glows */}
          <div className="absolute top-0 right-10 w-[120%] h-[120%] bg-indigo-400/20 rounded-full blur-[100px] z-0 pointer-events-none transform -translate-y-10" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-300/20 rounded-full blur-[80px] z-0 pointer-events-none" />

        </motion.div>
      </section>

      {/* 2. TICKER STRIP */}
      <div className="w-full bg-indigo-600 text-indigo-50 py-4 overflow-hidden shadow-inner transform -rotate-1 relative z-20 border-y border-indigo-500 box-border -mx-2">
        <motion.div 
          className="whitespace-nowrap flex gap-12 text-sm font-bold tracking-widest uppercase items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          style={{ width: "200%" }}
        >
          {/* We duplicate the array 4 times to ensure seamless infinite scroll */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-16 items-center shrink-0">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Live Demo Active
              </span>
              <span className="text-indigo-400/50">•</span>
              <span className="text-indigo-200 backdrop-blur-sm">Slide 3 Spike Detected</span>
              <span className="text-indigo-400/50">•</span>
              <span className="text-indigo-900 bg-indigo-100 px-3 py-1 rounded-lg">60% Confused</span>
              <span className="text-indigo-400/50">•</span>
              <span>Teacher Alerted</span>
              <span className="text-indigo-400/50">•</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* 3. INTERACTIVE FEATURES & DEMO WALKTHROUGH */}
      <section className="relative w-full max-w-7xl mx-auto px-6 py-24 lg:py-32 space-y-32 z-10">
        
        {/* Features Blocks */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-10">
          
          {/* Block 1: Live Feedback Chart */}
          <div className="group bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(79,70,229,0.08)] transition-all duration-300 overflow-hidden relative h-[340px] flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
            <div className="space-y-3 z-10">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Live Analytics</h3>
              <p className="text-sm text-slate-500 font-medium">Watch metrics adjust instantly as you teach, no lag.</p>
            </div>
            {/* Animated Bars mock */}
            <div className="flex items-end gap-3 h-32 mt-auto pb-2">
              {[40, 70, 45, 90, 65].map((h, i) => (
                <motion.div 
                  key={i} 
                  initial={{ height: "20%" }}
                  whileInView={{ height: `${h}%` }}
                  transition={{ duration: 1, delay: i * 0.1, type: "spring", bounce: 0.3 }}
                  viewport={{ once: true, margin: "-50px" }}
                  className="flex-1 bg-indigo-50 rounded-t-xl relative overflow-hidden group-hover:bg-indigo-100 transition-colors"
                >
                  <motion.div 
                    className="absolute bottom-0 w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-xl" 
                    initial={{ height: "10%" }}
                    whileInView={{ height: `${h * 0.8}%` }}
                    transition={{ duration: 1.2, delay: i * 0.1 + 0.2 }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Block 2: No Login Needed */}
          <div className="group bg-slate-900 rounded-[2rem] p-8 shadow-2xl overflow-hidden relative h-[340px] flex flex-col justify-between">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 z-0" />
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />

             <div className="space-y-3 z-10 text-white relative">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 backdrop-blur-sm border border-white/10">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <h3 className="text-2xl font-bold">Zero Friction</h3>
              <p className="text-sm text-indigo-200 font-medium leading-relaxed">No signups for students. Just point camera and vote.</p>
            </div>
            
            <motion.div 
              className="z-10 mt-auto flex items-center gap-5 bg-white/10 p-5 rounded-2xl backdrop-blur-md border border-white/10 transform group-hover:-translate-y-2 group-hover:bg-white/20 transition-all duration-300"
            >
              <div className="bg-white p-2.5 rounded-xl shrink-0">
                 <QRCodeSVG value="https://clearhai.com" size={56} className="text-slate-900" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Code</p>
                <p className="text-3xl font-bold text-white tracking-[0.2em] leading-none">A4K9</p>
              </div>
            </motion.div>
          </div>

          {/* Block 3: Smart Alerts */}
          <div className="group bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(239,68,68,0.1)] hover:border-red-100 transition-all duration-300 overflow-hidden relative h-[340px] flex flex-col justify-between bg-gradient-to-b from-white to-red-50/20">
             <div className="space-y-3 z-10 relative">
               <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 group-hover:bg-red-100 transition-transform duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Smart UI Alerts</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Get subtle notifications when the class drops below 40% comprehension.</p>
            </div>
            
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4, delay: 0.2 }}
              viewport={{ once: true, margin: "-50px" }}
              className="mt-auto bg-white border border-red-100 shadow-[0_20px_40px_-10px_rgba(239,68,68,0.2)] p-5 rounded-2xl flex items-start gap-4 z-10 relative group-hover:-translate-y-2 transition-transform duration-300"
            >
              <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <p className="font-bold text-red-600 text-sm leading-tight">High confusion detected</p>
                <p className="text-xs text-red-400 leading-tight font-medium">68% of students need help on Slide 4.</p>
              </div>
            </motion.div>
          </div>

        </div>

        {/* Walkthrough - Visual Steps */}
        <div className="text-center space-y-20 relative z-10">
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">How it works</h2>
            <p className="text-slate-500 text-lg md:text-xl font-medium">Three simple steps to a highly engaged classroom.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12 lg:gap-8 relative lg:pt-10">
             {/* Dynamic Connecting line */}
             <div className="hidden lg:block absolute top-[50%] left-24 right-24 h-1 bg-gradient-to-r from-indigo-100 via-indigo-300 to-indigo-100 z-0 rounded-full opacity-50" />

             {/* Step 1 */}
             <div className="relative z-10 flex flex-col items-center group">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.05)] text-indigo-600 font-extrabold flex items-center justify-center text-2xl mb-8 group-hover:bg-indigo-50 group-hover:scale-110 transition-all duration-300">1</div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-sm aspect-video flex flex-col justify-center items-center group-hover:-translate-y-3 transition-transform duration-500 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full z-0 transition-transform group-hover:scale-110" />
                  <button className="relative z-10 px-8 py-4 bg-indigo-600 shadow-lg shadow-indigo-600/30 text-white font-bold rounded-2xl flex items-center gap-3 active:scale-95 transition-transform cursor-default pointer-events-none">
                    Start Session
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <p className="relative z-10 mt-6 text-sm font-bold text-slate-400 tracking-wide uppercase">Teacher initiates</p>
                </div>
             </div>

             {/* Step 2 */}
             <div className="relative z-10 flex flex-col items-center group">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.05)] text-indigo-600 font-extrabold flex items-center justify-center text-2xl mb-8 group-hover:bg-indigo-50 group-hover:scale-110 transition-all duration-300">2</div>
                <div className="bg-slate-900 p-8 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] w-56 mx-auto flex flex-col justify-center items-center group-hover:-translate-y-3 transition-transform duration-500 relative overflow-hidden border-4 border-slate-800">
                  <div className="absolute -inset-x-10 top-0 h-20 bg-gradient-to-b from-white/5 to-transparent z-0" />
                  <div className="w-full space-y-4 z-10">
                    <div className="w-full bg-green-500/20 border border-green-500/30 p-5 rounded-3xl flex justify-center text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors duration-300">
                      <ThumbsUp className="w-8 h-8" />
                    </div>
                    <div className="w-full bg-red-400/10 border border-red-500/20 p-5 rounded-3xl flex justify-center text-red-400/50">
                      <ThumbsDown className="w-8 h-8" />
                    </div>
                  </div>
                  <p className="mt-6 text-xs font-bold text-slate-400 uppercase tracking-widest z-10">Students Tap</p>
                </div>
             </div>

             {/* Step 3 */}
             <div className="relative z-10 flex flex-col items-center group">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.05)] text-indigo-600 font-extrabold flex items-center justify-center text-2xl mb-8 group-hover:bg-indigo-50 group-hover:scale-110 transition-all duration-300">3</div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-sm aspect-video flex flex-col justify-center gap-5 group-hover:-translate-y-3 transition-transform duration-500 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-green-400/10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="flex justify-between items-center w-full relative z-10">
                    <p className="font-extrabold text-slate-800 text-lg">Slide 12</p>
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold tracking-wider rounded-xl shadow-sm">+14 Votes</span>
                  </div>
                  <div className="h-8 w-full bg-slate-100 rounded-full overflow-hidden flex relative z-10 p-1">
                    <motion.div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full" initial={{ width: "20%" }} whileInView={{ width: "85%" }} transition={{ duration: 1.5, type: "spring" }} viewport={{ once: true }} />
                    <div className="w-1 bg-transparent" />
                    <motion.div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full" initial={{ width: "80%" }} whileInView={{ width: "15%" }} transition={{ duration: 1.5, type: "spring" }} viewport={{ once: true }} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wide relative z-10 mt-2">Dashboard Updates Live</p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-14 px-6 mt-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="font-extrabold text-3xl text-slate-800 tracking-tight">clearHai<span className="text-indigo-600">?</span></p>
          <div className="flex items-center gap-2">
			  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
			  <p className="text-slate-500 text-sm font-semibold tracking-wide">Live feedback, zero friction.</p>
		  </div>
        </div>
      </footer>
    </main>
  );
}
