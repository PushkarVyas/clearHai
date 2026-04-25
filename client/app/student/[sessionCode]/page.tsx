"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { socket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, Loader2, Maximize, Minimize, Settings2, Hand, MessageSquare, Send, MessageCircle, Heart, AlertTriangle } from "lucide-react";
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

function StudentPresentationContent() {
  const { sessionCode } = useParams() as { sessionCode: string };
  const searchParams = useSearchParams();
  const userName = searchParams.get('name') || "Anonymous";
  const router = useRouter();

  const [slide, setSlide] = useState<number | null>(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [pdfPages, setPdfPages] = useState<number>(0);
  const [isWhiteboardMode, setIsWhiteboardMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  const [feedback, setFeedback] = useState<"understood" | "not_understood" | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // Floating Panels
  const [showControls, setShowControls] = useState(true);
  const [showDoubtPopup, setShowDoubtPopup] = useState(false);
  const [doubtText, setDoubtText] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chat, setChat] = useState<{id: string, name: string, text: string, timestamp: number}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Classroom States
  const [isHandRaised, setIsHandRaised] = useState(false);

  // UI Interactive Hider
  const [uiVisible, setUiVisible] = useState(true);
  const hideUiTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      setUiVisible(true);
      if (hideUiTimeout.current) clearTimeout(hideUiTimeout.current);
      hideUiTimeout.current = setTimeout(() => {
        if (!showChat && !showDoubtPopup && !showControls && !isPaused && !isHandRaised) {
          setUiVisible(false);
        }
      }, 4000);
    };

    window.addEventListener("pointermove", handleActivity);
    window.addEventListener("pointerdown", handleActivity);
    handleActivity();
    return () => {
      window.removeEventListener("pointermove", handleActivity);
      window.removeEventListener("pointerdown", handleActivity);
      if (hideUiTimeout.current) clearTimeout(hideUiTimeout.current);
    }
  }, [showChat, showDoubtPopup, showControls, isPaused, isHandRaised]);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    const joinRoom = () => {
      socket.emit("join-session", { sessionCode, name: userName }, (response: any) => {
        if (!response.success) {
          alert("Session not found");
          router.push("/join");
        } else {
          setSlide(response.currentSlide);
          setIsWhiteboardMode(response.isWhiteboardMode || false);
          setHasPdf(response.hasPdf);
          setChat(response.chat || []);
          setIsPaused(response.isPaused || false);
          if (response.raisedHands?.find((r: any) => r.id === socket.id)) setIsHandRaised(true);
          setTimeout(() => renderAllStrokes(response.drawings || []), 100);
          setLoading(false);
        }
      });
    };

    joinRoom();

    socket.on("connect", () => {
      setIsConnected(true);
      joinRoom();
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("slide-changed", ({ currentSlide, drawings }: any) => {
      setSlide(currentSlide);
      setFeedback(null);
      clearCanvas();
      setTimeout(() => renderAllStrokes(drawings || []), 50);
    });

    socket.on("whiteboard-mode-changed", ({ isWhiteboardMode }: any) => {
      setIsWhiteboardMode(isWhiteboardMode);
      setTimeout(() => {
         socket.emit("join-session", { sessionCode, name: userName }, (response: any) => {
            renderAllStrokes(response.drawings || []);
         });
      }, 100);
    });

    socket.on("session-paused", ({ isPaused }) => setIsPaused(isPaused));

    socket.on("session-ended", () => {
       alert("The teacher has ended this session.");
       router.push('/');
    });

    socket.on("receive-message", (msg: any) => {
      setChat(prev => [...prev, msg]);
      if (!showChat) setUnreadCount(prev => prev + 1);
    });

    // --- DRAWING SYNC ---
    socket.on("start-draw", ({ slideNumber, point, color, size }) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.globalCompositeOperation = color === 'ERASER' ? 'destination-out' : 'source-over';
    });

    socket.on("draw-progress", ({ slideNumber, points }) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !points || points.length === 0) return;
      for (const p of points) {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    });

    socket.on("clear-lines", ({ slideNumber }) => clearCanvas());

    return () => {
      socket.off("slide-changed");
      socket.off("whiteboard-mode-changed");
      socket.off("receive-message");
      socket.off("start-draw");
      socket.off("draw-progress");
      socket.off("clear-lines");
      socket.off("session-paused");
      socket.off("session-ended");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [sessionCode, router, userName, showChat]);

  // Auto scroll chat
  useEffect(() => {
    if (showChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    }
  }, [chat, showChat]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const renderAllStrokes = (drawings: any[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const strokeData of drawings) {
      if (!strokeData.points || strokeData.points.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(strokeData.points[0].x, strokeData.points[0].y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeData.color;
      ctx.lineWidth = strokeData.size;
      ctx.globalCompositeOperation = strokeData.color === 'ERASER' ? 'destination-out' : 'source-over';
      for (let i = 1; i < strokeData.points.length; i++) {
        ctx.lineTo(strokeData.points[i].x, strokeData.points[i].y);
      }
      ctx.stroke();
    }
  };

  const submitFeedback = (type: "understood" | "not_understood") => {
    if (!slide) return;
    setFeedback(type);
    socket.emit("submit-feedback", { sessionCode, slideNumber: slide, feedback: type });
  };

  const submitDoubt = () => {
    if (!doubtText.trim()) return;
    socket.emit("ask-doubt", { sessionCode, text: doubtText.trim() }, () => {
      setDoubtText("");
      setShowDoubtPopup(false);
    });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit("send-message", { sessionCode, name: userName, text: chatInput });
    setChatInput("");
  };
  
  const toggleRaiseHand = () => {
    if (isHandRaised) {
      socket.emit("lower-hand", { sessionCode });
      setIsHandRaised(false);
    } else {
      socket.emit("raise-hand", { sessionCode });
      setIsHandRaised(true);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="hq-screen w-full bg-slate-900 flex items-center justify-center flex-col gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative font-sans flex flex-col items-center justify-center selection:bg-indigo-100 touch-none">
      
      {/* 1. DOMINANT FULL SCREEN SLIDE */}
      <div className={`w-full h-full relative flex items-center justify-center overflow-hidden transition-all duration-700 ${isPaused ? 'opacity-30 blur-sm scale-95' : 'opacity-100 scale-100'}`}>
        {!isWhiteboardMode ? (
          hasPdf ? (
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#2b2b2b]">
              <PDFViewer
                sessionCode={sessionCode}
                slide={slide || 1}
                pdfPages={pdfPages}
                setPdfPages={setPdfPages}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                pageClassName="shadow-2xl"
              />
            </div>
          ) : (
            <motion.img 
              key={slide}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              src={`https://placehold.co/1920x1080/2b2b2b/4f46e5?text=Slide+${slide}&font=montserrat`}
              alt={`Slide ${slide}`}
              className="w-full h-full object-contain absolute inset-0 z-0"
            />
          )
        ) : (
          <div className="absolute inset-0 bg-white" />
        )}
        
        {/* Canvas Sync Overlay */}
        <canvas 
          ref={canvasRef}
          className="w-full h-full absolute inset-0 z-10 pointer-events-none"
        />
      </div>

      {/* ============================================================== */}
      {/* DISTRACTION-FREE UI LAYER */}
      {/* ============================================================== */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${(uiVisible || isPaused) ? 'opacity-100' : 'opacity-0'}`}>
        
        <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
          {!isConnected && (
            <div className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-lg cursor-default pointer-events-auto">
              <Loader2 className="w-4 h-4 animate-spin" /> Reconnecting
            </div>
          )}
          <div className="bg-black/95 text-white px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-lg cursor-default pointer-events-auto">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" /> 
             {isWhiteboardMode ? "Live Whiteboard" : `Slide ${slide} Live`}
          </div>
        </div>

        <div className="absolute top-6 right-6 z-30 flex gap-2 pointer-events-auto">
          <button onClick={toggleFullscreen} className="p-4 bg-black/95 hover:bg-black text-white/80 hover:text-white rounded-2xl shadow-lg border border-white/10 transition-colors">
            {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          </button>
        </div>

        {/* OVERLAY POLL AND CHAT CONTROLS */}
        <div className={`absolute inset-x-0 bottom-8 z-50 flex justify-center pointer-events-none transition-all duration-700 ease-in-out ${isPaused ? 'bottom-[35vh] scale-[1.15]' : ''}`}>
          <motion.div 
            drag={!isPaused} dragConstraints={!isPaused ? { top: -500, right: 200, bottom: 20, left: -200 } : undefined} dragElastic={0.1} dragMomentum={false}
            className={`cursor-grab active:cursor-grabbing pointer-events-auto flex flex-col items-center gap-3 w-[90vw] sm:w-[380px] ${isPaused ? 'cursor-default active:cursor-default' : ''}`}
            style={{ touchAction: "none" }}
          >
            {/* Context Notice for Paused Mode */}
            <AnimatePresence>
              {isPaused && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
                  <div className="inline-block bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-4 py-1.5 rounded-full font-bold text-sm tracking-widest uppercase mb-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    Session Paused
                  </div>
                  <h2 className="text-2xl font-black text-white px-4 leading-tight">Teacher requested your feedback.</h2>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top minimal dock buttons - Hide when paused since we want them to focus entirely on answering */}
            <AnimatePresence>
              {!isPaused && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 relative bg-black/95 p-3 rounded-[2rem] border border-white/10 shadow-lg">
                  
                  <button onClick={() => { setShowChat(!showChat); setShowControls(false); setShowDoubtPopup(false); setUnreadCount(0); }} 
                    className={`p-4 shadow-md rounded-full transition-colors flex items-center gap-2 relative ${showChat ? 'bg-indigo-600 text-white' : 'bg-transparent text-white/80 hover:bg-white/10'}`}>
                    <MessageCircle className="w-6 h-6" />
                    {unreadCount > 0 && !showChat && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-transparent">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setShowDoubtPopup(!showDoubtPopup); setShowControls(false); setShowChat(false); }} 
                    className={`p-4 shadow-md rounded-full transition-colors flex items-center gap-2 ${showDoubtPopup ? 'bg-indigo-600 text-white' : 'bg-transparent text-white/80 hover:bg-white/10'}`}>
                    <MessageSquare className="w-6 h-6" />
                  </button>
                  
                  <div className="w-px h-10 bg-white/10 self-center mx-2" />
                  
                  <button onClick={() => { setShowControls(!showControls); setShowDoubtPopup(false); setShowChat(false); }} 
                    className={`p-4 shadow-md rounded-full transition-colors flex items-center gap-2 ${showControls ? 'bg-indigo-600 text-white' : 'bg-transparent text-white/80 hover:bg-white/10'}`}>
                    <Settings2 className="w-6 h-6" />
                  </button>
                  <button onClick={toggleRaiseHand} 
                    className={`p-4 shadow-md rounded-full transition-transform active:scale-95 flex items-center gap-2 ${isHandRaised ? 'bg-yellow-500 text-black shadow-yellow-500/30 font-bold' : 'bg-transparent text-white/80 hover:bg-white/10'}`}>
                    <Hand className="w-6 h-6" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Doubt Input Popup */}
            <AnimatePresence>
              {showDoubtPopup && !isPaused && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="w-full bg-black/95 p-6 rounded-[2rem] shadow-2xl border border-white/10 text-white"
                >
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 cursor-grab active:cursor-grabbing shrink-0" />
                  <h3 className="text-center font-extrabold mb-3 px-2 text-lg tracking-tight">Ask a Doubt</h3>
                  <textarea value={doubtText} onChange={e => setDoubtText(e.target.value)} placeholder="I didn't understand the..."
                    className="w-full text-base p-5 bg-white/10 border border-white/10 rounded-[1.25rem] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-28 font-medium text-white placeholder-white/40"
                  />
                  <button onClick={submitDoubt} disabled={!doubtText.trim()} className="mt-4 w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-colors active:scale-95 text-lg">
                    Send to Teacher <Send className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat System UI */}
            <AnimatePresence>
              {showChat && !isPaused && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="w-full bg-black/95 p-6 rounded-[2rem] shadow-2xl border border-white/10 flex flex-col max-h-[50vh] text-white"
                >
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 cursor-grab shrink-0" />
                  <h3 className="text-center font-extrabold mb-3 text-lg tracking-tight shrink-0">Class Chat</h3>
                  <div className="flex-1 overflow-y-auto mb-3 space-y-3 pr-2 scrollbar-hide">
                     {chat.length === 0 ? (
                       <p className="text-center text-sm font-medium text-slate-500 py-10 italic">No messages yet.</p>
                     ) : (
                       chat.map(m => (
                         <div key={m.id} className="flex flex-col gap-1 items-start">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.name}</span>
                           <div className={`text-sm py-2 px-3.5 rounded-3xl font-semibold border ${m.name === userName ? 'bg-indigo-600 text-white border-indigo-500/50 rounded-tl-sm' : m.name === 'Teacher' ? 'bg-white text-black border-transparent' : 'bg-white/10 text-white border-white/5 rounded-tr-sm'}`}>
                             {m.text}
                           </div>
                         </div>
                       ))
                     )}
                     <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={sendMessage} className="flex gap-2 shrink-0">
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..."
                      className="flex-1 text-base p-4 bg-white/10 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-white/30"
                    />
                    <button type="submit" disabled={!chatInput.trim()} className="px-5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Feedback Poll UI */}
            <AnimatePresence>
              {(showControls || isPaused) && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className={`w-full bg-black/95 p-6 rounded-[2.5rem] shadow-2xl border ${isPaused ? 'border-yellow-500/50 scale-100' : 'border-white/10'} pointer-events-auto text-white transition-all`}
                >
                  {!isPaused && <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing shrink-0" />}
                  <h3 className="text-center font-extrabold mb-5 px-2 text-xl tracking-tight">Are you keeping up?</h3>
                  <div className="flex gap-4">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => submitFeedback("understood")}
                      className={`flex-1 p-5 rounded-[1.5rem] border-2 transition-all duration-300 flex flex-col items-center gap-4 ${
                        feedback === "understood" ? "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20 transform scale-[1.02]" : "bg-white/5 border-white/10 shadow-sm hover:bg-white/10"
                      }`}
                    >
                      <div className={`p-4 rounded-full ${feedback === "understood" ? "bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "bg-white/10 text-green-400"}`}>
                        <ThumbsUp className="w-7 h-7" />
                      </div>
                      <span className={`text-sm font-extrabold ${feedback === "understood" ? "text-green-400" : "text-slate-300"}`}>
                        Understood
                      </span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => submitFeedback("not_understood")}
                      className={`flex-1 p-5 rounded-[1.5rem] border-2 transition-all duration-300 flex flex-col items-center gap-4 ${
                        feedback === "not_understood" ? "bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20 transform scale-[1.02]" : "bg-white/5 border-white/10 shadow-sm hover:bg-white/10"
                      }`}
                    >
                      <div className={`p-4 rounded-full ${feedback === "not_understood" ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "bg-white/10 text-red-400"}`}>
                        <ThumbsDown className="w-7 h-7" />
                      </div>
                      <span className={`text-sm font-extrabold ${feedback === "not_understood" ? "text-red-400" : "text-slate-300"}`}>
                        Need Help
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function PresentationStudent() {
  return (
    <Suspense fallback={
      <div className="w-screen h-screen bg-slate-900 flex items-center justify-center flex-col gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    }>
      <StudentPresentationContent />
    </Suspense>
  );
}
