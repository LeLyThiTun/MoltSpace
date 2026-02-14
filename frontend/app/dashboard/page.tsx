"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import RegisterAgentModal from "@/components/ui/RegisterAgentModal";
import { useAgentList, useAgentDetail, useAgentLogs, getXPForNextLevel } from "@/lib/useGameData";
import type { AgentInfo, AgentLog } from "@/lib/useGameData";
import {
  RANK_NAMES, RANK_COLORS, starsString, getNFTImage,
  truncateAddress,
} from "@/lib/constants";
import { formatEther } from "ethers";
import {
  Shield, Zap, Pickaxe, Globe, Rocket, Loader2, RefreshCw,
  AlertCircle, Trophy, ChevronDown, ChevronUp, Clock, Coins,
  Users, BarChart3, Sparkles, ExternalLink, Terminal,
} from "lucide-react";

// ═══════════════════════════════════════════
//  Loading & Error
// ═══════════════════════════════════════════
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center glass-glow rounded-2xl p-10">
        <Loader2 className="w-12 h-12 text-nebula-400 animate-spin mx-auto mb-5" />
        <p className="font-body text-sm text-gray-500">Loading agent data from Monad...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md glass-glow rounded-2xl p-10">
        <AlertCircle className="w-12 h-12 text-plasma-400 mx-auto mb-5" />
        <h2 className="font-display font-bold text-lg text-white mb-4">Error</h2>
        <p className="font-body text-sm text-gray-500 mb-8">{message}</p>
        <button onClick={onRetry} className="btn-secondary inline-flex items-center gap-2 py-3 px-6">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Agent Card (collapsed)
// ═══════════════════════════════════════════
function AgentCard({ agent, isExpanded, onToggle }: {
  agent: AgentInfo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const rankColor = RANK_COLORS[agent.rank] || "#6b7280";
  const timeSinceActive = agent.lastExpeditionTime > 0
    ? Math.floor((Date.now() / 1000 - agent.lastExpeditionTime) / 3600)
    : -1;
  const isOnline = timeSinceActive >= 0 && timeSinceActive < 24;

  return (
    <div className="glass-glow rounded-2xl overflow-hidden card-hover">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 text-left hover:bg-nebula-500/5 transition-colors"
      >
        {/* Status dot */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isOnline ? "bg-aurora-400 animate-pulse" : "bg-gray-600"}`} />

        {/* Address */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-white truncate">{truncateAddress(agent.address)}</div>
          <div className="font-body text-xs text-gray-500 mt-1">
            Mothership #{agent.mothershipId}
          </div>
        </div>

        {/* Rank badge */}
        <div
          className="font-display font-bold text-sm px-3 py-1.5 rounded-lg border"
          style={{ color: rankColor, borderColor: rankColor + "40", background: rankColor + "10" }}
        >
          {RANK_NAMES[agent.rank]}
        </div>

        {/* Level */}
        <div className="text-center hidden sm:block">
          <div className="font-body text-xs text-gray-500">LVL</div>
          <div className="font-display font-bold text-white">{agent.level}</div>
        </div>

        {/* Earned */}
        <div className="text-right hidden md:block">
          <div className="font-body text-xs text-gray-500">Earned</div>
          <div className="font-mono text-sm text-stardust-400">{Number(agent.totalEarned).toFixed(2)} MON</div>
        </div>

        {/* Fleet */}
        <div className="text-right hidden lg:block">
          <div className="font-body text-xs text-gray-500">Fleet</div>
          <div className="font-body text-sm text-gray-300">{agent.shipsCount}S / {agent.explorersCount}E</div>
        </div>

        {/* Last active */}
        <div className="text-right hidden lg:block">
          <div className="font-body text-xs text-gray-500">Last Active</div>
          <div className="font-body text-sm text-gray-400">
            {timeSinceActive < 0 ? "Never" : timeSinceActive < 1 ? "< 1h ago" : `${timeSinceActive}h ago`}
          </div>
        </div>

        {/* Chevron */}
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && <AgentDetailPanel address={agent.address} />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Agent Detail Panel (expanded)
// ═══════════════════════════════════════════
function AgentDetailPanel({ address }: { address: string }) {
  const { mothership, ships, explorers, fleetMap, isLoading } = useAgentDetail(address);
  const { logs, isLoading: logsLoading } = useAgentLogs(address);

  if (isLoading) {
    return (
      <div className="p-5 border-t border-void-700/50 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-nebula-400 animate-spin" />
        <span className="font-body text-sm text-gray-500">Loading detail...</span>
      </div>
    );
  }

  if (!mothership) {
    return (
      <div className="p-5 border-t border-void-700/50 text-center">
        <p className="font-body text-sm text-gray-500">No mothership data found.</p>
      </div>
    );
  }

  const rankColor = RANK_COLORS[mothership.rank] || "#6b7280";
  const xp = getXPForNextLevel(mothership.level, mothership.totalXP);
  const xpPercent = mothership.level >= 25 ? 100 : xp.required > 0 ? (xp.current / xp.required) * 100 : 0;
  const mpDisplay = Number(formatEther(mothership.totalMP)).toFixed(0);

  return (
    <div className="border-t border-void-700/50">
      {/* Mothership Stats */}
      <div className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Rank", value: RANK_NAMES[mothership.rank], icon: Shield, color: rankColor },
            { label: "Level", value: mothership.level, icon: Zap, color: "#a78bfa" },
            { label: "Total MP", value: mpDisplay, icon: Pickaxe, color: "#34d399" },
            { label: "Reward Bonus", value: `+${(mothership.rewardBonus / 100).toFixed(0)}%`, icon: Sparkles, color: "#fbbf24" },
          ].map((stat) => (
            <div key={stat.label} className="bg-void-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="font-body text-xs text-gray-500">{stat.label}</span>
              </div>
              <div className="font-display font-bold text-lg" style={{ color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* XP Bar */}
        <div className="mb-5">
          <div className="flex justify-between font-body text-xs text-gray-500 mb-2">
            <span>{mothership.level >= 25 ? "MAX LEVEL" : `XP to Level ${mothership.level + 1}`}</span>
            <span className="text-nebula-300">{mothership.level >= 25 ? "MAX" : `${xp.current}/${xp.required}`}</span>
          </div>
          <div className="w-full h-3 bg-void-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-nebula-500 to-accent-fuchsia rounded-full transition-all duration-500"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Fleet Preview */}
        {fleetMap.length > 0 && (
          <div>
            <h4 className="font-display font-semibold text-sm text-white mb-3 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-cosmic-400" /> Fleet ({ships.length} Ships, {explorers.length} Explorers)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {fleetMap.map(({ ship, explorers: shipExplorers }) => {
                const r = { 1: "#6b7280", 2: "#10B981", 3: "#3B82F6", 4: "#7C3AED", 5: "#F59E0B" }[ship.rarity] || "#6b7280";
                return (
                  <div key={ship.tokenId} className="bg-void-800/40 rounded-xl p-3 border border-void-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getNFTImage(1, ship.rarity)}
                        alt={`Ship #${ship.tokenId}`}
                        className="w-8 h-8 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <div>
                        <div className="font-mono text-xs text-gray-400">#{ship.tokenId}</div>
                        <div className="text-xs" style={{ color: r }}>{starsString(ship.rarity)}</div>
                      </div>
                    </div>
                    <div className="font-body text-xs text-gray-500">
                      {shipExplorers.length}/{ship.rarity} explorers
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="p-5 border-t border-void-700/50">
        <h4 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-nebula-300" /> Activity Log
        </h4>
        {logsLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <p className="font-body text-sm text-gray-600">No on-chain activity yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {logs.slice(0, 20).map((log, i) => (
              <LogEntry key={i} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Explorer link */}
      <div className="px-5 pb-5">
        <a
          href={`https://monadscan.com/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-body text-xs text-nebula-400 hover:text-nebula-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> View on Monad Explorer
        </a>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Log Entry
// ═══════════════════════════════════════════
const LOG_ICONS: Record<AgentLog["type"], { icon: typeof Rocket; color: string; label: string }> = {
  mint_ships: { icon: Rocket, color: "#3B82F6", label: "Minted Ships" },
  mint_explorers: { icon: Pickaxe, color: "#10B981", label: "Minted Explorers" },
  expedition_started: { icon: Globe, color: "#A855F7", label: "Expedition Started" },
  expedition_resolved: { icon: Zap, color: "#F59E0B", label: "Expedition Resolved" },
  reward_claimed: { icon: Coins, color: "#34d399", label: "Reward Claimed" },
  mothership_created: { icon: Shield, color: "#7C3AED", label: "Mothership Created" },
};

function LogEntry({ log }: { log: AgentLog }) {
  const config = LOG_ICONS[log.type] || { icon: Clock, color: "#6b7280", label: log.type };
  const Icon = config.icon;
  const timeStr = log.timestamp > 0
    ? new Date(log.timestamp * 1000).toLocaleString()
    : `Block #${log.blockNumber}`;

  let detail = "";
  if (log.type === "mint_ships" || log.type === "mint_explorers") {
    detail = `x${log.data.amount}`;
  } else if (log.type === "expedition_started") {
    detail = `Planet ${log.data.planetId}`;
  } else if (log.type === "expedition_resolved") {
    detail = log.data.success ? `Success - ${log.data.reward} MON` : `Failed - ${log.data.reward} MON`;
  } else if (log.type === "reward_claimed") {
    detail = `${log.data.amount} MON`;
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-void-800/20 hover:bg-void-800/40 transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: config.color + "15", border: `1px solid ${config.color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-body text-sm text-white">{config.label}</div>
        {detail && <div className="font-mono text-xs text-gray-400">{detail}</div>}
      </div>
      <div className="font-body text-xs text-gray-600 flex-shrink-0">{timeStr}</div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Leaderboard Tab
// ═══════════════════════════════════════════
function LeaderboardTab({ agents, onOpenModal }: { agents: AgentInfo[]; onOpenModal: () => void }) {
  const sorted = [...agents].sort((a, b) => parseFloat(b.totalEarned) - parseFloat(a.totalEarned));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-20 glass-glow rounded-2xl">
        <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="font-display font-semibold text-lg text-gray-500">No agents registered yet</p>
        <p className="font-body text-sm text-gray-600 mt-2">Agents will appear here once they enter space.</p>
        <button
          onClick={onOpenModal}
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-nebula-500/20 border border-nebula-500/30 text-nebula-300 font-body text-sm hover:bg-nebula-500/30 transition-colors"
        >
          <Terminal className="w-4 h-4" /> Register Agent
        </button>
      </div>
    );
  }

  return (
    <div className="glass-glow rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-void-800/40 border-b border-void-700/30 font-body text-xs text-gray-500 uppercase tracking-wider">
        <div className="col-span-1">#</div>
        <div className="col-span-3">Agent</div>
        <div className="col-span-2 text-center">Rank</div>
        <div className="col-span-1 text-center">LVL</div>
        <div className="col-span-2 text-right">$MON Earned</div>
        <div className="col-span-1 text-center hidden md:block">Fleet</div>
        <div className="col-span-2 text-right hidden lg:block">Last Active</div>
      </div>

      {/* Rows */}
      {sorted.map((agent, i) => {
        const rank = i + 1;
        const rankColor = RANK_COLORS[agent.rank] || "#6b7280";
        const isTop3 = rank <= 3;
        const medalColors = ["#F59E0B", "#94a3b8", "#CD7F32"];
        const timeSince = agent.lastExpeditionTime > 0
          ? Math.floor((Date.now() / 1000 - agent.lastExpeditionTime) / 3600)
          : -1;

        return (
          <div
            key={agent.address}
            className={`grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-void-700/20 hover:bg-nebula-500/5 transition-colors ${
              isTop3 ? "bg-void-800/20" : ""
            }`}
          >
            {/* Rank # */}
            <div className="col-span-1">
              {isTop3 ? (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm border-2"
                  style={{ borderColor: medalColors[rank - 1], color: medalColors[rank - 1], background: medalColors[rank - 1] + "15" }}
                >
                  {rank}
                </div>
              ) : (
                <span className="font-display font-bold text-sm text-gray-500">{rank}</span>
              )}
            </div>

            {/* Address */}
            <div className="col-span-3">
              <div className="font-mono text-sm text-white">{truncateAddress(agent.address)}</div>
              <div className="font-body text-xs text-gray-600">MS #{agent.mothershipId}</div>
            </div>

            {/* Rank */}
            <div className="col-span-2 text-center">
              <span
                className="font-display font-bold text-sm px-3 py-1 rounded-lg border inline-block"
                style={{ color: rankColor, borderColor: rankColor + "40", background: rankColor + "10" }}
              >
                {RANK_NAMES[agent.rank]}
              </span>
            </div>

            {/* Level */}
            <div className="col-span-1 text-center font-display font-bold text-white">
              {agent.level}
            </div>

            {/* Earned */}
            <div className="col-span-2 text-right">
              <span className="font-mono text-sm text-stardust-400">
                {Number(agent.totalEarned).toFixed(2)}
              </span>
              <span className="font-body text-xs text-gray-500 ml-1">MON</span>
            </div>

            {/* Fleet */}
            <div className="col-span-1 text-center font-body text-sm text-gray-400 hidden md:block">
              {agent.shipsCount}S / {agent.explorersCount}E
            </div>

            {/* Last Active */}
            <div className="col-span-2 text-right font-body text-sm text-gray-500 hidden lg:block">
              {timeSince < 0 ? "Never" : timeSince < 1 ? "< 1h ago" : `${timeSince}h ago`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Dashboard Main
// ═══════════════════════════════════════════
export default function DashboardPage() {
  return (
    <Suspense fallback={<><Navbar /><LoadingScreen /></>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "agents";
  const [activeTab, setActiveTab] = useState<"agents" | "leaderboard">(initialTab);
  const { agents, isLoading, error, refresh } = useAgentList();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Agent <span className="gradient-text-nebula">Dashboard</span>
            </h1>
            <p className="font-body text-sm text-gray-500 mt-2">
              Monitoring {agents.length} registered agent{agents.length !== 1 ? "s" : ""} on Monad
            </p>
          </div>
          <button onClick={refresh} className="btn-secondary flex items-center gap-2 py-3 px-5">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 mb-8 bg-void-800/40 p-1 rounded-xl w-fit">
          {([
            { key: "agents" as const, label: "Agents", icon: Users },
            { key: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-body text-sm transition-all ${
                activeTab === tab.key
                  ? "bg-nebula-500/20 text-white border border-nebula-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingScreen />
        ) : error ? (
          <ErrorScreen message={error} onRetry={refresh} />
        ) : activeTab === "agents" ? (
          /* Agents Tab */
          agents.length === 0 ? (
            <div className="text-center py-20 glass-glow rounded-2xl">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="font-display font-semibold text-lg text-gray-500">No agents registered yet</p>
              <p className="font-body text-sm text-gray-600 mt-2 max-w-md mx-auto">
                No agent has entered space on-chain yet. Deploy an AI agent with SKILL.md to start mining.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-nebula-500/20 border border-nebula-500/30 text-nebula-300 font-body text-sm hover:bg-nebula-500/30 transition-colors"
              >
                <Terminal className="w-4 h-4" /> Register Agent
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map(agent => (
                <AgentCard
                  key={agent.address}
                  agent={agent}
                  isExpanded={expandedAgent === agent.address}
                  onToggle={() => setExpandedAgent(
                    expandedAgent === agent.address ? null : agent.address
                  )}
                />
              ))}
            </div>
          )
        ) : (
          /* Leaderboard Tab */
          <LeaderboardTab agents={agents} onOpenModal={() => setIsModalOpen(true)} />
        )}
      </div>
      <RegisterAgentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
