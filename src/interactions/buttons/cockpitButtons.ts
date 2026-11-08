import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { db } from '../../database/db';
import { createNewRadarModal, createTrackItemModal } from '../modals/radarModal';
import { createStopFilterSelectMenu } from '../selectMenus/filterSelect';
import { marketAnalyzer } from '../../services/marketAnalyzer';

export async function handleButtonClick(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  // 1. ➕ Nouveau Radar
  if (customId === 'btn_new_radar') {
    const modal = createNewRadarModal();
    await interaction.showModal(modal);
    return;
  }

  // 2. 📋 Mes filtres
  if (customId === 'btn_my_filters') {
    const userRadars = db.getRadars(userId);

    if (userRadars.length === 0) {
      await interaction.reply({
        content: '📋 **Aucun radar actif pour l\'instant !**\nClique sur **➕ Nouveau Radar** pour lancer ta première surveillance.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Tes Radars & Filtres Vinted')
      .setColor(0x5865f2)
      .setDescription(
        userRadars
          .map(
            (r, index) =>
              `**${index + 1}. ${r.name}**\n` +
              `• Statut : ${r.active ? '🟢 Actif' : '🔴 En pause'}\n` +
              `• Prix Max : **${r.maxPrice} €**\n` +
              `• Tailles : ${r.sizes.length ? r.sizes.join(', ') : 'Toutes'}\n` +
              `• Pépites trouvées : **${r.itemsFound}**\n` +
              `• URL : [Lien Catalogue](${r.vintedUrl})`
          )
          .join('\n\n')
      )
      .setFooter({ text: 'Pour arrêter un radar, clique sur "🛑 Arrêter un filtre"' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_new_radar')
        .setLabel('➕ Nouveau')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('btn_resume_all')
        .setLabel('▶️ Tout relancer')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
    return;
  }

  // 3. 🛑 Arrêter un filtre
  if (customId === 'btn_stop_filter') {
    const selectMenuRow = createStopFilterSelectMenu(userId);
    if (!selectMenuRow) {
      await interaction.reply({
        content: 'ℹ️ Tu n\'as aucun radar actif en cours.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: '🛑 Sélectionne le radar que tu souhaites mettre en pause :',
      components: [selectMenuRow],
      ephemeral: true,
    });
    return;
  }

  // 4. ⚠️ Tout arrêter
  if (customId === 'btn_stop_all') {
    const stoppedCount = db.stopAllRadarsForUser(userId);
    await interaction.reply({
      content: `🛑 **Tous tes radars sont maintenant en pause !** (${stoppedCount} arrêté(s)).\nPour les relancer plus tard, utilise "📋 Mes filtres".`,
      ephemeral: true,
    });
    return;
  }

  // 5. ▶️ Tout relancer (from my filters)
  if (customId === 'btn_resume_all') {
    const resumedCount = db.resumeAllRadarsForUser(userId);
    await interaction.reply({
      content: `▶️ **Tous tes radars sont réactivés !** (${resumedCount} relancé(s)).\nLes scans reprennent immédiatement.`,
      ephemeral: true,
    });
    return;
  }

  // 6. 👁️ Suivre une annonce
  if (customId === 'btn_track_item') {
    const modal = createTrackItemModal();
    await interaction.showModal(modal);
    return;
  }

  // 7. 🛒 Autobuy
  if (customId === 'btn_autobuy') {
    const embed = new EmbedBuilder()
      .setTitle('🛒 DJEY Autobuy · Mode Achat Éclair')
      .setColor(0x5865f2)
      .setDescription(
        `⚡ **Module Autobuy activé.**\n\n` +
          `• Pré-remplissage du panier en 1-clic sur chaque alerte reçue.\n` +
          `• Redirection sécurisée directe vers le checkout Vinted.\n` +
          `• Zéro latence de rafraîchissement.\n\n` +
          `*Astuce : Connecte-toi à ton compte Vinted sur ton navigateur pour valider le panier instantanément.*`
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return;
  }

  // 8. ✅ Autocop
  if (customId === 'btn_autocop') {
    const embed = new EmbedBuilder()
      .setTitle('🎯 DJEY Autocop · Ciblage Automatique')
      .setColor(0x57f287)
      .setDescription(
        `🎯 **Mode Autocop Configuré !**\n\n` +
          `Chaque nouvel article détecté sous la médiane de plus de **35% de marge** déclenche une notification ultra-prioritaire sonore avec lien direct de commande prioritaire.`
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return;
  }

  // 9. Alert Negotiation button: btn_copy_nego_{sellerPrice}_{brand}
  if (customId.startsWith('btn_copy_nego_')) {
    const parts = customId.split('_');
    const price = parseFloat(parts[3]) || 50;
    const brand = parts.slice(4).join(' ') || 'Vinted';
    const message = marketAnalyzer.generateNegotiationOffer(price, brand);

    await interaction.reply({
      content:
        `💬 **Message de négociation (-25%) prêt à coller :**\n\n` +
        `\`\`\`\n${message}\n\`\`\`\n` +
        `*Copie ce texte et colle-le directement dans la messagerie du vendeur Vinted.*`,
      ephemeral: true,
    });
    return;
  }

  // 10. Alert Ignore button: btn_ignore_{alertId}
  if (customId.startsWith('btn_ignore_')) {
    const alertId = customId.replace('btn_ignore_', '');
    db.markAlertIgnored(alertId);

    await interaction.reply({
      content: '❌ **Article ignoré.** Tu ne recevras plus de notification pour cette annonce.',
      ephemeral: true,
    });
    return;
  }
}
