export interface MarketReport {
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

export class MarketAnalyzer {
  /**
   * Calculates real statistics on price samples: median, avg, resale ranges and estimated net margins.
   */
  public analyzePrices(purchasePrice: number, rawPrices: number[]): MarketReport {
    // Clean and filter valid prices
    const validPrices = rawPrices
      .map((p) => Number(p))
      .filter((p) => !isNaN(p) && p > 1 && p < 10000)
      .sort((a, b) => a - b);

    const activeSample = validPrices.length > 0 ? validPrices : [Math.max(1, purchasePrice)];

    // Median
    const mid = Math.floor(activeSample.length / 2);
    const medianPrice =
      activeSample.length % 2 !== 0
        ? activeSample[mid]
        : (activeSample[mid - 1] + activeSample[mid]) / 2;

    // Average
    const sum = activeSample.reduce((acc, curr) => acc + curr, 0);
    const averagePrice = Math.round((sum / activeSample.length) * 10) / 10;

    const minPrice = activeSample[0];
    const maxPrice = activeSample[activeSample.length - 1];

    // Resale Price targets
    // Target = roughly 92% of market median for fast, competitive sale
    const suggestedResaleMin = Math.round(medianPrice * 0.85);
    const suggestedResaleTarget = Math.round(medianPrice * 0.95);
    const suggestedResaleMax = Math.round(medianPrice * 1.1);

    // Vinted & logistics friction estimation (~7% commission buffer & packing materials)
    const estimatedDeductions = Math.round((suggestedResaleTarget * 0.05 + 1.5) * 10) / 10;
    const grossMargin = Math.round((suggestedResaleTarget - purchasePrice) * 10) / 10;
    const netMargin = Math.max(0, Math.round((grossMargin - estimatedDeductions) * 10) / 10);
    const roiPercentage = purchasePrice > 0 ? Math.round((netMargin / purchasePrice) * 100) : 0;

    let dealRating: MarketReport['dealRating'] = 'FAIBLE_MARGE';
    let dealBadge = '⚠️ Marge limitée';

    if (roiPercentage >= 65 || (purchasePrice <= medianPrice * 0.55 && netMargin >= 25)) {
      dealRating = 'MEGA_PEPITE';
      dealBadge = '🔥 MEGA PÉPITE';
    } else if (roiPercentage >= 35 || netMargin >= 20) {
      dealRating = 'TRES_BONNE_AFFAIRE';
      dealBadge = '⚡ TRÈS BONNE AFFAIRE';
    } else if (roiPercentage >= 20 || netMargin >= 10) {
      dealRating = 'BON_PLAN';
      dealBadge = '✅ BON PLAN';
    }

    return {
      sampleCount: activeSample.length,
      medianPrice: Math.round(medianPrice * 10) / 10,
      averagePrice,
      minPrice,
      maxPrice,
      suggestedResaleMin,
      suggestedResaleTarget,
      suggestedResaleMax,
      grossMargin,
      netMargin,
      roiPercentage,
      dealRating,
      dealBadge,
      comparablesSummary: `${activeSample.length} articles analysés (médiane: ${Math.round(medianPrice)}€, fourchette: ${minPrice}€ - ${maxPrice}€)`,
    };
  }

  /**
   * Generates tailored negotiation offer string with 20% to 25% discount.
   */
  public generateNegotiationOffer(sellerPrice: number, brand: string): string {
    const discountedPrice = Math.max(1, Math.round(sellerPrice * 0.75));
    return `Bonjour ! Votre article ${brand ? brand + ' ' : ''}m'intéresse beaucoup. Seriez-vous d'accord pour ${discountedPrice}€ au lieu de ${sellerPrice}€ avec paiement et achat immédiat ? Merci et bonne journée !`;
  }
}

export const marketAnalyzer = new MarketAnalyzer();
