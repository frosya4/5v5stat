package main

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go"
	"github.com/golang-jwt/jwt/v5"
	demoinfocs "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	common "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	events "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/option"
)

// --- CONFIG ---
const (
	Port      = ":8000"
	AdminKey  = "admin"                       // Legacy, will be replaced by JWT in production
	JwtSecret = "your-very-secure-secret-573" // In production use Env Var

	// 🔥 ОБНОВЛЕННАЯ ВЕРСИЯ ПАРСЕРА
	CurrentParserVersion = 3
	CurrentParserName    = "go-cs2-parser-v3-full"
)

var firestoreClient *firestore.Client
var parserSemaphore = make(chan struct{}, 1) // Лимит: 1 парсинг одновременно

// --- СТРУКТУРЫ ---

type MatchMeta struct {
	Version    int    `json:"version" firestore:"version"`
	IsDetailed bool   `json:"is_detailed" firestore:"is_detailed"`
	Parser     string `json:"parser" firestore:"parser"`
}

type SideStat struct {
	Kills   int `json:"kills" firestore:"kills"`
	Deaths  int `json:"deaths" firestore:"deaths"`
	Assists int `json:"assists" firestore:"assists"`
	Damage  int `json:"damage" firestore:"damage"`
	FK      int `json:"fk" firestore:"fk"`
	FD      int `json:"fd" firestore:"fd"`
	Rounds  int `json:"rounds" firestore:"rounds"`

	Rating  float64 `json:"rating" firestore:"rating"`
	Rating3 float64 `json:"rating_3" firestore:"rating_3"`
	ADR     float64 `json:"adr" firestore:"adr"`
	Impact  float64 `json:"impact" firestore:"impact"`
	KAST    float64 `json:"kast" firestore:"kast"`
}

type KillEvent struct {
	Time       string `json:"time" firestore:"time"`
	Killer     string `json:"killer" firestore:"killer"`
	KillerTeam string `json:"killer_team" firestore:"killer_team"`
	Victim     string `json:"victim" firestore:"victim"`
	VictimTeam string `json:"victim_team" firestore:"victim_team"`
	Weapon     string `json:"weapon" firestore:"weapon"`
	HS         bool   `json:"hs" firestore:"hs"`
	IsTrade    bool   `json:"is_trade" firestore:"is_trade"`

	// 🔥 НОВЫЕ ПОЛЯ: Style Points
	IsWallbang     bool `json:"is_wallbang" firestore:"is_wallbang"`
	IsThroughSmoke bool `json:"is_through_smoke" firestore:"is_through_smoke"`
	IsNoScope      bool `json:"is_noscope" firestore:"is_noscope"`
	IsBlind        bool `json:"is_blind" firestore:"is_blind"` // Убийца был ослеплен
	IsBomb         bool `json:"is_bomb" firestore:"is_bomb"`   // Это событие планта/взрыва

	// 🔥 НОВЫЕ ПОЛЯ: Координаты (для Heatmap)
	KillerX float64 `json:"kx" firestore:"kx"`
	KillerY float64 `json:"ky" firestore:"ky"`
	KillerZ float64 `json:"kz" firestore:"kz"`
	VictimX float64 `json:"vx" firestore:"vx"`
	VictimY float64 `json:"vy" firestore:"vy"`
	VictimZ float64 `json:"vz" firestore:"vz"`
}

type GrenadeEvent struct {
	Thrower     string  `json:"thrower" firestore:"thrower"`
	ThrowerTeam string  `json:"thrower_team" firestore:"thrower_team"`
	Type        string  `json:"type" firestore:"type"` // smoke, flash, he, molotov, inc
	X           float64 `json:"x" firestore:"x"`
	Y           float64 `json:"y" firestore:"y"`
	Z           float64 `json:"z" firestore:"z"`
	Time        string  `json:"time" firestore:"time"`
}

type DuelStat struct {
	Enemy  string `json:"enemy" firestore:"enemy"`
	Kills  int    `json:"kills" firestore:"kills"`
	Deaths int    `json:"deaths" firestore:"deaths"`
	Diff   int    `json:"diff" firestore:"diff"`
}

type WeaponStat struct {
	Name      string `json:"name" firestore:"name"`
	Kills     int    `json:"kills" firestore:"kills"`
	HS        int    `json:"hs" firestore:"hs"`
	HSPercent int    `json:"hs_percent" firestore:"hs_percent"`
}

type PlayerStat struct {
	Name         string  `json:"name" firestore:"name"`
	SteamID      string  `json:"steamid" firestore:"steamid"`
	Team         string  `json:"team" firestore:"team"`
	Kills        int     `json:"kills" firestore:"kills"`
	Deaths       int     `json:"deaths" firestore:"deaths"`
	Assists      int     `json:"assists" firestore:"assists"`
	FlashAssists int     `json:"flash_assists" firestore:"flash_assists"`
	TradeKills   int     `json:"trade_kills" firestore:"trade_kills"`
	HS           int     `json:"hs" firestore:"hs"`
	HSPercent    int     `json:"hs_percent" firestore:"hs_percent"`
	KD           float64 `json:"kd" firestore:"kd"`
	ADR          float64 `json:"adr" firestore:"adr"`
	KAST         float64 `json:"kast" firestore:"kast"`
	Impact       float64 `json:"impact" firestore:"impact"`

	Rating2 float64 `json:"rating" firestore:"rating"`
	Rating3 float64 `json:"rating_3" firestore:"rating_3"`

	FK                  int     `json:"fk" firestore:"fk"`
	FD                  int     `json:"fd" firestore:"fd"`
	BlindTime           float64 `json:"blind_time" firestore:"blind_time"`
	EnemiesFlashedTime  float64 `json:"enemies_flashed_time" firestore:"enemies_flashed_time"`
	EnemiesFlashedCount int     `json:"enemies_flashed_count" firestore:"enemies_flashed_count"`

	UtilDmg         int     `json:"util_dmg" firestore:"util_dmg"`
	UtilDmgPerRound float64 `json:"util_dmg_per_round" firestore:"util_dmg_per_round"`
	MoneySpent      int     `json:"money_spent" firestore:"money_spent"`
	FavWeapon       string  `json:"fav_weapon" firestore:"fav_weapon"`
	FlashesThrown   int     `json:"flashes_thrown" firestore:"flashes_thrown"`

	// Хитгруппы
	HitsHead    int `json:"hits_head" firestore:"hits_head"`
	HitsChest   int `json:"hits_chest" firestore:"hits_chest"`
	HitsStomach int `json:"hits_stomach" firestore:"hits_stomach"`
	HitsArms    int `json:"hits_arms" firestore:"hits_arms"`
	HitsLegs    int `json:"hits_legs" firestore:"hits_legs"`

	// 🔥 НОВЫЕ ПОЛЯ: Бомба
	Plants  int `json:"plants" firestore:"plants"`
	Defuses int `json:"defuses" firestore:"defuses"`

	Clutches1v1 int `json:"clutches_1v1" firestore:"clutches_1v1"`
	Clutches1v2 int `json:"clutches_1v2" firestore:"clutches_1v2"`
	Clutches1v3 int `json:"clutches_1v3" firestore:"clutches_1v3"`
	Clutches1v4 int `json:"clutches_1v4" firestore:"clutches_1v4"`
	Clutches1v5 int `json:"clutches_1v5" firestore:"clutches_1v5"`

	Weapons []WeaponStat `json:"weapons" firestore:"weapons"`
	Duels   []DuelStat   `json:"duels" firestore:"duels"`

	RoundsPlayed   int                    `json:"-" firestore:"-"`
	KASTRounds     int                    `json:"-" firestore:"-"`
	RoundKillCount int                    `json:"-" firestore:"-"` // resets each round
	WasTraded      bool                   `json:"-" firestore:"-"` // set by trade detector per round
	WeaponMap      map[string]*WeaponStat `json:"-" firestore:"-"`
	DuelMap        map[string]*DuelStat   `json:"-" firestore:"-"`
	TotalDamage    int                    `json:"-" firestore:"-"`

	// Parser 3.0: Multikill rounds
	K2 int `json:"k2" firestore:"k2"`
	K3 int `json:"k3" firestore:"k3"`
	K4 int `json:"k4" firestore:"k4"`
	K5 int `json:"k5" firestore:"k5"`

	// Parser 3.0: KAST component breakdown (round counts)
	KASTKill     int `json:"kast_kill" firestore:"kast_kill"`
	KASTAssist   int `json:"kast_assist" firestore:"kast_assist"`
	KASTSurvived int `json:"kast_survived" firestore:"kast_survived"`
	KASTTraded   int `json:"kast_traded" firestore:"kast_traded"`

	// Parser 3.0: Trade deaths (player died and was NOT traded)
	TradeDeaths int `json:"trade_deaths" firestore:"trade_deaths"`

	// Parser 3.0: Opening duel (aliases for FK/FD with explicit naming)
	OpeningKills  int     `json:"opening_kills" firestore:"opening_kills"`
	OpeningDeaths int     `json:"opening_deaths" firestore:"opening_deaths"`
	OpeningPct    float64 `json:"opening_pct" firestore:"opening_pct"`

	// Parser 3.0: Per-round rates
	KPR float64 `json:"kpr" firestore:"kpr"`
	DPR float64 `json:"dpr" firestore:"dpr"`

	// 🔥 НОВЫЕ ПОЛЯ: Статистика по сторонам
	StatsT  SideStat `json:"t_stats" firestore:"t_stats"`
	StatsCT SideStat `json:"ct_stats" firestore:"ct_stats"`
}

type RoundHistory struct {
	RoundNum   int    `json:"round_num" firestore:"round_num"`
	WinnerSide string `json:"winner_side" firestore:"winner_side"`
	WinType    string `json:"win_type" firestore:"win_type"`
	ScoreA     int    `json:"score_a" firestore:"score_a"`
	ScoreB     int    `json:"score_b" firestore:"score_b"`

	// 🔥 НОВЫЕ ПОЛЯ: Экономика раунда
	BuyTypeT  string `json:"buy_type_t" firestore:"buy_type_t"`
	BuyTypeCT string `json:"buy_type_ct" firestore:"buy_type_ct"`

	KillFeed []KillEvent    `json:"kill_feed" firestore:"kill_feed"`
	Grenades []GrenadeEvent `json:"grenades" firestore:"grenades"`
}

type DemoResponse struct {
	ID            string         `json:"id" firestore:"id"`
	Map           string         `json:"map" firestore:"map"`
	RoundsCount   int            `json:"rounds_count" firestore:"rounds_count"`
	RoundsHistory []RoundHistory `json:"rounds_history" firestore:"rounds_history"`
	FinalScoreT   int            `json:"final_score_t" firestore:"final_score_t"`
	FinalScoreCT  int            `json:"final_score_ct" firestore:"final_score_ct"`
	Players       []PlayerStat   `json:"players" firestore:"players"`
	Filename      string         `json:"filename" firestore:"filename"`
	UploadDate    string         `json:"upload_date" firestore:"upload_date"`
	Meta          MatchMeta      `json:"meta" firestore:"meta"`
}

type DeathLog struct {
	Time       time.Duration
	KillerID   uint64
	VictimID   uint64
	VictimTeam common.Team
}

// --- AUTH STRUCTURES ---

type User struct {
	ID                  string    `json:"id" firestore:"id"`
	Email               string    `json:"email" firestore:"email"`
	PasswordHash        string    `json:"-" firestore:"password_hash"`
	DisplayName         string    `json:"display_name" firestore:"display_name"`
	SteamID             string    `json:"steamid" firestore:"steamid"`
	Avatar              string    `json:"avatar" firestore:"avatar"`
	BackgroundURL       string    `json:"background_url" firestore:"background_url"`
	DashboardBackground string    `json:"dashboard_background" firestore:"dashboard_background"`
	Bio                 string    `json:"bio" firestore:"bio"`
	SocialVK            string    `json:"social_vk" firestore:"social_vk"`
	SocialTG            string    `json:"social_tg" firestore:"social_tg"`
	SocialTwitch        string    `json:"social_twitch" firestore:"social_twitch"`
	Role                string    `json:"role" firestore:"role"` // "admin" or "user"
	CreatedAt           time.Time `json:"created_at" firestore:"created_at"`
}

type PublicUser struct {
	ID                  string `json:"id"`
	DisplayName         string `json:"display_name"`
	SteamID             string `json:"steamid"`
	Avatar              string `json:"avatar"`
	BackgroundURL       string `json:"background_url"`
	DashboardBackground string `json:"dashboard_background"`
	Bio                 string `json:"bio"`
	SocialVK            string `json:"social_vk"`
	SocialTG            string `json:"social_tg"`
	SocialTwitch        string `json:"social_twitch"`
	Role                string `json:"role"`
}

type RegisterRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
	SteamID     string `json:"steamid"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

func main() {
	ctx := context.Background()
	sa := option.WithCredentialsFile("serviceAccountKey.json")
	app, err := firebase.NewApp(ctx, nil, sa)
	if err != nil {
		log.Fatalf("Init error: %v\n", err)
	}
	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("Firestore error: %v\n", err)
	}
	firestoreClient = client
	defer client.Close()

	fmt.Println("✅ 573 stat Parser v3 READY")

	mux := http.NewServeMux()

	// API Routes
	mux.HandleFunc("/api/register", corsMiddleware(handleRegister))
	mux.HandleFunc("/api/login", corsMiddleware(handleLogin))
	mux.HandleFunc("/api/me", corsMiddleware(authMiddleware(handleMe)))
	mux.HandleFunc("/api/update-profile", corsMiddleware(authMiddleware(handleUpdateProfile)))
	mux.HandleFunc("/api/user/", corsMiddleware(handleGetUser))
	mux.HandleFunc("/api/upload-demo", corsMiddleware(authMiddleware(handleUpload)))
	mux.HandleFunc("/api/generate-review", corsMiddleware(handleGenerateReview))

	// Static Files Frontend
	// Important: This must be after API routes
	fs := http.FileServer(http.Dir("../frontend/dist"))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If it's an API request that didn't match above, return 404
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Check if file exists in dist
		path := filepath.Join("../frontend/dist", r.URL.Path)
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		http.ServeFile(w, r, "../frontend/dist/index.html")
	})

	fmt.Printf("🚀 Server running on https://573pugs.pro\n")
	log.Fatal(http.ListenAndServe(Port, mux))
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	// Check if user is admin
	role := r.Context().Value("role").(string)
	if role != "admin" {
		http.Error(w, "Forbidden: Admin only", 403)
		return
	}

	fmt.Println("📥 New upload received. Downloading...")

	r.Body = http.MaxBytesReader(w, r.Body, 1024*1024*1024)
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Bad Request", 400)
		return
	}
	defer file.Close()

	tempFile, err := os.CreateTemp("", "cs2demo-*.dem")
	if err != nil {
		http.Error(w, "Server Error", 500)
		return
	}
	defer os.Remove(tempFile.Name())
	io.Copy(tempFile, file)
	tempFile.Close()

	fmt.Printf("📂 Processing in queue: %s\n", header.Filename)

	// 🔥 ОЧЕРЕДЬ: Ограничиваем до 1 парсинга за раз, чтобы не уронить сервер
	parserSemaphore <- struct{}{}
	result, err := parseDemo(tempFile.Name(), header.Filename)
	<-parserSemaphore

	if err != nil {
		fmt.Println("❌ Parse Error:", err)
		http.Error(w, "Parse Error: "+err.Error(), 500)
		return
	}

	fmt.Println("\n💾 Saving to Firestore...")
	ctx := context.Background()
	_, err = firestoreClient.Collection("matches").Doc(result.ID).Set(ctx, result)
	if err != nil {
		fmt.Println("❌ Firebase Error:", err)
		http.Error(w, "Firebase Error: "+err.Error(), 500)
		return
	}

	fmt.Println("✅ Done! Match saved.")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "https://573pugs.pro" || origin == "http://573pugs.pro" || strings.HasPrefix(origin, "http://localhost") {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "https://573pugs.pro")
		}
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func extractDateAndMap(filename string, headerMap string) (string, string) {
	re := regexp.MustCompile(`_(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})[-_]`)
	matches := re.FindStringSubmatch(filename)
	finalDate := time.Now()
	if len(matches) == 6 {
		dateStr := matches[1] + matches[2] + matches[3] + matches[4] + matches[5]
		parsedTime, err := time.Parse("0601021504", dateStr)
		if err == nil {
			finalDate = parsedTime
		}
	}
	prettyMap := headerMap
	if prettyMap == "" && strings.Contains(filename, "de_") {
		parts := strings.Split(filename, "-")
		prettyMap = strings.TrimSuffix(parts[len(parts)-1], ".dem")
	}
	if len(prettyMap) > 0 {
		runes := []rune(prettyMap)
		runes[0] = unicode.ToUpper(runes[0])
		prettyMap = string(runes)
	}
	return finalDate.Format(time.RFC3339), prettyMap
}

func formatRoundTime(current time.Duration, start time.Duration) string {
	elapsed := current - start
	if elapsed < 0 {
		elapsed = 0
	}
	return fmt.Sprintf("%d:%02d", int(elapsed.Minutes()), int(elapsed.Seconds())%60)
}

func formatTeam(t common.Team) string {
	if t == common.TeamCounterTerrorists {
		return "CT"
	} else if t == common.TeamTerrorists {
		return "T"
	}
	return "SPEC"
}

// Вспомогательная функция для определения типа закупа
func determineBuyType(teamVal int) string {
	if teamVal < 5000 {
		return "Eco"
	} else if teamVal < 20000 {
		return "Force" // Semi-Buy
	} else {
		return "Full"
	}
}

func getPlayer(stats map[uint64]*PlayerStat, steamID uint64, name string) *PlayerStat {
	if _, ok := stats[steamID]; !ok {
		stats[steamID] = &PlayerStat{
			Name:      name,
			SteamID:   fmt.Sprintf("%d", steamID),
			WeaponMap: make(map[string]*WeaponStat),
			DuelMap:   make(map[string]*DuelStat),
		}
	}
	if name != "" {
		stats[steamID].Name = name
	}
	return stats[steamID]
}

func getWeaponStat(p *PlayerStat, name string) *WeaponStat {
	if _, ok := p.WeaponMap[name]; !ok {
		p.WeaponMap[name] = &WeaponStat{Name: name}
	}
	return p.WeaponMap[name]
}

func getDuelStat(p *PlayerStat, enemy string) *DuelStat {
	if _, ok := p.DuelMap[enemy]; !ok {
		p.DuelMap[enemy] = &DuelStat{Enemy: enemy}
	}
	return p.DuelMap[enemy]
}

func parseDemo(path string, originalFilename string) (DemoResponse, error) {
	f, err := os.Open(path)
	if err != nil {
		return DemoResponse{}, err
	}
	defer f.Close()
	p := demoinfocs.NewParser(f)
	defer p.Close()

	globalStats := make(map[uint64]*PlayerStat)
	roundsHistory := []RoundHistory{}
	roundStats := make(map[uint64]*PlayerStat)
	currentRoundKills := []KillEvent{}
	currentRoundGrenades := []GrenadeEvent{}

	var roundFirstKill bool
	var roundStartTime time.Duration
	var recentDeaths []DeathLog
	var potentialClutchPlayer *common.Player
	var potentialClutchEnemies int

	// Экономика раунда
	var currentBuyT, currentBuyCT string

	header, err := p.ParseHeader()
	if err != nil {
		return DemoResponse{}, err
	}
	realDate, prettyMap := extractDateAndMap(originalFilename, header.MapName)
	idHash := md5.Sum([]byte(originalFilename + realDate))
	matchID := hex.EncodeToString(idHash[:])[:12]

	p.RegisterEventHandler(func(e events.RoundStart) {
		roundStats = make(map[uint64]*PlayerStat)
		currentRoundKills = []KillEvent{}
		currentRoundGrenades = []GrenadeEvent{}
		roundFirstKill = false
		roundStartTime = p.CurrentTime()
		recentDeaths = []DeathLog{}
		potentialClutchPlayer = nil
		potentialClutchEnemies = 0

		for _, pl := range p.GameState().Participants().Playing() {
			if pl.SteamID64 != 0 {
				s := getPlayer(globalStats, pl.SteamID64, pl.Name)
				s.MoneySpent += pl.EquipmentValueCurrent()
				// Reset per-round trackers
				s.RoundKillCount = 0
				s.WasTraded = false
			}
		}
	})

	// Определяем тип закупа после окончания фризтайма
	p.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
		roundStartTime = p.CurrentTime()

		tVal := p.GameState().Team(common.TeamTerrorists).CurrentEquipmentValue()
		ctVal := p.GameState().Team(common.TeamCounterTerrorists).CurrentEquipmentValue()

		currentBuyT = determineBuyType(tVal)
		currentBuyCT = determineBuyType(ctVal)
	})

	// --- ROUND END ---
	p.RegisterEventHandler(func(e events.RoundEnd) {
		killCount := 0
		knifeCount := 0
		for _, k := range currentRoundKills {
			killCount++
			if strings.Contains(k.Weapon, "Knife") || strings.Contains(k.Weapon, "Bayonet") || strings.Contains(k.Weapon, "Karambit") {
				knifeCount++
			}
		}
		if killCount > 0 && float64(knifeCount)/float64(killCount) > 0.8 {
			return
		}

		if potentialClutchPlayer != nil && potentialClutchPlayer.Team == e.Winner {
			s := getPlayer(globalStats, potentialClutchPlayer.SteamID64, potentialClutchPlayer.Name)
			switch potentialClutchEnemies {
			case 1:
				s.Clutches1v1++
			case 2:
				s.Clutches1v2++
			case 3:
				s.Clutches1v3++
			case 4:
				s.Clutches1v4++
			case 5:
				s.Clutches1v5++
			}
		}

		winner := "DRAW"
		if e.Winner == common.TeamTerrorists {
			winner = "T"
		}
		if e.Winner == common.TeamCounterTerrorists {
			winner = "CT"
		}

		winType := "elimination"
		switch e.Reason {
		case events.RoundEndReasonTargetBombed:
			winType = "bomb"
		case events.RoundEndReasonBombDefused:
			winType = "defuse"
		case events.RoundEndReasonTargetSaved:
			winType = "time"
		}

		roundsHistory = append(roundsHistory, RoundHistory{
			RoundNum:   len(roundsHistory) + 1,
			WinnerSide: winner,
			WinType:    winType,
			ScoreA:     p.GameState().Team(common.TeamCounterTerrorists).Score(),
			ScoreB:     p.GameState().Team(common.TeamTerrorists).Score(),

			// 🔥 ЭКОНОМИКА
			BuyTypeT:  currentBuyT,
			BuyTypeCT: currentBuyCT,

			KillFeed: currentRoundKills,
			Grenades: currentRoundGrenades,
		})

		playingParticipants := p.GameState().Participants().Playing()

		for _, player := range playingParticipants {
			if player.SteamID64 == 0 || player.Name == "GOTV" {
				continue
			}

			gStat := getPlayer(globalStats, player.SteamID64, player.Name)
			rStat := getPlayer(roundStats, player.SteamID64, player.Name)

			currentTeam := formatTeam(player.Team)
			if currentTeam != "SPEC" {
				gStat.Team = currentTeam
			} else if gStat.Team == "" {
				gStat.Team = "SPEC"
			}

			// Aggregate stats
			gStat.Kills += rStat.Kills
			gStat.Deaths += rStat.Deaths
			gStat.Assists += rStat.Assists
			gStat.FlashAssists += rStat.FlashAssists
			gStat.TradeKills += rStat.TradeKills
			gStat.HS += rStat.HS
			gStat.FK += rStat.FK
			gStat.FD += rStat.FD
			gStat.TotalDamage += rStat.TotalDamage
			gStat.UtilDmg += rStat.UtilDmg
			gStat.BlindTime += rStat.BlindTime
			gStat.RoundsPlayed++

			// Aggregate hitgroups and flashes
			gStat.HitsHead += rStat.HitsHead
			gStat.HitsChest += rStat.HitsChest
			gStat.HitsStomach += rStat.HitsStomach
			gStat.HitsArms += rStat.HitsArms
			gStat.HitsLegs += rStat.HitsLegs
			gStat.EnemiesFlashedTime += rStat.EnemiesFlashedTime
			gStat.EnemiesFlashedCount += rStat.EnemiesFlashedCount

			// Aggregate bomb
			gStat.Plants += rStat.Plants
			gStat.Defuses += rStat.Defuses

			// Parser 3.0: Multikill round tallies
			switch gStat.RoundKillCount {
			case 2:
				gStat.K2++
			case 3:
				gStat.K3++
			case 4:
				gStat.K4++
			default:
				if gStat.RoundKillCount >= 5 {
					gStat.K5++
				}
			}

			// Parser 3.0: KAST component breakdown
			isAlive := player.IsAlive()
			kastContributed := false
			if rStat.Kills > 0 {
				gStat.KASTKill++
				kastContributed = true
			}
			if rStat.Assists > 0 || rStat.FlashAssists > 0 {
				gStat.KASTAssist++
				kastContributed = true
			}
			if isAlive {
				gStat.KASTSurvived++
				kastContributed = true
			}
			if gStat.WasTraded {
				gStat.KASTTraded++
				kastContributed = true
			}
			if kastContributed {
				gStat.KASTRounds++
			}

			// Parser 3.0: Opening kills/deaths mirrors FK/FD
			gStat.OpeningKills = gStat.FK
			gStat.OpeningDeaths = gStat.FD

			for wName, wStat := range rStat.WeaponMap {
				gwStat := getWeaponStat(gStat, wName)
				gwStat.Kills += wStat.Kills
				gwStat.HS += wStat.HS
			}
			for enemyName, dStat := range rStat.DuelMap {
				gdStat := getDuelStat(gStat, enemyName)
				gdStat.Kills += dStat.Kills
				gdStat.Deaths += dStat.Deaths
				gdStat.Diff += dStat.Diff
			}

			// Side-specific accumulation
			var sidePtr *SideStat
			if currentTeam == "T" {
				sidePtr = &gStat.StatsT
			} else if currentTeam == "CT" {
				sidePtr = &gStat.StatsCT
			}

			if sidePtr != nil {
				sidePtr.Rounds++
				sidePtr.Kills += rStat.Kills
				sidePtr.Deaths += rStat.Deaths
				sidePtr.Assists += rStat.Assists
				sidePtr.Damage += rStat.TotalDamage
				sidePtr.FK += rStat.FK
				sidePtr.FD += rStat.FD
			}
		}
	})

	// --- KILL HANDLER ---
	p.RegisterEventHandler(func(e events.Kill) {
		if !p.GameState().IsMatchStarted() {
			return
		}

		weapon := "world"
		if e.Weapon != nil {
			weapon = e.Weapon.String()
		}

		var kName, kTeam string
		var kX, kY, kZ float64 // Coords
		isTrade := false

		// 🔥 KILLER LOGIC
		if e.Killer != nil {
			kName = e.Killer.Name
			kTeam = formatTeam(e.Killer.Team)
			pos := e.Killer.Position()
			kX, kY, kZ = pos.X, pos.Y, pos.Z // Запоминаем координаты

			s := getPlayer(roundStats, e.Killer.SteamID64, e.Killer.Name)
			s.Kills++
			if e.IsHeadshot {
				s.HS++
			}
			getWeaponStat(s, weapon).Kills++
			if e.IsHeadshot {
				getWeaponStat(s, weapon).HS++
			}

			// Trade Logic: check if this kill avenges a recently killed teammate
			cutoff := p.CurrentTime() - (5 * time.Second)
			for i := len(recentDeaths) - 1; i >= 0; i-- {
				d := recentDeaths[i]
				if d.Time < cutoff {
					break
				}
				if d.KillerID == e.Victim.SteamID64 && d.VictimTeam == e.Killer.Team {
					s.TradeKills++
					isTrade = true
					// Mark the original victim as traded in their global stats
					if gs := globalStats[d.VictimID]; gs != nil {
						gs.WasTraded = true
					}
					break
				}
			}

			// Parser 3.0: increment per-round kill count on global stat
			gKillerStat := getPlayer(globalStats, e.Killer.SteamID64, e.Killer.Name)
			gKillerStat.RoundKillCount++

			if !roundFirstKill {
				s.FK++
				roundFirstKill = true
				if e.Victim != nil {
					getPlayer(roundStats, e.Victim.SteamID64, e.Victim.Name).FD++
				}
			}
			if e.Victim != nil {
				d := getDuelStat(s, e.Victim.Name)
				d.Kills++
				d.Diff++
				dv := getDuelStat(getPlayer(roundStats, e.Victim.SteamID64, e.Victim.Name), kName)
				dv.Deaths++
				dv.Diff--
			}
		} else {
			kName = "World"
			kTeam = "NONE"
		}

		// 🔥 VICTIM LOGIC
		var vName, vTeam string
		var vX, vY, vZ float64
		if e.Victim != nil {
			vName = e.Victim.Name
			vTeam = formatTeam(e.Victim.Team)
			pos := e.Victim.Position()
			vX, vY, vZ = pos.X, pos.Y, pos.Z // Запоминаем координаты

			getPlayer(roundStats, e.Victim.SteamID64, e.Victim.Name).Deaths++

			if e.Killer != nil {
				recentDeaths = append(recentDeaths, DeathLog{
					Time:       p.CurrentTime(),
					KillerID:   e.Killer.SteamID64,
					VictimID:   e.Victim.SteamID64,
					VictimTeam: e.Victim.Team,
				})
			}
		} else {
			vName = "Unknown"
		}

		if e.Assister != nil {
			astStat := getPlayer(roundStats, e.Assister.SteamID64, e.Assister.Name)
			astStat.Assists++
			if e.AssistedFlash {
				astStat.FlashAssists++
			}
		}

		// Clutch Logic Update
		ctAlive, tAlive := 0, 0
		var lastCT, lastT *common.Player
		for _, pl := range p.GameState().Participants().Playing() {
			if pl.IsAlive() {
				if pl.Team == common.TeamCounterTerrorists {
					ctAlive++
					lastCT = pl
				}
				if pl.Team == common.TeamTerrorists {
					tAlive++
					lastT = pl
				}
			}
		}
		if ctAlive == 1 && tAlive > 0 {
			if potentialClutchPlayer != lastCT {
				potentialClutchPlayer = lastCT
				potentialClutchEnemies = tAlive
			}
		} else if tAlive == 1 && ctAlive > 0 {
			if potentialClutchPlayer != lastT {
				potentialClutchPlayer = lastT
				potentialClutchEnemies = ctAlive
			}
		} else {
			if e.Victim != nil && potentialClutchPlayer != nil && e.Victim.SteamID64 == potentialClutchPlayer.SteamID64 {
				potentialClutchPlayer = nil
				potentialClutchEnemies = 0
			}
		}

		// 🔥 ЗАПОЛНЕНИЕ НОВЫХ ПОЛЕЙ
		isBlind := false
		if e.Killer != nil {
			isBlind = e.Killer.IsBlinded()
		}

		currentRoundKills = append(currentRoundKills, KillEvent{
			Time:   formatRoundTime(p.CurrentTime(), roundStartTime),
			Killer: kName, KillerTeam: kTeam,
			Victim: vName, VictimTeam: vTeam,
			Weapon: weapon, HS: e.IsHeadshot,
			IsTrade: isTrade,

			// Новые данные
			IsWallbang:     e.PenetratedObjects > 0,
			IsThroughSmoke: e.ThroughSmoke,
			IsNoScope:      e.NoScope,
			IsBlind:        isBlind,

			// Координаты
			KillerX: kX, KillerY: kY, KillerZ: kZ,
			VictimX: vX, VictimY: vY, VictimZ: vZ,
		})
	})

	// --- OTHER HANDLERS ---
	p.RegisterEventHandler(func(e events.PlayerHurt) {
		if !p.GameState().IsMatchStarted() || e.Attacker == nil {
			return
		}
		s := getPlayer(roundStats, e.Attacker.SteamID64, e.Attacker.Name)
		if e.HealthDamage > 0 {
			s.TotalDamage += e.HealthDamage
			if e.Weapon != nil && (e.Weapon.Type == common.EqHE || e.Weapon.Type == common.EqMolotov || e.Weapon.Type == common.EqIncendiary) {
				s.UtilDmg += e.HealthDamage
			}
		}
		// Хитгруппы
		switch e.HitGroup {
		case events.HitGroupHead:
			s.HitsHead++
		case events.HitGroupChest:
			s.HitsChest++
		case events.HitGroupStomach:
			s.HitsStomach++
		case events.HitGroupLeftArm, events.HitGroupRightArm:
			s.HitsArms++
		case events.HitGroupLeftLeg, events.HitGroupRightLeg:
			s.HitsLegs++
		}
	})

	p.RegisterEventHandler(func(e events.PlayerFlashed) {
		if !p.GameState().IsMatchStarted() {
			return
		}
		if e.Player != nil && e.Attacker != nil {
			// Врага ослепило
			if e.Player.Team != e.Attacker.Team {
				if e.FlashDuration().Seconds() > 0.5 {
					pStat := getPlayer(roundStats, e.Attacker.SteamID64, e.Attacker.Name)
					pStat.EnemiesFlashedTime += e.FlashDuration().Seconds()
					pStat.EnemiesFlashedCount++
				}
			} else {
				// Старая логика (BlindTime) - совместимость
				if e.FlashDuration().Seconds() > 0.5 {
					getPlayer(roundStats, e.Attacker.SteamID64, e.Attacker.Name).BlindTime += e.FlashDuration().Seconds()
				}
			}
		}
	})

	// 🔥 GRENADE EVENTS
	p.RegisterEventHandler(func(e events.FlashExplode) {
		if !p.GameState().IsMatchStarted() {
			return
		}
		t := "Unknown"
		team := "NONE"
		if e.Thrower != nil {
			t = e.Thrower.Name
			team = formatTeam(e.Thrower.Team)
			// Add to stats
			getPlayer(roundStats, e.Thrower.SteamID64, e.Thrower.Name).FlashesThrown++ // Need to add FlashesThrown to PlayerStat? It's defined in types
		}
		currentRoundGrenades = append(currentRoundGrenades, GrenadeEvent{
			Thrower: t, ThrowerTeam: team, Type: "flash",
			X: e.Position.X, Y: e.Position.Y, Z: e.Position.Z,
			Time: formatRoundTime(p.CurrentTime(), roundStartTime),
		})
	})
	p.RegisterEventHandler(func(e events.HeExplode) {
		if !p.GameState().IsMatchStarted() {
			return
		}
		t := "Unknown"
		team := "NONE"
		if e.Thrower != nil {
			t = e.Thrower.Name
			team = formatTeam(e.Thrower.Team)
		}
		currentRoundGrenades = append(currentRoundGrenades, GrenadeEvent{
			Thrower: t, ThrowerTeam: team, Type: "he",
			X: e.Position.X, Y: e.Position.Y, Z: e.Position.Z,
			Time: formatRoundTime(p.CurrentTime(), roundStartTime),
		})
	})
	p.RegisterEventHandler(func(e events.SmokeStart) {
		if !p.GameState().IsMatchStarted() {
			return
		}
		t := "Unknown"
		team := "NONE"
		if e.Thrower != nil {
			t = e.Thrower.Name
			team = formatTeam(e.Thrower.Team)
		}
		currentRoundGrenades = append(currentRoundGrenades, GrenadeEvent{
			Thrower: t, ThrowerTeam: team, Type: "smoke",
			X: e.Position.X, Y: e.Position.Y, Z: e.Position.Z,
			Time: formatRoundTime(p.CurrentTime(), roundStartTime),
		})
	})
	p.RegisterEventHandler(func(e events.GrenadeProjectileDestroy) {
		if !p.GameState().IsMatchStarted() {
			return
		}
		if e.Projectile.WeaponInstance != nil && (e.Projectile.WeaponInstance.Type == common.EqMolotov || e.Projectile.WeaponInstance.Type == common.EqIncendiary) {
			t := "Unknown"
			team := "NONE"
			if e.Projectile.Thrower != nil {
				t = e.Projectile.Thrower.Name
				team = formatTeam(e.Projectile.Thrower.Team)
			}
			pos := e.Projectile.Position()
			currentRoundGrenades = append(currentRoundGrenades, GrenadeEvent{
				Thrower: t, ThrowerTeam: team, Type: "fire",
				X: pos.X, Y: pos.Y, Z: pos.Z,
				Time: formatRoundTime(p.CurrentTime(), roundStartTime),
			})
		}
	})

	// 🔥 BOMB EVENTS
	p.RegisterEventHandler(func(e events.BombPlanted) {
		if !p.GameState().IsMatchStarted() {
			return
		}

		pName := "Unknown"
		pTeam := "T"
		var pX, pY, pZ float64

		if e.Player != nil {
			pName = e.Player.Name
			pTeam = formatTeam(e.Player.Team)
			pos := e.Player.Position()
			pX, pY, pZ = pos.X, pos.Y, pos.Z

			// Стата игрока
			getPlayer(roundStats, e.Player.SteamID64, e.Player.Name).Plants++
		}

		currentRoundKills = append(currentRoundKills, KillEvent{
			Time:   formatRoundTime(p.CurrentTime(), roundStartTime),
			Killer: pName, KillerTeam: pTeam, Weapon: "c4_planted", IsBomb: true,
			KillerX: pX, KillerY: pY, KillerZ: pZ, // Координаты планта
		})
	})

	p.RegisterEventHandler(func(e events.BombDefused) {
		if !p.GameState().IsMatchStarted() {
			return
		}
		if e.Player != nil {
			getPlayer(roundStats, e.Player.SteamID64, e.Player.Name).Defuses++
			// Можно добавить ивент дефьюза в фид, если хочется, но не обязательно
		}
	})

	// 🔥 GRENADE HANDLERS
	p.RegisterEventHandler(func(e events.GrenadeProjectileDestroy) {
		if !p.GameState().IsMatchStarted() || e.Projectile.Thrower == nil {
			return
		}

		proj := e.Projectile
		grenadeType := "unknown"
		switch proj.WeaponInstance.Type {
		case common.EqHE:
			grenadeType = "he"
		case common.EqFlash:
			grenadeType = "flash"
		case common.EqSmoke:
			grenadeType = "smoke"
		case common.EqMolotov, common.EqIncendiary:
			grenadeType = "fire"
		case common.EqDecoy:
			grenadeType = "decoy"
		}

		// Save coordinate
		pos := proj.Position()
		currentRoundGrenades = append(currentRoundGrenades, GrenadeEvent{
			Thrower:     proj.Thrower.Name,
			ThrowerTeam: formatTeam(proj.Thrower.Team),
			Type:        grenadeType,
			X:           pos.X,
			Y:           pos.Y,
			Z:           pos.Z,
			Time:        formatRoundTime(p.CurrentTime(), roundStartTime),
		})
	})

	// --- PROGRESS ---
	ticker := time.NewTicker(1 * time.Second)
	done := make(chan bool)
	go func() {
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				prog := p.Progress()
				fmt.Printf("\r⏳ Обработка демо: %.0f%%", prog*100)
			}
		}
	}()

	err = p.ParseToEnd()
	ticker.Stop()
	done <- true
	fmt.Println("\n✅ Обработка завершена.")

	finalPlayers := []PlayerStat{}
	for _, s := range globalStats {
		if s.RoundsPlayed == 0 {
			s.RoundsPlayed = 1
		}
		rounds := float64(s.RoundsPlayed)

		s.ADR = float64(s.TotalDamage) / rounds
		s.UtilDmgPerRound = float64(s.UtilDmg) / rounds
		kpr := float64(s.Kills) / rounds
		dpr := float64(s.Deaths) / rounds
		apr := float64(s.Assists) / rounds

		if s.Deaths > 0 {
			s.KD = float64(s.Kills) / float64(s.Deaths)
		} else {
			s.KD = float64(s.Kills)
		}
		if s.Kills > 0 {
			s.HSPercent = int((float64(s.HS) / float64(s.Kills)) * 100)
		}

		s.KAST = (float64(s.KASTRounds) / rounds) * 100
		s.Impact = (2.13 * kpr) + (0.42 * apr) - 0.41

		s.Rating2 = (0.0073 * s.KAST) + (0.3591 * kpr) - (0.5329 * dpr) + (0.2372 * s.Impact) + (0.0032 * s.ADR) + 0.1587
		impact3 := (2.2 * kpr) + (0.45 * apr) - 0.40
		s.Rating3 = (0.0068 * s.KAST) + (0.38 * kpr) - (0.56 * dpr) + (0.24 * impact3) + (0.0035 * s.ADR) + 0.14

		s.Rating2 = math.Round(s.Rating2*100) / 100
		s.Rating3 = math.Round(s.Rating3*100) / 100
		s.Impact = math.Round(s.Impact*100) / 100
		s.ADR = math.Round(s.ADR*10) / 10

		// Parser 3.0: derive KPR, DPR, opening success %
		s.KPR = math.Round(kpr*1000) / 1000
		s.DPR = math.Round(dpr*1000) / 1000
		totalOpening := s.FK + s.FD
		if totalOpening > 0 {
			s.OpeningPct = math.Round(float64(s.FK)/float64(totalOpening)*1000) / 10 // 1 decimal
		}
		s.OpeningKills = s.FK
		s.OpeningDeaths = s.FD

		bestW, bestWKills := "", -1
		for _, w := range s.WeaponMap {
			if w.Kills > 0 {
				w.HSPercent = int((float64(w.HS) / float64(w.Kills)) * 100)
			}
			if w.Kills > bestWKills {
				bestWKills = w.Kills
				bestW = w.Name
			}
			s.Weapons = append(s.Weapons, *w)
		}
		s.FavWeapon = bestW
		for _, d := range s.DuelMap {
			s.Duels = append(s.Duels, *d)
		}

		// --- SIDE STATS CALCULATION ---
		calcSideRating := func(ss *SideStat) {
			if ss.Rounds == 0 {
				return
			}
			rnd := float64(ss.Rounds)
			ss.ADR = float64(ss.Damage) / rnd
			kpr := float64(ss.Kills) / rnd
			dpr := float64(ss.Deaths) / rnd
			apr := float64(ss.Assists) / rnd

			kastVal := 70.0
			impact3 := (2.2 * kpr) + (0.45 * apr) - 0.40
			ss.Rating3 = (0.0068 * kastVal) + (0.38 * kpr) - (0.56 * dpr) + (0.24 * impact3) + (0.0035 * ss.ADR) + 0.14

			ss.Rating = math.Round(ss.Rating*100) / 100
			ss.Rating3 = math.Round(ss.Rating3*100) / 100
			ss.ADR = math.Round(ss.ADR*10) / 10
			ss.Impact = math.Round(ss.Impact*100) / 100
		}

		calcSideRating(&s.StatsT)
		calcSideRating(&s.StatsCT)

		finalPlayers = append(finalPlayers, *s)
	}

	return DemoResponse{
		ID: matchID, Map: prettyMap, RoundsCount: len(roundsHistory),
		RoundsHistory: roundsHistory, FinalScoreCT: p.GameState().Team(common.TeamCounterTerrorists).Score(),
		FinalScoreT: p.GameState().Team(common.TeamTerrorists).Score(), Players: finalPlayers,
		Filename: originalFilename, UploadDate: realDate,

		Meta: MatchMeta{
			Version:    CurrentParserVersion,
			IsDetailed: true,
			Parser:     CurrentParserName,
		},
	}, err
}

// --- AUTH HANDLERS ---

func handleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", 400)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password required", 400)
		return
	}

	// Validate email
	if _, err := mail.ParseAddress(req.Email); err != nil {
		http.Error(w, "Invalid email format", 400)
		return
	}

	ctx := context.Background()

	// Check if user exists
	iter := firestoreClient.Collection("users").Where("email", "==", req.Email).Limit(1).Documents(ctx)
	doc, err := iter.Next()
	if err == nil && doc != nil {
		http.Error(w, "User already exists", 400)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal error", 500)
		return
	}

	user := User{
		ID:           fmt.Sprintf("u_%d", time.Now().UnixNano()),
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  req.DisplayName,
		SteamID:      req.SteamID,
		Role:         "user", // Default role
		CreatedAt:    time.Now(),
	}

	// First user is automatically admin (simple bootstrap)
	countIter := firestoreClient.Collection("users").Limit(1).Documents(ctx)
	_, err = countIter.Next()
	if err != nil { // No users yet
		user.Role = "admin"
	}

	_, err = firestoreClient.Collection("users").Doc(user.ID).Set(ctx, user)
	if err != nil {
		http.Error(w, "Failed to save user", 500)
		return
	}

	token, _ := generateToken(user)
	json.NewEncoder(w).Encode(AuthResponse{Token: token, User: user})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", 400)
		return
	}

	ctx := context.Background()
	iter := firestoreClient.Collection("users").Where("email", "==", req.Email).Limit(1).Documents(ctx)
	doc, err := iter.Next()
	if err != nil {
		http.Error(w, "Invalid credentials", 401)
		return
	}

	var user User
	doc.DataTo(&user)

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid credentials", 401)
		return
	}

	token, _ := generateToken(user)
	json.NewEncoder(w).Encode(AuthResponse{Token: token, User: user})
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	ctx := context.Background()
	doc, err := firestoreClient.Collection("users").Doc(userID).Get(ctx)
	if err != nil {
		http.Error(w, "User not found", 401)
		return
	}

	var user User
	doc.DataTo(&user)
	json.NewEncoder(w).Encode(user)
}

func handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PATCH" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	userID := r.Context().Value("user_id").(string)
	var updateData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "Invalid request", 400)
		return
	}

	// Allowed fields to update
	allowedFields := map[string]bool{
		"display_name":         true,
		"steamid":              true,
		"avatar":               true,
		"background_url":       true,
		"dashboard_background": true,
		"bio":                  true,
		"social_vk":            true,
		"social_tg":            true,
		"social_twitch":        true,
	}

	updates := []firestore.Update{}
	for k, v := range updateData {
		if allowedFields[k] {
			updates = append(updates, firestore.Update{Path: k, Value: v})
		}
	}

	if len(updates) == 0 {
		http.Error(w, "No valid fields to update", 400)
		return
	}

	ctx := context.Background()
	_, err := firestoreClient.Collection("users").Doc(userID).Update(ctx, updates)
	if err != nil {
		http.Error(w, "Failed to update profile", 500)
		return
	}

	// Return updated user
	doc, _ := firestoreClient.Collection("users").Doc(userID).Get(ctx)
	var user User
	doc.DataTo(&user)
	json.NewEncoder(w).Encode(user)
}

// --- AUTH MIDDLEWARE ---

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header missing", 401)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			return []byte(JwtSecret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", 401)
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		ctx := context.WithValue(r.Context(), "user_id", claims["sub"])
		ctx = context.WithValue(ctx, "role", claims["role"])

		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// --- HELPERS ---

func generateToken(user User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"exp":  time.Now().Add(time.Hour * 24 * 7).Unix(),
	})
	return token.SignedString([]byte(JwtSecret))
}

// --- OLLAMA AI REVIEW ---
type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type OllamaResponse struct {
	Response string `json:"response"`
}

func handleGenerateReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var reqBody struct {
		Prompt string `json:"prompt"`
		Model  string `json:"model"` // Optional model override
	}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		fmt.Println("❌ Error decoding AI request:", err)
		http.Error(w, "Invalid request", 400)
		return
	}

	// System Prompt for CS2 Analysis
	systemPrompt := `Ты — профессиональный аналитик CS2 матчей уровня BLAST Premier и ESL Pro League. Тебе дадут детальную статистику матча. Пиши разбор ТОЛЬКО на русском языке, связным текстом абзацами, без списков со звёздочками.

В данных будет: счёт, сторона [CT]/[T], K/D/A, ADR, RTG, KAST, FK/FD (открывающие дуэли), мультикиллы, клатчи, и оружие с числом убийств из него.

Твой анализ должен обязательно включать:
1) Ход матча — одна команда выигрывала пистольные раунды? Кто контролировал экономику? Почему итоговый счёт такой.
2) Ключевой игрок — расскажи про его оружие (AWP-агрессия? АК-дуэли на открытиях?), вклад через FK, мультикиллы или клатчи, конкретные цифры.
3) Провальный игрок — плохой KAST, высокий FD, слабый ADR, это говорит о чём? Какие роли он не выполнял?
4) Тактический вердикт — одно предложение итог.

Пиши как комментатор на Major — уверенно, технично, с конкретными отсылками к цифрам из данных.`

	fullPrompt := systemPrompt + "\n\nСтатистика матча:\n" + reqBody.Prompt

	model := "llama3" // Default model mapping, assuming llama3 is installed
	if reqBody.Model != "" {
		model = reqBody.Model
	}

	ollamaReq := OllamaRequest{
		Model:  model,
		Prompt: fullPrompt,
		Stream: false,
	}

	reqBytes, _ := json.Marshal(ollamaReq)

	fmt.Println("🤖 Sending request to Ollama...")

	resp, err := http.Post("http://127.0.0.1:11434/api/generate", "application/json", bytes.NewBuffer(reqBytes))
	if err != nil {
		fmt.Println("❌ Ollama connection error:", err)
		http.Error(w, "Ollama connection error: Is it running? "+err.Error(), 500)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Println("❌ Ollama returned non-200 status:", resp.StatusCode)
		http.Error(w, "Ollama API Error", 500)
		return
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		fmt.Println("❌ Failed to decode Ollama response:", err)
		http.Error(w, "Failed to decode Ollama response", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"review": ollamaResp.Response,
	})
}

func handleGetUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/user/")
	if id == "" {
		http.Error(w, "ID required", 400)
		return
	}

	ctx := context.Background()

	// 1. Try by Doc ID
	doc, err := firestoreClient.Collection("users").Doc(id).Get(ctx)
	if err == nil {
		var u User
		doc.DataTo(&u)
		json.NewEncoder(w).Encode(toPublic(u))
		return
	}

	// 2. Try by SteamID search
	iter := firestoreClient.Collection("users").Where("steamid", "==", id).Limit(1).Documents(ctx)
	doc, err = iter.Next()
	if err == nil {
		var u User
		doc.DataTo(&u)
		json.NewEncoder(w).Encode(toPublic(u))
		return
	}

	// 3. Try by DisplayName search (normalized)
	iter = firestoreClient.Collection("users").Where("display_name", "==", id).Limit(1).Documents(ctx)
	doc, err = iter.Next()
	if err == nil {
		var u User
		doc.DataTo(&u)
		json.NewEncoder(w).Encode(toPublic(u))
		return
	}

	http.Error(w, "User not found", 404)
}

func toPublic(u User) PublicUser {
	return PublicUser{
		ID:                  u.ID,
		DisplayName:         u.DisplayName,
		SteamID:             u.SteamID,
		Avatar:              u.Avatar,
		BackgroundURL:       u.BackgroundURL,
		DashboardBackground: u.DashboardBackground,
		Bio:                 u.Bio,
		SocialVK:            u.SocialVK,
		SocialTG:            u.SocialTG,
		SocialTwitch:        u.SocialTwitch,
		Role:                u.Role,
	}
}
