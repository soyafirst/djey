import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ButtonInteraction,
} from 'discord.js';
import { db } from '../../database/db';
import { vintedScanner } from '../../services/vintedScanner';

export function createNewRadarModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('modal_new_radar')
    .setTitle('➕ Nouveau Radar Vinted');

  const nameInput = new TextInputBuilder()
    .setCustomId('input_filter_name')
    .setLabel('Nom du radar (ex: Doudounes Ralph Lauren)')
    .setPlaceholder('Ex: Doudounes Ralph Lauren')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80);

  const urlInput = new TextInputBuilder()
    .setCustomId('input_vinted_url')
    .setLabel('URL de la recherche catalogue Vinted')
    .setPlaceholder('https://www.vinted.fr/catalog?search_text=doudoune+ralph+lauren')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const priceInput = new TextInputBuilder()
    .setCustomId('input_max_price')
    .setLabel('Prix maximum d\'achat (€)')
    .setPlaceholder('Ex: 50')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const sizesInput = new TextInputBuilder()
    .setCustomId('input_sizes')
    .setLabel('Tailles ciblées (séparées par virgules)')
    .setPlaceholder('Ex: M, L, XL ou 42, 43')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput);
  const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput);
  const row4 = new ActionRowBuilder<TextInputBuilder>().addComponents(sizesInput);

  modal.addComponents(row1, row2, row3, row4);
  return modal;
}

export function createTrackItemModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('modal_track_item')
    .setTitle('👁️ Suivre une annonce Vinted');

  const urlInput = new TextInputBuilder()
    .setCustomId('input_track_url')
    .setLabel('Lien de l\'article Vinted à surveiller')
    .setPlaceholder('https://www.vinted.fr/items/123456789-titre-article')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput);
  modal.addComponents(row);
  return modal;
}

export async function handleRadarModalSubmit(interaction: ModalSubmitInteraction) {
  if (interaction.customId === 'modal_new_radar') {
    const filterName = interaction.fields.getTextInputValue('input_filter_name').trim();
    const vintedUrl = interaction.fields.getTextInputValue('input_vinted_url').trim();
    const maxPriceRaw = interaction.fields.getTextInputValue('input_max_price').trim().replace('€', '').replace(',', '.');
    const sizesRaw = interaction.fields.getTextInputValue('input_sizes');

    const maxPrice = parseFloat(maxPriceRaw);
    if (isNaN(maxPrice) || maxPrice <= 0) {
      await interaction.reply({
        content: '❌ Prix maximum invalide. Merci d\'indiquer un montant numérique en euros (ex: 45).',
        ephemeral: true,
      });
      return;
    }

    const sizes = sizesRaw
      ? sizesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Save to DB
    const newRadar = db.addRadar({
      userId: interaction.user.id,
      userName: interaction.user.tag || interaction.user.username,
      name: filterName,
      vintedUrl,
      maxPrice,
      sizes,
      active: true,
    });

    // Start scanner if not started
    vintedScanner.start();

    // Trigger immediate initial scan for this radar
    setTimeout(async () => {
      try {
        await vintedScanner.scanRadar(newRadar);
      } catch (err) {
        console.error('Initial scan error:', err);
      }
    }, 500);

    await interaction.reply({
      content:
        `✅ **Radar DJEY activé !** Tu recevras chaque trouvaille ici-même en DM.\n\n` +
        `🎯 **Nom** : ${filterName}\n` +
        `💰 **Prix Max** : ${maxPrice} €\n` +
        `📏 **Tailles** : ${sizes.length > 0 ? sizes.join(', ') : 'Toutes'}\n` +
        `⚡ *Fréquence de scan : toutes les 3 à 5 secondes avec détection d'opportunités.*`,
      ephemeral: true,
    });
  } else if (interaction.customId === 'modal_track_item') {
    const itemUrl = interaction.fields.getTextInputValue('input_track_url').trim();
    db.addTrackedItem({
      userId: interaction.user.id,
      url: itemUrl,
      title: 'Annonce Vinted Suivie',
      price: 0,
      status: 'available',
    });

    await interaction.reply({
      content: `👁️ **Annonce sous surveillance !**\n${itemUrl}\nTu seras notifié en MP de toute baisse de prix ou dès sa vente définitive.`,
      ephemeral: true,
    });
  }
}
