"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { ChevronLeft, ChevronRight, AlertTriangle, Maximize, Minimize, BarChart2, MessageSquare, PenTool, Eraser, Plus, Trash2, MessageCircle, Send, Loader2, Hand, Move, Pause, Play, Bookmark, Eye, Flag, CheckCircle, Power } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

export default function PresentationTeacher() {
  const { sessionCode } = useParams() as { sessionCode: string };
  const router = useRouter();

  const [slide, setSlide] = useState(1);
  const [isWhiteboardMode, setIsWhiteboardMode] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);
  const [pdfPages, setPdfPages] = useState<number>(0);

  const [stats, setStats] = useState({ understood: 0, not_understood: 0 });
  const [allStats, setAllStats] = useState<Record<number, {understood: number, not_understood: number}>>({});
  const [alertMsg, setAlertMsg] = useState("");
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // UI Interaction State
  const [uiVisible, setUiVisible] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const hideUiTimeout = useRef<NodeJS.Timeout | null>(null);

  // Classroom States
  const [isPaused, setIsPaused] = useState(false);
  const [pauseTimer, setPauseTimer] = useState(0);
  const pauseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [raisedHands, setRaisedHands] = useState<{id: string, name: string}[]>([]);
  
  const [sessionEnded, setSessionEnded] = useState(false);

  // Floating Panels State
  const [showStats, setShowStats] = useState(false);
  const [showDoubts, setShowDoubts] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Custom Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingView = useRef(false);
  const dragStartView = useRef({ x: 0, y: 0 });

  const onWheelZoom = (e: React.WheelEvent) => {
    if (isDrawingMode) return;
    const zoomIntensity = 0.05;
    const newScale = Math.min(Math.max(0.5, scale + (e.deltaY < 0 ? zoomIntensity : -zoomIntensity)), 5);
    setScale(newScale);
  };

  const onPanStart = (e: React.PointerEvent) => {
    if (isDrawingMode) return;
    isDraggingView.current = true;
    dragStartView.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const onPanMove = (e: React.PointerEvent) => {
    if (!isDraggingView.current || isDrawingMode) return;
    setPosition({ x: e.clientX - dragStartView.current.x, y: e.clientY - dragStartView.current.y });
  };

  const onPanEnd = () => {
    isDraggingView.current = false;
  };
  
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [color, setColor] = useState("#4f46e5");
  const [size, setSize] = useState(4);
  const isDrawing = useRef(false);
  const currentStroke = useRef({ points: [] as {x:number, y:number}[], color: "#4f46e5", size: 4 });
  const lastEmitTime = useRef(0);
  const pendingEmitPoints = useRef<{x:number, y:number}[]>([]);

  // Users, Doubts, Chat
  const [doubts, setDoubts] = useState<{id: string, text: string, timestamp: number}[]>([]);
  const [chat, setChat] = useState<{id: string, name: string, text: string, timestamp: number}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevStats = useRef(stats);

  const total = stats.understood + stats.not_understood;
  const understoodPct = total === 0 ? 0 : Math.round((stats.understood / total) * 100);
  const notUnderstoodPct = total === 0 ? 0 : Math.round((stats.not_understood / total) * 100);
  const isHighConfusion = notUnderstoodPct > 60;

  useEffect(() => {
    if (isFocusMode) {
      setUiVisible(false);
      return;
    }
    const handleActivity = () => {
      setUiVisible(true);
      if (hideUiTimeout.current) clearTimeout(hideUiTimeout.current);
      hideUiTimeout.current = setTimeout(() => {
        if (!showChat && !showDoubts && !showStats && !isDrawingMode) {
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
  }, [showChat, showDoubts, showStats, isDrawingMode, isFocusMode]);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    const joinRoom = () => {
      socket.emit("join-session", { sessionCode, name: "Teacher" }, (response: any) => {
        if (!response.success) {
          alert("Session not found");
          router.push("/");
        } else {
          setSlide(response.currentSlide);
          setIsWhiteboardMode(response.isWhiteboardMode || false);
          setHasPdf(response.hasPdf);
          setStats(response.responses);
          setAllStats(prev => ({ ...prev, [response.currentSlide]: response.responses }));
          prevStats.current = response.responses;
          setDoubts(response.doubts || []);
          setChat(response.chat || []);
          setIsPaused(response.isPaused || false);
          setBookmarks(response.bookmarks || []);
          setRaisedHands(response.raisedHands || []);
          setTimeout(() => renderAllStrokes(response.drawings || []), 100);
        }
      });
    };

    joinRoom();

    socket.on("connect", () => {
      setIsConnected(true);
      joinRoom(); // Silently rejoin session to sync states if dropped
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("stats-updated", ({ slideNumber, responses }: any) => {
      setAllStats(prev => ({ ...prev, [slideNumber]: responses }));
      if (slideNumber !== slide) return; 
      
      setStats(responses);
      prevStats.current = responses;
    });

    socket.on("user-count-update", (count) => setUserCount(count));

    socket.on("auto-alert", ({ message }: any) => {
      setAlertMsg(message);
      setTimeout(() => setAlertMsg(""), 6000);
    });

    socket.on("new-doubt", (doubt) => {
      setDoubts(prev => [doubt, ...prev]);
      if (!showDoubts) {
        setAlertMsg("💬 New doubt asked!");
        setTimeout(() => setAlertMsg(""), 4000);
      }
    });

    socket.on("receive-message", (msg) => {
      setChat(prev => [...prev, msg]);
      if (!showChat) setUnreadChatCount(prev => prev + 1);
    });

    socket.on("slide-changed", ({ currentSlide, responses, drawings }: any) => {
      setSlide(currentSlide);
      setStats(responses);
      setAllStats(prev => ({ ...prev, [currentSlide]: responses }));
      prevStats.current = responses;
      setTimeout(() => renderAllStrokes(drawings || []), 50);
    });

    socket.on("whiteboard-mode-changed", ({ isWhiteboardMode }: any) => {
      setIsWhiteboardMode(isWhiteboardMode);
      setTimeout(() => {
         socket.emit("join-session", { sessionCode, name: "Teacher" }, (response: any) => {
            renderAllStrokes(response.drawings || []);
         });
      }, 100);
    });

    socket.on("session-paused", ({ isPaused }) => setIsPaused(isPaused));
    socket.on("bookmarks-updated", ({ bookmarks }) => setBookmarks(bookmarks));
    socket.on("raised-hands-updated", ({ raisedHands }) => setRaisedHands(raisedHands));

    return () => {
      socket.off("stats-updated");
      socket.off("auto-alert");
      socket.off("new-doubt");
      socket.off("slide-changed");
      socket.off("receive-message");
      socket.off("user-count-update");
      socket.off("whiteboard-mode-changed");
      socket.off("session-paused");
      socket.off("bookmarks-updated");
      socket.off("raised-hands-updated");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [sessionCode, router, slide, showStats, showDoubts, showChat]);

  useEffect(() => {
    if (showChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadChatCount(0);
    }
  }, [chat, showChat]);

  // Pause Timer Visual
  useEffect(() => {
    if (isPaused) {
      setPauseTimer(15);
      pauseIntervalRef.current = setInterval(() => {
        setPauseTimer(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current);
    }
    return () => { if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current); };
  }, [isPaused]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit("send-message", { sessionCode, name: "Teacher", text: chatInput });
    setChatInput("");
  };

  const changeSlide = (step: number) => {
    const nextSlide = Math.max(1, slide + step);
    if (nextSlide !== slide) {
      if (isPaused) togglePause();
      socket.emit("change-slide", { sessionCode, nextSlide });
    }
  };

  const toggleWhiteboard = () => {
    socket.emit("toggle-whiteboard", { sessionCode, isWhiteboardMode: !isWhiteboardMode });
  };

  const togglePause = () => {
    socket.emit("toggle-pause", { sessionCode, isPaused: !isPaused });
  };

  const toggleBookmark = () => {
    socket.emit("toggle-bookmark", { sessionCode, slideNumber: slide });
  };
  
  const handleEndSession = () => {
    setSessionEnded(true);
    socket.emit("end-session", { sessionCode });
    // Keep them on screen to view overlay
  };

  // --- DRAWING LOGIC ---
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

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    isDrawing.current = true;
    const point = getCoordinates(e);
    currentStroke.current = { points: [point], color, size };
    pendingEmitPoints.current = [];

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.globalCompositeOperation = color === 'ERASER' ? 'destination-out' : 'source-over';

    socket.emit('start-draw', { sessionCode, slideNumber: slide, point, color, size });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !isDrawingMode) return;
    const point = getCoordinates(e);
    currentStroke.current.points.push(point);
    pendingEmitPoints.current.push(point);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.lineTo(point.x, point.y); ctx.stroke(); }

    const now = Date.now();
    if (now - lastEmitTime.current >= 24) { 
      socket.emit('draw-progress', { sessionCode, slideNumber: slide, points: pendingEmitPoints.current });
      pendingEmitPoints.current = [];
      lastEmitTime.current = now;
    }
  };

  const onPointerUpOrLeave = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (pendingEmitPoints.current.length > 0) {
      socket.emit('draw-progress', { sessionCode, slideNumber: slide, points: pendingEmitPoints.current });
      pendingEmitPoints.current = [];
    }
    socket.emit('end-draw', { sessionCode, slideNumber: slide, stroke: currentStroke.current });
  };

  const clearCanvas = () => {
    socket.emit('clear-lines', { sessionCode, slideNumber: slide });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Calculate Difficulty Tag
  const getDifficulty = () => {
     if (total < 3) return { label: "Collecting Data", color: "text-slate-400" };
     if (notUnderstoodPct < 20) return { label: "Easy", color: "text-green-400 font-bold" };
     if (notUnderstoodPct < 50) return { label: "Medium", color: "text-yellow-400 font-bold" };
     return { label: "Difficult", color: "text-red-400 font-bold" };
  };

  if (sessionEnded) {
    // Generate End Session Summary metrics
    const slides = Object.keys(allStats).map(Number);
    let mostConfusingSlide = 1;
    let maxConfused = -1;
    let totalU = 0, totalNU = 0;
    
    slides.forEach(s => {
      const u = allStats[s].understood || 0;
      const nu = allStats[s].not_understood || 0;
      totalU += u;
      totalNU += nu;
      const pct = (u+nu) > 0 ? (nu/(u+nu)) : 0;
      if (pct > maxConfused && (u+nu) > 0) { maxConfused = pct; mostConfusingSlide = s; }
    });
    const avgUnderstanding = (totalU + totalNU) > 0 ? Math.round((totalU / (totalU + totalNU))*100) : 0;
    
    return (
      <div className="w-screen h-screen bg-slate-900 flex items-center justify-center font-sans text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-bl-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/10 rounded-tr-full pointer-events-none" />
        
        <div className="bg-black/90 p-10 rounded-[3rem] border border-white/10 max-w-xl w-full mx-4 shadow-lg relative z-10 text-center">
           <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
             <CheckCircle className="w-10 h-10" />
           </div>
           <h2 className="text-4xl font-extrabold tracking-tight mb-2">Session Ended</h2>
           <p className="text-slate-400 mb-8">Summary created. All students disconnected.</p>
           
           <div className="grid grid-cols-2 gap-4 mb-8">
             <div className="bg-black/40 border border-white/5 p-5 rounded-3xl">
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Average Understanding</p>
               <p className="text-3xl font-black text-white">{avgUnderstanding}%</p>
             </div>
             <div className="bg-black/40 border border-white/5 p-5 rounded-3xl">
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Total Responses</p>
               <p className="text-3xl font-black text-white">{totalU + totalNU}</p>
             </div>
             <div className="bg-black/40 border border-white/5 p-5 rounded-3xl col-span-2">
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Toughest Concept (Slide)</p>
               <p className="text-3xl font-black text-red-400">{maxConfused >= 0 ? mostConfusingSlide : '-'}</p>
             </div>
           </div>
           
           {bookmarks.length > 0 && (
             <div className="bg-indigo-500/20 border border-indigo-500/30 p-5 rounded-3xl mb-8 flex flex-col items-center">
                <Bookmark className="w-6 h-6 text-indigo-400 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Saved Bookmarks</p>
                <div className="flex gap-2 mt-3 flex-wrap justify-center">
                  {bookmarks.map(b => (
                    <span key={b} className="px-3 py-1 bg-indigo-500/40 text-white rounded-lg text-sm font-bold">Slide {b}</span>
                  ))}
                </div>
             </div>
           )}
           
           <button onClick={() => router.push('/')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors active:scale-95 shadow-xl shadow-indigo-500/20 tracking-wide">
             Return Home
           </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-screen h-screen bg-black overflow-hidden relative font-sans flex flex-col items-center justify-center selection:bg-indigo-100 touch-none"
      onClick={() => isFocusMode && setIsFocusMode(false)} // Double tap triggers standard click easily enough, resetting focus locally
    >
      
      {/* 1. DOMINANT EDGE-TO-EDGE SLIDE */}
      <div 
        className="w-full h-full relative overflow-hidden bg-[#2b2b2b]" 
        style={{ cursor: isDrawingMode ? 'crosshair' : 'grab' }}
        onWheel={onWheelZoom}
        onPointerDown={!isDrawingMode ? onPanStart : undefined}
        onPointerMove={!isDrawingMode ? onPanMove : undefined}
        onPointerUp={!isDrawingMode ? onPanEnd : undefined}
        onPointerLeave={!isDrawingMode ? onPanEnd : undefined}
        onDoubleClick={!isDrawingMode ? resetZoom : undefined}
      >
        <div 
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0', width: '100%', height: '100%', transition: isDraggingView.current ? 'none' : 'transform 0.1s ease-out' }}
          className="w-full h-full relative origin-top-left"
        >
          {!isWhiteboardMode ? (
            hasPdf ? (
              <PDFViewer
                sessionCode={sessionCode}
                slide={slide || 1}
                pdfPages={pdfPages}
                setPdfPages={setPdfPages}
              />
            ) : (
              <motion.img 
                key={`img-${slide}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                src={`https://placehold.co/1920x1080/2b2b2b/4f46e5?text=Slide+${slide}&font=montserrat`}
                alt={`Slide ${slide}`}
                className="w-full h-full object-contain absolute inset-0 pointer-events-none"
              />
            )
          ) : (
            <div className="w-full h-full absolute inset-0 bg-white" />
          )}
          
          {/* DRAWING OVERLAY PLACED INSIDE TRANSFORM MAP TO SCALE CORRECTLY */}
          <canvas 
            ref={canvasRef}
            onPointerDown={isDrawingMode ? onPointerDown : undefined}
            onPointerMove={isDrawingMode ? onPointerMove : undefined}
            onPointerUp={isDrawingMode ? onPointerUpOrLeave : undefined}
            onPointerOut={isDrawingMode ? onPointerUpOrLeave : undefined}
            className={`w-full h-full absolute inset-0 ${!isDrawingMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* DISTRACTION-FREE UI LAYER (Hides on inactivity or Focus Mode) */}
      {/* ============================================================== */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 delay-100 ${uiVisible && !isFocusMode ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Status Indicators */}
        <div className="absolute top-6 left-6 z-20 flex flex-col gap-3">
          {!isConnected && (
            <div className="bg-yellow-500 text-black px-5 py-3 rounded-2xl text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 shadow-lg mb-2 pointer-events-auto">
              <Loader2 className="w-5 h-5 animate-spin" /> Reconnecting...
            </div>
          )}
          {alertMsg && (
            <div className="bg-red-500 text-white px-5 py-3 rounded-2xl text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 shadow-lg mb-2 pointer-events-auto">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {alertMsg}
            </div>
          )}
          {isHighConfusion && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-xl shadow-red-500/20 pointer-events-auto">
              Students Struggling
            </motion.div>
          )}
          
          <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-lg pointer-events-auto cursor-default">
             <div className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]'}`}></div> 
             {isPaused ? "Poll Active" : isWhiteboardMode ? "Whiteboard Active" : "Presenting Live"}
          </div>
          <div className="bg-indigo-600/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase shadow-lg pointer-events-auto flex justify-between gap-4 cursor-default text-center">
             <span>{userCount} Online</span>
             {raisedHands.length > 0 && (
               <div className="relative group flex items-center">
                 <span className="text-yellow-300 flex items-center gap-1 cursor-pointer">
                   <Hand className="w-3 h-3" /> {raisedHands.length}
                 </span>
                 <div className="absolute top-full right-0 mt-2 min-w-32 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col gap-1 text-left">
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest border-b border-white/10 pb-1 mb-1">Raised Hands</p>
                    {raisedHands.map(r => (
                      <span key={r.id} className="text-xs font-bold text-white truncate">{r.name}</span>
                    ))}
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Floating Toggles (Right Edge) */}
        <div className="absolute top-6 right-6 z-50 flex flex-col gap-4 pointer-events-auto">
          <button onClick={() => setShowStats(!showStats)} 
            className={`p-4 shadow-lg rounded-2xl border transition-colors active:scale-95 ${showStats ? 'bg-indigo-600 text-white border-indigo-500' : isHighConfusion ? 'bg-red-500 text-white shadow-red-500/40 animate-pulse' : 'bg-black/95 border-white/10 text-white/80 hover:bg-black hover:text-white'}`}>
            <BarChart2 className="w-6 h-6" />
          </button>
          <button onClick={() => setShowDoubts(!showDoubts)} 
            className={`p-4 shadow-lg rounded-2xl border transition-colors active:scale-95 ${showDoubts ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-black/95 border-white/10 text-white/80 hover:bg-black hover:text-white'}`}>
            <MessageSquare className="w-6 h-6" />
          </button>
          <button onClick={() => { setShowChat(!showChat); setUnreadChatCount(0); }} 
            className={`p-4 relative shadow-lg rounded-2xl border transition-colors active:scale-95 ${showChat ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-black/95 border-white/10 text-white/80 hover:bg-black hover:text-white'}`}>
            <MessageCircle className="w-6 h-6" />
            {unreadChatCount > 0 && !showChat && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-black">
                {unreadChatCount}
              </span>
            )}
          </button>
          
          <button title="End Session" onClick={handleEndSession} className="p-4 shadow-lg rounded-2xl border bg-black/95 border-white/10 text-red-400 hover:bg-red-500 hover:scroll-p-0 hover:text-white transition-colors mt-auto pointer-events-auto">
             <Power className="w-6 h-6" />
          </button>
        </div>

        {/* Overlay PANELS (Draggable) */}
        <AnimatePresence>
          {showStats && (
            <motion.div drag dragConstraints={{ top: 0, right: 0, bottom: 500, left: -1000 }} dragElastic={0} dragMomentum={false}
              initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }}
              style={{ position: 'absolute', top: '2rem', right: '6rem' }}
              className="z-[60] w-80 bg-black/95 p-6 rounded-3xl shadow-lg border-2 border-white/10 pointer-events-auto cursor-grab active:cursor-grabbing text-white"
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />
              <div className="flex justify-between items-center mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">Live Feedback <span className={getDifficulty().color}>• {getDifficulty().label}</span></p>
              </div>
              <div className="flex justify-between items-end mb-3">
                <div className="opacity-90">
                  <p className="text-4xl font-black text-green-400 leading-none">{understoodPct}%</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-2">Understood</p>
                </div>
                <div className="opacity-90 text-right">
                  <p className="text-4xl font-black text-red-400 leading-none">{notUnderstoodPct}%</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-2">Confused</p>
                </div>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex relative shadow-inner p-0.5">
                <motion.div className="h-full bg-green-500 rounded-full shadow-sm shrink-0" animate={{ width: `${understoodPct}%` }} transition={{ bounce: 0 }} />
                <div className="w-0.5 shrink-0 bg-transparent" />
                <motion.div className="h-full bg-red-500 rounded-full shadow-sm shrink-0 min-w-0" animate={{ width: `${notUnderstoodPct}%` }} transition={{ bounce: 0 }} />
              </div>
              <div className="mt-4 text-center text-[10px] font-bold tracking-widest uppercase text-slate-400 border-t border-white/10 pt-3 flex justify-between items-center">
                <span>{total} Total Responses</span>
                {raisedHands.length > 0 && <span className="text-yellow-300">{raisedHands.length} Active Hands</span>}
              </div>
            </motion.div>
          )}

          {showDoubts && (
            <motion.div drag dragConstraints={{ top: 0, right: 0, bottom: 500, left: -1000 }} dragElastic={0} dragMomentum={false}
              initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }}
              style={{ position: 'absolute', top: '10rem', right: '6rem' }}
              className="z-[60] w-80 bg-black/95 p-6 rounded-3xl shadow-lg border-2 border-white/10 pointer-events-auto flex flex-col text-white max-h-[50vh]"
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 cursor-grab shrink-0" />
              <div className="flex justify-between items-center mb-4 shrink-0">
                 <h3 className="font-extrabold tracking-tight text-lg">Student Doubts</h3>
                 <span className="text-xs bg-white/10 rounded-full px-2 py-1 font-bold text-slate-300">{doubts.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                {doubts.length === 0 ? (
                  <p className="text-sm font-medium text-slate-500 italic text-center py-4">No doubts yet.</p>
                ) : (
                  doubts.map(d => (
                    <div key={d.id} className="bg-white/5 p-4 rounded-3xl rounded-tr-sm border border-white/10">
                      <p className="text-sm text-slate-200 font-semibold leading-relaxed">{d.text}</p>
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-3">
                        {new Date(d.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {showChat && (
            <motion.div drag dragConstraints={{ top: 0, right: 0, bottom: 500, left: -1000 }} dragElastic={0} dragMomentum={false}
              initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }}
              style={{ position: 'absolute', top: '15rem', right: '6rem' }}
              className="z-[60] w-80 bg-black/95 p-5 rounded-3xl shadow-lg border-2 border-white/10 pointer-events-auto flex flex-col text-white max-h-[50vh]"
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 cursor-grab shrink-0" />
              <h3 className="font-extrabold tracking-tight text-lg mb-3 shrink-0">Class Chat</h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide mb-3">
                {chat.length === 0 ? (
                  <p className="text-sm font-medium text-slate-500 italic text-center py-4">No messages yet.</p>
                ) : (
                  chat.map(m => (
                    <div key={m.id} className="flex flex-col gap-1 items-start">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.name}</span>
                      <div className={`text-sm py-2.5 px-3.5 rounded-3xl font-semibold border ${m.name === "Teacher" ? 'bg-indigo-600 border-indigo-500/50 rounded-tl-sm text-white' : 'bg-white/10 border-white/5 text-slate-200 rounded-tr-sm'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 shrink-0">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..."
                  className="flex-1 text-sm p-3 bg-white/10 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-white/30"
                />
                <button type="submit" disabled={!chatInput.trim()} className="px-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MINIMAL BOTTOM CONTROLS */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-3 pointer-events-auto w-[90vw] sm:w-auto">
          
          {/* Pause Timer Notice */}
          <AnimatePresence>
            {isPaused && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-yellow-500/90 backdrop-blur-xl text-black font-extrabold px-6 py-2 rounded-2xl shadow-xl shadow-yellow-500/20 text-sm tracking-wide border border-yellow-300">
                Poll Active — <span className="font-mono">{pauseTimer}s</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Annotation Toolbar Component (Floats above Controls if active) */}
          <div className="flex items-center gap-2 bg-black/95 px-4 py-3 rounded-3xl shadow-lg border border-white/10 relative">
              
              {/* Focus Mode & Pause Buttons */}
              <button title="Focus Mode" onClick={() => setIsFocusMode(true)} className="p-3.5 rounded-2xl transition-colors text-slate-400 hover:bg-white/10 hover:text-white">
                <Eye className="w-6 h-6" />
              </button>
              <button title="Pause for Feedback" onClick={togglePause} className={`p-3.5 flex items-center justify-center rounded-2xl transition-all ${isPaused ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 font-bold' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
              </button>
              
              <div className="w-px h-8 bg-white/10 mx-2" />

              {/* Interaction Mode Toggle */}
              <div className="flex items-center bg-white/10 rounded-2xl p-1.5 relative">
                <div className={`absolute inset-y-1.5 w-[46%] rounded-xl transition-all duration-300 ease-out z-0 ${isDrawingMode ? 'bg-indigo-600 left-1.5' : 'bg-indigo-600 left-[51%]'}`} />
                <button title="Draw Mode" onClick={() => { setIsDrawingMode(true); setColor(color === "ERASER" ? "#4f46e5" : color); }} className={`relative z-10 p-3 rounded-xl transition-colors ${isDrawingMode ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                  <PenTool className="w-6 h-6" />
                </button>
                <button title="Pan/Zoom Mode" onClick={() => setIsDrawingMode(false)} className={`relative z-10 p-3 rounded-xl transition-colors ${!isDrawingMode ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                  <Move className="w-6 h-6" />
                </button>
              </div>

              <div className="w-px h-8 bg-white/10 mx-2" />

              <button title="Eraser" onClick={() => { setIsDrawingMode(true); setColor("ERASER"); setSize(30); }} className={`p-3.5 rounded-2xl transition-colors ${isDrawingMode && color === "ERASER" ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                <Eraser className="w-6 h-6" />
              </button>

              {isDrawingMode && color !== "ERASER" && (
                <div className="flex items-center gap-2 px-2 ml-1 bg-black/40 rounded-full py-1">
                  {['#ffffff', '#4f46e5', '#ef4444', '#22c55e'].map(c => (
                    <button key={c} onClick={() => { setColor(c); setSize(4); }} 
                      className={`w-8 h-8 rounded-full border-[3px] transition-transform ${color === c ? 'scale-110 border-slate-900 shadow-[0_0_0_2px_rgba(255,255,255,0.8)]' : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}

              <div className="w-px h-8 bg-white/10 mx-2" />
              
              <button title="Clear Ink" onClick={clearCanvas} className="p-3.5 rounded-2xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors">
                <Trash2 className="w-6 h-6" />
              </button>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3 bg-black/95 px-4 py-3 rounded-full shadow-lg border border-white/10 w-full sm:w-auto justify-center">
            
            <button title="Previous Slide" onClick={() => changeSlide(-1)} disabled={slide === 1 || isWhiteboardMode} className="p-4 disabled:opacity-30 rounded-2xl transition-all active:scale-95 text-slate-200 hover:bg-white/10 hover:text-white">
              <ChevronLeft className="w-7 h-7" />
            </button>
            
            <div className="px-6 flex relative items-center justify-center font-black text-white text-2xl tracking-[0.2em] cursor-default bg-white/10 border border-white/5 py-3 rounded-2xl min-w-[140px]">
              {bookmarks.includes(slide) && <Bookmark className="w-4 h-4 absolute top-2 left-3 text-indigo-400 fill-current" />}
              {isWhiteboardMode ? "W/B" : slide} <span className="text-slate-400 font-medium ml-2 tracking-normal">{isWhiteboardMode ? '' : `/ ${pdfPages > 0 ? pdfPages : "∞"}`}</span>
            </div>
            
            <button title="Next Slide" onClick={() => changeSlide(1)} disabled={isWhiteboardMode} className="p-4 disabled:opacity-30 text-slate-200 rounded-2xl transition-all active:scale-95 hover:bg-white/10 hover:text-white">
              <ChevronRight className="w-7 h-7" />
            </button>

            <div className="w-px h-10 bg-white/10 mx-2" />
            
            <button onClick={toggleBookmark} className={`p-4 rounded-2xl transition-all active:scale-95 ${bookmarks.includes(slide) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-transparent text-slate-300 hover:bg-white/10 hover:text-white'}`} title="Bookmark Slide">
              <Bookmark className={`w-6 h-6 ${bookmarks.includes(slide) ? 'fill-current' : ''}`} />
            </button>
            <button onClick={toggleWhiteboard} className={`px-5 py-4 font-bold text-sm tracking-widest uppercase rounded-2xl transition-all active:scale-95 ml-2 flex items-center justify-center border ${isWhiteboardMode ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-transparent text-slate-300 border-dashed border-white/20 hover:bg-white/10 hover:text-white'}`} title="Toggle Global Whiteboard">
              {isWhiteboardMode ? "Exit Whiteboard" : "Whiteboard"}
            </button>
            
            <div className="w-px h-10 bg-white/10 mx-2" />
            
            <button onClick={handleFullscreen} className="p-4 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl transition-all">
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
{isFocusMode && (
  <div className="absolute top-4 right-4 z-[999] opacity-30 hover:opacity-100 transition-opacity">
    <button onClick={() => setIsFocusMode(false)} className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl text-white font-bold flex items-center gap-2 border border-white/10 shadow-xl pointer-events-auto active:scale-95 text-xs">
       <Eye className="w-4 h-4" /> Exit Focus
    </button>
  </div>
)}
    </div>
  );
}
