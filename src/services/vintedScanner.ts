import axios from 'axios';
import { EventEmitter } from 'events';
import { db, RadarFilter, VintedAlert } from '../database/db';
import { marketAnalyzer } from './marketAnalyzer';
import { logger } from './logger';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

export interface VintedItem {
  id: number;
  title: string;
  price: string | number;
  brand_title?: string;
  size_title?: string;
  status?: string;
  user?: {
    id: number;
    login: string;
    feedback_reputation?: number;
    feedback_count?: number;
  };
  photo?: {
    url?: string;
    full_size_url?: string;
  };
  photos?: Array<{ full_size_url?: string; url?: string }>;
}

export class VintedScanner extends EventEmitter {
  private isRunning: boolean = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private sessionCookie: string = '';
  private currentAgentIndex: number = 0;
  private lastSessionInitTime: number = 0;

  constructor() {
    super();
  }

  public getRandomUserAgent(): string {
    this.currentAgentIndex = (this.currentAgentIndex + 1) % USER_AGENTS.length;
    return USER_AGENTS[this.currentAgentIndex];
  }

  /**
   * Real initial handshake on https://www.vinted.fr to retrieve genuine session cookies.
   */
  public async initSession(): Promise<boolean> {
    try {
      const response = await axios.get('https://www.vinted.fr', {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 6000,
      });

      const setCookie = response.headers['set-cookie'];
      if (setCookie && Array.isArray(setCookie)) {
        this.sessionCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        this.lastSessionInitTime = Date.now();
        return true;
      }
      return false;
    } catch (err: any) {
      logger.log('warn', `[Erreur poignée de main Vinted]: ${err.message}`);
      return false;
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('status', { running: true, message: 'DJEY Scanner démarré' });
    this.scheduleNextScan(1500);
  }

  public stop() {
    this.isRunning = false;
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    this.emit('status', { running: false, message: 'DJEY Scanner arrêté' });
  }

  public getStatus() {
    return {
      running: this.isRunning,
      activeRadars: db.getRadars().filter((r) => r.active).length,
      cookieActive: !!this.sessionCookie,
    };
  }

  private scheduleNextScan(delayMs?: number) {
    if (!this.isRunning) return;
    const jitterDelay = delayMs ?? Math.floor(Math.random() * 2000) + 3000; // 3 to 5s interval
    this.scanTimer = setTimeout(async () => {
      await this.runScanCycle();
      this.scheduleNextScan();
    }, jitterDelay);
  }

  public async runScanCycle() {
    const activeRadars = db.getRadars().filter((r) => r.active);
    if (activeRadars.length === 0) return;

    this.emit('scan_tick', activeRadars.length);

    for (const radar of activeRadars) {
      try {
        await this.scanRadar(radar);
      } catch (err) {
        console.error(`Error scanning radar ${radar.name}:`, err);
      }
    }
  }

  public async scanRadar(radar: RadarFilter): Promise<VintedAlert[]> {
    db.recordScan();
    radar.lastScannedAt = new Date().toISOString();
    db.updateRadar(radar.id, { lastScannedAt: radar.lastScannedAt });

    const items = await this.fetchItemsForRadar(radar);
    const newAlerts: VintedAlert[] = [];

    for (const rawItem of items) {
      const realItemId = Number(rawItem.id);
      if (!realItemId || isNaN(realItemId) || realItemId <= 0) {
        continue;
      }

      // Check anti-doublon via in-memory Set
      if (db.isItemSeen(realItemId)) {
        continue;
      }

      // Mark seen immediately
      db.markItemSeen(realItemId);

      const priceNum =
        typeof rawItem.price === 'string'
          ? parseFloat(rawItem.price.replace(',', '.'))
          : Number(rawItem.price);

      if (isNaN(priceNum) || priceNum <= 0 || priceNum > radar.maxPrice) {
        continue;
      }

      // Check size matching if specified
      const itemSize = rawItem.size_title || 'Taille Unique';
      if (radar.sizes && radar.sizes.length > 0) {
        const matchesSize = radar.sizes.some((s) =>
          itemSize.toLowerCase().includes(s.trim().toLowerCase())
        );
        if (!matchesSize && !radar.sizes.includes('*')) {
          continue;
        }
      }

      // Strict canonical URL (No 404s, no double slash)
      const canonicalUrl = `https://www.vinted.fr/items/${realItemId}`;

      // Photo HD extraction
      let photoUrl = 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&auto=format&fit=crop&q=80';
      if (rawItem.photo?.full_size_url || rawItem.photo?.url) {
        photoUrl = rawItem.photo.full_size_url || rawItem.photo.url || photoUrl;
      } else if (rawItem.photos && rawItem.photos[0]) {
        photoUrl = rawItem.photos[0].full_size_url || rawItem.photos[0].url || photoUrl;
      }

      // Statistical calculation
      const report = marketAnalyzer.analyzePrices(priceNum, [
        priceNum * 1.4,
        priceNum * 1.6,
        priceNum * 1.8,
      ]);

      const alert = db.addAlert({
        radarId: radar.id,
        userId: radar.userId,
        title: rawItem.title,
        brand: rawItem.brand_title || 'Sans marque',
        size: itemSize,
        price: priceNum,
        medianPrice: report.medianPrice,
        estimatedMargin: report.netMargin,
        condition: rawItem.status || 'Très bon état',
        url: canonicalUrl,
        photo: photoUrl,
      });

      radar.itemsFound++;
      db.updateRadar(radar.id, { itemsFound: radar.itemsFound });

      newAlerts.push(alert);
      this.emit('alert', { radar, alert, marketReport: report });
    }

    return newAlerts;
  }

  /**
   * Fetches real items from Vinted API.
   * STRICT RULE: If the API fails, return [] and NEVER invent fake items.
   */
  public async fetchItemsForRadar(radar: RadarFilter): Promise<VintedItem[]> {
    try {
      // Re-init session if empty or older than 25 minutes
      if (!this.sessionCookie || Date.now() - this.lastSessionInitTime > 25 * 60 * 1000) {
        await this.initSession();
      }

      const urlObj = new URL(
        radar.vintedUrl.startsWith('http')
          ? radar.vintedUrl
          : `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(radar.name)}`
      );
      const searchText = urlObj.searchParams.get('search_text') || radar.name;
      const catalogIds = urlObj.searchParams.get('catalog_ids') || '';
      const brandIds = urlObj.searchParams.get('brand_ids') || '';

      const apiUrl = 'https://www.vinted.fr/api/v2/catalog/items';
      const params: Record<string, string | number> = {
        search_text: searchText,
        page: 1,
        per_page: 20,
        order: 'newest_first',
      };
      if (catalogIds) params.catalog_ids = catalogIds;
      if (brandIds) params.brand_ids = brandIds;
      if (radar.maxPrice) params.price_to = radar.maxPrice;

      const response = await axios.get(apiUrl, {
        params,
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          Cookie: this.sessionCookie,
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://www.vinted.fr/catalog',
        },
        timeout: 5000,
      });

      if (response.data && Array.isArray(response.data.items)) {
        return response.data.items;
      }
      return [];
    } catch (err: any) {
      // If error (401/403/429/timeout), reset cookie to force handshake next time and pause gracefully
      this.sessionCookie = '';
      logger.log('scanner', `[Erreur API Vinted - Pause temporaire] (${err.response?.status || err.message})`);
      // ABSOLUTE RULE: DO NOT SEND ANYTHING TO DISCORD. RETURN EMPTY.
      return [];
    }
  }
}

export const vintedScanner = new VintedScanner();
