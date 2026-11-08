import dotenv from 'dotenv';
dotenv.config();

export interface BotConfig {
  token: string;
  clientId: string;
  port: number;
}

export const config: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  port: Number(process.env.PORT) || 3000,
};

export function updateConfig(newConfig: Partial<BotConfig>): void {
  if (newConfig.token !== undefined) {
    config.token = newConfig.token;
    process.env.DISCORD_TOKEN = newConfig.token;
  }
  if (newConfig.clientId !== undefined) {
    config.clientId = newConfig.clientId;
    process.env.CLIENT_ID = newConfig.clientId;
  }
}
