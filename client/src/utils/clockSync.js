// NTP Clock Synchronization Engine for SyncRoom
// Uses Cristian's Algorithm with low-RTT sample filtering

export class ClockSyncEngine {
  constructor(sendWsMessage) {
    this.sendWsMessage = sendWsMessage;
    this.samples = []; // array of { rtt, offset, time }
    this.estimatedOffset = 0; // serverTime = localTime + estimatedOffset
    this.minRTT = Infinity;
    this.lastRTT = 0;
    this.syncListeners = new Set();
    this.syncInterval = null;
    this.isCalibrating = false;
  }

  // Register listener for sync state changes
  subscribe(fn) {
    this.syncListeners.add(fn);
    return () => this.syncListeners.delete(fn);
  }

  notify() {
    for (const fn of this.syncListeners) {
      fn({
        offset: this.estimatedOffset,
        rtt: this.lastRTT,
        minRTT: this.minRTT,
        sampleCount: this.samples.length,
        isCalibrating: this.isCalibrating
      });
    }
  }

  // Start initial synchronization burst
  async startSyncBurst(burstCount = 8) {
    this.isCalibrating = true;
    this.notify();

    for (let i = 0; i < burstCount; i++) {
      this.sendPing();
      // Wait 120ms between burst pings
      await new Promise((r) => setTimeout(r, 120));
    }

    this.isCalibrating = false;
    this.notify();

    // Start background maintenance sync every 5 seconds
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        this.sendPing();
      }, 5000);
    }
  }

  sendPing() {
    if (!this.sendWsMessage) return;
    const clientSendTime = Date.now();
    this.sendWsMessage({
      type: 'sync_ping',
      clientSendTime
    });
  }

  handlePong(data) {
    const clientReceiveTime = Date.now();
    const { clientSendTime, serverReceiveTime, serverTransmitTime } = data;

    // RTT is total round trip minus server processing time
    const rtt = Math.max(1, (clientReceiveTime - clientSendTime) - (serverTransmitTime - serverReceiveTime));
    
    // Clock offset = ((T1 - T0) + (T2 - T3)) / 2
    // If offset is positive, server clock is ahead of client clock
    const offset = Math.round(((serverReceiveTime - clientSendTime) + (serverTransmitTime - clientReceiveTime)) / 2);

    this.lastRTT = rtt;
    this.samples.push({ rtt, offset, timestamp: clientReceiveTime });

    // Keep last 25 samples
    if (this.samples.length > 25) {
      this.samples.shift();
    }

    // Filter samples: sort by lowest RTT (least network delay jitter)
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    this.minRTT = sorted[0].rtt;

    // Pick top 40% lowest RTT samples and take their median offset
    const bestCount = Math.max(1, Math.floor(sorted.length * 0.4));
    const bestSamples = sorted.slice(0, bestCount);
    bestSamples.sort((a, b) => a.offset - b.offset);

    const medianOffset = bestSamples[Math.floor(bestSamples.length / 2)].offset;
    this.estimatedOffset = medianOffset;

    this.notify();
    return { rtt, offset: this.estimatedOffset };
  }

  // Convert local timestamp to server timestamp
  localToServer(localTime = Date.now()) {
    return localTime + this.estimatedOffset;
  }

  // Convert server timestamp to local timestamp
  serverToLocal(serverTime) {
    return serverTime - this.estimatedOffset;
  }

  // Stop sync loops on teardown
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncListeners.clear();
  }
}
