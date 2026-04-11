import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Crown, Diamond, Layers, Flag, Users2, Star, Hash, Ban, Loader2, Trophy, ArrowRight } from "lucide-react"

// ── Constants ────────────────────────────────────────────────────────────────
const SUIT_SYMBOL: Record<string, string> = { H: "♥", D: "♦", C: "♣", S: "♠" }
const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]
const TRICK_RANKS = ["7", "8", "9", "J", "Q", "K", "10", "A"]
const SUITS = ["H", "D", "C", "S"]

const GAMES = [
  { id: "king",        name: "Roi de cœur",   icon: Crown,  color: "text-red-400",    bg: "bg-red-500/20",    border: "border-red-500/40" },
  { id: "diamonds",    name: "Carreaux",       icon: Diamond, color: "text-blue-400",  bg: "bg-blue-500/20",   border: "border-blue-500/40" },
  { id: "tricks",      name: "Plis",           icon: Layers, color: "text-amber-400",  bg: "bg-amber-500/20",  border: "border-amber-500/40" },
  { id: "last-trick",  name: "Dernier Pli",    icon: Flag,   color: "text-emerald-400",bg: "bg-emerald-500/20",border: "border-emerald-500/40" },
  { id: "queens",      name: "Dames",          icon: Users2, color: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/40" },
  { id: "queen-spades",name: "Dame de Pique",  icon: Hash,   color: "text-slate-300",  bg: "bg-slate-500/20",  border: "border-slate-500/40" },
  { id: "general",     name: "Général",        icon: Star,   color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/40" },
  { id: "trix",        name: "Trix",           icon: Crown,  color: "text-pink-400",   bg: "bg-pink-500/20",   border: "border-pink-500/40" },
]

// ── Card helpers ─────────────────────────────────────────────────────────────
const getSuit = (c: string) => c[c.length - 1] as "H" | "D" | "C" | "S"
const getRank = (c: string) => c.slice(0, -1)
const rankIdx  = (c: string) => RANKS.indexOf(getRank(c))
const trickRankIdx = (c: string) => TRICK_RANKS.indexOf(getRank(c))

function penaltyLeadCards(game: string): string[] {
  const hearts = RANKS.map(r => r + "H")
  const diamonds = RANKS.map(r => r + "D")
  const queens = ["QH", "QD", "QC", "QS"]
  switch (game) {
    case "king": return ["KH"]
    case "queens": return queens
    case "diamonds": return diamonds
    case "queen-spades": return ["QS", ...hearts]
    case "general": return [...new Set(["KH", ...queens, ...diamonds, "QS", ...hearts])]
    default: return []
  }
}

function getPlayableCards(hand: string[], gs: any, mySeat: number): string[] {
  if (!gs || (gs.currentTurnSeat !== mySeat && gs.selectedGame !== "trix")) return []
  if (gs.selectedGame === "trix") {
    if (gs.trixCurrentPlayerSeat !== mySeat) return []
    return getValidTrixClient(hand, gs.trixPiles)
  }
  
  const trick = gs.currentTrick ?? []
  const isLeading = trick.length === 0
  
  let playable = hand;
  if (!isLeading) {
    const leadSuit = getSuit(trick[0].card)
    const suited = hand.filter(c => getSuit(c) === leadSuit)
    if (suited.length > 0) playable = suited;
  }

  let trulyValid = playable;
  if (gs.completedTricks === 0) {
    const valued = penaltyLeadCards(gs.selectedGame ?? "");
    const safeCards = playable.filter(c => !valued.includes(c));
    if (safeCards.length > 0) trulyValid = safeCards;
  } else if (isLeading && gs.completedTricks > 0) {
    const allPlayed = gs.tricksTaken?.flat() || [];
    const game = gs.selectedGame!;
    const brokenSuits: string[] = [];
    if ((game === "queen-spades" || game === "general") && allPlayed.some((c: string) => getSuit(c) === "H")) brokenSuits.push("H");
    if ((game === "diamonds" || game === "general") && allPlayed.some((c: string) => getSuit(c) === "D")) brokenSuits.push("D");

    const safeLeadCards = playable.filter(c => {
      if (game === "queen-spades" && getSuit(c) === "H" && !brokenSuits.includes("H")) return false;
      if (game === "diamonds" && getSuit(c) === "D" && !brokenSuits.includes("D")) return false;
      if (game === "general" && getSuit(c) === "H" && !brokenSuits.includes("H")) return false;
      if (game === "general" && getSuit(c) === "D" && !brokenSuits.includes("D")) return false;
      return true;
    });
    if (safeLeadCards.length > 0) trulyValid = safeLeadCards;
  }

  return trulyValid;
}

function getValidTrixClient(hand: string[], piles: Record<string, string[]>): string[] {
  const valid = new Set<string>()
  for (const suit of SUITS as ("H" | "D" | "C" | "S")[]) {
    const pile = piles[suit] ?? []
    if (pile.length === 0) {
      if (hand.includes("J" + suit)) valid.add("J" + suit)
    } else {
      const ranks = pile.map(c => rankIdx(c))
      const minR = Math.min(...ranks), maxR = Math.max(...ranks)
      if (minR > 0) { const d = RANKS[minR - 1] + suit; if (hand.includes(d)) valid.add(d) }
      if (maxR < 7) { const u = RANKS[maxR + 1] + suit; if (hand.includes(u)) valid.add(u) }
    }
  }
  return [...valid]
}

// ── Sub-components ───────────────────────────────────────────────────────────
function PlayingCard({ card, onClick, disabled, playable, small = false, grayOut = true }: {
  card: string; onClick?: () => void; disabled?: boolean; playable?: boolean; small?: boolean; grayOut?: boolean
}) {
  const suit = getSuit(card)
  const rank = getRank(card)
  const isRed = suit === "H" || suit === "D"
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        "rounded-lg bg-white border-2 flex flex-col items-center justify-center font-bold select-none transition-all duration-150",
        small ? "w-10 h-14 text-xs gap-0.5" : "w-14 h-20 text-sm gap-1",
        isRed ? "text-red-600" : "text-slate-900",
        playable && "border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 cursor-pointer hover:-translate-y-3",
        !playable && onClick && "border-slate-200 cursor-pointer hover:-translate-y-1",
        !playable && !onClick && "border-slate-200 cursor-default",
        disabled && "cursor-not-allowed !translate-y-0",
        disabled && grayOut && "opacity-30 grayscale",
      )}
    >
      <span>{rank}</span>
      <span className={small ? "text-base" : "text-xl"}>{SUIT_SYMBOL[suit]}</span>
    </button>
  )
}

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border-2 border-emerald-600 bg-gradient-to-br from-emerald-800 to-emerald-900 flex items-center justify-center",
      small ? "w-10 h-14" : "w-12 h-16"
    )}>
      <div className="w-6 h-8 rounded border border-emerald-600/50 flex items-center justify-center">
        <span className="text-yellow-400 text-xs font-black">T</span>
      </div>
    </div>
  )
}

function PlayerZone({ seat, cardCount = 0, isActive, isChooser, isDoubled, hasVeto, position }: {
  seat?: { name: string; score: number; seatIndex: number }
  cardCount?: number; isActive: boolean; isChooser: boolean; isDoubled: boolean; hasVeto: boolean; position: "top" | "left" | "right"
}) {
  if (!seat) return <div className={cn("flex items-center justify-center w-28 h-20 rounded-xl bg-white/5 border border-dashed border-white/10", position === "left" || position === "right" ? "flex-col" : "")}><span className="text-white/20 text-xs">Empty</span></div>

  const isHorizontal = position === "top"
  const isSide = position === "left" || position === "right"

  return (
    <div className={cn(
      "flex gap-2 p-2 rounded-xl border transition-all",
      isHorizontal ? "flex-row items-center" : "flex-col items-center",
      isActive ? "bg-yellow-400/20 border-yellow-400/60 shadow-lg shadow-yellow-400/20" : "bg-white/10 border-white/20",
      isSide && "w-24" // Optimize horizontal space for side players
    )}>
      <div className={cn(
        "flex",
        isHorizontal ? "-space-x-5 flex-row" : "-space-y-10 flex-col py-4"
      )}>
        {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
          <div key={i} className="relative transition-transform hover:scale-110">
            <CardBack small />
          </div>
        ))}
      </div>
      <div className={cn("text-center w-full", !isHorizontal && "mt-1")}>
        <p className="text-[10px] font-bold text-white truncate px-1">{seat.name}</p>
        <p className="text-sm font-black text-yellow-400">{seat.score}</p>
        <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
          {isChooser && <Badge className="bg-yellow-500 text-emerald-950 text-[8px] px-1 h-3">PICK</Badge>}
          {isDoubled && <Badge className="bg-orange-500 text-white text-[8px] px-1 h-3">2×</Badge>}
          {!hasVeto && <Badge className="bg-red-700 text-white text-[8px] px-1 h-3">ØV</Badge>}
          {isActive && <Badge className="bg-white text-emerald-950 text-[8px] px-1 h-3 animate-pulse">TURN</Badge>}
        </div>
      </div>
    </div>
  )
}

function TrickArea({ trick, mySeat }: { trick: { seatIndex: number; card: string }[]; mySeat: number }) {
  const positions = ["bottom", "right", "top", "left"] as const
  const seatAtPos = (pos: typeof positions[number]) => {
    const off = { bottom: 0, right: 1, top: 2, left: 3 }[pos]
    return (mySeat + off) % 4
  }
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-2 w-36 h-36">
      {/* top */}
      <div className="col-start-2 row-start-1 flex items-end justify-center">
        {trick.find(t => t.seatIndex === seatAtPos("top")) && (
          <PlayingCard card={trick.find(t => t.seatIndex === seatAtPos("top"))!.card} small />
        )}
      </div>
      {/* left */}
      <div className="col-start-1 row-start-2 flex items-center justify-end">
        {trick.find(t => t.seatIndex === seatAtPos("left")) && (
          <PlayingCard card={trick.find(t => t.seatIndex === seatAtPos("left"))!.card} small />
        )}
      </div>
      {/* center label */}
      <div className="col-start-2 row-start-2 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-white/30 text-xs">♠</span>
        </div>
      </div>
      {/* right */}
      <div className="col-start-3 row-start-2 flex items-center justify-start">
        {trick.find(t => t.seatIndex === seatAtPos("right")) && (
          <PlayingCard card={trick.find(t => t.seatIndex === seatAtPos("right"))!.card} small />
        )}
      </div>
      {/* bottom */}
      <div className="col-start-2 row-start-3 flex items-start justify-center">
        {trick.find(t => t.seatIndex === seatAtPos("bottom")) && (
          <PlayingCard card={trick.find(t => t.seatIndex === seatAtPos("bottom"))!.card} small />
        )}
      </div>
    </div>
  )
}

function TrixPiles({ piles }: { piles: Record<string, string[]> }) {
  return (
    <div className="flex gap-3">
      {(["H", "D", "C", "S"] as const).map(suit => {
        const pile = piles[suit] ?? []
        const isRed = suit === "H" || suit === "D"
        const started = pile.length > 0
        const ranks = pile.map(c => rankIdx(c))
        const minR = started ? Math.min(...ranks) : -1
        const maxR = started ? Math.max(...ranks) : -1
        return (
          <div key={suit} className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-xl border min-w-[52px]",
            started ? "bg-white/10 border-white/20" : "bg-black/20 border-dashed border-white/10"
          )}>
            <span className={cn("text-2xl", isRed ? "text-red-500" : "text-slate-300")}>{SUIT_SYMBOL[suit]}</span>
            {started ? (
              <div className="text-center">
                <p className="text-xs text-white font-bold">{RANKS[maxR]}</p>
                <p className="text-[10px] text-white/40">J</p>
                <p className="text-xs text-white font-bold">{RANKS[minR]}</p>
                <p className="text-[10px] text-yellow-400">{pile.length} cards</p>
              </div>
            ) : (
              <p className="text-[10px] text-white/30">Play J</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main GamePage ────────────────────────────────────────────────────────────
export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const mySeat = parseInt(localStorage.getItem("trix-lobby-seat") ?? "-1")

  const data    = useQuery(api.game.getGameState, code ? { code } : "skip")
  const myCards = useQuery(api.game.getMyHand, code && mySeat >= 0 ? { code, seatIndex: mySeat } : "skip")

  const playCardMut          = useMutation(api.game.playCard)
  const selectGameMut        = useMutation(api.game.selectGame)
  const useVetoMut           = useMutation(api.game.useVeto)
  const skipVetoMut          = useMutation(api.game.skipVeto)
  const confirmVetoWindowMut = useMutation(api.game.confirmVetoWindow)
  const nextRoundMut         = useMutation(api.game.nextRound)
  const passTrixTurnMut      = useMutation(api.game.passTrixTurn)

  const [vetoSecsLeft, setVetoSecsLeft] = useState(10)
  const [playingCard, setPlayingCard]   = useState<string | null>(null)

  const lobby = data?.lobby
  const gs    = data?.gameState

  const [turnTimerLeft, setTurnTimerLeft] = useState(30)

  useEffect(() => {
    if (gs?.phase !== "playing") return
    setTurnTimerLeft(30)
    const interval = setInterval(() => {
      setTurnTimerLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [gs?.turnSequenceId, gs?.phase])

  // Auto-pass Trix if no cards
  const isMyTurn = gs?.phase === "playing" && (gs?.selectedGame === "trix" ? gs?.trixCurrentPlayerSeat === mySeat : gs?.currentTurnSeat === mySeat)
  const playable = getPlayableCards(Array.isArray(myCards) ? myCards : [], gs, mySeat)
  
  useEffect(() => {
    if (isMyTurn && gs?.phase === "playing" && gs?.selectedGame === "trix" && myCards) {
      if (playable.length === 0) {
        passTrixTurnMut({ code: code!, seatIndex: mySeat }).catch(console.error)
      }
    }
  }, [isMyTurn, gs?.phase, gs?.selectedGame, myCards, playable.length, gs?.turnSequenceId])

  // Veto countdown
  useEffect(() => {
    if (gs?.phase !== "veto" || !gs.vetoWindowStart) return
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.ceil(10 - (Date.now() - gs.vetoWindowStart!) / 1000))
      setVetoSecsLeft(secs)
      if (secs <= 0) {
        clearInterval(interval)
        confirmVetoWindowMut({ code: code! }).catch(() => {})
      }
    }, 250)
    return () => clearInterval(interval)
  }, [gs?.phase, gs?.vetoWindowStart])

  const handlePlayCard = useCallback(async (card: string) => {
    if (!code || playingCard) return
    setPlayingCard(card)
    try { await playCardMut({ code, seatIndex: mySeat, card }) }
    catch (e: any) { toast.error(e.message) }
    finally { setPlayingCard(null) }
  }, [code, mySeat, playingCard])

  if (!data || !lobby || !gs) return (
    <div className="min-h-screen bg-[#064e3b] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mx-auto" />
        <p className="text-emerald-200">Loading game…</p>
      </div>
    </div>
  )

  // Seat helpers
  const seatAt = (offset: number) => (mySeat + offset) % 4
  const topSeat   = lobby.seats.find(s => s.seatIndex === seatAt(2))
  const rightSeat = lobby.seats.find(s => s.seatIndex === seatAt(1))
  const leftSeat  = lobby.seats.find(s => s.seatIndex === seatAt(3))
  const meSeat    = lobby.seats.find(s => s.seatIndex === mySeat)
  



  const amChooser = lobby.chooserSeatIndex === mySeat
  const myHasVeto = !lobby.vetoUsedBySeats.includes(mySeat)

  // ── GAME OVER ──────────────────────────────────────────────────────────────
  if (gs.phase === "game-over") {
    const sorted = [...lobby.seats].sort((a, b) => b.score - a.score)
    return (
      <div className="min-h-screen bg-[#064e3b] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-white text-center">
          <Trophy className="w-20 h-20 text-yellow-400 mx-auto" />
          <h1 className="text-4xl font-black italic">GAME OVER</h1>
          <Card className="bg-white/10 border-white/20">
            <CardHeader><CardTitle className="text-white">Final Standings</CardTitle></CardHeader>
            <CardContent className="p-0">
              {sorted.map((s, idx) => (
                <div key={s.seatIndex} className={cn("flex items-center justify-between px-4 py-3 border-b border-white/10", idx === 0 && "bg-yellow-500/10")}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                    <span className="font-bold">{s.name}{s.seatIndex === mySeat && " (you)"}</span>
                  </div>
                  <span className="font-black text-yellow-400 text-xl">{s.score}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button onClick={() => navigate("/lobby")} className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold text-lg">
            Back to Lobby
          </Button>
        </div>
      </div>
    )
  }

  // ── TABLE LAYOUT ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#14532d] overflow-hidden flex flex-col">
      {/* Header: scores strip */}
      <div className="bg-[#064e3b]/90 border-b border-white/10 px-3 py-2 flex justify-between items-center shrink-0">
        {lobby.seats.map(s => (
          <div key={s.seatIndex} className={cn("text-center px-2 rounded-lg transition-all", s.seatIndex === mySeat && "bg-white/10")}>
            <p className="text-[10px] text-emerald-300/70 truncate max-w-[60px]">{s.name}{s.seatIndex === mySeat ? " ★" : ""}</p>
            <p className="text-sm font-black text-yellow-400">{s.score}</p>
            {gs.doublingSeats.includes(s.seatIndex) && gs.phase === "playing" && (
              <Badge className="bg-orange-500 text-white text-[8px] px-0.5 h-3">2×</Badge>
            )}
          </div>
        ))}
        <div className="text-right flex flex-col items-end justify-center shrink-0 min-w-[90px]">
          <p className="text-sm font-black text-yellow-400 whitespace-nowrap">
            {gs.selectedGame ? GAMES.find(g => g.id === gs.selectedGame)?.name : "Selecting..."}
          </p>
          <p className="text-[10px] text-emerald-300/70">Round {lobby.currentRound + 1}/32</p>
        </div>
      </div>

      {/* Table body */}
      <div className="flex-1 relative overflow-hidden">
        {/* Felt texture */}
        <div className="absolute inset-4 rounded-[2rem] bg-[#166534]/60 border-2 border-emerald-800/50 shadow-inner" />

        {/* TOP player */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <PlayerZone
            seat={topSeat} cardCount={Math.max(0, 8 - (topSeat?.chosenGames.length ?? 0))}
            position="top"
            isActive={gs.phase === "playing" && (gs.selectedGame === "trix" ? gs.trixCurrentPlayerSeat === seatAt(2) : gs.currentTurnSeat === seatAt(2))}
            isChooser={lobby.chooserSeatIndex === seatAt(2)}
            isDoubled={gs.doublingSeats.includes(seatAt(2))}
            hasVeto={!lobby.vetoUsedBySeats.includes(seatAt(2))}
          />
        </div>

        {/* LEFT player */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <PlayerZone
            seat={leftSeat} cardCount={Math.max(0, 8 - (leftSeat?.chosenGames.length ?? 0))}
            position="left"
            isActive={gs.phase === "playing" && (gs.selectedGame === "trix" ? gs.trixCurrentPlayerSeat === seatAt(3) : gs.currentTurnSeat === seatAt(3))}
            isChooser={lobby.chooserSeatIndex === seatAt(3)}
            isDoubled={gs.doublingSeats.includes(seatAt(3))}
            hasVeto={!lobby.vetoUsedBySeats.includes(seatAt(3))}
          />
        </div>

        {/* RIGHT player */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
          <PlayerZone
            seat={rightSeat} cardCount={Math.max(0, 8 - (rightSeat?.chosenGames.length ?? 0))}
            position="right"
            isActive={gs.phase === "playing" && (gs.selectedGame === "trix" ? gs.trixCurrentPlayerSeat === seatAt(1) : gs.currentTurnSeat === seatAt(1))}
            isChooser={lobby.chooserSeatIndex === seatAt(1)}
            isDoubled={gs.doublingSeats.includes(seatAt(1))}
            hasVeto={!lobby.vetoUsedBySeats.includes(seatAt(1))}
          />
        </div>

        {/* CENTER: trick area or Trix piles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          {gs.phase === "playing" && gs.selectedGame !== "trix" && (
            <TrickArea trick={gs.currentTrick} mySeat={mySeat} />
          )}
          {gs.phase === "playing" && gs.selectedGame === "trix" && (
            <TrixPiles piles={gs.trixPiles} />
          )}
          {gs.selectedGame && gs.phase !== "playing" && (
            <div className="text-center">
              {(() => {
                const g = GAMES.find(x => x.id === gs.selectedGame)
                const Icon = g?.icon ?? Star
                return (
                  <div className={cn("p-4 rounded-full", g?.bg)}>
                    <Icon className={cn("w-10 h-10", g?.color)} />
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* My turn indicator */}
        {isMyTurn && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
            <Badge className="bg-yellow-500 text-emerald-950 font-black text-sm px-3 py-1 flex items-center gap-2 animate-bounce">YOUR TURN <span className="bg-emerald-900 text-yellow-400 rounded-sm px-1.5 py-0.5 text-xs font-mono">00:{turnTimerLeft.toString().padStart(2, "0")}</span></Badge>
          </div>
        )}

        {/* ── OVERLAYS ─────────────────────────────────────────────────────────── */}

        {/* SELECTION overlay */}
        {gs.phase === "selection" && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <Card className="bg-[#064e3b] border-white/20 w-full max-w-md max-h-full overflow-y-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-center">
                  {amChooser ? "🎴 Choose Your Game" : `Waiting for ${lobby.seats[lobby.chooserSeatIndex]?.name} to choose…`}
                </CardTitle>
              </CardHeader>
              {amChooser && (
                <CardContent className="space-y-2">
                  {GAMES.map(g => {
                    const alreadyPlayed = lobby.seats[mySeat]?.chosenGames.includes(g.id)
                    const isVetoed = gs.vetoedGameId === g.id
                    const Icon = g.icon
                    return (
                      <Button key={g.id} disabled={alreadyPlayed || isVetoed}
                        onClick={() => selectGameMut({ code: code!, seatIndex: mySeat, gameId: g.id }).catch((e: any) => toast.error(e.message))}
                        variant="outline"
                        className={cn("w-full h-14 justify-start gap-3 border-2 transition-all",
                          (alreadyPlayed || isVetoed) ? "opacity-40 grayscale" : cn("bg-white/5 hover:bg-white/15", g.border, "text-white")
                        )}
                      >
                        <Icon className={cn("w-6 h-6", g.color)} />
                        <span className="font-bold">{g.name}</span>
                        {alreadyPlayed && <span className="ml-auto text-xs text-white/40">Played</span>}
                        {isVetoed && <span className="ml-auto text-xs text-red-400 font-bold uppercase tracking-wider">Vetoed</span>}
                      </Button>
                    )
                  })}
                </CardContent>
              )}
              {!amChooser && (
                <CardContent className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* VETO overlay */}
        {gs.phase === "veto" && gs.selectedGame && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <Card className="bg-[#064e3b] border-white/20 w-full max-w-sm max-h-full overflow-y-auto">
              <div className="bg-yellow-500 text-emerald-950 text-center font-black text-lg py-3 px-4 rounded-t-lg">
                VETO WINDOW — {vetoSecsLeft}s
              </div>
              <CardContent className="p-6 space-y-5">
                <div className="text-center">
                  {(() => {
                    const g = GAMES.find(x => x.id === gs.selectedGame)
                    const Icon = g?.icon ?? Star
                    return (
                      <div className="flex flex-col items-center gap-2">
                        <div className={cn("p-4 rounded-full", g?.bg)}>
                          <Icon className={cn("w-12 h-12", g?.color)} />
                        </div>
                        <h3 className="text-xl font-black text-white">{g?.name}</h3>
                        <p className="text-sm text-emerald-200/60">
                          Selected by <span className="text-yellow-400">{lobby.seats[lobby.chooserSeatIndex]?.name}</span>
                        </p>
                      </div>
                    )
                  })()}
                </div>

                {/* Timer bar */}
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full transition-all duration-250"
                    style={{ width: `${(vetoSecsLeft / 10) * 100}%` }} />
                </div>

                {/* Veto button (not for chooser, not if already used) */}
                {mySeat !== lobby.chooserSeatIndex && myHasVeto && !gs.vetoSkippedBySeats?.includes(mySeat) && (
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => useVetoMut({ code: code!, seatIndex: mySeat }).catch((e: any) => toast.error(e.message))}
                      className="w-full h-14 bg-red-600 hover:bg-red-500 text-white font-black text-lg"
                    >
                      <Ban className="mr-2 w-5 h-5" /> USE MY VETO
                    </Button>
                    <Button
                      onClick={() => skipVetoMut({ code: code!, seatIndex: mySeat }).catch((e: any) => toast.error(e.message))}
                      variant="outline"
                      className="w-full h-12 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                    >
                      Skip Veto
                    </Button>
                  </div>
                )}
                {mySeat !== lobby.chooserSeatIndex && !myHasVeto && (
                  <p className="text-center text-white/40 text-sm italic">You've used your veto</p>
                )}
                {mySeat !== lobby.chooserSeatIndex && myHasVeto && gs.vetoSkippedBySeats?.includes(mySeat) && (
                  <p className="text-center text-white/60 text-sm">Waiting for others to decide…</p>
                )}
                {mySeat === lobby.chooserSeatIndex && (
                  <p className="text-center text-white/60 text-sm">Waiting for others to decide…</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ROUND OVER overlay */}
        {gs.phase === "round-over" && gs.roundScoreSummary && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <Card className="bg-[#064e3b] border-white/20 w-full max-w-sm max-h-full overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-white text-center">
                  {(() => {
                    const g = GAMES.find(x => x.id === gs.selectedGame)
                    return `${g?.name ?? "Round"} — Scores`
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gs.roundScoreSummary.map((s: any) => (
                  <div key={s.name} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    s.name === meSeat?.name ? "bg-yellow-500/10 border-yellow-400/40" : "bg-white/5 border-white/10"
                  )}>
                    <div>
                      <p className="font-bold text-white">{s.name}</p>
                      {s.isDoubled && <Badge className="bg-orange-500 text-white text-[9px] h-3 px-1">2× doubled</Badge>}
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-black", s.roundScore > 0 ? "text-red-400" : s.roundScore < 0 ? "text-emerald-400" : "text-white/40")}>
                        {s.roundScore > 0 ? `+${s.roundScore}` : s.roundScore}
                      </p>
                      <p className="text-sm text-yellow-400 font-bold">{s.totalScore} total</p>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={() => nextRoundMut({ code: code! }).catch((e: any) => toast.error(e.message))}
                  className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold mt-2"
                >
                  Next Round <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* MY HAND at bottom */}
      <div className="bg-[#064e3b]/90 border-t border-white/10 p-3 shrink-0">
        <div className="flex items-center gap-2 justify-center mb-1">
          <span className="text-xs text-emerald-300/70 font-medium">{meSeat?.name} (you)</span>
          {gs.doublingSeats.includes(mySeat) && gs.phase === "playing" && (
            <Badge className="bg-orange-500 text-white text-[10px] px-1">2× doubled</Badge>
          )}
          {amChooser && gs.phase === "selection" && (
            <Badge className="bg-yellow-500 text-emerald-950 text-[10px] px-1 font-bold">YOUR PICK</Badge>
          )}
        </div>
        {myCards && myCards.length > 0 && (
          <div className="flex gap-1 justify-center flex-wrap max-h-24 overflow-y-auto">
            {[...myCards].sort((a, b) => {
              const suitOrder = { H: 0, D: 1, C: 2, S: 3 }
              const sd = suitOrder[getSuit(a)] - suitOrder[getSuit(b)]
              if (sd !== 0) return sd
              const ri = gs.selectedGame === "trix" ? rankIdx : trickRankIdx
              return ri(a) - ri(b)
            }).map(card => (
              <PlayingCard
                key={card}
                card={card}
                onClick={isMyTurn && playable.includes(card) ? () => handlePlayCard(card) : undefined}
                playable={isMyTurn && playable.includes(card)}
                disabled={!isMyTurn || !playable.includes(card) || playingCard !== null}
                grayOut={gs.phase === "playing"}
              />
            ))}
          </div>
        )}
        {myCards?.length === 0 && gs.phase === "playing" && gs.selectedGame === "trix" && (
          <p className="text-center text-emerald-300 font-bold py-2">You've finished! Waiting for others…</p>
        )}
      </div>
    </div>
  )
}
