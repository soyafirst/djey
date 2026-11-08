import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
} from 'discord.js';

export const vintedCommandData = new SlashCommandBuilder()
  .setName('vinted')
  .setDescription('Ouvre le Cockpit DJEY Vinted interactif en Message Privé (DM)');

export function createCockpitEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📦 DJEY · COCKPIT VINTED')
    .setColor(0x1e1f22)
    .setDescription(
      `⚡ **Ton cockpit Vinted — un clic, zéro commande à retenir.**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🌐 **Radar** : Lance une surveillance catalogue ➔ alertes directes en MP.\n` +
        `⚙️ **Contrôle** : Pause • stop • wipe depuis "Mes filtres".\n` +
        `🏷️ **Vente** : Suis une annonce jusqu'à sa vente réelle.\n` +
        `🛒 **Autobuy** : Fais défiler les annonces et achète en direct.\n` +
        `🎯 **Autocop** : Catalogue + prix/taille ➔ ciblage automatique dès qu'une pépite sort.`
    )
    .setFooter({ text: 'DJEY Vinted • /vinted • MP only' })
    .setTimestamp();
}

export function createCockpitButtons(): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1: ➕ Nouveau Radar (Success) & 📋 Mes filtres (Primary)
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_new_radar')
      .setLabel('➕ Nouveau Radar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_my_filters')
      .setLabel('📋 Mes filtres')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 2: 🛑 Arrêter un filtre (Danger) & ⚠️ Tout arrêter (Danger)
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_stop_filter')
      .setLabel('🛑 Arrêter un filtre')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_stop_all')
      .setLabel('⚠️ Tout arrêter')
      .setStyle(ButtonStyle.Danger)
  );

  // Row 3: 👁️ Suivre une annonce (Secondary), 🛒 Autobuy (Primary), ✅ Autocop (Success)
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_track_item')
      .setLabel('👁️ Suivre une annonce')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_autobuy')
      .setLabel('🛒 Autobuy')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_autocop')
      .setLabel('✅ Autocop')
      .setStyle(ButtonStyle.Success)
  );

  return [row1, row2, row3];
}

export async function executeVintedCommand(interaction: CommandInteraction) {
  const cockpitEmbed = createCockpitEmbed();
  const cockpitComponents = createCockpitButtons();

  // If used in a Guild/Server:
  if (interaction.guildId) {
    try {
      const dmChannel = await interaction.user.createDM();
      await dmChannel.send({
        embeds: [cockpitEmbed],
        components: cockpitComponents,
      });

      await interaction.reply({
        content: '📩 Ton Cockpit personnel t\'attend dans tes Messages Privés !',
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        content: '⚠️ Impossible de t\'envoyer un message privé ! Vérifie tes paramètres de confidentialité Discord (autoriser les messages privés des membres du serveur).',
        ephemeral: true,
      });
    }
  } else {
    // Already in DM
    await interaction.reply({
      embeds: [cockpitEmbed],
      components: cockpitComponents,
    });
  }
}
