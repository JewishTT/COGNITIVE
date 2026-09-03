export class EventBus {
  constructor() {
    this.clients = new Set();
    this.listeners = new Map();
  }

  addClient(res) {
    this.clients.add(res);

    // Remove client on close
    res.on('close', () => {
      this.clients.delete(res);
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ event: 'connected', data: { timestamp: new Date().toISOString() } })}\n\n`);
  }

  emit(event, data) {
    const message = `data: ${JSON.stringify({ event, data })}\n\n`;

    // Send to SSE clients
    this.clients.forEach(client => {
      try {
        client.write(message);
      } catch (err) {
        // Client disconnected
        this.clients.delete(client);
      }
    });

    // Notify internal listeners
    const eventListeners = this.listeners.get(event) || [];
    eventListeners.forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error(`Event listener error for ${event}:`, err);
      }
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const eventListeners = this.listeners.get(event) || [];
    const index = eventListeners.indexOf(callback);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}