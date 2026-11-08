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
        `🎯 **Autocop** : Catalogue + prix/taille ➔ ciblage automatique dès qu'une pépite sort.\n\n` +
        `✨ **MODULE EXPERT RESELL IA :**\n` +
        `🔍 **Legit Check IA** : Vérifie l'authenticité (étiquette, logo, coutures).\n` +
        `🏷️ **Identifier & Estimer** : Reconnaissance visuelle + médiane réelle de marché.\n` +
        `📝 **Fiche de Revente SEO** : Génère une annonce Vinted optimisée prête à coller.\n\n` +
        `🔎 **NOUVEAUX MODULES PRO :**\n` +
        `🔎 **Explorer un Catalogue** : Recherche ciblée par URL ou mots-clés (tri par prix croissant).\n` +
        `🔥 **Top Bonnes Ventes** : Pièces les plus liquides & rentables par période (7, 10, 30 jours).`
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

  // Row 4: 🔍 Legit Check IA (Primary), 🏷️ Identifier & Estimer (Primary), 📝 Fiche de Revente SEO (Success)
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_legit_check')
      .setLabel('🔍 Legit Check IA')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_identify_estimate')
      .setLabel('🏷️ Identifier & Estimer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_resell_seo')
      .setLabel('📝 Fiche de Revente SEO')
      .setStyle(ButtonStyle.Success)
  );

  // Row 5: 🔎 Explorer un Catalogue (Primary), 🔥 Top Bonnes Ventes (Danger)
  const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_explore_catalog')
      .setLabel('🔎 Explorer un Catalogue')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_top_sales')
      .setLabel('🔥 Top Bonnes Ventes')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3, row4, row5];
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
