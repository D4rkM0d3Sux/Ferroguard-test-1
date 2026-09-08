import { HardwareConfig, SerialLogEntry } from '../types';

export class EspConnectionService {
  private config: HardwareConfig;
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;
  private pollIntervalTimer: any = null;
  private onStatusCallbacks: Array<(data: any) => void> = [];
  private onLogCallbacks: Array<(entry: SerialLogEntry) => void> = [];
  private onMetalDetectedCallbacks: Array<(signal: number) => void> = [];

  constructor(initialConfig: HardwareConfig) {
    this.config = initialConfig;
  }

  public setConfig(newConfig: Partial<HardwareConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): HardwareConfig {
    return this.config;
  }

  public onStatus(cb: (data: any) => void) {
    this.onStatusCallbacks.push(cb);
    return () => {
      this.onStatusCallbacks = this.onStatusCallbacks.filter(c => c !== cb);
    };
  }

  public onLog(cb: (entry: SerialLogEntry) => void) {
    this.onLogCallbacks.push(cb);
    return () => {
      this.onLogCallbacks = this.onLogCallbacks.filter(c => c !== cb);
    };
  }

  public onMetalDetected(cb: (signal: number) => void) {
    this.onMetalDetectedCallbacks.push(cb);
    return () => {
      this.onMetalDetectedCallbacks = this.onMetalDetectedCallbacks.filter(c => c !== cb);
    };
  }

  private emitLog(direction: 'in' | 'out' | 'system', message: string) {
    const entry: SerialLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      direction,
      message,
    };
    this.onLogCallbacks.forEach(cb => cb(entry));
  }

  // --- Web Serial API Connection ---
  public async connectSerial(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      this.emitLog('system', 'Error: Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera, or use WiFi HTTP mode.');
      throw new Error('Web Serial not supported in this browser. Please use Chrome/Edge or WiFi HTTP mode.');
    }

    try {
      this.emitLog('system', 'Requesting USB Serial port for ESP8266 (Baud: 115200)...');
      // @ts-ignore
      this.serialPort = await navigator.serial.requestPort();
      await this.serialPort.open({ baudRate: this.config.baudRate || 115200 });

      this.config.connected = true;
      this.config.connectionType = 'serial';
      this.emitLog('system', 'Connected to ESP8266 via USB Serial @ 115200 baud.');

      this.startSerialReader();
      return true;
    } catch (err: any) {
      this.emitLog('system', `Serial connection failed: ${err.message || err}`);
      this.config.connected = false;
      return false;
    }
  }

  private async startSerialReader() {
    if (!this.serialPort || !this.serialPort.readable) return;

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
    this.serialReader = textDecoder.readable.getReader();

    let buffer = '';
    try {
      while (true) {
        const { value, done } = await this.serialReader.read();
        if (done) {
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.handleIncomingLine(trimmed);
            }
          }
        }
      }
    } catch (err: any) {
      this.emitLog('system', `Serial read stream terminated: ${err.message || err}`);
    } finally {
      this.config.connected = false;
      this.emitLog('system', 'Serial port disconnected.');
    }
  }

  private handleIncomingLine(line: string) {
    this.emitLog('in', line);

    // Try parsing as JSON telemetry
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const data = JSON.parse(line);
        if (data.event === 'METAL_DETECTED') {
          this.onMetalDetectedCallbacks.forEach(cb => cb(data.raw || 512));
        }
        this.onStatusCallbacks.forEach(cb => cb(data));
      } catch {
        // Not valid JSON, keep as raw text
      }
    }
  }

  public async sendSerialCommand(cmd: string): Promise<boolean> {
    if (!this.serialPort || !this.serialPort.writable) {
      if (this.config.connectionType === 'simulation') {
        this.emitLog('out', `[SIM]: ${cmd}`);
        return true;
      }
      this.emitLog('system', 'Cannot send: Serial port not writable.');
      return false;
    }

    try {
      this.emitLog('out', cmd);
      const textEncoder = new TextEncoder();
      const writer = this.serialPort.writable.getWriter();
      await writer.write(textEncoder.encode(cmd + '\n'));
      writer.releaseLock();
      return true;
    } catch (err: any) {
      this.emitLog('system', `Send error: ${err.message || err}`);
      return false;
    }
  }

  // --- WiFi HTTP Polling Connection ---
  public startWifiPolling() {
    this.stopWifiPolling();
    this.emitLog('system', `Starting HTTP polling to http://${this.config.ipAddress}:${this.config.port}/api/status`);

    const poll = async () => {
      try {
        const start = performance.now();
        const res = await fetch(`http://${this.config.ipAddress}:${this.config.port}/api/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(1500),
        });
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          const json = await res.json();
          this.config.connected = true;
          this.config.lastPingMs = elapsed;
          this.onStatusCallbacks.forEach(cb => cb(json));
        }
      } catch (err: any) {
        // Connection issue or CORS
        this.config.connected = false;
      }
    };

    poll();
    this.pollIntervalTimer = setInterval(poll, 600);
  }

  public stopWifiPolling() {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
  }

  public async sendWifiCommand(endpoint: string, body?: any): Promise<boolean> {
    try {
      this.emitLog('out', `POST http://${this.config.ipAddress}:${this.config.port}${endpoint}`);
      const res = await fetch(`http://${this.config.ipAddress}:${this.config.port}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch (err: any) {
      this.emitLog('system', `HTTP send error: ${err.message || err}`);
      return false;
    }
  }

  public async disconnect() {
    this.stopWifiPolling();
    if (this.serialReader) {
      try {
        await this.serialReader.cancel();
      } catch {}
      this.serialReader = null;
    }
    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch {}
      this.serialPort = null;
    }
    this.config.connected = false;
    this.emitLog('system', 'Disconnected from hardware.');
  }
}
