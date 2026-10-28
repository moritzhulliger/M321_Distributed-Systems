import { Injectable, signal } from '@angular/core';
import mqtt from 'mqtt';

export interface Measurement {
  t: number;
  temperature: number;
  humidity: number;
}

export interface Station {
  stationId: string;
  temperature: number | null;
  humidity: number | null;
  received: number | null;
  status: string;
  history: Measurement[];
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  readonly stations = signal<Station[]>([]);
  readonly connected = signal(false);

  private readonly maxHistory = 60;

  constructor() {
    const client = mqtt.connect(`ws://${window.location.hostname}:9001`, { reconnectPeriod: 2000 });

    client.on('connect', () => {
      this.connected.set(true);
      client.subscribe(['weather/validated', 'weather/status/#'], { qos: 1 });
    });
    client.on('close', () => this.connected.set(false));
    client.on('message', (topic, payload) => this.handleMessage(topic, payload.toString()));
  }

  private handleMessage(topic: string, payload: string): void {
    let data: any;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }
    if (typeof data?.stationId !== 'string') {
      return;
    }

    this.stations.update(list => {
      const old = list.find(s => s.stationId === data.stationId) ?? this.emptyStation(data.stationId);
      const updated = topic.startsWith('weather/status/')
        ? { ...old, status: data.status }
        : this.addMeasurement(old, data.temperature, data.humidity);
      const others = list.filter(s => s.stationId !== data.stationId);
      return [...others, updated].sort((a, b) => a.stationId.localeCompare(b.stationId));
    });
  }

  private addMeasurement(station: Station, temperature: number, humidity: number): Station {
    const now = Date.now();
    const history = [...station.history, { t: now, temperature, humidity }].slice(-this.maxHistory);
    return { ...station, temperature, humidity, received: now, history };
  }

  private emptyStation(stationId: string): Station {
    return { stationId, temperature: null, humidity: null, received: null, status: 'unbekannt', history: [] };
  }
}