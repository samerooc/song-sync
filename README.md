# 🎵 SyncRoom (Multi-Device Synced Playback) — Production Edition

> **Turn your phones, laptops, tablets, and Bluetooth speakers into a massive synchronized sound array.**  
> Zero app install. Zero signup. Pure browser-based high-fidelity synchronized playback.  
> **Theme**: Minimalist Crisp White & Slate-Gray Edition.

---

## 🌐 24x7 Live Deployment & Free Hosting

### 1. 24x7 Free Cloud Hosting (Render + UptimeRobot Setup)
1. **GitHub Deploy**: Push this repo to GitHub.
2. **Deploy on Render**:
   - Go to [render.com](https://render.com) and click **New > Web Service**.
   - Select your GitHub repo (`syncroom`).
   - Choose **Node** environment. Build Command: `npm run postinstall && npm run build`, Start Command: `npm start`.
   - Your permanent link will be generated: `https://syncroom.onrender.com`.
3. **Keep Render Awake 24x7 with UptimeRobot (Free)**:
   - Go to [uptimerobot.com](https://uptimerobot.com) (free signup).
   - Click **+ Add New Monitor**.
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `SyncRoom Ping`
   - URL: `https://<your-render-app>.onrender.com/ping`
   - Monitoring Interval: Every **5 minutes** or **10 minutes**.
   - Click **Create Monitor**!
   - Now UptimeRobot will ping the `/ping` endpoint, preventing Render from ever sleeping.

### 2. Instant Public Tunnel Link
- **Public URL**: `https://syncroom-rana.loca.lt`
- **Tunnel Password / IP**: `152.59.62.80`

### 3. Local WiFi / Hotspot Link (Zero Internet Lag)
- **Direct LAN**: `http://10.136.94.174:4000`

### 1. Install & Run
In the project root directory (`d:\Downloads\ssync`):

```bash
# Start both Server (port 4000) and Client (port 3000)
node start-dev.js
```

Or run standalone production mode:
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** (or `http://<your-local-ip>:3000` from any phone/tablet on your WiFi hotspot).

### 2. Run Integration Verification Test
```bash
node test-syncroom.js
```

---

## ⚡ Core Features Implemented

| ID | Feature | Status | Description |
|---|---|---|---|
| **FR-1** | Room Creation & 6-Digit Code | ✅ Complete | Unique 6-character room code & QR code generated for mobile joining. |
| **FR-2** | No-Login Join | ✅ Complete | Join instantly via code, QR scan, or URL link (`?room=CODE`). |
| **FR-3** | Host Playback Propagation | ✅ Complete | Play, pause, seek, and track change instantly broadcast to all devices. |
| **FR-4** | NTP-Style Clock Synchronization | ✅ Complete | Cristian's algorithm with low-RTT packet filtering to achieve &le; 10ms clock accuracy. |
| **FR-5** | Scheduled Start (Future Timestamp) | ✅ Complete | Host actions schedule playback ~1200ms into the future so all devices hit the exact same millisecond. |
| **FR-6** | Drift Correction Loop | ✅ Complete | Background loop with pitch-preserving rate nudging (0.96x - 1.04x) for 35-250ms skew, hard seek for 250ms+. |
| **FR-7** | Host Audio File Upload & Streaming | ✅ Complete | Multer backend supporting MP3, WAV, M4A, FLAC up to 50MB with HTTP 206 Partial Content (Safari/Chrome seek support). |
| **FR-8** | Late Joiner Auto Catch-up | ✅ Complete | Newly joined devices compute elapsed playback time and snap right to the current beat. |
| **FR-9** | YouTube IFrame API Playback Sync | ✅ Complete | Paste any YouTube video URL for synchronized group video watching. |
| **FR-10**| Bluetooth Latency Slider | ✅ Complete | Per-device calibration (-500ms to +500ms) with presets (AirPods, BT Speaker, Soundbar) & test click sound. |
| **FR-11**| Live Connected Devices List | ✅ Complete | Real-time device names, Host badge, and live RTT ping monitor (&lt;40ms green). |
| **FR-12**| Auto-Reconnect & Re-sync | ✅ Complete | Automatic WebSocket reconnection and re-clocking on temporary WiFi drop. |
| **UX** | Tap to Enable Audio Screen | ✅ Complete | User gesture overlay resolving iOS Safari & mobile Chrome autoplay policies. |

---

## 📐 Architecture & Math

### 1. Clock Synchronization (NTP / Cristian's Algorithm)
When a device connects, it fires an initial burst of ping packets to the server:
- $T_0$: Client send timestamp
- $T_1$: Server receive timestamp
- $T_2$: Server transmit timestamp
- $T_3$: Client receive timestamp

$$\text{RTT} = (T_3 - T_0) - (T_2 - T_1)$$
$$\text{Clock Offset} = \frac{(T_1 - T_0) + (T_2 - T_3)}{2}$$

The client sorts samples by lowest $\text{RTT}$ (which filters out WiFi transmission delays and queuing jitter), taking the median offset of the lowest-latency quartile.

### 2. Scheduled Future Playback
Instead of telling devices to "play now" (which causes audible echoes due to network delay differences), the Host sends:
$$\text{Scheduled Start Time} = \text{Server Time Now} + 1200\text{ ms}$$
Each client computes its local instant:
$$\text{Local Trigger Time} = \text{Scheduled Start Time} - \text{Clock Offset} - \text{Bluetooth Offset}$$
Web Audio executes the playback trigger at that precise physical instant.

### 3. Bluetooth Delay Compensation
Because Bluetooth A2DP audio codecs introduce 100ms - 300ms of hardware buffering in external speakers, each listener can calibrate their device:
- Setting **+200ms** shifts that device's playback 200ms earlier, neutralizing the speaker's internal delay.

---

## 🛠 Tech Stack
- **Server**: Node.js, Express, `ws` (WebSockets), Multer, HTTP 206 Partial Content Audio Streaming
- **Frontend**: React 18, Vite, Tailwind CSS, Web Audio API, Canvas Confetti, Lucide Icons, QRCode
