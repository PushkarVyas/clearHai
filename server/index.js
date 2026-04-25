require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── ENV ──────────────────────────────────────────────────────────────────────
if (!process.env.PORT || !process.env.CLIENT_URL || !process.env.MAX_FILE_SIZE_MB || !process.env.SESSION_CLEANUP_MINUTES) {
  console.error("CRITICAL ERROR: Missing required environment variables.");
  console.error("Please ensure PORT, CLIENT_URL, MAX_FILE_SIZE_MB, and SESSION_CLEANUP_MINUTES are set in .env");
  process.exit(1);
}

const PORT = process.env.PORT;
const CLIENT_URL = process.env.CLIENT_URL;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024;
const SESSION_CLEANUP_MS = parseInt(process.env.SESSION_CLEANUP_MINUTES) * 60 * 1000;

// ── EXPRESS + SOCKET.IO ──────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: CLIENT_URL === '*' ? true : CLIENT_URL.split(',').map(s => s.trim()), methods: ['GET', 'POST'] }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_URL === '*' ? true : CLIENT_URL.split(',').map(s => s.trim()), methods: ['GET', 'POST'] },
  pingTimeout: 30000,
  pingInterval: 10000,
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── MULTER (15 MB limit) ────────────────────────────────────────────────────
const upload = multer({
  dest: path.join(__dirname, 'temp/'),
  limits: { fileSize: MAX_FILE_SIZE },
});

// ── IN-MEMORY STATE ─────────────────────────────────────────────────────────
const sessions = {};
const socketToSession = {};

// Per-socket rate limiters: { socketId: { chat: lastTs, reaction: lastTs } }
const rateLimits = {};
const RATE_LIMIT_CHAT_MS = 500;

// ── HELPERS ─────────────────────────────────────────────────────────────────
const generateSessionCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const sanitize = (str, maxLen = 500) => {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen);
};

const log = (type, msg) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${type}] ${msg}`);
};

// ── SESSION CREATION ────────────────────────────────────────────────────────
app.post('/api/session/create', upload.single('file'), (req, res) => {
  let sessionCode;
  do { sessionCode = generateSessionCode(); } while (sessions[sessionCode]);

  log('SESSION', `Creating ${sessionCode}, file: ${req.file ? req.file.originalname : 'none'}`);

  if (req.file) {
    const targetDir = path.join(__dirname, 'uploads', sessionCode);
    fs.mkdirSync(targetDir, { recursive: true });

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Please upload PDF file' });
    }

    fs.renameSync(req.file.path, path.join(targetDir, 'raw.pdf'));
  }

  sessions[sessionCode] = {
    currentSlide: 1,
    responses: { 1: { understood: 0, not_understood: 0 } },
    userResponses: {},
    drawings: {},
    doubts: [],
    isWhiteboardMode: false,
    users: {},
    chat: [],
    hasPdf: !!req.file,
    bookmarks: [],
    raisedHands: [],
    isPaused: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  res.json({ success: true, sessionCode });
});

// ── SESSION GARBAGE COLLECTOR (every 10 min) ────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(sessions)) {
    const s = sessions[code];
    const userCount = Object.keys(s.users).length;
    const age = now - s.lastActivity;
    if (userCount === 0 && age > SESSION_CLEANUP_MS) {
      log('GC', `Purging inactive session ${code} (idle ${Math.round(age / 60000)}m)`);
      // Clean up uploaded files
      const dir = path.join(__dirname, 'uploads', code);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      delete sessions[code];
    }
  }
}, 10 * 60 * 1000);

// ── SOCKET.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('join-session', (payload, callback) => {
    let sessionCode = typeof payload === 'string' ? payload : payload?.sessionCode;
    const name = sanitize(typeof payload === 'string' ? 'Anonymous' : (payload?.name || 'Anonymous'), 30);

    sessionCode = sessionCode?.toUpperCase();
    if (!sessionCode || !sessions[sessionCode]) {
      if (typeof callback === 'function') callback({ success: false, error: 'Session not found' });
      return;
    }

    socket.join(sessionCode);
    socketToSession[socket.id] = sessionCode;
    sessions[sessionCode].users[socket.id] = { name };
    sessions[sessionCode].lastActivity = Date.now();
    rateLimits[socket.id] = { chat: 0 };

    io.to(sessionCode).emit('user-count-update', Object.keys(sessions[sessionCode].users).length);

    const session = sessions[sessionCode];
    if (typeof callback === 'function') {
      callback({
        success: true,
        currentSlide: session.currentSlide,
        responses: session.responses[session.currentSlide] || { understood: 0, not_understood: 0 },
        isWhiteboardMode: session.isWhiteboardMode,
        drawings: session.drawings[session.currentSlide] || [],
        doubts: session.doubts,
        chat: session.chat.slice(-50), // Send last 50 messages only
        hasPdf: session.hasPdf,
        isPaused: session.isPaused,
        bookmarks: session.bookmarks,
        raisedHands: session.raisedHands,
      });
    }
  });

  socket.on('change-slide', ({ sessionCode, nextSlide }, callback) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (!session) return;

    session.currentSlide = nextSlide;
    session.lastActivity = Date.now();
    if (!session.responses[nextSlide]) {
      session.responses[nextSlide] = { understood: 0, not_understood: 0 };
    }

    io.to(sessionCode).emit('slide-changed', {
      currentSlide: session.currentSlide,
      responses: session.responses[nextSlide],
      drawings: session.drawings[nextSlide] || [],
    });

    if (typeof callback === 'function') callback({ success: true });
  });

  socket.on('toggle-whiteboard', ({ sessionCode, isWhiteboardMode }, callback) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (!session) return;

    session.isWhiteboardMode = isWhiteboardMode;
    session.lastActivity = Date.now();
    io.to(sessionCode).emit('whiteboard-mode-changed', { isWhiteboardMode });

    if (typeof callback === 'function') callback({ success: true });
  });

  socket.on('submit-feedback', ({ sessionCode, slideNumber, feedback }, callback) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (!session || session.currentSlide !== slideNumber) return;
    if (feedback !== 'understood' && feedback !== 'not_understood') return;

    if (!session.userResponses[socket.id]) session.userResponses[socket.id] = {};
    const prev = session.userResponses[socket.id][slideNumber];
    if (prev === feedback) {
      if (typeof callback === 'function') callback({ success: true });
      return;
    }

    if (prev && session.responses[slideNumber][prev] > 0) session.responses[slideNumber][prev]--;

    session.responses[slideNumber][feedback]++;
    session.userResponses[socket.id][slideNumber] = feedback;
    const stats = session.responses[slideNumber];

    io.to(sessionCode).emit('stats-updated', { slideNumber, responses: stats });

    const total = stats.understood + stats.not_understood;
    if (total > 0 && ((stats.not_understood / total) * 100) > 60) {
      io.to(sessionCode).emit('auto-alert', { slideNumber, message: 'High confusion on this slide' });
    }
    if (typeof callback === 'function') callback({ success: true });
  });

  // ── DRAWING (throttled by client) ───────────────────────────────────────
  socket.on('start-draw', ({ sessionCode, slideNumber, point, color, size }) => {
    socket.to(sessionCode?.toUpperCase()).emit('start-draw', { slideNumber, point, color, size });
  });

  socket.on('draw-progress', ({ sessionCode, slideNumber, points }) => {
    socket.to(sessionCode?.toUpperCase()).emit('draw-progress', { slideNumber, points });
  });

  socket.on('end-draw', ({ sessionCode, slideNumber, stroke }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (session) {
      if (!session.drawings[slideNumber]) session.drawings[slideNumber] = [];
      session.drawings[slideNumber].push(stroke);
    }
    socket.to(sessionCode).emit('end-draw', { slideNumber, stroke });
  });

  socket.on('clear-lines', ({ sessionCode, slideNumber }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (session) session.drawings[slideNumber] = [];
    socket.to(sessionCode).emit('clear-lines', { slideNumber });
  });

  // ── DOUBTS ──────────────────────────────────────────────────────────────
  socket.on('ask-doubt', ({ sessionCode, text }, callback) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (!session) return;

    text = sanitize(text, 500);
    if (!text) return;

    const doubt = { id: Math.random().toString(), text, timestamp: Date.now() };
    session.doubts.push(doubt);
    io.to(sessionCode).emit('new-doubt', doubt);
    if (typeof callback === 'function') callback({ success: true });
  });

  // ── CHAT (rate-limited) ─────────────────────────────────────────────────
  socket.on('send-message', ({ sessionCode, name, text }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (!session) return;

    // Rate limit
    const now = Date.now();
    const rl = rateLimits[socket.id];
    if (rl && (now - rl.chat) < RATE_LIMIT_CHAT_MS) return;
    if (rl) rl.chat = now;

    text = sanitize(text, 300);
    name = sanitize(name, 30);
    if (!text) return;

    const msg = { id: Math.random().toString(), name, text, timestamp: now };
    session.chat.push(msg);
    // Cap stored chat to 200 messages
    if (session.chat.length > 200) session.chat = session.chat.slice(-200);
    io.to(sessionCode).emit('receive-message', msg);
  });

  // ── CLASSROOM FEATURES ──────────────────────────────────────────────────
  socket.on('toggle-pause', ({ sessionCode, isPaused }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (session) {
      session.isPaused = isPaused;
      session.lastActivity = Date.now();
      io.to(sessionCode).emit('session-paused', { isPaused });
    }
  });

  socket.on('toggle-bookmark', ({ sessionCode, slideNumber }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (session) {
      if (session.bookmarks.includes(slideNumber)) {
        session.bookmarks = session.bookmarks.filter(s => s !== slideNumber);
      } else {
        session.bookmarks.push(slideNumber);
      }
      io.to(sessionCode).emit('bookmarks-updated', { bookmarks: session.bookmarks });
    }
  });

  socket.on('raise-hand', ({ sessionCode }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (session && !session.raisedHands.find(r => r.id === socket.id)) {
      const name = session.users[socket.id]?.name || 'Anonymous';
      session.raisedHands.push({ id: socket.id, name });
      io.to(sessionCode).emit('raised-hands-updated', { raisedHands: session.raisedHands });
    }
  });

  socket.on('lower-hand', ({ sessionCode }) => {
    sessionCode = sessionCode?.toUpperCase();
    const session = sessions[sessionCode];
    if (session) {
      session.raisedHands = session.raisedHands.filter(r => r.id !== socket.id);
      io.to(sessionCode).emit('raised-hands-updated', { raisedHands: session.raisedHands });
    }
  });

  socket.on('end-session', ({ sessionCode }) => {
    sessionCode = sessionCode?.toUpperCase();
    log('SESSION', `Ending session ${sessionCode}`);
    io.to(sessionCode).emit('session-ended');
    // Cleanup files
    const dir = path.join(__dirname, 'uploads', sessionCode);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    delete sessions[sessionCode];
  });

  // ── DISCONNECT ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const sessionCode = socketToSession[socket.id];
    if (sessionCode && sessions[sessionCode]) {
      delete sessions[sessionCode].users[socket.id];
      sessions[sessionCode].raisedHands = sessions[sessionCode].raisedHands.filter(r => r.id !== socket.id);
      io.to(sessionCode).emit('raised-hands-updated', { raisedHands: sessions[sessionCode].raisedHands });

      const numUsers = Object.keys(sessions[sessionCode].users).length;
      io.to(sessionCode).emit('user-count-update', numUsers);
      log('SOCKET', `User disconnected from ${sessionCode} (${numUsers} remaining)`);
    }
    delete socketToSession[socket.id];
    delete rateLimits[socket.id];
  });
});

// ── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('clearHai backend is running'));

// ── START ───────────────────────────────────────────────────────────────────
server.listen(PORT, () => log('SERVER', `Listening on port ${PORT}`));
