import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';

export const helpCommandData = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Guide complet d\'utilisation du Cockpit DJEY Vinted');

export async function executeHelpCommand(interaction: CommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('📖 Guide d\'utilisation · DJEY Vinted')
    .setColor(0x5865f2)
    .setDescription(
      `Bienvenue sur le bot **DJEY Vinted**, ton allié d'achat-revente et de snip d'annonces en temps réel !\n\n` +
        `### 🚀 Démarrage Rapide\n` +
        `Tape la commande \`/vinted\` à tout moment. Si tu es sur un serveur, le bot t'ouvrira immédiatement ton Cockpit en **Message Privé**.\n\n` +
        `### 🎛️ Fonctions du Cockpit :\n` +
        `• **➕ Nouveau Radar** : Ouvre un pop-up pour coller une recherche Vinted, fixer ton prix max et tes tailles.\n` +
        `• **📋 Mes filtres** : Consulte l'état de tes surveillances, le nombre d'articles trouvés et mets-les en pause.\n` +
        `• **🛑 Arrêter un filtre** : Sélectionne un radar spécifique à désactiver via un menu déroulant.\n` +
        `• **⚠️ Tout arrêter** : Met immédiatement tous tes radars en sommeil.\n` +
        `• **👁️ Suivre une annonce** : Surveille l'évolution de prix d'un article spécifique jusqu'à sa vente.\n` +
        `• **🛒 Autobuy** : Accès rapide aux opportunités immédiates.\n` +
        `• **✅ Autocop** : Ciblage automatique ultra rapide.\n\n` +
        `### 🧠 Module Expert Resell IA & Outils Pro :\n` +
        `• **🔍 Legit Check IA** : Envoie une photo d'étiquette, logo ou coutures pour un audit d'authenticité noté sur 100 avec points suspects et conformes.\n` +
        `• **🏷️ Identifier & Estimer** : Reconnaissance visuelle par IA (marque, modèle exact, époque) + calcul de la médiane réelle et bouton transparent "Voir la liste".\n` +
        `• **📝 Fiche de Revente SEO** : Génération d'une annonce Vinted complète optimisée avec mots-clés chauds, arguments de vente et prix conseillé, copiable en 1 clic.\n` +
        `• **🔎 Explorer un Catalogue** : Rentre une URL ou des mots-clés pour sortir les 10-15 annonces les moins chères (triées par prix croissant) avec option de conversion directe en Radar.\n` +
        `• **🔥 Top Bonnes Ventes** : Analyse de rotation et des opportunités les plus liquides par période (7, 10, 30 jours) avec création de radar immédiate sur le top 1.\n\n` +
        `### ⚡ Alertes Pépites en DM :\n` +
        `Chaque alerte te donne le prix du vendeur, la **médiane réelle de marché**, et le **bénéfice net estimé** après frais. Trois boutons te permettent d'acheter directement, de copier un texte de négo à -25%, ou d'ignorer l'article.`
    )
    .setFooter({ text: 'DJEY Vinted • v14.0' });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
