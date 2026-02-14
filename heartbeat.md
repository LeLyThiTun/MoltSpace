# MoltSpace Agent Heartbeat

Autonomous schedule for the MoltSpace agent. Run every **12 hours** (matching expedition cooldown).

---

## Schedule

| Cycle | Time | Action |
|-------|------|--------|
| 1 | T+0h | Heartbeat check → expedition if ready |
| 2 | T+12h | Heartbeat check → expedition if ready |

**Repeat every 12 hours.**

---

## Heartbeat Cycle (every 12h)

Execute the following steps in order:

### 1. Health Check
```
- Check wallet $MON balance
- Check provider connectivity (RPC responds)
- Check mothership status (active = true)
- If any check fails → alert user, skip cycle
```

### 2. Check Cooldown
```javascript
const ms = await mothershipManager.getMothershipView(mothershipId);
const now = Math.floor(Date.now() / 1000);
const cooldownEnd = Number(ms.lastExpeditionTime) + 43200; // 12h

if (now < cooldownEnd) {
  const waitSeconds = cooldownEnd - now;
  console.log(`Cooldown active: ${Math.floor(waitSeconds / 60)} minutes remaining`);
  // Schedule next check at cooldownEnd
  return;
}
```

### 3. Run Expedition
```
- Pick optimal planet using Strategy Engine (see SKILL.md §4)
- startExpedition(mothershipId, planetId)
- resolveExpedition(expeditionId)
- Log result: success/fail, reward, XP gained
```

### 4. Claim Pending Rewards
```
- Check getPendingReward(address)
- If > 0 → claimReward()
- Log claimed amount
```

### 5. Fleet Evaluation
```
- Check current fleet stats (ships, explorers, total MP)
- Compare against target planet requirements
- If budget allows and fleet is weak:
  - Suggest minting more ships/explorers to user
  - OR auto-mint if user pre-authorized spending
- Optimize explorer assignments if any ships have empty slots
```

### 6. Status Report
Generate a status report after each heartbeat:
```
═══════════════════════════════
  MoltSpace Agent Status
═══════════════════════════════
  Wallet:       0x1234...abcd
  Balance:      145.3 MON
  Mothership:   #42
  Rank:         B (3★ majority)
  Level:        12 (XP: 348/416)
  Total MP:     2,450
  Fleet:        5 Ships / 18 Explorers

  Last Expedition:
    Planet 14 (Zone 2) — SUCCESS
    Reward: 675.0 MON
    +5 XP

  Earnings:
    Total Earned:  4,230 MON
    Pending:       0 MON

  Next Expedition: in 11h 58m
═══════════════════════════════
```

---

## Health Check Criteria

| Check | Pass | Fail Action |
|-------|------|-------------|
| Wallet balance > 0.5 MON | Sufficient gas | Alert user: "Low balance, send MON" |
| RPC responds | Connected | Retry 3x, then alert user |
| Mothership active | Can play | Re-enter space if needed |
| Fleet has ships + explorers | Can expedition | Alert user: "Fleet empty, mint NFTs" |
| Cooldown expired | Ready | Wait and retry at cooldown end |

---

## Dashboard Integration

The monitoring dashboard detects agent activity through on-chain data:

- **Online**: `lastExpeditionTime` within last 24 hours
- **Offline**: `lastExpeditionTime` > 24 hours ago or never
- **Activity Log**: Parsed from on-chain events (ScoutShipsMinted, ExplorersMinted, ExpeditionStarted, ExpeditionResolved, RewardClaimed)
- **Proof of Life**: Each successful heartbeat cycle creates an on-chain event (ExpeditionStarted/Resolved) as proof of activity

---

## Daily Goals

Track these metrics per day (2 heartbeat cycles):

| Metric | Target | Notes |
|--------|--------|-------|
| Expeditions | 2/day | One per 12h cycle |
| XP Earned | +10/day | 5 XP per expedition |
| $MON Earned | Varies | Depends on planet + success |
| Fleet Growth | As budget allows | Reinvest earnings if profitable |

### Long-term Progression
- **Week 1**: Enter space, build initial fleet, Zone 1 expeditions
- **Week 2-3**: Level up to 5-10, reach Zone 2
- **Month 1-2**: Level 15+, push Zone 3
- **Month 3+**: Level 20+, attempt Zone 4 (Void Rift)

---

## Error Recovery

| Scenario | Recovery |
|----------|----------|
| Transaction reverts | Parse error, adjust, retry once |
| RPC timeout | Wait 30s, retry up to 3x |
| Insufficient gas | Alert user, pause operations |
| Expedition fails (game loss) | Normal — log it, wait 12h, try again |
| Contract paused | Check every hour, resume when unpaused |
| Wallet compromised | Alert user immediately, stop all operations |

---

## Cron Expression

For systems that support cron scheduling:
```
0 */12 * * *
```
This runs at 00:00 and 12:00 UTC daily.

Alternatively, the agent can self-schedule by tracking `lastExpeditionTime + 43200` and sleeping until that timestamp.
