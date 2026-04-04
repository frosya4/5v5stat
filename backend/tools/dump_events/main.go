package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	firebase "firebase.google.com/go"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

type WeaponStat struct {
	Name  string `firestore:"name"`
	Kills int    `firestore:"kills"`
	HS    int    `firestore:"hs"`
}

type KillEvent struct {
	Time       string  `firestore:"time"`
	Killer     string  `firestore:"killer"`
	KillerTeam string  `firestore:"killer_team"`
	Victim     string  `firestore:"victim"`
	VictimTeam string  `firestore:"victim_team"`
	Weapon     string  `firestore:"weapon"`
	HS         bool    `firestore:"hs"`
	IsWallbang bool    `firestore:"is_wallbang"`
	IsNoScope  bool    `firestore:"is_noscope"`
	IsBlind    bool    `firestore:"is_blind"`
	IsTrade    bool    `firestore:"is_trade"`
	IsBomb     bool    `firestore:"is_bomb"`
	KillerX    float64 `firestore:"kx"`
	KillerY    float64 `firestore:"ky"`
	KillerZ    float64 `firestore:"kz"`
	VictimX    float64 `firestore:"vx"`
	VictimY    float64 `firestore:"vy"`
	VictimZ    float64 `firestore:"vz"`
}

type GrenadeEvent struct {
	Thrower     string  `firestore:"thrower"`
	ThrowerTeam string  `firestore:"thrower_team"`
	Type        string  `firestore:"type"`
	X           float64 `firestore:"x"`
	Y           float64 `firestore:"y"`
	Z           float64 `firestore:"z"`
	Time        string  `firestore:"time"`
}

type RoundHistory struct {
	RoundNum   int            `firestore:"round_num"`
	WinnerSide string         `firestore:"winner_side"`
	WinType    string         `firestore:"win_type"`
	ScoreA     int            `firestore:"score_a"`
	ScoreB     int            `firestore:"score_b"`
	BuyTypeT   string         `firestore:"buy_type_t"`
	BuyTypeCT  string         `firestore:"buy_type_ct"`
	KillFeed   []KillEvent    `firestore:"kill_feed"`
	Grenades   []GrenadeEvent `firestore:"grenades"`
}

type PlayerStat struct {
	Name           string       `firestore:"name"`
	SteamID        string       `firestore:"steamid"`
	Team           string       `firestore:"team"`
	Kills          int          `firestore:"kills"`
	Deaths         int          `firestore:"deaths"`
	Assists        int          `firestore:"assists"`
	FlashAssists   int          `firestore:"flash_assists"`
	ADR            float64      `firestore:"adr"`
	KAST           float64      `firestore:"kast"`
	Rating         float64      `firestore:"rating"`
	Rating3        float64      `firestore:"rating_3"`
	FK             int          `firestore:"fk"`
	FD             int          `firestore:"fd"`
	HS             int          `firestore:"hs"`
	HSPercent      int          `firestore:"hs_percent"`
	Impact         float64      `firestore:"impact"`
	UtilDmg        int          `firestore:"util_dmg"`
	MoneySpent     int          `firestore:"money_spent"`
	BlindTime      float64      `firestore:"blind_time"`
	EnemiesFlashed float64      `firestore:"enemies_flashed_time"`
	FlashesThrown  int          `firestore:"flashes_thrown"`
	Clutches1v1    int          `firestore:"clutches_1v1"`
	Clutches1v2    int          `firestore:"clutches_1v2"`
	Clutches1v3    int          `firestore:"clutches_1v3"`
	Clutches1v4    int          `firestore:"clutches_1v4"`
	Clutches1v5    int          `firestore:"clutches_1v5"`
	K1             int          `firestore:"k1"`
	K2             int          `firestore:"k2"`
	K3             int          `firestore:"k3"`
	K4             int          `firestore:"k4"`
	K5             int          `firestore:"k5"`
	Plants         int          `firestore:"plants"`
	Defuses        int          `firestore:"defuses"`
	HitsHead       int          `firestore:"hits_head"`
	HitsChest      int          `firestore:"hits_chest"`
	HitsStomach    int          `firestore:"hits_stomach"`
	HitsArms       int          `firestore:"hits_arms"`
	HitsLegs       int          `firestore:"hits_legs"`
	TradeKills     int          `firestore:"trade_kills"`
	TradeDeaths    int          `firestore:"trade_deaths"`
	FavWeapon      string       `firestore:"fav_weapon"`
	Weapons        []WeaponStat `firestore:"weapons"`
}

type DemoMatch struct {
	ID            string         `firestore:"id"`
	Map           string         `firestore:"map"`
	RoundsCount   int            `firestore:"rounds_count"`
	FinalScoreT   int            `firestore:"final_score_t"`
	FinalScoreCT  int            `firestore:"final_score_ct"`
	UploadDate    string         `firestore:"upload_date"`
	Filename      string         `firestore:"filename"`
	Players       []PlayerStat   `firestore:"players"`
	RoundsHistory []RoundHistory `firestore:"rounds_history"`
}

func main() {
	ctx := context.Background()
	sa := option.WithCredentialsFile("serviceAccountKey.json")
	conf := &firebase.Config{ProjectID: "cs5v5stat"}
	app, err := firebase.NewApp(ctx, conf, sa)
	if err != nil {
		log.Fatalf("Firebase init error: %v", err)
	}
	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("Firestore error: %v", err)
	}
	defer client.Close()

	fmt.Println("🔍 Fetching matches from Firestore...")
	iter := client.Collection("matches").Documents(ctx)
	var matches []DemoMatch
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatalf("Iterator error: %v", err)
		}
		var m DemoMatch
		doc.DataTo(&m)
		matches = append(matches, m)
	}

	if len(matches) == 0 {
		fmt.Println("❌ No matches found")
		return
	}

	sort.Slice(matches, func(i, j int) bool {
		return matches[i].UploadDate > matches[j].UploadDate
	})

	m := matches[0]
	fmt.Printf("📂 Processing: %s (%s)\n", m.Map, m.UploadDate)

	out := dumpAllEvents(m)

	filename := fmt.Sprintf("all_events_%s.txt", strings.ReplaceAll(m.ID, ":", "-"))
	os.WriteFile(filename, []byte(out), 0644)
	fmt.Printf("✅ Written: %s (%d bytes, %d lines)\n", filename, len(out), strings.Count(out, "\n"))
}

func w(weapon string) string {
	return strings.ReplaceAll(weapon, "weapon_", "")
}

func flags(k KillEvent) string {
	var f []string
	if k.HS {
		f = append(f, "HS")
	}
	if k.IsWallbang {
		f = append(f, "Wallbang")
	}
	if k.IsNoScope {
		f = append(f, "NoScope")
	}
	if k.IsBlind {
		f = append(f, "Blind")
	}
	if k.IsTrade {
		f = append(f, "Trade")
	}
	if len(f) == 0 {
		return ""
	}
	return " [" + strings.Join(f, "+") + "]"
}

func dumpAllEvents(m DemoMatch) string {
	var sb strings.Builder

	// ═══ HEADER ═══════════════════════════════════════════════
	sb.WriteString("╔══════════════════════════════════════════════════════════╗\n")
	sb.WriteString(fmt.Sprintf("║  МАТЧ: %-50s║\n", strings.ToUpper(m.Map)))
	sb.WriteString(fmt.Sprintf("║  СЧЁТ: CT %-2d : %-2d T    %-33s║\n", m.FinalScoreCT, m.FinalScoreT, fmt.Sprintf("(%d раундов)", m.RoundsCount)))
	sb.WriteString(fmt.Sprintf("║  ДАТА: %-50s║\n", m.UploadDate))
	sb.WriteString(fmt.Sprintf("║  ФАЙЛ: %-50s║\n", m.Filename))
	sb.WriteString("╚══════════════════════════════════════════════════════════╝\n\n")

	// ═══ PLAYERS ══════════════════════════════════════════════
	sb.WriteString("══════════ СОСТАВЫ И ПОЛНАЯ СТАТИСТИКА ══════════════════════\n\n")

	ctTeam := []PlayerStat{}
	tTeam := []PlayerStat{}
	for _, p := range m.Players {
		t := strings.ToUpper(p.Team)
		if strings.Contains(t, "3") || strings.Contains(t, "CT") {
			ctTeam = append(ctTeam, p)
		} else {
			tTeam = append(tTeam, p)
		}
	}
	sort.Slice(ctTeam, func(i, j int) bool { return ctTeam[i].Rating > ctTeam[j].Rating })
	sort.Slice(tTeam, func(i, j int) bool { return tTeam[i].Rating > tTeam[j].Rating })

	writePlayerSection(&sb, "CT", ctTeam)
	writePlayerSection(&sb, "T", tTeam)

	// ═══ EVENTS BY ROUND ══════════════════════════════════════
	sb.WriteString("\n══════════ СОБЫТИЯ ПО РАУНДАМ ═══════════════════════════════\n\n")

	rounds := append([]RoundHistory{}, m.RoundsHistory...)
	sort.Slice(rounds, func(i, j int) bool { return rounds[i].RoundNum < rounds[j].RoundNum })

	for _, r := range rounds {
		buyT := r.BuyTypeT
		buyCT := r.BuyTypeCT
		if buyT == "" {
			buyT = "?"
		}
		if buyCT == "" {
			buyCT = "?"
		}
		winType := r.WinType
		if winType == "" {
			winType = "elimination"
		}

		// Round header
		sb.WriteString(fmt.Sprintf("┌─ РАУНД %2d ─────────────────────────────────────────────────\n", r.RoundNum))
		sb.WriteString(fmt.Sprintf("│  T: %-8s  CT: %-8s  │  Победа: %-3s (%s)  │  Счёт: %d-%d\n",
			buyT, buyCT, r.WinnerSide, winType, r.ScoreA, r.ScoreB))
		sb.WriteString("│\n")

		// Aggregate events into a timeline (kills + grenades)
		type Event struct {
			time string
			kind string // "kill" | "grenade" | "bomb"
			text string
		}
		var events []Event

		for _, k := range r.KillFeed {
			if k.IsBomb {
				weaponClean := w(k.Weapon)
				txt := ""
				if strings.Contains(weaponClean, "planted") || weaponClean == "c4_planted" {
					txt = fmt.Sprintf("💣 БОМБА ЗАЛОЖЕНА  %s [%s]  @ t=%s", k.Killer, k.KillerTeam, k.Time)
				} else if strings.Contains(weaponClean, "defused") || weaponClean == "c4_defused" {
					txt = fmt.Sprintf("✂️  БОМБА ОБЕЗВРЕЖЕНА  %s [%s]  @ t=%s", k.Killer, k.KillerTeam, k.Time)
				} else if weaponClean == "C4" {
					txt = fmt.Sprintf("💥 БОМБА ВЗОРВАЛАСЬ  жертва: %s [%s]  @ t=%s", k.Victim, k.VictimTeam, k.Time)
				} else {
					txt = fmt.Sprintf("💣 %s [%s] → %s [%s]  via %s  @ t=%s",
						k.Killer, k.KillerTeam, k.Victim, k.VictimTeam, weaponClean, k.Time)
				}
				events = append(events, Event{time: k.Time, kind: "bomb", text: txt})
			} else {
				killer := k.Killer
				if killer == "" {
					killer = "World"
				}
				txt := fmt.Sprintf("🔫 %s [%s] → %s [%s]  via %s%s",
					killer, k.KillerTeam, k.Victim, k.VictimTeam, w(k.Weapon), flags(k))
				if k.KillerX != 0 || k.KillerY != 0 {
					txt += fmt.Sprintf("  pos=(%.0f,%.0f)", k.KillerX, k.KillerY)
				}
				txt += fmt.Sprintf("  @ t=%s", k.Time)
				events = append(events, Event{time: k.Time, kind: "kill", text: txt})
			}
		}

		for _, g := range r.Grenades {
			gType := map[string]string{
				"smoke": "💨 SMOKE",
				"flash": "⚡ FLASH",
				"he":    "💥 HE",
				"fire":  "🔥 MOLOTOV",
			}[g.Type]
			if gType == "" {
				gType = "🟡 " + g.Type
			}
			txt := fmt.Sprintf("%s  %s [%s]  pos=(%.0f,%.0f)  @ t=%s",
				gType, g.Thrower, g.ThrowerTeam, g.X, g.Y, g.Time)
			events = append(events, Event{time: g.Time, kind: "grenade", text: txt})
		}

		// Sort by time string (works for m:ss format)
		sort.Slice(events, func(i, j int) bool {
			return events[i].time < events[j].time
		})

		for _, e := range events {
			sb.WriteString(fmt.Sprintf("│  %s\n", e.text))
		}

		sb.WriteString("└────────────────────────────────────────────────────────────\n\n")
	}

	return sb.String()
}

func writePlayerSection(sb *strings.Builder, side string, players []PlayerStat) {
	sb.WriteString(fmt.Sprintf("  ── %s ─────────────────────────────────────────────────────\n", side))
	for _, p := range players {
		sb.WriteString(fmt.Sprintf("  %s\n", p.Name))

		// Core stats
		sb.WriteString(fmt.Sprintf("    Счёт:   %dK / %dD / %dA\n", p.Kills, p.Deaths, p.Assists))
		sb.WriteString(fmt.Sprintf("    Рейтинг: %.2f (3.0: %.2f)  ADR: %.0f  KAST: %.0f%%  Impact: %.2f\n",
			p.Rating, p.Rating3, p.ADR, p.KAST, p.Impact))
		sb.WriteString(fmt.Sprintf("    Открытия: %dFK / %dFD  |  Хедшоты: %d (%.0f%%)\n",
			p.FK, p.FD, p.HS, p.KAST))

		// Multikills
		if p.K2+p.K3+p.K4+p.K5 > 0 {
			sb.WriteString(fmt.Sprintf("    Мультикиллы: %dx1K %dx2K %dx3K %dx4K %dx5K (эйс)\n",
				p.K1, p.K2, p.K3, p.K4, p.K5))
		}

		// Clutches
		clutchSum := p.Clutches1v1 + p.Clutches1v2 + p.Clutches1v3 + p.Clutches1v4 + p.Clutches1v5
		if clutchSum > 0 {
			sb.WriteString(fmt.Sprintf("    Клатчи: 1v1=%d 1v2=%d 1v3=%d 1v4=%d 1v5=%d (всего %d)\n",
				p.Clutches1v1, p.Clutches1v2, p.Clutches1v3, p.Clutches1v4, p.Clutches1v5, clutchSum))
		}

		// Bomb
		if p.Plants > 0 || p.Defuses > 0 {
			sb.WriteString(fmt.Sprintf("    Бомба: %d планта, %d дефуза\n", p.Plants, p.Defuses))
		}

		// Utility
		if p.UtilDmg > 0 || p.FlashesThrown > 0 {
			sb.WriteString(fmt.Sprintf("    Утилита: %d урона от грений, %d флешек брошено, %. 1fс слепоты врагов\n",
				p.UtilDmg, p.FlashesThrown, p.EnemiesFlashed))
		}

		// Hitboxes
		sb.WriteString(fmt.Sprintf("    Попадания: голова=%d грудь=%d живот=%d руки=%d ноги=%d\n",
			p.HitsHead, p.HitsChest, p.HitsStomach, p.HitsArms, p.HitsLegs))

		// Trades
		if p.TradeKills > 0 || p.TradeDeaths > 0 {
			sb.WriteString(fmt.Sprintf("    Обмены: %d трейд-кил, %d трейд-смерть\n", p.TradeKills, p.TradeDeaths))
		}

		// Weapons
		topW := []WeaponStat{}
		for _, ww := range p.Weapons {
			if ww.Kills > 0 {
				topW = append(topW, ww)
			}
		}
		sort.Slice(topW, func(i, j int) bool { return topW[i].Kills > topW[j].Kills })
		if len(topW) > 0 {
			sb.WriteString("    Оружие: ")
			for i, ww := range topW {
				if i >= 5 {
					break
				}
				sb.WriteString(fmt.Sprintf("%s → %dк (hs: %d)  ", w(ww.Name), ww.Kills, ww.HS))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}
}
