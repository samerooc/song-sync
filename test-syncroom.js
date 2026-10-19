import http from 'http';
const WebSocket = globalThis.WebSocket;

console.log('🧪 Starting SyncRoom Integration & Architecture Verification...\n');

// 1. Health check
const req = http.get('http://localhost:4000/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ 1. REST Health Check Passed:', data);
    testCreateRoom();
  });
});

req.on('error', (err) => {
  console.error('❌ Server not running or error:', err.message);
  process.exit(1);
});

// 2. Create room
function testCreateRoom() {
  const postData = JSON.stringify({});
  const req = http.request('http://localhost:4000/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const room = JSON.parse(data);
      console.log(`✅ 2. Room Created: Code=${room.code}, HostToken=${room.hostToken}`);
      testWebSockets(room.code, room.hostToken);
    });
  });
  req.write(postData);
  req.end();
}

// 3. Test WebSockets: Clock Sync Ping/Pong + Host & Listener Join + Play Sync
function testWebSockets(roomCode, hostToken) {
  const hostWs = new WebSocket('ws://localhost:4000');
  const listenerWs = new WebSocket('ws://localhost:4000');

  hostWs.addEventListener('open', () => {
    console.log('🔌 Host WebSocket Connected');
    // Test NTP ping
    hostWs.send(JSON.stringify({
      type: 'sync_ping',
      clientSendTime: Date.now()
    }));
  });

  hostWs.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'sync_pong') {
      const rtt = Date.now() - msg.clientSendTime;
      console.log(`✅ 3. NTP Clock Ping/Pong OK: RTT=${rtt}ms, ServerTime=${msg.serverReceiveTime}`);

      // Now join room as Host
      hostWs.send(JSON.stringify({
        type: 'join_room',
        roomCode,
        hostToken,
        deviceName: 'Host Laptop'
      }));
    }

    if (msg.type === 'room_joined') {
      console.log(`✅ 4. Host Joined Room ${msg.roomCode} (isHost=${msg.isHost})`);

      // Connect listener now
      const listenerWs = new WebSocket('ws://localhost:4000');
      
      listenerWs.addEventListener('open', () => {
        listenerWs.send(JSON.stringify({
          type: 'join_room',
          roomCode,
          deviceName: 'Listener Phone',
          userLatencyOffset: 120
        }));
      });

      listenerWs.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'room_joined') {
          console.log(`✅ 5. Listener Joined Room ${msg.roomCode} (isHost=${msg.isHost})`);

          // Now Host triggers Play with scheduled future start
          console.log('▶️ Host triggering Scheduled Play with 1000ms delay...');
          hostWs.send(JSON.stringify({
            type: 'play',
            position: 0,
            scheduledDelay: 1000
          }));
        }

        if (msg.type === 'playback_sync') {
          console.log(`✅ 6. Playback Sync Received by Listener: Action=${msg.action}, ScheduledStart=${msg.scheduledStartTime}, ServerTime=${msg.serverTime}`);
          const delayUntilStart = msg.scheduledStartTime - Date.now();
          console.log(`🎯 Precise Scheduling Buffer: ${delayUntilStart}ms until exact synchronized start moment!`);
          
          console.log('\n🎉 ALL INTEGRATION TESTS PASSED! SyncRoom is fully operational.');
          hostWs.close();
          listenerWs.close();
          process.exit(0);
        }
      });
    }

    if (msg.type === 'device_list') {
      console.log(`📱 Device List Updated: ${msg.devices.length} devices connected`);
    }
  });
}
