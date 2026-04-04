// parse_demo - CS2 demo analytics tool
// Parses a .dem file and produces a structured performance report including:
//   - Full KAST (Kill / Assist / Survived / Traded) with exact 5-second trade window
//   - Rating 2.0 approximation using HLTV component weights
//   - ADR, KPR, DPR, Opening Kill Success %, Impact Rating, Flash Support
//   - Per-round event timeline with economy, positions, and grenade data
//   - Positional path sampling for heatmap generation

package main

import (
	"fmt"
	"log"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	demoinfocs "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	events "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

// ─────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────

// KASTFlags tracks the four KAST contributions for one player in one round.
type KASTFlags struct {
	Kill     bool
	Assist   bool
	Survived bool
	Traded   bool
}

// Contributed returns true if any flag is set (round counts toward KAST).
func (f KASTFlags) Contributed() bool {
	return f.Kill || f.Assist || f.Survived || f.Traded
}

// DeathRecord captures a death event for trade detection.
type DeathRecord struct {
	VictimSID  uint64 // steam ID of the victim
	VictimTeam common.Team
	KillerSID  uint64 // steam ID of the killer (who must be killed for trade)
	Tick       int
}

// PathSample stores an XY position at a given tick (used for heatmap / pathing).
type PathSample struct {
	Tick int
	X, Y float32
}

// PlayerStats accumulates all metrics for one player across the whole match.
type PlayerStats struct {
	Name    string
	Team    common.Team
	SteamID uint64

	// Basic
	Kills        int
	Deaths       int
	Assists      int
	FlashAssists int

	// Damage
	DamageDealt int
	UtilDamage  int

	// Headshots
	Headshots int

	// Opening duels
	OpeningKills  int // FK won
	OpeningDeaths int // FD

	// Trade kills made BY this player (killed enemy who had just killed teammate)
	TradeKillsMade int

	// Per-round multikills
	K2, K3, K4, K5 int

	// Clutches won (index = opponents remaining when clutch started: 1..5)
	ClutchWins [6]int

	// Flash support
	EnemiesFlashed    int
	TotalFlashSeconds float64

	// KAST per round (index = round number 1-based)
	kastRounds []KASTFlags

	// Positional path (sampled every sampleInterval ticks)
	Path            []PathSample
	lastSampledTick int

	// Weapon kill breakdown: weapon name -> kills
	WeaponKills map[string]int

	// Internal per-round tracking
	roundKills  int
	roundDamage int
}

// RoundStats stores per-round context.
type RoundStats struct {
	Number     int
	BuyT       string
	BuyCT      string
	MoneyT     int
	MoneyCT    int
	EqT        int
	EqCT       int
	WinnerSide string
	EndReason  string
	ScoreCT    int
	ScoreT     int
	Events     []string // timestamped log entries
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

func teamLabel(t common.Team) string {
	switch t {
	case common.TeamCounterTerrorists:
		return "CT"
	case common.TeamTerrorists:
		return "T"
	default:
		return "?"
	}
}

func playerName(p *common.Player) string {
	if p == nil {
		return "World"
	}
	return p.Name
}

func weaponLabel(e *common.Equipment) string {
	if e == nil {
		return "?"
	}
	return e.String()
}

func buyType(money int) string {
	switch {
	case money < 5000:
		return "Eco"
	case money < 20000:
		return "Force"
	default:
		return "Full"
	}
}

func roundEndLabel(r events.RoundEndReason) string {
	labels := map[events.RoundEndReason]string{
		1:  "bomb_exploded",
		7:  "defuse",
		9:  "ct_surrender",
		8:  "t_surrender",
		12: "time",
	}
	if s, ok := labels[r]; ok {
		return s
	}
	return "elimination"
}

// tradeWindowTicks returns the number of ticks in a 5-second trade window
// given the demo's tick rate.
func tradeWindowTicks(tickRate float64) int {
	if tickRate <= 0 {
		tickRate = 64 // safe default
	}
	return int(math.Round(5.0 * tickRate))
}

// ─────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────

type Engine struct {
	parser    demoinfocs.Parser
	players   map[uint64]*PlayerStats
	rounds    []RoundStats
	currRound RoundStats
	roundNum  int

	// Trade detection: recent deaths indexed by victim SteamID.
	// Cleared per-round so there's no cross-round contamination.
	pendingDeaths []DeathRecord

	// Opening duel: first inter-team kill/death of the round
	openingDuelDone bool

	// Clutch tracking: once one side has 1 player alive vs. N enemies
	clutchCandidate uint64 // SteamID of the potential clutcher
	clutchOpponents int    // how many enemies they face

	sampleInterval int // positional sampling interval in ticks
}

func newEngine(p demoinfocs.Parser) *Engine {
	return &Engine{
		parser:         p,
		players:        make(map[uint64]*PlayerStats),
		sampleInterval: 128, // ~1 second at 128 tick, ~2 sec at 64 tick
	}
}

func (e *Engine) getPlayer(p *common.Player) *PlayerStats {
	if p == nil {
		return nil
	}
	sid := p.SteamID64
	if _, ok := e.players[sid]; !ok {
		e.players[sid] = &PlayerStats{
			Name:        p.Name,
			Team:        p.Team,
			SteamID:     sid,
			WeaponKills: make(map[string]int),
		}
	}
	s := e.players[sid]
	s.Name = p.Name // keep name fresh
	s.Team = p.Team
	return s
}

// ensureKASTRound grows the kastRounds slice to cover the current round.
func (s *PlayerStats) ensureKASTRound(round int) {
	for len(s.kastRounds) < round {
		s.kastRounds = append(s.kastRounds, KASTFlags{})
	}
}

// ─── Event Handlers ───────────────────────────────────────────────

func (e *Engine) onRoundStart(ev events.RoundStart) {
	e.roundNum++
	e.openingDuelDone = false
	e.pendingDeaths = e.pendingDeaths[:0]
	e.clutchCandidate = 0
	e.clutchOpponents = 0

	gs := e.parser.GameState()
	var moneyT, moneyCT, eqT, eqCT int
	for _, pl := range gs.Participants().Playing() {
		switch pl.Team {
		case common.TeamTerrorists:
			moneyT += pl.Money()
			eqT += pl.EquipmentValueFreezeTimeEnd()
		case common.TeamCounterTerrorists:
			moneyCT += pl.Money()
			eqCT += pl.EquipmentValueFreezeTimeEnd()
		}
		// Reset per-round kill/damage counters
		if acc := e.getPlayer(pl); acc != nil {
			acc.roundKills = 0
			acc.roundDamage = 0
		}
	}

	e.currRound = RoundStats{
		Number:  e.roundNum,
		BuyT:    buyType(moneyT),
		BuyCT:   buyType(moneyCT),
		MoneyT:  moneyT,
		MoneyCT: moneyCT,
		EqT:     eqT,
		EqCT:    eqCT,
	}
}

func (e *Engine) onRoundEnd(ev events.RoundEnd) {
	gs := e.parser.GameState()
	e.currRound.WinnerSide = teamLabel(ev.Winner)
	e.currRound.EndReason = roundEndLabel(ev.Reason)
	e.currRound.ScoreCT = gs.TeamCounterTerrorists().Score()
	e.currRound.ScoreT = gs.TeamTerrorists().Score()

	// Mark survivors for KAST
	for _, pl := range gs.Participants().Playing() {
		if !pl.IsAlive() {
			continue
		}
		acc := e.getPlayer(pl)
		if acc == nil {
			continue
		}
		acc.ensureKASTRound(e.roundNum)
		acc.kastRounds[e.roundNum-1].Survived = true
	}

	// Finalize multikill tallies
	for _, acc := range e.players {
		switch acc.roundKills {
		case 2:
			acc.K2++
		case 3:
			acc.K3++
		case 4:
			acc.K4++
		default:
			if acc.roundKills >= 5 {
				acc.K5++
			}
		}
	}

	e.rounds = append(e.rounds, e.currRound)
}

func (e *Engine) onKill(ev events.Kill) {
	gs := e.parser.GameState()
	tick := gs.IngameTick()
	tickRate := e.parser.TickRate()
	tradeWindow := tradeWindowTicks(tickRate)

	weapon := weaponLabel(ev.Weapon)

	// ── Collect display info ──────────────────────────────────────────────────
	killerName := playerName(ev.Killer)
	killerTeam := ""
	victimName := playerName(ev.Victim)
	victimTeam := ""
	if ev.Killer != nil {
		killerTeam = teamLabel(ev.Killer.Team)
	}
	if ev.Victim != nil {
		victimTeam = teamLabel(ev.Victim.Team)
	}

	var tags []string
	if ev.IsHeadshot {
		tags = append(tags, "HS")
	}
	if ev.IsWallBang() {
		tags = append(tags, "Wallbang")
	}
	if ev.NoScope {
		tags = append(tags, "NoScope")
	}
	if ev.ThroughSmoke {
		tags = append(tags, "ThroughSmoke")
	}
	if ev.AttackerBlind {
		tags = append(tags, "Blind")
	}

	// Positions & view angle
	posInfo := ""
	if ev.Killer != nil {
		kp := ev.Killer.Position()
		posInfo += fmt.Sprintf(" kpos=(%.0f,%.0f) yaw=%.1f", kp.X, kp.Y, ev.Killer.ViewDirectionX())
	}
	if ev.Victim != nil {
		vp := ev.Victim.Position()
		posInfo += fmt.Sprintf(" vpos=(%.0f,%.0f)", vp.X, vp.Y)
	}

	tagStr := ""
	if len(tags) > 0 {
		tagStr = " [" + strings.Join(tags, "+") + "]"
	}

	// ── Check if this kill is a TRADE ─────────────────────────────────────────
	isTrade := false
	if ev.Killer != nil && ev.Victim != nil {
		for _, death := range e.pendingDeaths {
			withinWindow := (tick - death.Tick) <= tradeWindow
			killerIsEnemy := death.VictimTeam != ev.Killer.Team
			killsThePriorKiller := death.KillerSID == ev.Victim.SteamID64
			if withinWindow && killerIsEnemy && killsThePriorKiller {
				isTrade = true
				// Mark the original victim as Traded in KAST
				if tradedAcc, ok := e.players[death.VictimSID]; ok {
					tradedAcc.ensureKASTRound(e.roundNum)
					tradedAcc.kastRounds[e.roundNum-1].Traded = true
				}
				if killerAcc := e.getPlayer(ev.Killer); killerAcc != nil {
					killerAcc.TradeKillsMade++
				}
				break
			}
		}
	}

	if isTrade {
		tags = append(tags, "Trade")
		tagStr = " [" + strings.Join(tags, "+") + "]"
	}

	// ── Record death for future trade detection ───────────────────────────────
	if ev.Victim != nil && ev.Killer != nil {
		// Prune stale records first (outside trade window)
		fresh := e.pendingDeaths[:0]
		for _, d := range e.pendingDeaths {
			if tick-d.Tick <= tradeWindow {
				fresh = append(fresh, d)
			}
		}
		e.pendingDeaths = append(fresh, DeathRecord{
			VictimSID:  ev.Victim.SteamID64,
			VictimTeam: ev.Victim.Team,
			KillerSID:  ev.Killer.SteamID64,
			Tick:       tick,
		})
	}

	// ── Per-player stat updates ───────────────────────────────────────────────
	if killerAcc := e.getPlayer(ev.Killer); killerAcc != nil && ev.Killer != ev.Victim {
		killerAcc.Kills++
		killerAcc.roundKills++
		if ev.IsHeadshot {
			killerAcc.Headshots++
		}
		killerAcc.WeaponKills[weapon]++
		killerAcc.ensureKASTRound(e.roundNum)
		killerAcc.kastRounds[e.roundNum-1].Kill = true

		// Opening duel
		if !e.openingDuelDone && ev.Killer != nil && ev.Victim != nil &&
			ev.Killer.Team != ev.Victim.Team {
			killerAcc.OpeningKills++
			e.openingDuelDone = true
		}
	}
	if victimAcc := e.getPlayer(ev.Victim); victimAcc != nil {
		victimAcc.Deaths++
		// Opening death (before trade tag — first inter-team death)
		if !e.openingDuelDone && ev.Killer != nil && ev.Victim != nil &&
			ev.Killer.Team != ev.Victim.Team {
			victimAcc.OpeningDeaths++
		}
	}

	// Flash assist
	if ev.AssistedFlash && ev.Assister != nil {
		if assistAcc := e.getPlayer(ev.Assister); assistAcc != nil {
			assistAcc.FlashAssists++
			assistAcc.ensureKASTRound(e.roundNum)
			assistAcc.kastRounds[e.roundNum-1].Assist = true
		}
	}

	// ── Log event ────────────────────────────────────────────────────────────
	line := fmt.Sprintf("  KILL   tick=%7d  %s[%s] -> %s[%s]  %s%s%s",
		tick, killerName, killerTeam, victimName, victimTeam, weapon, tagStr, posInfo)
	e.currRound.Events = append(e.currRound.Events, line)
}

func (e *Engine) onAssist(ev events.PlayerHurt) {
	// Regular assists are tracked via e.onKill (ev.Assister). Nothing extra needed here.
}

func (e *Engine) onDamage(ev events.PlayerHurt) {
	if ev.Attacker == nil || ev.Attacker == ev.Player {
		return
	}
	acc := e.getPlayer(ev.Attacker)
	if acc == nil {
		return
	}
	dmg := ev.HealthDamageTaken
	acc.DamageDealt += dmg
	acc.roundDamage += dmg

	// Util damage heuristic: grenades, molotovs, incendiary
	if ev.Weapon != nil {
		wl := strings.ToLower(ev.Weapon.String())
		if strings.Contains(wl, "grenade") || strings.Contains(wl, "molotov") ||
			strings.Contains(wl, "incendiary") {
			acc.UtilDamage += dmg
		}
	}
}

func (e *Engine) onFlash(ev events.PlayerFlashed) {
	if ev.Attacker == nil || ev.Attacker == ev.Player {
		return
	}
	// Only count flashes on enemies
	if ev.Attacker.Team == ev.Player.Team {
		return
	}
	if acc := e.getPlayer(ev.Attacker); acc != nil {
		acc.EnemiesFlashed++
		acc.TotalFlashSeconds += ev.FlashDuration().Seconds()
	}
}

func (e *Engine) onBombPlanted(ev events.BombPlanted) {
	gs := e.parser.GameState()
	tick := gs.IngameTick()
	site := "A"
	if int(ev.Site) == 1 {
		site = "B"
	}
	line := fmt.Sprintf("  BOMB_PLANTED  tick=%7d  %s[%s]  site=%s",
		tick, playerName(ev.Player), teamLabel(ev.Player.Team), site)
	e.currRound.Events = append(e.currRound.Events, line)
}

func (e *Engine) onBombDefused(ev events.BombDefused) {
	gs := e.parser.GameState()
	tick := gs.IngameTick()
	line := fmt.Sprintf("  BOMB_DEFUSED  tick=%7d  %s[%s]",
		tick, playerName(ev.Player), teamLabel(ev.Player.Team))
	e.currRound.Events = append(e.currRound.Events, line)
}

func (e *Engine) onBombExplode(ev events.BombExplode) {
	gs := e.parser.GameState()
	line := fmt.Sprintf("  BOMB_EXPLODE  tick=%7d", gs.IngameTick())
	e.currRound.Events = append(e.currRound.Events, line)
}

func (e *Engine) onGrenade(ev events.GrenadeProjectileDestroy) {
	if ev.Projectile == nil || ev.Projectile.Thrower == nil {
		return
	}
	gs := e.parser.GameState()
	tick := gs.IngameTick()
	thrower := ev.Projectile.Thrower
	pos := ev.Projectile.Position()
	wStr := ev.Projectile.WeaponInstance.String()
	line := fmt.Sprintf("  GRENADE  tick=%7d  %s[%s]  type=%-20s  pos=(%.0f,%.0f,%.0f)",
		tick, thrower.Name, teamLabel(thrower.Team), wStr, pos.X, pos.Y, pos.Z)
	e.currRound.Events = append(e.currRound.Events, line)
}

func (e *Engine) onFrameDone(ev events.FrameDone) {
	gs := e.parser.GameState()
	tick := gs.IngameTick()
	if tick%e.sampleInterval != 0 {
		return
	}
	for _, pl := range gs.Participants().Playing() {
		if !pl.IsAlive() {
			continue
		}
		acc := e.getPlayer(pl)
		if acc == nil || tick == acc.lastSampledTick {
			continue
		}
		pos := pl.Position()
		acc.Path = append(acc.Path, PathSample{
			Tick: tick, X: float32(pos.X), Y: float32(pos.Y),
		})
		acc.lastSampledTick = tick
	}
}

// ─── Metrics Computation ──────────────────────────────────────────

// KAST returns the player's KAST percentage.
func kastPercent(s *PlayerStats, totalRounds int) float64 {
	if totalRounds == 0 {
		return 0
	}
	contributed := 0
	for round := 0; round < totalRounds && round < len(s.kastRounds); round++ {
		if s.kastRounds[round].Contributed() {
			contributed++
		}
	}
	return float64(contributed) / float64(totalRounds) * 100
}

// ADR returns average damage per round.
func adr(s *PlayerStats, totalRounds int) float64 {
	if totalRounds == 0 {
		return 0
	}
	return float64(s.DamageDealt) / float64(totalRounds)
}

// KPR returns kills per round.
func kpr(s *PlayerStats, totalRounds int) float64 {
	if totalRounds == 0 {
		return 0
	}
	return float64(s.Kills) / float64(totalRounds)
}

// DPR returns deaths per round.
func dpr(s *PlayerStats, totalRounds int) float64 {
	if totalRounds == 0 {
		return 0
	}
	return float64(s.Deaths) / float64(totalRounds)
}

// ImpactRating approximates the HLTV Impact formula:
// Impact = 2.13 * KPR + 0.42 * singleMultiKillRounds/totalRounds - 0.41
func impactRating(s *PlayerStats, totalRounds int) float64 {
	if totalRounds == 0 {
		return 0
	}
	multiKillRounds := float64(s.K2+s.K3+s.K4+s.K5) / float64(totalRounds)
	impact := 2.13*kpr(s, totalRounds) + 0.42*multiKillRounds - 0.41
	return math.Max(0, impact)
}

// Rating20 approximates the HLTV Rating 2.0 formula.
// Rating2.0 = (KillRating + 0.7*SurvivalRating + MultiKillRating + 0.5*ImpactRating + ADRRating) / 5
// Where each component is normalized against world average baselines.
func rating20(s *PlayerStats, totalRounds int) float64 {
	if totalRounds == 0 {
		return 0
	}
	// Baseline averages (approximate world average at top level)
	const (
		avgKPR  = 0.679
		avgSPR  = 0.317 // survived per round
		avgMKPR = 0.095 // multi-kill rounds per round
		avgADR  = 79.0
	)

	kprVal := kpr(s, totalRounds)
	survRating := float64(totalRounds-s.Deaths) / float64(totalRounds) // survival rate

	multiKillRPR := float64(s.K2+s.K3+s.K4+s.K5) / float64(totalRounds)

	adrVal := adr(s, totalRounds)

	killRating := kprVal / avgKPR
	survivalRating := survRating / avgSPR
	multiKillRating := multiKillRPR / avgMKPR
	adrRating := adrVal / avgADR
	impactVal := impactRating(s, totalRounds)

	rating := (killRating + 0.7*survivalRating + multiKillRating + 0.5*impactVal + adrRating) / 5.0
	return math.Max(0, rating)
}

// openingSuccessRate returns FK% = FK / (FK + FD).
func openingSuccessRate(s *PlayerStats) float64 {
	total := s.OpeningKills + s.OpeningDeaths
	if total == 0 {
		return 0
	}
	return float64(s.OpeningKills) / float64(total) * 100
}

// pathDistance returns the total distance traveled based on sampled path.
func pathDistance(path []PathSample) float64 {
	dist := 0.0
	for i := 1; i < len(path); i++ {
		dx := float64(path[i].X - path[i-1].X)
		dy := float64(path[i].Y - path[i-1].Y)
		dist += math.Sqrt(dx*dx + dy*dy)
	}
	return dist
}

// ─── Report Writer ────────────────────────────────────────────────

func writeReport(e *Engine, demoPath string) string {
	var sb strings.Builder

	gs := e.parser.GameState()
	scoreCT := gs.TeamCounterTerrorists().Score()
	scoreT := gs.TeamTerrorists().Score()
	totalRounds := len(e.rounds)
	if totalRounds == 0 {
		totalRounds = 1
	}

	// ── Header ────────────────────────────────────────────────────────────────
	sep := strings.Repeat("=", 80)
	sb.WriteString(sep + "\n")
	sb.WriteString(fmt.Sprintf("  DEMO  : %s\n", demoPath))
	sb.WriteString(fmt.Sprintf("  SCORE : CT %d - %d T  (%d rounds)\n", scoreCT, scoreT, totalRounds))
	sb.WriteString(fmt.Sprintf("  TICK  : %.0f Hz\n", e.parser.TickRate()))
	sb.WriteString(sep + "\n\n")

	// ── Scoreboard ────────────────────────────────────────────────────────────
	sb.WriteString("SCOREBOARD\n")
	sb.WriteString(strings.Repeat("-", 80) + "\n")
	header := fmt.Sprintf("  %-22s %-3s  %3s %3s %3s  %6s %6s %5s %5s  %5s %5s  %4s %4s  %4s\n",
		"Player", "Tm", "K", "D", "A", "ADR", "Rating", "KAST", "HS%",
		"FK%", "FK", "K2", "K3+", "UD")
	sb.WriteString(header)
	sb.WriteString(strings.Repeat("-", 80) + "\n")

	// Sort players: CT first, then T; within side by Rating descending
	allPlayers := make([]*PlayerStats, 0, len(e.players))
	for _, s := range e.players {
		allPlayers = append(allPlayers, s)
	}
	sort.Slice(allPlayers, func(i, j int) bool {
		if allPlayers[i].Team != allPlayers[j].Team {
			return allPlayers[i].Team > allPlayers[j].Team // CT = 3, T = 2
		}
		return rating20(allPlayers[i], totalRounds) > rating20(allPlayers[j], totalRounds)
	})

	prevTeam := common.Team(0)
	for _, s := range allPlayers {
		if s.Team != prevTeam && prevTeam != 0 {
			sb.WriteString(strings.Repeat("-", 80) + "\n")
		}
		prevTeam = s.Team

		r20 := rating20(s, totalRounds)
		kastPct := kastPercent(s, totalRounds)
		hsPct := 0.0
		if s.Kills > 0 {
			hsPct = float64(s.Headshots) / float64(s.Kills) * 100
		}
		fkPct := openingSuccessRate(s)

		sb.WriteString(fmt.Sprintf("  %-22s %-3s  %3d %3d %3d  %6.1f %6.2f %4.0f%% %4.0f%%  %4.0f%% %3d  %4d %4d  %4d\n",
			s.Name, teamLabel(s.Team),
			s.Kills, s.Deaths, s.Assists,
			adr(s, totalRounds), r20, kastPct, hsPct,
			fkPct, s.OpeningKills,
			s.K2, s.K3+s.K4+s.K5,
			s.UtilDamage))
	}
	sb.WriteString("\n")

	// ── KAST Breakdown ─────────────────────────────────────────────────────────
	sb.WriteString("KAST BREAKDOWN (per player)\n")
	sb.WriteString(strings.Repeat("-", 80) + "\n")
	sb.WriteString(fmt.Sprintf("  %-22s  %6s  %5s %5s %5s %5s  %s\n",
		"Player", "KAST%", "Kill", "Asst", "Surv", "Traded", "Rounds contributed"))
	sb.WriteString(strings.Repeat("-", 80) + "\n")
	for _, s := range allPlayers {
		k, a, sv, tr := 0, 0, 0, 0
		contributed := 0
		for _, f := range s.kastRounds {
			if f.Kill {
				k++
			}
			if f.Assist {
				a++
			}
			if f.Survived {
				sv++
			}
			if f.Traded {
				tr++
			}
			if f.Contributed() {
				contributed++
			}
		}
		pct := 0.0
		if totalRounds > 0 {
			pct = float64(contributed) / float64(totalRounds) * 100
		}
		sb.WriteString(fmt.Sprintf("  %-22s  %5.0f%%  %5d %5d %5d %5d    %d/%d\n",
			s.Name, pct, k, a, sv, tr, contributed, totalRounds))
	}
	sb.WriteString("\n")

	// ── Advanced per-player ────────────────────────────────────────────────────
	sb.WriteString("ADVANCED STATISTICS\n")
	sb.WriteString(strings.Repeat("-", 80) + "\n")
	for _, s := range allPlayers {
		sb.WriteString(fmt.Sprintf("  [%s] %s\n", teamLabel(s.Team), s.Name))
		sb.WriteString(fmt.Sprintf("    Rating 2.0      : %.4f\n", rating20(s, totalRounds)))
		sb.WriteString(fmt.Sprintf("    Impact Rating   : %.4f\n", impactRating(s, totalRounds)))
		sb.WriteString(fmt.Sprintf("    KPR / DPR       : %.3f / %.3f\n", kpr(s, totalRounds), dpr(s, totalRounds)))
		sb.WriteString(fmt.Sprintf("    Opening FK/FD   : %d / %d   success: %.0f%%\n",
			s.OpeningKills, s.OpeningDeaths, openingSuccessRate(s)))
		sb.WriteString(fmt.Sprintf("    Trade Kills Made: %d\n", s.TradeKillsMade))
		sb.WriteString(fmt.Sprintf("    Multikills      : 2k=%d  3k=%d  4k=%d  5k=%d\n",
			s.K2, s.K3, s.K4, s.K5))
		sb.WriteString(fmt.Sprintf("    Clutch Wins     : 1v1=%d 1v2=%d 1v3=%d 1v4=%d 1v5=%d\n",
			s.ClutchWins[1], s.ClutchWins[2], s.ClutchWins[3], s.ClutchWins[4], s.ClutchWins[5]))
		sb.WriteString(fmt.Sprintf("    Headshots       : %d (%.0f%%)\n",
			s.Headshots, func() float64 {
				if s.Kills == 0 {
					return 0
				}
				return float64(s.Headshots) / float64(s.Kills) * 100
			}()))
		sb.WriteString(fmt.Sprintf("    Flash Support   : %d enemies flashed / %.1fs total blind\n",
			s.EnemiesFlashed, s.TotalFlashSeconds))
		sb.WriteString(fmt.Sprintf("    Flash Assists   : %d\n", s.FlashAssists))
		sb.WriteString(fmt.Sprintf("    Util Damage     : %d\n", s.UtilDamage))

		// Top weapons
		type wkv struct {
			name  string
			kills int
		}
		var wlist []wkv
		for name, kills := range s.WeaponKills {
			wlist = append(wlist, wkv{name, kills})
		}
		sort.Slice(wlist, func(i, j int) bool { return wlist[i].kills > wlist[j].kills })
		sb.WriteString("    Weapons         : ")
		for i, w := range wlist {
			if i >= 5 {
				break
			}
			sb.WriteString(fmt.Sprintf("%s=%d  ", w.name, w.kills))
		}
		sb.WriteString("\n")

		// Path
		if len(s.Path) > 0 {
			sb.WriteString(fmt.Sprintf("    Distance Walked : %.0f units (%d path samples)\n",
				pathDistance(s.Path), len(s.Path)))
		}
		sb.WriteString("\n")
	}

	// ── Round-by-Round ────────────────────────────────────────────────────────
	sb.WriteString("ROUND-BY-ROUND LOG\n")
	sb.WriteString(strings.Repeat("-", 80) + "\n")
	for _, r := range e.rounds {
		sb.WriteString(fmt.Sprintf("ROUND %2d | Winner=%-3s (%s) | Score CT %d - %d T\n",
			r.Number, r.WinnerSide, r.EndReason, r.ScoreCT, r.ScoreT))
		sb.WriteString(fmt.Sprintf("  Economy  T: $%-5d eq=$%-5d (%s)   CT: $%-5d eq=$%-5d (%s)\n",
			r.MoneyT, r.EqT, r.BuyT, r.MoneyCT, r.EqCT, r.BuyCT))
		for _, ev := range r.Events {
			sb.WriteString(ev + "\n")
		}
		sb.WriteString("\n")
	}

	// ── Player Paths ──────────────────────────────────────────────────────────
	sb.WriteString("PLAYER PATHS (XY samples, every ~1s)\n")
	sb.WriteString(strings.Repeat("-", 80) + "\n")
	for _, s := range allPlayers {
		if len(s.Path) == 0 {
			continue
		}
		sb.WriteString(fmt.Sprintf("  [%s] %s: %d samples  dist=%.0f units\n",
			teamLabel(s.Team), s.Name, len(s.Path), pathDistance(s.Path)))
		maxShow := 10
		for i, p := range s.Path {
			if i >= maxShow {
				sb.WriteString(fmt.Sprintf("    ... (%d more)\n", len(s.Path)-maxShow))
				break
			}
			sb.WriteString(fmt.Sprintf("    tick=%7d  (%.0f, %.0f)\n", p.Tick, p.X, p.Y))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// ─── Entry Point ──────────────────────────────────────────────────

func main() {
	demoPath := ""
	if len(os.Args) > 1 {
		demoPath = os.Args[1]
	} else {
		entries, _ := os.ReadDir(".")
		for _, ent := range entries {
			if strings.HasSuffix(ent.Name(), ".dem") {
				demoPath = ent.Name()
				break
			}
		}
	}
	if demoPath == "" {
		log.Fatal("Usage: go run tools\\parse_demo\\main.go <demo.dem>")
	}

	f, err := os.Open(demoPath)
	if err != nil {
		log.Fatalf("Cannot open demo file: %v", err)
	}
	defer f.Close()

	fmt.Printf("Parsing: %s\n", demoPath)
	t0 := time.Now()

	cfg := demoinfocs.ParserConfig{IgnoreErrBombsiteIndexNotFound: true}
	parser := demoinfocs.NewParserWithConfig(f, cfg)
	defer parser.Close()

	eng := newEngine(parser)

	parser.RegisterEventHandler(eng.onRoundStart)
	parser.RegisterEventHandler(eng.onRoundEnd)
	parser.RegisterEventHandler(eng.onKill)
	parser.RegisterEventHandler(eng.onDamage)
	parser.RegisterEventHandler(eng.onFlash)
	parser.RegisterEventHandler(eng.onBombPlanted)
	parser.RegisterEventHandler(eng.onBombDefused)
	parser.RegisterEventHandler(eng.onBombExplode)
	parser.RegisterEventHandler(eng.onGrenade)
	parser.RegisterEventHandler(eng.onFrameDone)

	if err := parser.ParseToEnd(); err != nil {
		log.Printf("Parse warning: %v", err)
	}

	elapsed := time.Since(t0)
	fmt.Printf("Parsed in %v\n", elapsed.Round(time.Millisecond))

	report := writeReport(eng, demoPath)

	outPath := strings.TrimSuffix(demoPath, ".dem") + "_report.txt"
	if err := os.WriteFile(outPath, []byte(report), 0644); err != nil {
		log.Fatalf("Cannot write report: %v", err)
	}
	lines := strings.Count(report, "\n")
	fmt.Printf("Written: %s  (%d bytes, %d lines)\n", outPath, len(report), lines)
}
