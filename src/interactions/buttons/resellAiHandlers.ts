import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  Message,
} from 'discord.js';
import axios from 'axios';
import {
  resellAiService,
  comparablesCache,
  exploreCatalogCache,
  topSalesCache,
} from '../../services/resellAiService';
import { db } from '../../database/db';
import { vintedScanner } from '../../services/vintedScanner';
import { logger } from '../../services/logger';

// In-memory user active session state for DM photo waiting
export interface UserResellSession {
  mode: 'IDENTIFY' | 'LEGIT_CHECK' | 'SEO_LISTING' | null;
  lastIdentifiedItem?: {
    searchId: string;
    brand: string;
    model: string;
    era?: string;
    medianPrice?: number;
    recommendedPrice?: number;
  };
  lastGeneratedListing?: {
    title: string;
    description: string;
    price: number;
  };
  updatedAt: number;
}

const userSessions = new Map<string, UserResellSession>();

export function getUserSession(userId: string): UserResellSession {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { mode: null, updatedAt: Date.now() });
  }
  return userSessions.get(userId)!;
}

export function setUserSession(userId: string, data: Partial<UserResellSession>) {
  const current = getUserSession(userId);
  userSessions.set(userId, { ...current, ...data, updatedAt: Date.now() });
}

export async function handleResellButtonClicks(interaction: ButtonInteraction): Promise<boolean> {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  // 1. 🔍 Legit Check IA Button
  if (customId === 'btn_legit_check') {
    setUserSession(userId, { mode: 'LEGIT_CHECK' });

    const embed = new EmbedBuilder()
      .setTitle('🔍 LEGIT CHECK IA · Vérification d\'Authenticité')
      .setColor(0x5865f2)
      .setDescription(
        `📸 **Envoie les photos de ta pièce directement dans ce message privé :**\n\n` +
          `Pour un diagnostic précis, envoie au choix :\n` +
          `• 🏷️ **Photo de l'étiquette col / taille** (police, typographie, espacements)\n` +
          `• 🧵 **Photo du logo brodé ou imprimé** (qualité des surpiqûres et proportions)\n` +
          `• 🧼 **Photo de l'étiquette intérieure de lavage / composition**\n\n` +
          `*L'IA de vision inspectera immédiatement la conformité et te délivrera un rapport détaillé.*`
      )
      .setFooter({ text: 'DJEY Expert Resell IA • En attente de ta photo en DM' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return true;
  }

  // 2. 🏷️ Identifier & Estimer Button
  if (customId === 'btn_identify_estimate') {
    setUserSession(userId, { mode: 'IDENTIFY' });

    const embed = new EmbedBuilder()
      .setTitle('🏷️ IDENTIFICATION VISUELLE & ESTIMATION RÉELLE')
      .setColor(0x9b59b6)
      .setDescription(
        `📸 **Envoie la photo de l'article à analyser en DM** (ou écris son nom/marque/modèle).\n\n` +
          `L'intelligence artificielle va :\n` +
          `1. Identifier la **Marque**, le **Modèle exact** et l'**Époque** (Vintage 90s, Y2K).\n` +
          `2. Interroger en direct l'API Vinted pour récupérer les annonces comparables similaires.\n` +
          `3. Calculer la **Médiane Mathématique Réelle** et le **Prix Optimal de Revente Rapide** sous 48h !\n` +
          `4. Te donner la liste transparente de tous les liens Vinted réels analysés.`
      )
      .setFooter({ text: 'DJEY Expert Resell IA • Glisse ta photo ici-même' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return true;
  }

  // 3. 📋 Voir la liste des comparables
  if (customId.startsWith('btn_view_comparables_')) {
    await interaction.deferReply({ ephemeral: true });

    const searchId = customId.replace('btn_view_comparables_', '');
    let data = comparablesCache.get(searchId);

    // If cache missed, attempt dynamic recovery from session
    if (!data || !data.items || data.items.length === 0) {
      const session = getUserSession(userId);
      if (session.lastIdentifiedItem) {
        const item = session.lastIdentifiedItem;
        const fresh = await resellAiService.queryComparableVintedPrices(
          item.brand || 'Vinted',
          item.model || 'Streetwear',
          'Vêtement'
        );
        data = {
          searchId,
          brand: item.brand,
          model: item.model,
          medianPrice: fresh.medianPrice,
          minPrice: fresh.priceRange.min,
          maxPrice: fresh.priceRange.max,
          recommendedSellPrice: fresh.recommendedSellPrice,
          items: fresh.comparables,
          timestamp: Date.now(),
        };
        comparablesCache.set(searchId, data);
      }
    }

    if (!data || !data.items || data.items.length === 0) {
      await interaction.editReply({
        content: '⚠️ Aucune liste de comparables disponible pour cette recherche (recherche expirée). N\'hésite pas à ré-analyser l\'article !',
      });
      return true;
    }

    const listLines = data.items.slice(0, 20).map((it) => {
      return `• **${it.price} €** — ${it.size} — @${it.seller} (${it.rating}★) ➔ [Lien direct](${it.url})`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`📋 Comparables Vinted Réels · ${data.brand} ${data.model}`)
      .setColor(0x5865f2)
      .setDescription(
        `Voici les **${data.items.length} annonces réelles** utilisées pour le calcul de la médiane :\n\n` +
          listLines.join('\n') +
          (data.items.length > 20 ? `\n*... et ${data.items.length - 20} autres annonces.*` : '') +
          `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📉 **Prix le plus bas constaté :** **${data.minPrice} €**\n` +
          `📊 **Médiane retenue :** **~${data.medianPrice} €**\n` +
          `📈 **Prix le plus haut constaté :** **${data.maxPrice} €**`
      )
      .setFooter({ text: 'DJEY Expert Resell IA • Liens directs officiels Vinted' });

    await interaction.editReply({
      embeds: [embed],
    });
    return true;
  }

  // 4. 📝 Fiche de Revente SEO Button
  if (customId === 'btn_resell_seo') {
    const session = getUserSession(userId);

    // If an item was already identified previously, auto-generate!
    if (session.lastIdentifiedItem) {
      await interaction.deferReply({ ephemeral: true });
      const item = session.lastIdentifiedItem;
      const listing = await resellAiService.generateSeoListing({
        brand: item.brand,
        model: item.model,
        era: item.era,
        targetPrice: item.recommendedPrice || item.medianPrice || 50,
      });

      session.lastGeneratedListing = {
        title: listing.optimizedTitle,
        description: listing.fullDescription,
        price: listing.recommendedPrice,
      };

      const embed = createSeoListingEmbed(listing);
      const row = createSeoListingButtons();

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
      return true;
    }

    // Otherwise, open a quick modal to input item details
    const modal = new ModalBuilder()
      .setCustomId('modal_resell_seo')
      .setTitle('📝 Générer une Fiche de Revente SEO');

    const brandInput = new TextInputBuilder()
      .setCustomId('input_seo_brand')
      .setLabel('Marque de l\'article (ex: Carhartt, Nike)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const modelInput = new TextInputBuilder()
      .setCustomId('input_seo_model')
      .setLabel('Modèle (ex: Detroit Jacket J97, Dunk Low)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const sizeInput = new TextInputBuilder()
      .setCustomId('input_seo_size')
      .setLabel('Taille et État (ex: Taille L, Très bon état)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(brandInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(modelInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput)
    );

    await interaction.showModal(modal);
    return true;
  }

  // 5. ✨ Action Button from Identification: Generate Listing directly
  if (customId.startsWith('btn_generate_listing_')) {
    await interaction.deferReply({ ephemeral: true });
    const session = getUserSession(userId);
    const item = session.lastIdentifiedItem || {
      searchId: '',
      brand: 'Vintage',
      model: 'Streetwear',
      medianPrice: 50,
      recommendedPrice: 45,
    };

    const listing = await resellAiService.generateSeoListing({
      brand: item.brand,
      model: item.model,
      era: item.era,
      targetPrice: item.recommendedPrice || item.medianPrice,
    });

    session.lastGeneratedListing = {
      title: listing.optimizedTitle,
      description: listing.fullDescription,
      price: listing.recommendedPrice,
    };

    const embed = createSeoListingEmbed(listing);
    const row = createSeoListingButtons();

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
    return true;
  }

  // 6. 📋 Copy Listing Button
  if (customId === 'btn_copy_listing_text') {
    const session = getUserSession(userId);
    if (!session.lastGeneratedListing) {
      await interaction.reply({
        content: '⚠️ Aucune fiche générée récemment.',
        ephemeral: true,
      });
      return true;
    }

    const { title, description, price } = session.lastGeneratedListing;
    await interaction.reply({
      content:
        `📋 **TITRE COPIABLE :**\n\`\`\`\n${title}\n\`\`\`\n` +
        `📝 **DESCRIPTION COPIABLE :**\n\`\`\`\n${description}\n\`\`\`\n` +
        `💰 **PRIX CONSEILLÉ :** **${price} €**`,
      ephemeral: true,
    });
    return true;
  }

  // 7. 🔎 Explorer un Catalogue Button -> Modal
  if (customId === 'btn_explore_catalog') {
    const modal = new ModalBuilder()
      .setCustomId('modal_explore_catalog')
      .setTitle('🔎 Explorer un Catalogue Vinted');

    const urlInput = new TextInputBuilder()
      .setCustomId('input_explore_url')
      .setLabel('URL du catalogue Vinted (optionnel)')
      .setPlaceholder('https://www.vinted.fr/catalog?catalog_ids=5...')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const keywordsInput = new TextInputBuilder()
      .setCustomId('input_explore_keywords')
      .setLabel('Que cherches-tu en particulier ?')
      .setPlaceholder('ex: t-shirt dri fit, tech fleece, carhartt detroit')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const sizeInput = new TextInputBuilder()
      .setCustomId('input_explore_size')
      .setLabel('Taille (ex: M, L, 42)')
      .setPlaceholder('Laisse vide pour toutes les tailles')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const maxPriceInput = new TextInputBuilder()
      .setCustomId('input_explore_max_price')
      .setLabel('Prix max (€)')
      .setPlaceholder('ex: 45')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(keywordsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(maxPriceInput)
    );

    await interaction.showModal(modal);
    return true;
  }

  // 8. 🔥 Top Bonnes Ventes Button -> Modal
  if (customId === 'btn_top_sales') {
    const modal = new ModalBuilder()
      .setCustomId('modal_top_sales')
      .setTitle('🔥 Top Bonnes Ventes Vinted');

    const daysInput = new TextInputBuilder()
      .setCustomId('input_top_days')
      .setLabel('Période en jours (ex: 7, 10, 30)')
      .setValue('7')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const categoryInput = new TextInputBuilder()
      .setCustomId('input_top_category')
      .setLabel('Marque ou Catégorie (ex: Nike, Carhartt)')
      .setPlaceholder('ex: Nike, Vestes, Sweats, Carhartt')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const sizeInput = new TextInputBuilder()
      .setCustomId('input_top_size')
      .setLabel('Taille (ex: M, L, Toutes)')
      .setValue('Toutes')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput)
    );

    await interaction.showModal(modal);
    return true;
  }

  // 9. ➕ Sauvegarder Catalogue en Radar
  if (customId.startsWith('btn_save_explore_radar_')) {
    await interaction.deferReply({ ephemeral: true });
    const expId = customId.replace('btn_save_explore_radar_', '');
    const data = exploreCatalogCache.get(expId);

    if (!data) {
      await interaction.editReply({
        content: '⚠️ Données du catalogue expirées. Relance une recherche via "🔎 Explorer un Catalogue".',
      });
      return true;
    }

    db.addRadar({
      userId,
      userName: interaction.user.tag || interaction.user.username,
      name: `Radar · ${data.name}`,
      vintedUrl: data.vintedUrl,
      maxPrice: data.maxPrice,
      sizes: data.sizes,
      active: true,
    });

    vintedScanner.start();

    await interaction.editReply({
      content:
        `✅ **Nouveau Radar Enregistré avec Succès !**\n\n` +
        `🎯 **Nom** : Radar · ${data.name}\n` +
        `💰 **Prix Max** : ${data.maxPrice} €\n` +
        `📏 **Tailles** : ${data.sizes.length ? data.sizes.join(', ') : 'Toutes'}\n` +
        `⚡ Le bot scrute désormais ce catalogue en continu et t'enverra chaque trouvaille ici en MP !`,
    });
    return true;
  }

  // 10. ➕ Créer un Radar sur le #1 du Top Ventes
  if (customId.startsWith('btn_radar_top_1_')) {
    await interaction.deferReply({ ephemeral: true });
    const topId = customId.replace('btn_radar_top_1_', '');
    const data = topSalesCache.get(topId);

    if (!data) {
      await interaction.editReply({
        content: '⚠️ Données du Top Ventes expirées. Relance le module "🔥 Top Bonnes Ventes".',
      });
      return true;
    }

    const vintedUrl = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(data.topItemName)}&order=newest_first`;
    db.addRadar({
      userId,
      userName: interaction.user.tag || interaction.user.username,
      name: `Radar #1 · ${data.topItemName}`,
      vintedUrl,
      maxPrice: data.targetBuyPrice,
      sizes: data.size && data.size !== 'Toutes' ? [data.size] : [],
      active: true,
    });

    vintedScanner.start();

    await interaction.editReply({
      content:
        `✅ **Radar Activé sur la Pépite #1 !**\n\n` +
        `🎯 **Modèle :** ${data.topItemName}\n` +
        `💰 **Prix d'Achat Cible :** max **${data.targetBuyPrice} €**\n` +
        `⚡ Dès qu'un vendeur poste cette pièce sous ce prix, tu recevras une alerte MP immédiate pour l'acheter avant tout le monde !`,
    });
    return true;
  }

  return false;
}

export async function handleResellModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  // Modal 1: Fiche SEO
  if (interaction.customId === 'modal_resell_seo') {
    await interaction.deferReply({ ephemeral: true });
    const brand = interaction.fields.getTextInputValue('input_seo_brand').trim();
    const model = interaction.fields.getTextInputValue('input_seo_model').trim();
    const sizeState = interaction.fields.getTextInputValue('input_seo_size') || 'Taille standard';

    const listing = await resellAiService.generateSeoListing({
      brand,
      model,
      size: sizeState,
      condition: 'Très bon état',
    });

    const session = getUserSession(interaction.user.id);
    session.lastGeneratedListing = {
      title: listing.optimizedTitle,
      description: listing.fullDescription,
      price: listing.recommendedPrice,
    };

    const embed = createSeoListingEmbed(listing);
    const row = createSeoListingButtons();

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
    return true;
  }

  // Modal 2: 🔎 Explorer un Catalogue Ciblé
  if (interaction.customId === 'modal_explore_catalog') {
    await interaction.deferReply({ ephemeral: true });

    const catalogUrl = interaction.fields.getTextInputValue('input_explore_url')?.trim() || undefined;
    const keywords = interaction.fields.getTextInputValue('input_explore_keywords')?.trim() || '';
    const size = interaction.fields.getTextInputValue('input_explore_size')?.trim() || undefined;
    const maxPriceRaw = interaction.fields.getTextInputValue('input_explore_max_price')?.trim().replace('€', '').replace(',', '.');
    const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : 50;

    const result = await resellAiService.exploreCatalog({
      catalogUrl,
      keywords,
      size,
      maxPrice: isNaN(maxPrice) ? 50 : maxPrice,
    });

    const expId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    exploreCatalogCache.set(expId, {
      id: expId,
      name: keywords || 'Catalogue Vinted',
      vintedUrl: result.targetUrl,
      maxPrice: isNaN(maxPrice) ? 50 : maxPrice,
      sizes: size ? [size] : [],
      itemsCount: result.items.length,
      timestamp: Date.now(),
    });

    if (result.items.length === 0) {
      await interaction.editReply({
        content: `🔎 Aucun article trouvé pour "${keywords}" avec ces critères. Essaie avec des mots-clés plus larges !`,
      });
      return true;
    }

    const lines = result.items.map((it, idx) => {
      return `**${idx + 1}.** **${it.price} €** — ${it.size} — *${it.title.substring(0, 42)}* ➔ [Voir l'annonce](${it.url})`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🔎 Catalogue Ciblé · ${keywords}`)
      .setColor(0x5865f2)
      .setDescription(
        `Voici les **${result.items.length} annonces les moins chères** détectées (triées par prix croissant) :\n\n` +
          lines.join('\n') +
          `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 **Prix le plus bas :** **${result.items[0].price} €**\n` +
          `🎯 **Filtre prix max :** **${isNaN(maxPrice) ? 50 : maxPrice} €**`
      )
      .setFooter({ text: 'DJEY Vinted • Clique ci-dessous pour transformer cette recherche en Radar permanent' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_save_explore_radar_${expId}`)
        .setLabel('➕ Sauvegarder ce catalogue en Radar')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [actionRow],
    });
    return true;
  }

  // Modal 3: 🔥 Top Bonnes Ventes
  if (interaction.customId === 'modal_top_sales') {
    await interaction.deferReply({ ephemeral: true });

    const daysRaw = interaction.fields.getTextInputValue('input_top_days')?.trim() || '7';
    const days = parseInt(daysRaw, 10) || 7;
    const category = interaction.fields.getTextInputValue('input_top_category')?.trim() || 'Nike';
    const size = interaction.fields.getTextInputValue('input_top_size')?.trim() || 'Toutes';

    const result = await resellAiService.analyzeTopSales({
      days,
      category,
      size,
    });

    const topId = `top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    topSalesCache.set(topId, {
      id: topId,
      brandCategory: category,
      topItemName: result.topOpportunity.name,
      targetBuyPrice: result.topOpportunity.targetBuyPrice,
      size,
      timestamp: Date.now(),
    });

    const rankingLines = result.rankings.map((r) => {
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `**#${r.rank}**`;
      return `${medal} **${r.name}**\n` +
        `   • 💰 Achat cible : **~${r.targetBuyPrice} €** | Revente : **~${r.resalePrice} €**\n` +
        `   • 📈 Marge nette : **+${r.netMargin} €** | Vitesse : ${r.velocity}\n` +
        `   • 🔍 [Rechercher en direct sur Vinted](${r.searchUrl})`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🔥 TOP BONNES VENTES · ${category.toUpperCase()} (${days} JOURS)`)
      .setColor(0xed4245)
      .setDescription(
        `📊 **Classement des pièces les plus liquides & rentables sur Vinted :**\n` +
          `*Tailles : ${size} • Historique analysé : ${days} jours*\n\n` +
          rankingLines.join('\n\n') +
          `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 **Pépite #1 Recommandée :** **${result.topOpportunity.name}** (Acheter à < **${result.topOpportunity.targetBuyPrice} €**)`
      )
      .setFooter({ text: 'DJEY Expert Resell IA • Données de rotation et liquidité du marché' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_radar_top_1_${topId}`)
        .setLabel(`➕ Créer un Radar sur le #1 (${result.topOpportunity.targetBuyPrice}€ max)`)
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [actionRow],
    });
    return true;
  }

  return false;
}

/**
 * Handles incoming DM messages from users (especially image uploads for Identify & Legit Check).
 */
export async function handleIncomingDmMessage(message: Message) {
  // Only process DMs and non-bot messages
  if (message.author.bot || message.guildId) return;
  if (!('send' in message.channel && typeof (message.channel as any).sendTyping === 'function')) return;
  const channel = message.channel as any;

  const session = getUserSession(message.author.id);
  const attachments = Array.from(message.attachments.values());

  // Check if user is in an active Resell AI mode or uploaded an image
  if (session.mode === 'IDENTIFY' || (attachments.length > 0 && session.mode !== 'LEGIT_CHECK')) {
    await channel.sendTyping();
    const statusMsg = await channel.send('⏳ **Analyse IA en cours...** *(Reconnaissance visuelle ultra-rapide & extraction Vinted)*');

    try {
      let imageObj: { data: string; mimeType: string } | undefined;
      if (attachments.length > 0 && attachments[0].contentType?.startsWith('image/')) {
        try {
          const imgResp = await axios.get(attachments[0].url, { responseType: 'arraybuffer' });
          imageObj = {
            data: Buffer.from(imgResp.data).toString('base64'),
            mimeType: attachments[0].contentType,
          };
        } catch (err) {
          console.error('Failed to download user attachment:', err);
        }
      }

      const result = await resellAiService.identifyAndEstimate(imageObj, message.content);

      // Save identified item into session
      session.lastIdentifiedItem = {
        searchId: result.searchId,
        brand: result.brand,
        model: result.model,
        era: result.era,
        medianPrice: result.medianPrice,
        recommendedPrice: result.recommendedSellPrice,
      };
      session.mode = null; // Reset mode

      const embed = new EmbedBuilder()
        .setTitle(`🏷️ IDENTIFICATION : ${result.brand} - ${result.model}`)
        .setColor(0x9b59b6)
        .setDescription(
          `✨ **Reconnaissance visuelle et analyse du marché Vinted :**\n\n` +
            `• **Époque / Style** : ${result.era}\n` +
            `• **Matière / Couleur** : ${result.colorMaterial}\n` +
            `• **Catégorie** : ${result.category}\n` +
            (result.suggestedKeywords.length
              ? `• **Mots-clés Vinted** : \`${result.suggestedKeywords.join(', ')}\`\n`
              : '')
        )
        .addFields(
          {
            name: '📊 Médiane Marché',
            value: `**~${result.medianPrice} €**\n*(calculé sur ${result.comparablesFound} annonces réelles)*`,
            inline: true,
          },
          {
            name: '📈 Fourchette constatée',
            value: `**${result.priceRange.min} € à ${result.priceRange.max} €**`,
            inline: true,
          },
          {
            name: '💡 Prix de vente rapide conseillé',
            value: `**${result.recommendedSellPrice} €**\n*(sous 48h • Médiane -15%)*`,
            inline: true,
          }
        )
        .setFooter({ text: 'DJEY Expert Resell IA • Données Vinted réelles' })
        .setTimestamp();

      if (attachments[0]?.url) {
        embed.setThumbnail(attachments[0].url);
      }

      const actionRow = new ActionRowBuilder<ButtonBuilder>();

      // Mandatory Transparency Button: "📋 Voir la liste des comparables ([X] annonces)"
      if (result.comparablesFound > 0) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_view_comparables_${result.searchId}`)
            .setLabel(`📋 Voir la liste (${result.comparablesFound} annonces)`)
            .setStyle(ButtonStyle.Primary)
        );
      }

      // Direct Action Button: "✨ Générer l'annonce pour revendre"
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_generate_listing_${result.searchId}`)
          .setLabel('✨ Générer l\'annonce pour revendre')
          .setStyle(ButtonStyle.Success)
      );

      await statusMsg.delete().catch(() => {});
      await channel.send({
        embeds: [embed],
        components: [actionRow],
      });
      return;
    } catch (e: any) {
      await statusMsg.edit('⏳ **Les serveurs IA sont momentanément occupés par une forte affluence.** Nouvelle tentative en cours... Merci de réenvoyer ta photo ou de préciser l\'article par texte.').catch(() => {});
      return;
    }
  }

  // Legit Check Mode
  if (session.mode === 'LEGIT_CHECK') {
    if (attachments.length === 0) {
      await message.reply('📸 Merci d\'envoyer une ou plusieurs photos (étiquette, logo, coutures) pour que l\'IA puisse inspecter la pièce !');
      return;
    }

    await channel.sendTyping();
    const statusMsg = await channel.send('🔍 **Audit Legit Check en cours...** *(Inspection des coutures, étiquettes et logos)*');

    try {
      const imageParts: Array<{ data: string; mimeType: string }> = [];
      for (const att of attachments) {
        if (att.contentType?.startsWith('image/')) {
          try {
            const resp = await axios.get(att.url, { responseType: 'arraybuffer' });
            imageParts.push({
              data: Buffer.from(resp.data).toString('base64'),
              mimeType: att.contentType,
            });
          } catch (e) {
            console.error('Error fetching attachment for legit check:', e);
          }
        }
      }

      const result = await resellAiService.performLegitCheck(imageParts, message.content);
      session.mode = null; // Reset mode

      const embedColor = result.score >= 80 ? 0x57f287 : result.score >= 55 ? 0xfee75c : 0xed4245;

      const embed = new EmbedBuilder()
        .setTitle(`🔍 RAPPORT LEGIT CHECK IA · ${result.brand}`)
        .setColor(embedColor)
        .setDescription(
          `### ${result.verdictEmoji} Score de Confiance : **${result.score}/100**\n` +
            `**Verdict : ${result.verdict}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ **Points Conformes Relevés :**\n` +
            result.conformPoints.map((p) => `• ${p}`).join('\n') +
            `\n\n` +
            (result.suspectPoints?.length
              ? `⚠️ **Points à Surveiller / Suspects :**\n` +
                result.suspectPoints.map((p) => `• ${p}`).join('\n') +
                `\n\n`
              : '') +
            `💡 **Conseil de l'Expert DJEY :**\n*${result.advice}*`
        )
        .setFooter({ text: 'DJEY Expert Resell IA • Analyse typographique et surpiqûres' })
        .setTimestamp();

      if (attachments[0]?.url) {
        embed.setThumbnail(attachments[0].url);
      }

      await statusMsg.delete().catch(() => {});
      await channel.send({ embeds: [embed] });
    } catch (e: any) {
      await statusMsg.edit('⏳ **Les serveurs IA sont momentanément occupés.** Nouvelle tentative en cours... Merci de réenvoyer les photos dans un instant.').catch(() => {});
    }
  }
}

function createSeoListingEmbed(listing: { optimizedTitle: string; fullDescription: string; recommendedPrice: number; hashtags?: string[] }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📝 FICHE DE REVENTE OPTIMISÉE SEO')
    .setColor(0x57f287)
    .setDescription(
      `🎯 **TITRE OPTIMISÉ (Mots-clés recherchés) :**\n` +
        `\`\`\`\n${listing.optimizedTitle}\n\`\`\`\n\n` +
        `📄 **DESCRIPTION VENDEUSE (Prête à copier) :**\n` +
        `\`\`\`\n${listing.fullDescription}\n\`\`\`\n\n` +
        `💰 **PRIX DE REVENTE CONSEILLÉ :** **${listing.recommendedPrice} €** (maximise la marge tout en restant sous la médiane)\n` +
        (listing.hashtags?.length ? `🏷️ **Tags :** ${listing.hashtags.join(' ')}` : '')
    )
    .setFooter({ text: 'DJEY Expert Resell IA • Cliquez ci-dessous pour copier facilement' });
}

function createSeoListingButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_copy_listing_text')
      .setLabel('📋 Copier le titre et la description en 1 clic')
      .setStyle(ButtonStyle.Primary)
  );
}
