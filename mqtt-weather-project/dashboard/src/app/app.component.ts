import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import Chart from 'chart.js/auto';
import { Station, WeatherService } from './weather.service';

type Point = { x: number; y: number };
type LineChart = Chart<'line', Point[]>;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tempCanvas') tempCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('humCanvas') humCanvas!: ElementRef<HTMLCanvasElement>;

  readonly now = signal(Date.now());

  private tempChart?: LineChart;
  private humChart?: LineChart;
  private timer?: number;
  private readonly colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];

  constructor(readonly weather: WeatherService) {
    effect(() => {
      const stations = this.weather.stations();
      this.updateChart(this.tempChart, stations, 'temperature');
      this.updateChart(this.humChart, stations, 'humidity');
    });
  }

  ngAfterViewInit(): void {
    this.tempChart = this.createChart(this.tempCanvas.nativeElement, 'Temperatur (°C)');
    this.humChart = this.createChart(this.humCanvas.nativeElement, 'Luftfeuchtigkeit (%)');
    this.timer = window.setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timer);
    this.tempChart?.destroy();
    this.humChart?.destroy();
  }

  secondsAgo(time: number): number {
    return Math.max(0, Math.round((this.now() - time) / 1000));
  }

  private createChart(canvas: HTMLCanvasElement, title: string): LineChart {
    return new Chart<'line', Point[]>(canvas, {
      type: 'line',
      data: { datasets: [] },
      options: {
        animation: false,
        plugins: { title: { display: true, text: title } },
        scales: {
          x: { type: 'linear', ticks: { callback: value => new Date(Number(value)).toLocaleTimeString() } }
        }
      }
    });
  }

  private updateChart(chart: LineChart | undefined, stations: Station[], field: 'temperature' | 'humidity'): void {
    if (!chart) {
      return;
    }
    chart.data.datasets = stations.map((s, i) => ({
      label: s.stationId,
      data: s.history.map(m => ({ x: m.t, y: m[field] })),
      borderColor: this.colors[i % this.colors.length],
      pointRadius: 2
    }));
    chart.update();
  }
}