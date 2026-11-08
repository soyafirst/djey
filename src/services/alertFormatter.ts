import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { VintedAlert } from '../database/db';

export function createVintedAlertEmbed(alert: VintedAlert): EmbedBuilder {
  const profitBadge = alert.estimatedMargin >= 30 ? '🔥 MEGA PÉPITE' : '⚡ TRÈS BONNE AFFAIRE';

  return new EmbedBuilder()
    .setTitle(`${profitBadge} · ${alert.title}`)
    .setURL(alert.url)
    .setColor(alert.estimatedMargin >= 30 ? 0xed4245 : 0x57f287)
    .setImage(alert.photo)
    .addFields(
      {
        name: '🏷️ Marque & Taille',
        value: `**${alert.brand}** • Taille : **${alert.size}**`,
        inline: true,
      },
      {
        name: '✨ État de l\'article',
        value: alert.condition || 'Très bon état',
        inline: true,
      },
      {
        name: '💰 Prix Vendeur',
        value: `**${alert.price} €**`,
        inline: true,
      },
      {
        name: '📊 Médiane Marché',
        value: `**~${alert.medianPrice} €**`,
        inline: true,
      },
      {
        name: '📈 Marge Estimée (Net)',
        value: `**+${alert.estimatedMargin} €**`,
        inline: true,
      },
      {
        name: '🎯 Rentabilité',
        value: `**+${Math.round((alert.estimatedMargin / alert.price) * 100)}% ROI**`,
        inline: true,
      }
    )
    .setFooter({
      text: 'DJEY Scanner • Alerte instantanée en DM • Cliquez ci-dessous pour agir',
    })
    .setTimestamp(new Date(alert.timestamp));
}

export function createVintedAlertButtons(alert: VintedAlert): ActionRowBuilder<ButtonBuilder> {
  const cleanUrl = alert.url.startsWith('https://www.vinted.fr/items/')
    ? alert.url
    : `https://www.vinted.fr/items/${alert.id.replace(/\D/g, '') || '0'}`;

  const buyBtn = new ButtonBuilder()
    .setLabel('⚡ Acheter direct (Vinted)')
    .setStyle(ButtonStyle.Link)
    .setURL(cleanUrl);

  const cleanBrand = alert.brand.replace(/[^a-zA-Z0-9]/g, '');
  const negoBtn = new ButtonBuilder()
    .setCustomId(`btn_copy_nego_${alert.price}_${cleanBrand}`)
    .setLabel('💬 Copier négo (-25%)')
    .setStyle(ButtonStyle.Secondary);

  const ignoreBtn = new ButtonBuilder()
    .setCustomId(`btn_ignore_${alert.id}`)
    .setLabel('❌ Ignorer')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buyBtn, negoBtn, ignoreBtn);
}
