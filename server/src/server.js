import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Config
const PORT = process.env.PORT || 4000;
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Audio upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a', 'audio/mp4', 'audio/flac', 'audio/x-m4a'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, OGG, M4A, AAC, FLAC) are permitted!'));
    }
  }
});

// State Store
// rooms Map: roomCode -> Room Object
const rooms = new Map();

function generateRoomCode() {
  // 6-digit numeric room code (e.g. 482910)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return rooms.has(code) ? generateRoomCode() : code;
}

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Calculate current position for late joiners or sync queries
function getRoomCurrentPosition(room) {
  if (!room || !room.playback) return 0;
  if (!room.playback.isPlaying || !room.playback.scheduledStartTime) {
    return room.playback.position || 0;
  }
  const now = Date.now();
  if (now < room.playback.scheduledStartTime) {
    // Scheduled in future, hasn't started yet
    return room.playback.position || 0;
  }
  const elapsed = (now - room.playback.scheduledStartTime) / 1000;
  const currentPos = (room.playback.position || 0) + elapsed * (room.playback.playbackRate || 1.0);
  if (room.media && room.media.duration && currentPos >= room.media.duration) {
    return room.media.duration;
  }
  return currentPos;
}

// Broadcast helper
function broadcastToRoom(roomCode, message, excludeClientId = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [clientId, client] of room.clients.entries()) {
    if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// Stream audio with HTTP 206 Partial Content support for smooth seeking & Safari
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Upload endpoint
app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    size: req.file.size
  });
});

// Create Room REST endpoint (supports random 6-digit or Admin custom 6-digit PIN)
app.post('/api/rooms', (req, res) => {
  let { customCode } = req.body || {};
  let code;

  if (customCode !== undefined && customCode !== null && String(customCode).trim() !== '') {
    const cleanCode = String(customCode).trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Room code must be exactly 6 digits (numbers only, e.g. 123456)' });
    }
    if (rooms.has(cleanCode)) {
      return res.status(400).json({ error: 'This 6-digit room code is already active. Please pick another code.' });
    }
    code = cleanCode;
  } else {
    code = generateRoomCode();
  }

  const hostToken = generateToken();
  const newRoom = {
    code,
    hostToken,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    streamMode: 'audio', // 'audio' (Namida Player - low data saver) or 'video'
    videoQuality: 'medium', // 'small' (144p/240p), 'medium' (360p), 'large' (480p), 'hd720', 'hd1080', 'auto'
    media: null, // { type: 'file' | 'youtube', url: '', title: '', duration: 0, thumbnail: '', channel: '' }
    playback: {
      isPlaying: false,
      position: 0,
      scheduledStartTime: 0,
      playbackRate: 1.0,
      updatedAtServerTime: Date.now()
    },
    clients: new Map() // clientId -> client object
  };

  rooms.set(code, newRoom);
  res.json({ code, hostToken });
});

// YouTube In-App Song & Video Search (Zero-API Key, Fast, Direct Web Scraper)
app.get('/api/yt-search', async (req, res) => {
  const query = req.query.q;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) {
      return res.json({ results: [] });
    }

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    const results = [];

    if (Array.isArray(contents)) {
      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents;
        if (Array.isArray(items)) {
          for (const item of items) {
            const v = item.videoRenderer;
            if (v && v.videoId) {
              const thumbs = v.thumbnail?.thumbnails || [];
              const bestThumb = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
              results.push({
                id: v.videoId,
                title: v.title?.runs?.[0]?.text || 'Untitled Video',
                channel: v.ownerText?.runs?.[0]?.text || '',
                duration: v.lengthText?.simpleText || '',
                thumbnail: bestThumb
              });
            }
            if (results.length >= 12) break;
          }
        }
        if (results.length >= 12) break;
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('YouTube search error:', err);
    res.status(500).json({ error: 'Failed to search YouTube. Please check network or try again.' });
  }
});

// Verify Room Code endpoint
app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found or expired' });
  }
  res.json({
    code: room.code,
    clientCount: room.clients.size,
    hasMedia: !!room.media,
    media: room.media ? { type: room.media.type, title: room.media.title } : null
  });
});

// 24x7 Keep-Alive Ping Endpoints (for UptimeRobot / Cron / Self-Ping)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/api/ping', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'SyncRoom server is awake', serverTime: Date.now(), uptime: process.uptime() });
});

// Server info / Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: Date.now(), activeRooms: rooms.size });
});

// WebSocket Handling
wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let clientId = 'client_' + Math.random().toString(36).substring(2, 9);
  let isHost = false;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // NTP Clock Sync Ping-Pong (ultra-low overhead)
      if (msg.type === 'sync_ping') {
        const serverReceiveTime = Date.now();
        ws.send(JSON.stringify({
          type: 'sync_pong',
          clientSendTime: msg.clientSendTime,
          serverReceiveTime,
          serverTransmitTime: Date.now()
        }));
        return;
      }

      // Join Room
      if (msg.type === 'join_room') {
        const { roomCode, hostToken, deviceName, userLatencyOffset } = msg;
        const code = (roomCode || '').toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found or expired' }));
          return;
        }

        currentRoomCode = code;
        isHost = hostToken && hostToken === room.hostToken;
        room.lastActivity = Date.now();

        const clientData = {
          id: clientId,
          ws,
          name: deviceName || (isHost ? 'Host' : `Device ${room.clients.size + 1}`),
          isHost,
          rtt: 0,
          userLatencyOffset: userLatencyOffset || 0,
          joinedAt: Date.now()
        };

        room.clients.set(clientId, clientData);

        // Send confirmation and current synchronized room state to newly joined client
        const currentPos = getRoomCurrentPosition(room);
        ws.send(JSON.stringify({
          type: 'room_joined',
          clientId,
          roomCode: code,
          isHost,
          streamMode: room.streamMode || 'audio',
          videoQuality: room.videoQuality || 'medium',
          media: room.media,
          playback: {
            ...room.playback,
            position: currentPos
          },
          serverTime: Date.now()
        }));

        // Broadcast updated device list to all in room
        broadcastDeviceList(code);
        return;
      }

      // Ensure room exists for subsequent room messages
      if (!currentRoomCode || !rooms.has(currentRoomCode)) {
        return;
      }
      const room = rooms.get(currentRoomCode);
      room.lastActivity = Date.now();

      // Client Heartbeat with RTT update
      if (msg.type === 'heartbeat') {
        const client = room.clients.get(clientId);
        if (client) {
          client.rtt = msg.rtt || 0;
          if (msg.userLatencyOffset !== undefined) {
            client.userLatencyOffset = msg.userLatencyOffset;
          }
          broadcastDeviceList(currentRoomCode);
        }
        return;
      }

      // HOST ONLY CONTROLS
      if (!isHost) {
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Only Admin can control room playback & settings' }));
        return;
      }

      // Admin updates Stream Settings (Audio-Only Mode vs Video Mode, Quality Selector)
      if (msg.type === 'set_stream_settings') {
        if (msg.streamMode) {
          room.streamMode = msg.streamMode;
        }
        if (msg.videoQuality) {
          room.videoQuality = msg.videoQuality;
        }
        broadcastToRoom(currentRoomCode, {
          type: 'stream_settings_updated',
          streamMode: room.streamMode,
          videoQuality: room.videoQuality
        });
        return;
      }

      // Admin Kicks a Client from the room
      if (msg.type === 'kick_client') {
        const targetId = msg.targetClientId;
        if (targetId && room.clients.has(targetId)) {
          const target = room.clients.get(targetId);
          if (target.ws && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              type: 'kicked',
              message: 'You have been removed from the room by the Admin.'
            }));
            target.ws.close();
          }
          room.clients.delete(targetId);
          broadcastDeviceList(currentRoomCode);
        }
        return;
      }

      // Host sets Media (Uploaded Audio or YouTube URL / Search)
      if (msg.type === 'set_media') {
        const { mediaType, url, title, duration, youtubeId, thumbnail, channel } = msg;
        room.media = {
          type: mediaType, // 'file' or 'youtube'
          url,
          title: title || 'Untitled Audio',
          duration: duration || 0,
          youtubeId: youtubeId || null,
          thumbnail: thumbnail || (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : ''),
          channel: channel || ''
        };
        // Reset playback position
        room.playback = {
          isPlaying: false,
          position: 0,
          scheduledStartTime: 0,
          playbackRate: 1.0,
          updatedAtServerTime: Date.now()
        };

        broadcastToRoom(currentRoomCode, {
          type: 'media_updated',
          media: room.media,
          playback: room.playback,
          serverTime: Date.now()
        });
        return;
      }

      // Host Play (Scheduled in near future with low-latency 350ms buffer)
      if (msg.type === 'play') {
        const currentPos = typeof msg.position === 'number' ? msg.position : getRoomCurrentPosition(room);
        const delay = msg.scheduledDelay || 350;
        const scheduledStartTime = Date.now() + delay;

        room.playback.isPlaying = true;
        room.playback.position = currentPos;
        room.playback.scheduledStartTime = scheduledStartTime;
        room.playback.updatedAtServerTime = Date.now();

        broadcastToRoom(currentRoomCode, {
          type: 'playback_sync',
          action: 'play',
          position: currentPos,
          scheduledStartTime,
          serverTime: Date.now()
        });
        return;
      }

      // Host Pause (Instantaneous across all clients)
      if (msg.type === 'pause') {
        const currentPos = typeof msg.position === 'number' ? msg.position : getRoomCurrentPosition(room);

        room.playback.isPlaying = false;
        room.playback.position = currentPos;
        room.playback.scheduledStartTime = 0;
        room.playback.updatedAtServerTime = Date.now();

        broadcastToRoom(currentRoomCode, {
          type: 'playback_sync',
          action: 'pause',
          position: currentPos,
          scheduledStartTime: 0,
          serverTime: Date.now()
        });
        return;
      }

      // Host Seek (Instant seek with 350ms scheduling if playing)
      if (msg.type === 'seek') {
        const targetPos = Math.max(0, msg.position || 0);
        let scheduledStartTime = 0;

        if (room.playback.isPlaying) {
          const delay = msg.scheduledDelay || 350;
          scheduledStartTime = Date.now() + delay;
          room.playback.scheduledStartTime = scheduledStartTime;
        }

        room.playback.position = targetPos;
        room.playback.updatedAtServerTime = Date.now();

        broadcastToRoom(currentRoomCode, {
          type: 'playback_sync',
          action: 'seek',
          position: targetPos,
          isPlaying: room.playback.isPlaying,
          scheduledStartTime,
          serverTime: Date.now()
        });
        return;
      }

    } catch (err) {
      console.error('WebSocket message handling error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode && rooms.has(currentRoomCode)) {
      const room = rooms.get(currentRoomCode);
      room.clients.delete(clientId);
      if (room.clients.size === 0) {
        // Schedule cleanup after 4 hours idle
        room.emptySince = Date.now();
      } else {
        broadcastDeviceList(currentRoomCode);
      }
    }
  });
});

function broadcastDeviceList(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const deviceList = Array.from(room.clients.values()).map(c => ({
    id: c.id,
    name: c.name,
    isHost: c.isHost,
    rtt: c.rtt,
    userLatencyOffset: c.userLatencyOffset
  }));

  broadcastToRoom(roomCode, {
    type: 'device_list',
    devices: deviceList
  });
}

// Room auto-cleanup cron (every 30 mins, purge rooms empty/idle for > 4 hours)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > 4 * 60 * 60 * 1000) {
      // Room expired
      rooms.delete(code);
    }
  }
}, 30 * 60 * 1000);

// Serve built client in production if available
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/ping') {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SyncRoom Server running on http://0.0.0.0:${PORT}`);

  // 24x7 Keep-Alive Self-Ping Loop (Render & Railway)
  const rawUrl = process.env.RENDER_EXTERNAL_URL || 
                 (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) || 
                 process.env.PING_URL;
  if (rawUrl) {
    const cleanUrl = rawUrl.replace(/\/$/, '');
    console.log(`📡 Auto Keep-Alive Active: Pinging ${cleanUrl}/ping every 10 mins`);
    setInterval(async () => {
      try {
        await fetch(`${cleanUrl}/ping`);
        console.log(`[KeepAlive] Pinged ${cleanUrl}/ping at ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.warn('[KeepAlive] Self-ping error:', err.message);
      }
    }, 10 * 60 * 1000);
  }
});
