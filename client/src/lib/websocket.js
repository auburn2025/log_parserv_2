export class LogWebSocket {
    onLogEntry;
    onStatusChange;
    onError;
    ws = null;
    reconnectTimeout = null;
    reconnectDelay = 1000;
    maxReconnectDelay = 30000;
    currentDelay = this.reconnectDelay;
    constructor(onLogEntry, onStatusChange, onError) {
        this.onLogEntry = onLogEntry;
        this.onStatusChange = onStatusChange;
        this.onError = onError;
    }
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/logs`;
            this.ws = new WebSocket(wsUrl);
            this.onStatusChange('connecting');
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.onStatusChange('connected');
                this.currentDelay = this.reconnectDelay;
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
            };
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    switch (data.type) {
                        case 'logEntry':
                            this.onLogEntry(data.data);
                            break;
                        case 'status':
                            this.onStatusChange(data.status);
                            break;
                        case 'subscribed':
                            console.log('Subscribed to file:', data.fileName);
                            break;
                        default:
                            console.warn('Unknown message type:', data.type);
                    }
                }
                catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.onStatusChange('disconnected');
                if (event.code !== 1000) { // Not a normal closure
                    this.scheduleReconnect();
                }
            };
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.onError('Connection error occurred');
                this.onStatusChange('disconnected');
            };
        }
        catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.onError('Failed to connect to server');
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            return;
        }
        this.reconnectTimeout = window.setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect();
            // Exponential backoff
            this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
        }, this.currentDelay);
    }
    subscribeToFile(fileName) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                fileName
            }));
        }
    }
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close(1000, 'User disconnected');
            this.ws = null;
        }
    }
    getConnectionState() {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }
}
