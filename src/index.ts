import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Interaction,
  Events,
  ActivityType,
} from 'discord.js';
import { config, updateConfig } from './config';
import { db } from './database/db';
import { vintedScanner } from './services/vintedScanner';
import { vintedCommandData, executeVintedCommand } from './commands/vinted';
import { helpCommandData, executeHelpCommand } from './commands/help';
import { handleButtonClick } from './interactions/buttons/cockpitButtons';
import { handleRadarModalSubmit } from './interactions/modals/radarModal';
import { handleFilterSelectMenu } from './interactions/selectMenus/filterSelect';
import { createVintedAlertEmbed, createVintedAlertButtons } from './services/alertFormatter';
import { logger } from './services/logger';
import {
  handleResellModalSubmit,
  handleIncomingDmMessage,
} from './interactions/buttons/resellAiHandlers';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
  ],
});

let isBotConnected = false;
let botError: string | null = null;
let lastHeartbeat: string | null = null;

export function getBotStatus() {
  return {
    connected: isBotConnected,
    user: client.user
      ? {
          id: client.user.id,
          tag: client.user.tag,
          username: client.user.username,
          avatar: client.user.displayAvatarURL(),
        }
      : null,
    ping: client.ws.ping >= 0 ? client.ws.ping : null,
    error: botError,
    lastHeartbeat,
    guildsCount: client.guilds.cache.size,
  };
}

// Register slash commands with Discord API
export async function registerSlashCommands(token: string, clientId: string) {
  if (!token || !clientId) {
    logger.log('warn', 'Token ou Client ID manquant pour l\'enregistrement des commandes Slash.');
    return;
  }
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    const commands = [vintedCommandData.toJSON(), helpCommandData.toJSON()];
    logger.log('info', `Enregistrement des commandes d'application Discord (/vinted, /help)...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.log('success', 'Commandes Slash (/vinted, /help) enregistrées avec succès sur Discord !');
  } catch (err: any) {
    logger.log('error', `Erreur lors de l'enregistrement des commandes Slash: ${err.message}`);
  }
}

// Event: Ready
client.once(Events.ClientReady, async (readyClient) => {
  isBotConnected = true;
  botError = null;
  lastHeartbeat = new Date().toISOString();

  // Set official activity status in Discord
  readyClient.user.setPresence({
    activities: [
      {
        name: 'DJEY Vinted • /vinted',
        type: ActivityType.Watching,
      },
    ],
    status: 'online',
  });

  logger.log('success', `Bot DJEY connecté avec succès sur Discord ! (Tag: ${readyClient.user.tag})`);
  logger.log('info', `Statut Discord activé: "Regarde DJEY Vinted • /vinted"`);

  // Auto-register slash commands using the verified bot application ID
  const effectiveAppId = readyClient.user.id;
  await registerSlashCommands(config.token, effectiveAppId);

  // Start background Vinted scanner
  vintedScanner.start();
});

// Event: Interaction Create (Commands, Buttons, Modals, Select Menus)
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // 1. Slash commands (/vinted, /help)
    if (interaction.isChatInputCommand()) {
      logger.log(
        'info',
        `Commande /${interaction.commandName} exécutée par @${interaction.user.tag} (${interaction.guildId ? 'sur serveur' : 'en MP'})`
      );

      if (interaction.commandName === 'vinted') {
        await executeVintedCommand(interaction);
        logger.log('dm', `Cockpit Embed avec 7 boutons envoyé à @${interaction.user.tag} en Message Privé`);
      } else if (interaction.commandName === 'help') {
        await executeHelpCommand(interaction);
      }
      return;
    }

    // 2. Buttons
    if (interaction.isButton()) {
      logger.log('info', `Clic bouton [${interaction.customId}] par @${interaction.user.tag}`);
      await handleButtonClick(interaction);
      return;
    }

    // 3. Modals
    if (interaction.isModalSubmit()) {
      logger.log('info', `Formulaire modal validé [${interaction.customId}] par @${interaction.user.tag}`);
      const handled = await handleResellModalSubmit(interaction);
      if (!handled) {
        await handleRadarModalSubmit(interaction);
      }
      return;
    }

    // 4. Select Menus
    if (interaction.isStringSelectMenu()) {
      logger.log('info', `Sélection menu [${interaction.customId}] par @${interaction.user.tag}`);
      await handleFilterSelectMenu(interaction);
      return;
    }
  } catch (err: any) {
    logger.log('error', `Erreur traitement interaction: ${err.message}`);
    if (interaction.isRepliable()) {
      const msg = '❌ Une erreur est survenue lors de l\'exécution de cette action.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  }
});

// Event: Message Create (Processes incoming DM images and text for Resell AI & Legit Check)
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleIncomingDmMessage(message);
  } catch (err: any) {
    logger.log('error', `Erreur traitement message DM: ${err.message}`);
  }
});

// Event: Errors & Disconnect
client.on(Events.Error, (err) => {
  logger.log('error', `Erreur Discord Gateway: ${err.message}`);
  botError = err.message;
});

// Scanner events logging
vintedScanner.on('scan_tick', (count: number) => {
  logger.log('scanner', `Scan Vinted en cours... (${count} radars actifs vérifiés)`);
});

// Wire up Scanner -> Send real Discord DM Alerts
vintedScanner.on('alert', async ({ radar, alert }) => {
  logger.log('scanner', `Pépite Vinted trouvée pour "${radar.name}": ${alert.title} à ${alert.price}€ (Marge estimée: +${alert.estimatedMargin}€)`);

  if (!isBotConnected || !alert.userId || alert.userId === 'default_user') {
    return;
  }

  try {
    const user = await client.users.fetch(alert.userId).catch(() => null);
    if (user) {
      const dmChannel = await user.createDM();
      const embed = createVintedAlertEmbed(alert);
      const components = [createVintedAlertButtons(alert)];

      await dmChannel.send({
        content: `🚨 **PÉPITE DÉTECTÉE · Radar: ${radar.name}**`,
        embeds: [embed],
        components,
      });

      logger.log('dm', `Alerte envoyée en MP à @${user.tag} (Article: "${alert.title}" - ${alert.price}€)`);
    }
  } catch (err: any) {
    logger.log('error', `Impossible d'envoyer l'alerte DM à l'utilisateur ${alert.userId}: ${err.message}`);
  }
});

// Heartbeat tracker
setInterval(() => {
  if (isBotConnected) {
    lastHeartbeat = new Date().toISOString();
  }
}, 15000);

// Start bot function
export async function startBot(
  customToken?: string,
  customClientId?: string
): Promise<{ success: boolean; message: string }> {
  const token = customToken || config.token;
  const clientId = customClientId || config.clientId;

  if (customToken || customClientId) {
    updateConfig({ token, clientId });
  }

  if (!token) {
    logger.log('error', 'Aucun DISCORD_BOT_TOKEN fourni.');
    return {
      success: false,
      message: 'Aucun DISCORD_BOT_TOKEN fourni. Renseigne ton token dans le panneau.',
    };
  }

  try {
    if (clientId) {
      await registerSlashCommands(token, clientId);
    }
    logger.log('info', 'Connexion à la passerelle Discord Gateway...');
    await client.login(token);
    isBotConnected = true;
    botError = null;
    return { success: true, message: 'Bot DJEY connecté avec succès sur Discord !' };
  } catch (err: any) {
    isBotConnected = false;
    botError = err.message;
    logger.log('error', `Échec de connexion Discord: ${err.message}`);
    return { success: false, message: `Échec de connexion : ${err.message}` };
  }
}

// Stop bot function
export async function stopBot() {
  if (isBotConnected) {
    client.destroy();
    isBotConnected = false;
    logger.log('warn', 'Bot DJEY déconnecté de Discord.');
  }
  vintedScanner.stop();
  return { success: true, message: 'Bot arrêté avec succès.' };
}

// Standalone execution if run directly via `npm run bot`
if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  if (config.token) {
    startBot().catch(console.error);
  } else {
    logger.log('info', 'Serveur prêt. Lance via l\'interface pour configurer ton bot.');
  }
}
