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

export interface BotStatus {
  connected: boolean;
  user: {
    id: string;
    tag: string;
    username: string;
    avatar: string | null;
  } | null;
  ping: number | null;
  error: string | null;
  lastHeartbeat: string | null;
  guildsCount: number;
}

export interface AppStatusResponse {
  bot: BotStatus;
  scanner: {
    running: boolean;
    activeRadars: number;
    cookieActive: boolean;
  };
  stats: {
    totalScans: number;
    totalAlerts: number;
    startedAt: string;
    activeRadars: number;
    totalRadars: number;
    totalSeenItems: number;
  };
  hasTokenInEnv: boolean;
  clientId: string;
}

export interface MarketAnalysisReport {
  sampleCount: number;
  medianPrice: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  suggestedResaleMin: number;
  suggestedResaleTarget: number;
  suggestedResaleMax: number;
  grossMargin: number;
  netMargin: number;
  roiPercentage: number;
  dealRating: 'MEGA_PEPITE' | 'TRES_BONNE_AFFAIRE' | 'BON_PLAN' | 'FAIBLE_MARGE';
  dealBadge: string;
  comparablesSummary: string;
}
