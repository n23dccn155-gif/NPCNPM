let clients = [];

const registerClient = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Set headers for CORS if needed, but app.js already has cors() middleware
  res.write(': ping\n\n');

  clients.push(res);
  console.log(`[Realtime] Client connected. Total active clients: ${clients.length}`);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
    console.log(`[Realtime] Client disconnected. Total active clients: ${clients.length}`);
  });
};

const sendRealtimeEvent = (type, data) => {
  const payload = JSON.stringify({ type, data });
  console.log(`[Realtime] Broadcasting event: ${type}`, data);
  clients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {
      console.error('[Realtime] Failed to write to client:', e);
    }
  });
};

module.exports = {
  registerClient,
  sendRealtimeEvent
};
