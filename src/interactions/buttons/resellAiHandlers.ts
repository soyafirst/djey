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
import { resellAiService, comparablesCache } from '../../services/resellAiService';
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
    const searchId = customId.replace('btn_view_comparables_', '');
    const data = comparablesCache.get(searchId);

    if (!data || data.items.length === 0) {
      await interaction.reply({
        content: '⚠️ Aucune liste de comparables trouvée pour cette recherche (recherche expirée ou aucun article disponible).',
        ephemeral: true,
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

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
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

  return false;
}

export async function handleResellModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
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
          value: result.comparablesFound > 0
            ? `**~${result.medianPrice} €**\n*(calculé sur ${result.comparablesFound} annonces réelles)*`
            : `*Données en attente*`,
          inline: true,
        },
        {
          name: '📈 Fourchette constatée',
          value: result.comparablesFound > 0
            ? `**${result.priceRange.min} € à ${result.priceRange.max} €**`
            : `*Non disponible*`,
          inline: true,
        },
        {
          name: '💡 Prix de vente rapide conseillé',
          value: result.comparablesFound > 0
            ? `**${result.recommendedSellPrice} €**\n*(sous 48h)*`
            : `*Non disponible*`,
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

    await channel.send({
      embeds: [embed],
      components: [actionRow],
    });
    return;
  }

  // Legit Check Mode
  if (session.mode === 'LEGIT_CHECK') {
    if (attachments.length === 0) {
      await message.reply('📸 Merci d\'envoyer une ou plusieurs photos (étiquette, logo, coutures) pour que l\'IA puisse inspecter la pièce !');
      return;
    }

    await channel.sendTyping();

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

    await channel.send({ embeds: [embed] });
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
