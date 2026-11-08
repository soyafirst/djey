import fs from 'fs';
import path from 'path';

export interface RadarFilter {
  id: string;
  userId: string;
  userName?: string;
  name: string;
  vintedUrl: string;
  maxPrice: number;
  sizes: string[];
  active: boolean;
  createdAt: string;
  itemsFound: number;
  lastScannedAt: string | null;
}

export interface VintedAlert {
  id: string;
  radarId: string;
  userId: string;
  title: string;
  brand: string;
  size: string;
  price: number;
  medianPrice: number;
  estimatedMargin: number;
  condition: string;
  url: string;
  photo: string;
  timestamp: string;
  ignored?: boolean;
}

export interface TrackedItem {
  id: string;
  userId: string;
  url: string;
  title: string;
  price: number;
  status: 'available' | 'sold' | 'reserved';
  addedAt: string;
}

export interface DatabaseSchema {
  radars: RadarFilter[];
  seenItemIds: string[];
  alerts: VintedAlert[];
  trackedItems: TrackedItem[];
  stats: {
    totalScans: number;
    totalAlerts: number;
    startedAt: string;
  };
}

const DB_PATH = path.resolve(process.cwd(), 'data', 'db.json');

class LocalDatabase {
  private data: DatabaseSchema = {
    radars: [],
    seenItemIds: [],
    alerts: [],
    trackedItems: [],
    stats: {
      totalScans: 0,
      totalAlerts: 0,
      startedAt: new Date().toISOString(),
    },
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          ...this.data,
          ...parsed,
          stats: { ...this.data.stats, ...(parsed.stats || {}) },
        };
      } else {
        // Seed initial sample radar for immediate user experience
        this.seedInitialData();
        this.save();
      }
    } catch (err) {
      console.warn('Could not read DB file, starting with memory store:', err);
      this.seedInitialData();
    }
  }

  private seedInitialData() {
    this.data.radars = [
      {
        id: 'radar_sample_1',
        userId: 'default_user',
        userName: 'DJEY Demo User',
        name: 'Doudounes Ralph Lauren',
        vintedUrl: 'https://www.vinted.fr/catalog?search_text=doudoune+ralph+lauren&price_to=60',
        maxPrice: 60,
        sizes: ['M', 'L'],
        active: true,
        createdAt: new Date().toISOString(),
        itemsFound: 3,
        lastScannedAt: new Date().toISOString(),
      },
      {
        id: 'radar_sample_2',
        userId: 'default_user',
        userName: 'DJEY Demo User',
        name: 'Sneakers Nike Dunk Low',
        vintedUrl: 'https://www.vinted.fr/catalog?search_text=nike+dunk+low&price_to=85',
        maxPrice: 85,
        sizes: ['42', '43', '44'],
        active: true,
        createdAt: new Date().toISOString(),
        itemsFound: 5,
        lastScannedAt: new Date().toISOString(),
      },
    ];

    this.data.alerts = [
      {
        id: 'v_alert_101',
        radarId: 'radar_sample_1',
        userId: 'default_user',
        title: 'Doudoune sans manche Polo Ralph Lauren Noire',
        brand: 'Ralph Lauren',
        size: 'L',
        price: 38,
        medianPrice: 75,
        estimatedMargin: 32.5,
        condition: 'Très bon état',
        url: 'https://www.vinted.fr/items/492019482-doudoune-ralph-lauren',
        photo: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&auto=format&fit=crop&q=80',
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        id: 'v_alert_102',
        radarId: 'radar_sample_2',
        userId: 'default_user',
        title: 'Nike Dunk Low Retro Panda Original',
        brand: 'Nike',
        size: '43',
        price: 55,
        medianPrice: 110,
        estimatedMargin: 48,
        condition: 'Neuf avec étiquette',
        url: 'https://www.vinted.fr/items/492019999-nike-dunk-low-panda',
        photo: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
        timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
      },
    ];
    this.data.seenItemIds = ['492019482', '492019999'];
    this.data.stats.totalAlerts = 2;
    this.data.stats.totalScans = 142;
  }

  private save() {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database:', err);
    }
  }

  // Radar Methods
  public getRadars(userId?: string): RadarFilter[] {
    if (userId) {
      return this.data.radars.filter((r) => r.userId === userId);
    }
    return this.data.radars;
  }

  public getRadarById(id: string): RadarFilter | undefined {
    return this.data.radars.find((r) => r.id === id);
  }

  public addRadar(radar: Omit<RadarFilter, 'id' | 'createdAt' | 'itemsFound' | 'lastScannedAt'>): RadarFilter {
    const newRadar: RadarFilter = {
      ...radar,
      id: `radar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      itemsFound: 0,
      lastScannedAt: null,
    };
    this.data.radars.push(newRadar);
    this.save();
    return newRadar;
  }

  public updateRadar(id: string, updates: Partial<RadarFilter>): RadarFilter | null {
    const idx = this.data.radars.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.radars[idx] = { ...this.data.radars[idx], ...updates };
    this.save();
    return this.data.radars[idx];
  }

  public deleteRadar(id: string): boolean {
    const initialLen = this.data.radars.length;
    this.data.radars = this.data.radars.filter((r) => r.id !== id);
    if (this.data.radars.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public stopAllRadarsForUser(userId: string): number {
    let count = 0;
    this.data.radars.forEach((r) => {
      if (r.userId === userId && r.active) {
        r.active = false;
        count++;
      }
    });
    if (count > 0) this.save();
    return count;
  }

  public resumeAllRadarsForUser(userId: string): number {
    let count = 0;
    this.data.radars.forEach((r) => {
      if (r.userId === userId && !r.active) {
        r.active = true;
        count++;
      }
    });
    if (count > 0) this.save();
    return count;
  }

  // Deduplication
  public isItemSeen(itemId: string): boolean {
    return this.data.seenItemIds.includes(String(itemId));
  }

  public markItemSeen(itemId: string) {
    const sId = String(itemId);
    if (!this.data.seenItemIds.includes(sId)) {
      this.data.seenItemIds.push(sId);
      // Cap seen items at 5,000 to prevent unbounded memory growth
      if (this.data.seenItemIds.length > 5000) {
        this.data.seenItemIds.splice(0, 500);
      }
      this.save();
    }
  }

  // Alerts
  public addAlert(alert: Omit<VintedAlert, 'id' | 'timestamp'>): VintedAlert {
    const newAlert: VintedAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.alerts.unshift(newAlert);
    if (this.data.alerts.length > 200) {
      this.data.alerts.pop();
    }
    this.data.stats.totalAlerts++;
    this.save();
    return newAlert;
  }

  public getAlerts(userId?: string): VintedAlert[] {
    if (userId) {
      return this.data.alerts.filter((a) => a.userId === userId);
    }
    return this.data.alerts;
  }

  public markAlertIgnored(alertId: string) {
    const alert = this.data.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.ignored = true;
      this.save();
    }
  }

  // Tracked Items
  public addTrackedItem(item: Omit<TrackedItem, 'id' | 'addedAt'>): TrackedItem {
    const newItem: TrackedItem = {
      ...item,
      id: `track_${Date.now()}`,
      addedAt: new Date().toISOString(),
    };
    this.data.trackedItems.push(newItem);
    this.save();
    return newItem;
  }

  public getTrackedItems(userId?: string): TrackedItem[] {
    if (userId) {
      return this.data.trackedItems.filter((t) => t.userId === userId);
    }
    return this.data.trackedItems;
  }

  // Stats
  public recordScan() {
    this.data.stats.totalScans++;
  }

  public getStats() {
    return {
      ...this.data.stats,
      activeRadars: this.data.radars.filter((r) => r.active).length,
      totalRadars: this.data.radars.length,
      totalSeenItems: this.data.seenItemIds.length,
    };
  }
}

export const db = new LocalDatabase();
