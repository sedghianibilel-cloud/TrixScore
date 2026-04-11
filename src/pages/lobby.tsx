import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Users, Plus, LogIn, CheckCircle2, Clock, Crown, Loader2, ArrowLeft, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

const SEAT_LABELS = ["Seat 1 ★ Host", "Seat 2", "Seat 3", "Seat 4"]

export default function LobbyPage() {
  const navigate = useNavigate()
  const [myName, setMyName] = useState(() => localStorage.getItem("trix-player-name") || "")
  const [myCode, setMyCode] = useState<string | null>(() => localStorage.getItem("trix-lobby-code"))
  const [mySeat, setMySeat] = useState<number>(() => parseInt(localStorage.getItem("trix-lobby-seat") ?? "-1"))
  const [view, setView] = useState<"choose" | "join-list" | "room">(myCode ? "room" : "choose")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState<string | null>(null)

  const playersData = useQuery(api.players.getStats)
  const lobbies   = useQuery(api.lobbies.getLobbies)
  const lobby     = useQuery(api.lobbies.getLobby, myCode ? { code: myCode } : "skip")
  const createLobbyMut = useMutation(api.lobbies.createLobby)
  const joinLobbyMut   = useMutation(api.lobbies.joinLobby)
  const toggleReadyMut = useMutation(api.lobbies.toggleReady)
  const startGameMut   = useMutation(api.game.startGame)
  const leaveLobbyMut  = useMutation(api.lobbies.leaveLobby)

  // Auto-start when all 4 ready
  useEffect(() => {
    if (lobby && myCode && lobby.seats.length === 4 && lobby.seats.every(s => s.isReady) && lobby.status === "waiting") {
      startGameMut({ code: myCode }).catch(() => {})
    }
  }, [lobby?.seats?.map(s => s.isReady).join(",")])

  // Navigate when game starts
  useEffect(() => {
    if (lobby?.status === "playing" && myCode) {
      navigate(`/game/${myCode}`)
    }
  }, [lobby?.status])

  const handleCreate = async () => {
    if (!myName) { toast.error("Pick your name first"); return }
    setIsCreating(true)
    try {
      const { code } = await createLobbyMut({ playerName: myName })
      localStorage.setItem("trix-player-name", myName)
      localStorage.setItem("trix-lobby-code", code)
      localStorage.setItem("trix-lobby-seat", "0")
      setMyCode(code); setMySeat(0); setView("room")
    } catch (e: any) { toast.error(e.message) }
    finally { setIsCreating(false) }
  }

  const handleJoin = async (code: string) => {
    if (!myName) { toast.error("Pick your name first"); return }
    setIsJoining(code)
    try {
      const { seatIndex } = await joinLobbyMut({ code, playerName: myName })
      localStorage.setItem("trix-player-name", myName)
      localStorage.setItem("trix-lobby-code", code)
      localStorage.setItem("trix-lobby-seat", seatIndex.toString())
      setMyCode(code); setMySeat(seatIndex); setView("room")
    } catch (e: any) { toast.error(e.message) }
    finally { setIsJoining(null) }
  }

  const handleLeave = async () => {
    if (myCode && mySeat >= 0) await leaveLobbyMut({ code: myCode, seatIndex: mySeat }).catch(() => {})
    localStorage.removeItem("trix-lobby-code"); localStorage.removeItem("trix-lobby-seat")
    setMyCode(null); setMySeat(-1); setView("choose")
  }

  const handleReady = async () => {
    if (!myCode) return
    await toggleReadyMut({ code: myCode, seatIndex: mySeat }).catch((e: any) => toast.error(e.message))
  }

  const myReadyState = lobby?.seats.find(s => s.seatIndex === mySeat)?.isReady

  // ── Choose Action ─────────────────────────────────────────────────────────
  if (view === "choose" || view === "join-list") {
    return (
      <main className="min-h-screen bg-[#064e3b] text-white p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-5xl font-black italic text-yellow-400 tracking-tighter drop-shadow-lg">TRIX</h1>
            <p className="text-emerald-100 font-medium">Online Multiplayer</p>
          </div>

          {/* Name selector */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> Your Name
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={myName} onValueChange={setMyName}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 text-base">
                  <SelectValue placeholder="Select your name…" />
                </SelectTrigger>
                <SelectContent className="bg-[#064e3b] border-white/20 text-white">
                  {playersData?.players.map(p => (
                    <SelectItem key={p.name} value={p.name} className="focus:bg-emerald-800 focus:text-white">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {view === "choose" && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleCreate}
                disabled={!myName || isCreating}
                className="h-20 flex-col gap-1 text-base font-bold bg-yellow-500 hover:bg-yellow-400 text-emerald-950 shadow-[0_4px_0_0_#ca8a04]"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                Create Lobby
              </Button>
              <Button
                onClick={() => setView("join-list")}
                disabled={!myName}
                variant="outline"
                className="h-20 flex-col gap-1 text-base font-bold bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <LogIn className="w-6 h-6" /> Join Lobby
              </Button>
            </div>
          )}

          {view === "join-list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-emerald-100">Open Lobbies</h2>
                <Button variant="ghost" size="sm" onClick={() => setView("choose")} className="text-emerald-300 hover:text-white h-8">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </div>
              {lobbies === undefined && <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-yellow-400" /></div>}
              {lobbies?.length === 0 && (
                <div className="text-center py-8 text-emerald-300">No open lobbies. Create one!</div>
              )}
              {lobbies?.map(l => (
                <Card key={l._id} className="bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-yellow-400 text-xl tracking-widest">{l.code}</span>
                        <Badge variant="outline" className="border-emerald-300/30 text-emerald-300 text-xs">
                          {l.seats.length}/4 players
                        </Badge>
                      </div>
                      <div className="text-xs text-emerald-200/60 mt-1">
                        {l.seats.map(s => s.name).join(", ")}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleJoin(l.code)}
                      disabled={isJoining === l.code || l.seats.some(s => s.name === myName)}
                      className="bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold min-w-[80px]"
                    >
                      {isJoining === l.code ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button variant="ghost" onClick={() => navigate("/")} className="w-full text-emerald-300 hover:text-white">
            ← Back to Score Tracker
          </Button>
        </div>
      </main>
    )
  }

  // ── Waiting Room ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#064e3b] text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-black italic text-yellow-400 tracking-tighter">TRIX</h1>
          <p className="text-emerald-200/70 text-sm">Waiting for players…</p>
        </div>

        {/* Lobby code */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-300/70">Lobby Code</p>
              <p className="text-3xl font-black tracking-widest text-yellow-400">{myCode}</p>
            </div>
            <Button variant="ghost" size="icon"
              onClick={() => { navigator.clipboard.writeText(myCode!); toast.success("Code copied!") }}
              className="text-emerald-300 hover:text-white"
            >
              <Copy className="w-5 h-5" />
            </Button>
          </CardContent>
        </Card>

        {/* Player slots */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[0, 1, 2, 3].map(i => {
              const seat = lobby?.seats.find(s => s.seatIndex === i)
              return (
                <div key={i} className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  seat ? "bg-white/10 border-white/20" : "bg-black/20 border-dashed border-white/10"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      seat ? "bg-emerald-700" : "bg-black/20 text-white/20"
                    )}>
                      {i === 0 ? <Crown className="w-4 h-4 text-yellow-400" /> : i + 1}
                    </div>
                    <div>
                      <p className={cn("font-bold", !seat && "text-white/20")}>
                        {seat?.name ?? (i === mySeat ? "You" : "Waiting…")}
                        {i === mySeat && seat && <span className="text-yellow-400 text-xs ml-1">(you)</span>}
                      </p>
                      <p className="text-xs text-emerald-300/50">{SEAT_LABELS[i]}</p>
                    </div>
                  </div>
                  {seat && (
                    seat.isReady
                      ? <Badge className="bg-emerald-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Ready</Badge>
                      : <Badge variant="outline" className="border-white/20 text-white/50"><Clock className="w-3 h-3 mr-1" />Waiting</Badge>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          {lobby?.seats.length === 4 && (
            <Button
              onClick={handleReady}
              className={cn(
                "w-full h-14 text-lg font-bold transition-all",
                myReadyState
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-yellow-500 hover:bg-yellow-400 text-emerald-950 shadow-[0_4px_0_0_#ca8a04]"
              )}
            >
              {myReadyState ? "✓ Ready! (click to unready)" : "🎮 I'm Ready!"}
            </Button>
          )}
          {(lobby?.seats.length ?? 0) < 4 && (
            <p className="text-center text-emerald-300/60 text-sm animate-pulse">
              Waiting for {4 - (lobby?.seats.length ?? 0)} more player(s)…
            </p>
          )}
          <Button variant="ghost" onClick={handleLeave} className="w-full text-red-400 hover:text-red-300 hover:bg-red-400/10">
            Leave Lobby
          </Button>
        </div>
      </div>
    </main>
  )
}
