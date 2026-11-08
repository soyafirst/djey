import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Key,
  Shield,
  Bot,
  Play,
  Square,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Activity,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  Sparkles
} from 'lucide-react';

interface BotStatus {
  connected: boolean;
  user: {
    id: string;
    tag: string;
    username: string;
    avatar: string | null;
  } | null;
  ping: number | null;
  error: string | null;
  lastHeartbeat: string | null;
  guildsCount: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'scanner' | 'dm';
  message: string;
}

export default function App() {
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasTokenInEnv, setHasTokenInEnv] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    connected: false,
    user: null,
    ping: null,
    error: null,
    lastHeartbeat: null,
    guildsCount: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Poll status & initial logs
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.bot) setBotStatus(data.bot);
      if (data.clientId && !clientId) setClientId(data.clientId);
      setHasTokenInEnv(Boolean(data.hasTokenInEnv));
    } catch (err) {
      console.error('Status fetch failed:', err);
    }
  };

  // Initial logs fetch
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) {
      console.error('Logs fetch failed:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();

    const interval = setInterval(fetchStatus, 4000);

    // Setup Server-Sent Events (SSE) for zero-latency live console streaming
    const eventSource = new EventSource('/api/logs/stream');
    eventSource.onmessage = (event) => {
      try {
        const newLog: LogEntry = JSON.parse(event.data);
        setLogs((prev) => [...prev, newLog]);
      } catch (e) {
        console.error('Failed to parse SSE log:', e);
      }
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleStartBot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token && !hasTokenInEnv) {
      showToast('⚠️ Renseigne ton DISCORD_BOT_TOKEN avant de démarrer.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, clientId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🟢 ' + data.message);
      } else {
        showToast('❌ ' + data.message);
      }
      await fetchStatus();
    } catch (err: any) {
      showToast('❌ Erreur : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      const data = await res.json();
      showToast('🔴 ' + data.message);
      await fetchStatus();
    } catch (err: any) {
      showToast('❌ Erreur : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    await fetch('/api/logs/clear', { method: 'POST' });
    setLogs([]);
    showToast('Console vidée.');
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    showToast('Logs copiés dans le presse-papier !');
  };

  const inviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=2147814400&scope=bot%20applications.commands`
    : '';

  return (
    <div className="min-h-screen bg-[#0F1012] text-[#DBDEE1] font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-[#18191C] border-b border-[#2B2D31] px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center text-white font-black text-xl shadow-lg">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-lg tracking-tight">DJEY Vinted</h1>
                <span className="bg-[#2B2D31] text-[#949BA4] text-xs font-mono px-2 py-0.5 rounded border border-[#383A40]">
                  Discord.js v14
                </span>
              </div>
              <p className="text-xs text-[#949BA4]">Panneau de contrôle &amp; Gestionnaire de passerelle Discord</p>
            </div>
          </div>

          {/* Bot State Badge */}
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-xl border flex items-center gap-2.5 shadow-sm text-xs font-bold transition-all ${
                botStatus.connected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  botStatus.connected ? 'bg-emerald-400 animate-ping' : 'bg-red-500'
                }`}
              />
              <span>
                {botStatus.connected && botStatus.user
                  ? `🟢 EN LIGNE : @${botStatus.user.tag}`
                  : '🔴 BOT HORS-LIGNE'}
              </span>
            </div>

            {botStatus.connected && (
              <div className="text-xs text-[#949BA4] bg-[#2B2D31] px-3 py-2 rounded-xl border border-[#383A40] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{botStatus.ping ?? 22} ms</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Row 1: Bot Configuration & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Configuration Form (Col 1-7) */}
          <div className="lg:col-span-7 bg-[#18191C] border border-[#2B2D31] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-[#5865F2]" />
                Identifiants Discord du Bot
              </h2>
              {hasTokenInEnv && (
                <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  ✓ Token détecté (.env)
                </span>
              )}
            </div>

            <form onSubmit={handleStartBot} className="space-y-4">
              {/* DISCORD_BOT_TOKEN Field */}
              <div>
                <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-1.5">
                  DISCORD_BOT_TOKEN <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={
                      hasTokenInEnv
                        ? '•••••••••••••••••••••••••••••••• (Actuel dans le serveur)'
                        : 'Colle ton Token Discord ici (ex: MTI...)'
                    }
                    className="w-full bg-[#111214] border border-[#2B2D31] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5C6067] focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] font-mono pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3.5 top-3.5 text-[#949BA4] hover:text-white transition-colors cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CLIENT_ID Field */}
              <div>
                <label className="block text-xs font-bold text-[#B5BAC1] uppercase tracking-wider mb-1.5">
                  CLIENT_ID (Application ID)
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Ex: 123456789012345678"
                  className="w-full bg-[#111214] border border-[#2B2D31] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5C6067] focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] font-mono"
                />
              </div>

              {/* Big Action Button */}
              <div className="pt-2">
                {botStatus.connected ? (
                  <button
                    type="button"
                    onClick={handleStopBot}
                    disabled={loading}
                    className="w-full bg-[#DA373C] hover:bg-[#A12828] disabled:opacity-50 text-white font-extrabold text-base py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    🔴 Arrêter le Bot DJEY
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#23A55A] hover:bg-[#1D8447] disabled:opacity-50 text-white font-extrabold text-base py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {loading ? 'Connexion à Discord en cours...' : '🟢 Démarrer le Bot DJEY'}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Quick Guide & Invite Link (Col 8-12) */}
          <div className="lg:col-span-5 bg-[#18191C] border border-[#2B2D31] rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                Permissions &amp; Invitation Discord
              </h2>

              <div className="text-xs text-[#949BA4] space-y-2.5">
                <div className="bg-[#111214] p-3 rounded-xl border border-[#2B2D31]">
                  <span className="font-semibold text-white block mb-1">
                    1. Intents Privilégiés (Obligatoire)
                  </span>
                  Dans Discord Developer Portal ➔ <strong>Bot</strong> ➔ coche impérativement :
                  <ul className="list-disc pl-4 mt-1 text-[#DBDEE1] font-mono text-[11px] space-y-0.5">
                    <li>MESSAGE CONTENT INTENT</li>
                    <li>SERVER MEMBERS INTENT</li>
                  </ul>
                </div>

                <div className="bg-[#111214] p-3 rounded-xl border border-[#2B2D31]">
                  <span className="font-semibold text-white block mb-1">
                    2. Utilisation dans Discord
                  </span>
                  Tape <code className="text-[#00A8FC] font-bold">/vinted</code> dans tes messages privés avec le bot pour afficher le Cockpit persistant avec tous les boutons interactifs.
                </div>
              </div>
            </div>

            {/* Invite Button */}
            {inviteUrl ? (
              <div className="pt-2">
                <a
                  href={inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs py-3 px-4 rounded-xl shadow transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Inviter le Bot sur mon Serveur
                </a>
              </div>
            ) : (
              <div className="text-[11px] text-[#5C6067] bg-[#111214] p-3 rounded-xl text-center">
                Saisis ton <strong>CLIENT_ID</strong> pour générer automatiquement le lien d'invitation Discord officiel.
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Live Console Terminal */}
        <div className="bg-[#141517] border border-[#2B2D31] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Terminal Titlebar */}
          <div className="bg-[#18191C] px-5 py-3.5 border-b border-[#2B2D31] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ED4245]" />
                <div className="w-3 h-3 rounded-full bg-[#FEE75C]" />
                <div className="w-3 h-3 rounded-full bg-[#57F287]" />
              </div>
              <div className="h-4 w-[1px] bg-[#2B2D31] mx-1" />
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold text-white tracking-wide">
                  Console de Logs en Direct
                </span>
                <span className="bg-[#2B2D31] text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {logs.length} logs
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
                  autoScroll
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[#2B2D31] border-[#383A40] text-[#949BA4]'
                }`}
              >
                Auto-scroll : {autoScroll ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={handleCopyLogs}
                className="p-1.5 text-[#949BA4] hover:text-white hover:bg-[#2B2D31] rounded-lg transition-colors cursor-pointer"
                title="Copier les logs"
              >
                <Copy className="w-4 h-4" />
              </button>

              <button
                onClick={handleClearLogs}
                className="p-1.5 text-[#949BA4] hover:text-red-400 hover:bg-[#2B2D31] rounded-lg transition-colors cursor-pointer"
                title="Vider la console"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Terminal Output */}
          <div className="p-5 font-mono text-xs h-[420px] overflow-y-auto space-y-2 select-text bg-[#0D0E10]">
            {logs.length === 0 ? (
              <div className="text-[#5C6067] py-8 text-center italic">
                En attente d'événements... Les logs de démarrage, scans et alertes apparaîtront ici en direct.
              </div>
            ) : (
              logs.map((log) => {
                let badgeClass = 'text-[#949BA4]';
                let textClass = 'text-[#DBDEE1]';

                if (log.level === 'success') {
                  badgeClass = 'text-emerald-400 font-bold';
                  textClass = 'text-emerald-300 font-semibold';
                } else if (log.level === 'scanner') {
                  badgeClass = 'text-cyan-400 font-bold';
                  textClass = 'text-cyan-200';
                } else if (log.level === 'dm') {
                  badgeClass = 'text-purple-400 font-bold';
                  textClass = 'text-purple-200 font-semibold';
                } else if (log.level === 'warn') {
                  badgeClass = 'text-amber-400 font-bold';
                  textClass = 'text-amber-300';
                } else if (log.level === 'error') {
                  badgeClass = 'text-red-400 font-bold';
                  textClass = 'text-red-300 font-semibold';
                }

                return (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed hover:bg-[#18191C] px-2 py-0.5 rounded transition-colors">
                    <span className="text-[#5C6067] shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`shrink-0 uppercase text-[10px] px-1.5 py-0.2 rounded bg-[#18191C] border border-[#2B2D31] ${badgeClass}`}>
                      {log.level}
                    </span>
                    <span className={`break-words ${textClass}`}>{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>

          {/* Terminal Footer Bar */}
          <div className="bg-[#18191C] px-5 py-2.5 border-t border-[#2B2D31] flex items-center justify-between text-[11px] text-[#949BA4] font-mono">
            <span>Passerelle WebSocket SSE connectée</span>
            <span>Scan Vinted : 3 à 5 secondes (Jitter aléatoire)</span>
          </div>
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#18191C] border border-[#383A40] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}
    </div>
  );
}
