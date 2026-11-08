import {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../../database/db';

export function createStopFilterSelectMenu(userId: string): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const radars = db.getRadars(userId).filter((r) => r.active);

  if (radars.length === 0) {
    return null;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('select_stop_filter')
    .setPlaceholder('Choisis le radar à arrêter...')
    .addOptions(
      radars.slice(0, 25).map((r) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.name.substring(0, 50))
          .setDescription(`Prix max: ${r.maxPrice}€ • ${r.itemsFound} trouvés`)
          .setValue(r.id)
          .setEmoji('🛑')
      )
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export async function handleFilterSelectMenu(interaction: StringSelectMenuInteraction) {
  if (interaction.customId === 'select_stop_filter') {
    const selectedRadarId = interaction.values[0];
    const radar = db.getRadarById(selectedRadarId);

    if (!radar) {
      await interaction.reply({
        content: '⚠️ Radar introuvable ou déjà supprimé.',
        ephemeral: true,
      });
      return;
    }

    db.updateRadar(selectedRadarId, { active: false });

    await interaction.reply({
      content: `🛑 **Radar mis en pause !**\nLe radar **${radar.name}** a été arrêté. Tu peux le relancer depuis "📋 Mes filtres" à tout moment.`,
      ephemeral: true,
    });
  }
}
