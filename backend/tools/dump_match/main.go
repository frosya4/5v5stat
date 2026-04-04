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

// ---- Minimal type mirrors (so we don't depend on main package) ----

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
	KillerX    float64 `firestore:"kx"`
	KillerY    float64 `firestore:"ky"`
}

type RoundHistory struct {
	RoundNum   int         `firestore:"round_num"`
	WinnerSide string      `firestore:"winner_side"`
	WinType    string      `firestore:"win_type"`
	ScoreA     int         `firestore:"score_a"`
	ScoreB     int         `firestore:"score_b"`
	BuyTypeT   string      `firestore:"buy_type_t"`
	BuyTypeCT  string      `firestore:"buy_type_ct"`
	KillFeed   []KillEvent `firestore:"kill_feed"`
}

type PlayerStat struct {
	Name        string       `firestore:"name"`
	SteamID     string       `firestore:"steamid"`
	Team        string       `firestore:"team"`
	Kills       int          `firestore:"kills"`
	Deaths      int          `firestore:"deaths"`
	Assists     int          `firestore:"assists"`
	ADR         float64      `firestore:"adr"`
	KAST        float64      `firestore:"kast"`
	Rating      float64      `firestore:"rating"`
	Rating3     float64      `firestore:"rating_3"`
	FK          int          `firestore:"fk"`
	FD          int          `firestore:"fd"`
	HS          int          `firestore:"hs"`
	HSPercent   int          `firestore:"hs_percent"`
	Impact      float64      `firestore:"impact"`
	UtilDmg     int          `firestore:"util_dmg"`
	MoneySpent  int          `firestore:"money_spent"`
	Clutches1v1 int          `firestore:"clutches_1v1"`
	Clutches1v2 int          `firestore:"clutches_1v2"`
	Clutches1v3 int          `firestore:"clutches_1v3"`
	Clutches1v4 int          `firestore:"clutches_1v4"`
	Clutches1v5 int          `firestore:"clutches_1v5"`
	K2          int          `firestore:"k2"`
	K3          int          `firestore:"k3"`
	K4          int          `firestore:"k4"`
	K5          int          `firestore:"k5"`
	Plants      int          `firestore:"plants"`
	Defuses     int          `firestore:"defuses"`
	Weapons     []WeaponStat `firestore:"weapons"`
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

	// --- Fetch all matches ---
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
		fmt.Println("❌ No matches found in Firestore")
		return
	}

	// Sort by date descending (latest first)
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].UploadDate > matches[j].UploadDate
	})

	// Pick latest match
	m := matches[0]
	fmt.Printf("📂 Dumping match: %s (%s)\n", m.Map, m.UploadDate)

	out := dumpMatch(m)

	filename := fmt.Sprintf("match_dump_%s.txt", strings.ReplaceAll(m.ID, ":", "-"))
	os.WriteFile(filename, []byte(out), 0644)
	fmt.Printf("✅ Written to %s (%d bytes)\n", filename, len(out))
}

func dumpMatch(m DemoMatch) string {
	var sb strings.Builder

	// Header
	sb.WriteString("=============================================================\n")
	sb.WriteString(fmt.Sprintf("  МАТЧ: %s\n", strings.ToUpper(m.Map)))
	sb.WriteString(fmt.Sprintf("  СЧЁТ: CT %d : %d T   (%d раундов)\n", m.FinalScoreCT, m.FinalScoreT, m.RoundsCount))
	sb.WriteString(fmt.Sprintf("  Дата: %s\n", m.UploadDate))
	sb.WriteString(fmt.Sprintf("  Файл: %s\n", m.Filename))
	sb.WriteString("=============================================================\n\n")

	// --- PLAYERS ---
	sb.WriteString("━━━ СТАТИСТИКА ИГРОКОВ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	ctPlayers := []PlayerStat{}
	tPlayers := []PlayerStat{}
	for _, p := range m.Players {
		t := strings.ToUpper(p.Team)
		if strings.Contains(t, "3") || strings.Contains(t, "CT") {
			ctPlayers = append(ctPlayers, p)
		} else {
			tPlayers = append(tPlayers, p)
		}
	}

	sort.Slice(ctPlayers, func(i, j int) bool { return ctPlayers[i].Rating > ctPlayers[j].Rating })
	sort.Slice(tPlayers, func(i, j int) bool { return tPlayers[i].Rating > tPlayers[j].Rating })

	writeTeam(&sb, "CT", ctPlayers)
	writeTeam(&sb, "T", tPlayers)

	// --- ROUNDS ---
	sb.WriteString("\n━━━ РАУНДЫ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")
	sorted := append([]RoundHistory{}, m.RoundsHistory...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].RoundNum < sorted[j].RoundNum })

	for _, r := range sorted {
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

		sb.WriteString(fmt.Sprintf("Раунд %2d | T-Buy: %-6s CT-Buy: %-6s | Победа: %-2s (%s) | Счёт: %d-%d\n",
			r.RoundNum, buyT, buyCT, r.WinnerSide, winType, r.ScoreA, r.ScoreB))

		for _, k := range r.KillFeed {
			flags := ""
			if k.HS {
				flags += " [HS]"
			}
			if k.IsWallbang {
				flags += " [WB]"
			}
			if k.IsNoScope {
				flags += " [NoScope]"
			}
			if k.IsBlind {
				flags += " [Blind]"
			}
			weapon := strings.Replace(k.Weapon, "weapon_", "", 1)
			sb.WriteString(fmt.Sprintf("          %s [%s] → %s [%s] via %s%s  @ t=%s\n",
				k.Killer, k.KillerTeam, k.Victim, k.VictimTeam, weapon, flags, k.Time))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func writeTeam(sb *strings.Builder, side string, players []PlayerStat) {
	sb.WriteString(fmt.Sprintf("  [%s КОМАНДА]\n", side))
	sb.WriteString(fmt.Sprintf("  %-20s %3s %3s %3s %5s %5s %5s %5s %4s %4s | Оружие\n",
		"Игрок", "K", "D", "A", "ADR", "RTG", "KAST", "IMP", "FK", "FD"))
	sb.WriteString("  " + strings.Repeat("-", 95) + "\n")

	for _, p := range players {
		// Top weapons
		topW := []WeaponStat{}
		for _, w := range p.Weapons {
			if w.Kills > 0 {
				topW = append(topW, w)
			}
		}
		sort.Slice(topW, func(i, j int) bool { return topW[i].Kills > topW[j].Kills })
		wStr := ""
		for i, w := range topW {
			if i >= 3 {
				break
			}
			name := strings.Replace(w.Name, "weapon_", "", 1)
			wStr += fmt.Sprintf("%s:%d ", name, w.Kills)
		}

		// Clutches & multikills
		extras := ""
		clutchSum := p.Clutches1v1 + p.Clutches1v2 + p.Clutches1v3 + p.Clutches1v4 + p.Clutches1v5
		if clutchSum > 0 {
			extras += fmt.Sprintf(" | Клатчи: %dv1 %dv2 %dv3 %dv4 %dv5", p.Clutches1v1, p.Clutches1v2, p.Clutches1v3, p.Clutches1v4, p.Clutches1v5)
		}
		if p.K3+p.K4+p.K5 > 0 {
			extras += fmt.Sprintf(" | Multi: %dx3к %dx4к %dx5к", p.K3, p.K4, p.K5)
		}
		if p.Plants > 0 || p.Defuses > 0 {
			extras += fmt.Sprintf(" | Бомба: %d плант %d дефуз", p.Plants, p.Defuses)
		}

		sb.WriteString(fmt.Sprintf("  %-20s %3d %3d %3d %5.0f %5.2f %4.0f%% %5.2f %4d %4d | %s%s\n",
			p.Name, p.Kills, p.Deaths, p.Assists,
			p.ADR, p.Rating, p.KAST, p.Impact,
			p.FK, p.FD, wStr, extras))
	}
	sb.WriteString("\n")
}
