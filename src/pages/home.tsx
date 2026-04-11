import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "sonner"
import { useNavigate } from "react-router"
import { 
  Users, 
  Play, 
  RotateCcw, 
  Trophy, 
  Ban, 
  CheckCircle2, 
  User, 
  Hash,
  Crown,
  Diamond,
  Layers,
  Flag,
  Users2,
  Star,
  ArrowRight,
  ShieldCheck,
  X,
  Spade,
  Plus,
  Minus,
  Loader2,
  LogIn,
} from "lucide-react"
import { cn } from "@/lib/utils"

type GamePhase = 'setup' | 'selecting' | 'veto-window' | 'playing' | 'scoring' | 'game-over';

type Player = {
  name: string;
  chosenGames: string[];
  hasVeto: boolean;
  totalScore: number;
  mkabbatha: number;
  wakelRay: number;
  elMrabba3: number;
};

const GAMES = [
  { id: 'king', name: 'Roi de cœur', icon: Crown, color: 'text-red-500' },
  { id: 'diamonds', name: 'Carreaux', icon: Diamond, color: 'text-blue-500' },
  { id: 'tricks', name: 'Plis', icon: Layers, color: 'text-amber-500' },
  { id: 'last-trick', name: 'Dernier plis', icon: Flag, color: 'text-emerald-500' },
  { id: 'queens', name: 'Dames', icon: Users2, color: 'text-purple-500' },
  { id: 'queen-spades', name: 'Dame de pique', icon: Spade, color: 'text-slate-300' },
  { id: 'general', name: 'Général', icon: Star, color: 'text-yellow-500' },
  { id: 'trix', name: 'Trix', icon: Hash, color: 'text-slate-400' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [players, setPlayers] = useState<Player[]>([
    { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
    { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
    { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
    { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
  ]);

  const playersData = useQuery(api.players.getStats);
  const initializePlayers = useMutation(api.players.initializePlayers);

  useEffect(() => {
    if (playersData && !playersData.initialized) {
      initializePlayers().catch(console.error);
    }
  }, [playersData, initializePlayers]);


  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [vetoedGamesThisTurn, setVetoedGamesThisTurn] = useState<string[]>([]);
  const [doubledPlayerIndices, setDoubledPlayerIndices] = useState<number[]>([0]);
  const [roundScores, setRoundScores] = useState<number[]>([0, 0, 0, 0]);
  const [vetoedBy, setVetoedBy] = useState<number | null>(null);
  const [trixOrder, setTrixOrder] = useState<number[]>([]);
  const [kingPlayer, setKingPlayer] = useState<number | null>(null);
  const [lastTrickPlayer, setLastTrickPlayer] = useState<number | null>(null);
  const [queensCount, setQueensCount] = useState<number[]>([0, 0, 0, 0]);
  const [diamondsCount, setDiamondsCount] = useState<number[]>([0, 0, 0, 0]);
  const [plisCount, setPlisCount] = useState<number[]>([0, 0, 0, 0]);
  const [capotPlayerIndex, setCapotPlayerIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ players: Player[], currentPlayerIndex: number, vetoedBy: number | null }>>([]);

  const recordSession = useMutation(api.players.recordSession);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  if (playersData === undefined) {
    return (
      <div className="min-h-screen bg-[#064e3b] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
      </div>
    );
  }


  const currentRoundNumber = players.reduce((acc, p) => acc + p.chosenGames.length, 0);

  const handleStartGame = () => {
    if (players.some(p => !p.name.trim())) {
      toast.error("Please enter all player names");
      return;
    }
    setGamePhase('selecting');
    setDoubledPlayerIndices([0]);
    setVetoedBy(null);
    setHistory([]);
  };

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);

    // Skip veto window on last game OR if a veto already happened this turn
    const gamesPlayed = players[currentPlayerIndex].chosenGames.length;
    if (gamesPlayed === 7 || vetoedBy !== null) {
      setDoubledPlayerIndices(vetoedBy !== null ? [currentPlayerIndex, vetoedBy] : [currentPlayerIndex]);
      
      if (gamesPlayed === 7) {
        setGamePhase('scoring');
        setRoundScores([0, 0, 0, 0]);
      } else {
        setGamePhase('playing');
      }
      return;
    }

    setDoubledPlayerIndices([currentPlayerIndex]);
    setGamePhase('veto-window');
  };

  const handleVeto = (playerIndex: number) => {
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].hasVeto = false;
    setPlayers(updatedPlayers);
    setVetoedBy(playerIndex);
    setDoubledPlayerIndices([currentPlayerIndex, playerIndex]);
    
    if (selectedGameId) {
      setVetoedGamesThisTurn(prev => [...prev, selectedGameId]);
    }

    toast.info(`${players[playerIndex].name} used their VETO!`);
    
    // Move back to selecting phase, but the game is NOT recorded yet
    // The player must choose a different game
    setGamePhase('selecting');
    setSelectedGameId(null);
  };

  const handleConfirmGame = () => {
    setGamePhase('playing');
  };

  const handleFinishGame = () => {
    setGamePhase('scoring');
    setRoundScores([0, 0, 0, 0]);
    setTrixOrder([]);
    setKingPlayer(null);
    setLastTrickPlayer(null);
    setQueensCount([0, 0, 0, 0]);
    setDiamondsCount([0, 0, 0, 0]);
    setPlisCount([0, 0, 0, 0]);
    setCapotPlayerIndex(null);
  };

  const handleSubmitScores = () => {
    // Save snapshot before applying scores
    const snapshotPlayers = JSON.parse(JSON.stringify(players));
    if (vetoedBy !== null) {
      snapshotPlayers[vetoedBy].hasVeto = true;
    }
    
    const snapshot = {
      players: snapshotPlayers,
      currentPlayerIndex,
      vetoedBy
    };
    setHistory(prev => [...prev, snapshot]);

    const updatedPlayers: Player[] = JSON.parse(JSON.stringify(players));
    
    // For special games, calculate scores based on custom logic
    const actualScores = [...roundScores];
    if (selectedGameId === 'trix') {
      const baseScores = [-150, -100, -50, 0];
      trixOrder.forEach((playerIdx, orderIdx) => {
        actualScores[playerIdx] = baseScores[orderIdx];
      });
    } else if (selectedGameId === 'king') {
      players.forEach((_, idx) => {
        const isKing = kingPlayer === idx;
        actualScores[idx] = isKing ? 100 : 0;
        if (isKing) {
          updatedPlayers[idx].wakelRay += 1;
        }
      });
    } else if (selectedGameId === 'last-trick') {
      players.forEach((_, idx) => {
        actualScores[idx] = lastTrickPlayer === idx ? 80 : 0;
      });
    } else if (selectedGameId === 'queens') {
      const allFourIndex = queensCount.findIndex(count => count === 4);
      if (allFourIndex !== -1) {
        players.forEach((_, idx) => {
          actualScores[idx] = idx === allFourIndex ? 0 : 80;
          if (idx === allFourIndex) {
            updatedPlayers[idx].mkabbatha += 1;
          }
        });
      } else {
        players.forEach((_, idx) => {
          actualScores[idx] = queensCount[idx] * 20;
        });
      }
    } else if (selectedGameId === 'diamonds') {
      const allEightIndex = diamondsCount.findIndex(count => count === 8);
      players.forEach((_, idx) => {
        updatedPlayers[idx].elMrabba3 += diamondsCount[idx];
      });
      if (allEightIndex !== -1) {
        players.forEach((_, idx) => {
          actualScores[idx] = idx === allEightIndex ? 0 : 80;
          if (idx === allEightIndex) {
            updatedPlayers[idx].mkabbatha += 1;
          }
        });
      } else {
        players.forEach((_, idx) => {
          actualScores[idx] = diamondsCount[idx] * 10;
        });
      }
    } else if (selectedGameId === 'tricks') {
      const allEightIndex = plisCount.findIndex(count => count === 8);
      if (allEightIndex !== -1) {
        players.forEach((_, idx) => {
          actualScores[idx] = idx === allEightIndex ? 0 : 80;
          if (idx === allEightIndex) {
            updatedPlayers[idx].mkabbatha += 1;
          }
        });
      } else {
        players.forEach((_, idx) => {
          actualScores[idx] = plisCount[idx] * 10;
        });
      }
    } else if (capotPlayerIndex !== null) {
      // Automatic Capot scores for general/queen-spades
      if (selectedGameId === 'general') {
        players.forEach((_, idx) => {
          actualScores[idx] = idx === capotPlayerIndex ? 0 : 600;
          if (idx === capotPlayerIndex) updatedPlayers[idx].mkabbatha += 1;
        });
      } else if (selectedGameId === 'queen-spades') {
        players.forEach((_, idx) => {
          actualScores[idx] = idx === capotPlayerIndex ? 0 : 180;
          if (idx === capotPlayerIndex) updatedPlayers[idx].mkabbatha += 1;
        });
      }
    }

    actualScores.forEach((score, idx) => {
      const finalScore = doubledPlayerIndices.includes(idx) ? score * 2 : score;
      updatedPlayers[idx].totalScore += finalScore;
      
      // Score reset rule: if total becomes exactly a multiple of 1000, reset to 0
      if (updatedPlayers[idx].totalScore !== 0 && updatedPlayers[idx].totalScore % 1000 === 0) {
        const hitValue = updatedPlayers[idx].totalScore;
        updatedPlayers[idx].totalScore = 0;
        toast.success(`${updatedPlayers[idx].name} hit ${hitValue}! Score reset to 0! 🎉`, {
          duration: 5000,
        });
      }
    });
    
    // Record the game for the current player
    if (selectedGameId) {
      updatedPlayers[currentPlayerIndex].chosenGames.push(selectedGameId);
    }
    
    setPlayers(updatedPlayers);

    // Total games played across all players
    const totalGamesPlayed = updatedPlayers.reduce((acc, p) => acc + p.chosenGames.length, 0);

    if (totalGamesPlayed === 32) {
      setGamePhase('game-over');
      return;
    }

    // Turn rotation: pass to the next player after each game
    const nextPlayerIndex = (currentPlayerIndex + 1) % 4;
    setCurrentPlayerIndex(nextPlayerIndex);
    setDoubledPlayerIndices([nextPlayerIndex]);

    setGamePhase('selecting');
    setSelectedGameId(null);
    setVetoedBy(null);
    setVetoedGamesThisTurn([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const lastSnapshot = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    
    setPlayers(lastSnapshot.players);
    setCurrentPlayerIndex(lastSnapshot.currentPlayerIndex);
    setGamePhase('selecting');
    setSelectedGameId(null);
    setVetoedBy(null);
    setVetoedGamesThisTurn([]);
    setIsSaved(false);
    
    toast.info("Last round undone");
  };

  const resetGame = () => {
    setPlayers([
      { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
      { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
      { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
      { name: '', chosenGames: [], hasVeto: true, totalScore: 0, mkabbatha: 0, wakelRay: 0, elMrabba3: 0 },
    ]);
    setGamePhase('setup');
    setCurrentPlayerIndex(0);
    setSelectedGameId(null);
    setVetoedGamesThisTurn([]);
    setTrixOrder([]);
    setKingPlayer(null);
    setLastTrickPlayer(null);
    setQueensCount([0, 0, 0, 0]);
    setDiamondsCount([0, 0, 0, 0]);
    setPlisCount([0, 0, 0, 0]);
    setCapotPlayerIndex(null);
    setHistory([]);
    setIsSaved(false);
  };

  const handleSaveSession = async () => {
    try {
      setIsSaving(true);
      await recordSession({
        players: players.map(p => ({
          name: p.name,
          score: p.totalScore,
          mkabbatha: p.mkabbatha,
          wakelRay: p.wakelRay,
          elMrabba3: p.elMrabba3
        }))
      });
      setIsSaved(true);
      toast.success("Session saved to Hall of Records! 🏆");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };

  if (gamePhase === 'setup') {
    return (
      <main className="min-h-screen bg-[#064e3b] text-white p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tighter italic text-yellow-400 drop-shadow-lg">TRIX</h1>
            <p className="text-emerald-100 font-medium">Score Tracker</p>
          </div>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" /> Player Setup
              </CardTitle>
              <CardDescription className="text-emerald-100/70">Select the 4 players for this session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {players.map((player, idx) => (
                <div key={idx} className="space-y-2">
                  <Label className="text-emerald-50">Player {idx + 1}</Label>
                  <Select
                    value={player.name}
                    onValueChange={(val) => {
                      const newPlayers = [...players];
                      newPlayers[idx].name = val;
                      setPlayers(newPlayers);
                    }}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 text-lg">
                      <SelectValue placeholder={`Select Player ${idx + 1}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#064e3b] border-white/20 text-white">
                      {playersData.players.map((p) => (
                        <SelectItem 
                          key={p.name} 
                          value={p.name}
                          disabled={players.some((sp, sIdx) => sIdx !== idx && sp.name === p.name)}
                          className="focus:bg-emerald-800 focus:text-white"
                        >
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button 
                onClick={handleStartGame} 
                className="w-full h-14 text-lg font-bold bg-yellow-500 hover:bg-yellow-400 text-emerald-950 mt-4 shadow-[0_4px_0_0_#ca8a04]"
              >
                <Play className="mr-2 w-5 h-5 fill-current" /> START GAME
              </Button>
              <Button 
                onClick={() => navigate('/stats')} 
                variant="ghost"
                className="w-full h-12 text-emerald-100 hover:text-white hover:bg-white/5 font-medium mt-2"
              >
                <Trophy className="mr-2 w-4 h-4" /> Hall of Records 🏆
              </Button>

              <div className="border-t border-white/10 pt-4 mt-2 space-y-3">
                <p className="text-center text-emerald-300/40 text-xs uppercase tracking-widest font-bold">⚡ Online Multiplayer</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => navigate('/lobby')}
                    className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-0 shadow-[0_3px_0_0_#065f46]"
                  >
                    <Plus className="mr-1.5 w-4 h-4" /> Create Lobby
                  </Button>
                  <Button
                    onClick={() => navigate('/lobby')}
                    variant="outline"
                    className="h-12 bg-white/10 border-white/20 text-white hover:bg-white/20 font-bold"
                  >
                    <LogIn className="mr-1.5 w-4 h-4" /> Join Lobby
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#064e3b] text-white pb-24">
      {/* Header / Scoreboard */}
      <header className="sticky top-0 z-10 bg-[#064e3b]/90 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-md mx-auto flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black italic text-yellow-400 tracking-tighter">TRIX</h2>
          <Badge variant="outline" className="text-emerald-100 border-emerald-100/30">
            Round {Math.min(currentRoundNumber + 1, 32)} / 32
          </Badge>
        </div>
        <div className="max-w-md mx-auto grid grid-cols-4 gap-2">
          {players.map((p, idx) => (
            <div 
              key={idx} 
              className={cn(
                "flex flex-col items-center p-2 rounded-lg transition-all border",
                currentPlayerIndex === idx ? "bg-white/20 border-yellow-400/50 ring-2 ring-yellow-400/20" : "bg-white/5 border-transparent"
              )}
            >
              <div className="relative">
                <User className={cn("w-6 h-6 mb-1", currentPlayerIndex === idx ? "text-yellow-400" : "text-emerald-300")} />
                {doubledPlayerIndices.includes(idx) && (gamePhase !== 'selecting') && (
                  <Badge className="absolute -top-2 -right-4 bg-yellow-500 text-emerald-950 text-[10px] px-1 h-4 font-bold">2X</Badge>
                )}
                {!p.hasVeto && <Ban className="absolute -bottom-1 -right-1 w-3 h-3 text-red-500 fill-emerald-950 rounded-full" />}
              </div>
              <span className="text-[10px] font-bold uppercase truncate w-full text-center">{p.name || `P${idx+1}`}</span>
              <span className="text-sm font-black text-yellow-400">{p.totalScore}</span>
              <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                {p.chosenGames.map((gameId, gIdx) => {
                  const GameIcon = GAMES.find(g => g.id === gameId)?.icon || Star;
                  return <GameIcon key={gIdx} className="w-2 h-2 text-emerald-100/40" />;
                })}
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {gamePhase === 'selecting' && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold">{players[currentPlayerIndex].name}'s Turn</h3>
              <p className="text-emerald-200/70 text-sm">Choose a game to play</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {GAMES.map((game) => {
                const isChosen = players[currentPlayerIndex].chosenGames.includes(game.id);
                const isVetoed = vetoedGamesThisTurn.includes(game.id);
                const Icon = game.icon;
                return (
                  <Button
                    key={game.id}
                    disabled={isChosen || isVetoed}
                    onClick={() => handleSelectGame(game.id)}
                    variant="outline"
                    className={cn(
                      "h-20 justify-start gap-4 border-2 transition-all relative overflow-hidden group",
                      isChosen || isVetoed
                        ? "bg-black/20 border-white/5 opacity-50 grayscale" 
                        : "bg-white/10 border-white/10 hover:bg-white/20 hover:border-yellow-400/50"
                    )}
                  >
                    <div className={cn("p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform", game.color)}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-bold text-white">{game.name}</span>
                      <span className="text-xs text-emerald-200/50">
                        {isChosen ? "Already played" : isVetoed ? "Vetoed this turn" : "Select this game"}
                      </span>
                    </div>
                    {isChosen && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />}
                    {isVetoed && <Ban className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-red-500" />}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {gamePhase === 'veto-window' && selectedGameId && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm overflow-hidden">
              <div className="bg-yellow-500 p-4 text-emerald-950 text-center font-black italic text-xl">
                VETO WINDOW
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={cn("p-6 rounded-full bg-white/5", GAMES.find(g => g.id === selectedGameId)?.color)}>
                    {(() => {
                      const Icon = GAMES.find(g => g.id === selectedGameId)?.icon || Star;
                      return <Icon className="w-16 h-16" />
                    })()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{GAMES.find(g => g.id === selectedGameId)?.name}</h3>
                    <p className="text-emerald-200/70">Selected by {players[currentPlayerIndex].name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-center text-sm font-medium text-emerald-100">Does anyone want to veto?</p>
                  <div className="grid grid-cols-1 gap-2">
                    {players.map((p, idx) => {
                      if (idx === currentPlayerIndex) return null;
                      return (
                        <Button
                          key={idx}
                          disabled={!p.hasVeto}
                          onClick={() => handleVeto(idx)}
                          variant="secondary"
                          className={cn(
                            "h-12 justify-between px-4",
                            p.hasVeto ? "bg-red-500/20 text-red-200 hover:bg-red-500/30 border-red-500/30" : "opacity-50"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <User className="w-4 h-4" /> {p.name}
                          </span>
                          {p.hasVeto ? (
                            <span className="flex items-center gap-1 text-xs font-bold">
                              <ShieldCheck className="w-4 h-4" /> USE VETO
                            </span>
                          ) : (
                            <span className="text-xs opacity-50 italic">Veto used</span>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <Button 
                  onClick={handleConfirmGame}
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg"
                >
                  NO VETO - START GAME
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {gamePhase === 'playing' && selectedGameId && (
          <div className="space-y-6 text-center py-12">
            <div className="space-y-2">
              <Badge className="bg-yellow-500 text-emerald-950 font-black">NOW PLAYING</Badge>
              <h3 className="text-4xl font-black text-white uppercase tracking-tight">
                {GAMES.find(g => g.id === selectedGameId)?.name}
              </h3>
            </div>
            
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-44 bg-white rounded-xl shadow-2xl flex items-center justify-center border-4 border-emerald-800">
                   {(() => {
                      const Icon = GAMES.find(g => g.id === selectedGameId)?.icon || Star;
                      const color = GAMES.find(g => g.id === selectedGameId)?.color || 'text-emerald-950';
                      return <Icon className={cn("w-16 h-16", color)} />
                    })()}
                </div>
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-emerald-950 font-black text-xl border-4 border-[#064e3b]">
                  2X
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-8">
              <p className="text-emerald-100/70 font-medium">
                Doubled Score for: <span className="text-yellow-400 font-bold">
                  {doubledPlayerIndices.map(idx => players[idx].name).join(" & ")}
                </span>
              </p>
              <Button 
                onClick={handleFinishGame}
                className="w-full h-16 text-xl font-black bg-white text-emerald-950 hover:bg-emerald-50"
              >
                FINISH GAME & SCORE
              </Button>
            </div>
          </div>
        )}

        {gamePhase === 'scoring' && (
          <div className="space-y-6">
             <div className="text-center space-y-1">
              <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                {(() => {
                  const game = GAMES.find(g => g.id === selectedGameId);
                  const Icon = game?.icon;
                  return (
                    <>
                      {Icon && <Icon className={cn("w-5 h-5", game.color)} />}
                      {selectedGameId === 'trix' ? 'Trix Ordering' : 
                       selectedGameId === 'king' ? 'Roi de cœur' :
                       selectedGameId === 'last-trick' ? 'Dernier plis' :
                        selectedGameId === 'queens' ? 'Dames' : 
                        selectedGameId === 'diamonds' ? 'Carreaux' : 
                        selectedGameId === 'tricks' ? 'Plis' : 'Enter Scores'}
                    </>
                  )
                })()}
              </h3>
              <p className="text-emerald-200/70 text-sm">
                {selectedGameId === 'trix' ? 'Tap players in order of finishing' : 
                 selectedGameId === 'king' ? 'Who took the King of Hearts?' :
                 selectedGameId === 'last-trick' ? 'Who took the last trick?' :
                 selectedGameId === 'queens' ? 'Distribute the 4 queens' : 
                 selectedGameId === 'diamonds' ? 'Distribute the 8 diamonds' : 
                 selectedGameId === 'tricks' ? 'Distribute the 8 plis' : 'Enter base points for each player'}
              </p>
            </div>

            {selectedGameId === 'king' || selectedGameId === 'last-trick' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {players.map((p, idx) => {
                    const isSelected = selectedGameId === 'king' ? kingPlayer === idx : lastTrickPlayer === idx;
                    const isDoubled = doubledPlayerIndices.includes(idx);
                    const basePoints = selectedGameId === 'king' ? 100 : 80;
                    return (
                      <Button
                        key={idx}
                        onClick={() => {
                          if (selectedGameId === 'king') {
                            setKingPlayer(isSelected ? null : idx);
                          } else {
                            setLastTrickPlayer(isSelected ? null : idx);
                          }
                        }}
                        variant="outline"
                        className={cn(
                          "h-32 flex flex-col gap-2 border-2 transition-all",
                          isSelected 
                            ? (selectedGameId === 'king' ? "bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]")
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <span className="text-lg font-bold">{p.name}</span>
                        {isSelected ? (
                          <div className="flex flex-col items-center">
                            <span className={cn("text-3xl font-black", selectedGameId === 'king' ? "text-red-500" : "text-emerald-500")}>
                              {isDoubled ? basePoints * 2 : basePoints}
                            </span>
                            <span className={cn("text-[10px] uppercase font-bold", selectedGameId === 'king' ? "text-red-400" : "text-emerald-400")}>Points</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-black text-white/20">0</span>
                        )}
                        {isDoubled && <Badge className="bg-yellow-500 text-emerald-950 text-[10px] font-bold">2X</Badge>}
                      </Button>
                    );
                  })}
                </div>
                <Button 
                  onClick={handleSubmitScores}
                  disabled={(selectedGameId === 'king' ? kingPlayer : lastTrickPlayer) === null}
                  className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold text-lg mt-4 disabled:opacity-50"
                >
                  SAVE SCORES & CONTINUE <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            ) : (selectedGameId === 'queens' || selectedGameId === 'diamonds' || selectedGameId === 'tricks') ? (
              <div className="space-y-6">
                <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardContent className="p-6 space-y-8">
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg">
                      <span className="text-sm font-medium text-emerald-100 uppercase tracking-wider">
                        {selectedGameId === 'queens' ? 'Queens' : selectedGameId === 'diamonds' ? 'Diamonds' : 'Plis'} remaining:
                      </span>
                      <span className={cn(
                        "text-2xl font-black px-3 py-1 rounded-md",
                        (selectedGameId === 'queens' ? 4 : 8) - (selectedGameId === 'queens' ? queensCount : selectedGameId === 'diamonds' ? diamondsCount : plisCount).reduce((a, b) => a + b, 0) === 0 ? "bg-emerald-50 text-white" : "text-yellow-400"
                      )}>
                        {(selectedGameId === 'queens' ? 4 : 8) - (selectedGameId === 'queens' ? queensCount : selectedGameId === 'diamonds' ? diamondsCount : plisCount).reduce((a, b) => a + b, 0)}
                      </span>
                    </div>

                    <div className="space-y-6">
                      {players.map((p, idx) => {
                        const count = selectedGameId === 'queens' ? queensCount[idx] : 
                                      selectedGameId === 'diamonds' ? diamondsCount[idx] : plisCount[idx];
                        const counts = selectedGameId === 'queens' ? queensCount : 
                                       selectedGameId === 'diamonds' ? diamondsCount : plisCount;
                        const maxCount = selectedGameId === 'queens' ? 4 : 8;
                        const pointsPerItem = selectedGameId === 'queens' ? 20 : 10;
                        const totalDistributed = counts.reduce((a, b) => a + b, 0);
                        const isDoubled = doubledPlayerIndices.includes(idx);
                        const hasAll = count === maxCount;
                        const someoneHasAll = counts.some(c => c === maxCount);
                        
                        let displayScore = count * pointsPerItem;
                        if (someoneHasAll) {
                          displayScore = hasAll ? 0 : 80;
                        }
                        if (isDoubled) displayScore *= 2;

                        const Icon = selectedGameId === 'queens' ? Users2 : selectedGameId === 'diamonds' ? Diamond : Layers;
                        const iconColor = selectedGameId === 'queens' ? "bg-purple-500 border-purple-400" : 
                                         selectedGameId === 'diamonds' ? "bg-blue-500 border-blue-400" : 
                                         "bg-amber-500 border-amber-400";
                        const shadowColor = selectedGameId === 'queens' ? "rgba(168,85,247,0.4)" : 
                                           selectedGameId === 'diamonds' ? "rgba(59,130,246,0.4)" : 
                                           "rgba(245,158,11,0.4)";

                        return (
                          <div key={idx} className="flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-lg flex items-center gap-2">
                                {p.name}
                                {isDoubled && <Badge className="bg-yellow-500 text-emerald-950 text-[10px]">2X</Badge>}
                              </span>
                              <div className="text-right">
                                <div className={cn("text-xl font-black", displayScore > 0 ? "text-yellow-400" : "text-white/30")}>
                                  {displayScore} pts
                                </div>
                                {hasAll && (
                                  <Badge className={cn(
                                    selectedGameId === 'queens' ? "bg-purple-500" : 
                                    selectedGameId === 'diamonds' ? "bg-blue-500" : "bg-amber-500", 
                                    "text-white text-[10px] animate-pulse"
                                  )}>
                                    {selectedGameId === 'queens' ? "TOUTES LES DAMES!" : 
                                     selectedGameId === 'diamonds' ? "TOUS LES CARREAUX!" : "TOUS LES PLIS!"}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-12 w-12 rounded-full border-2 border-white/20 bg-white/5 text-white disabled:opacity-20"
                                onClick={() => {
                                  if (selectedGameId === 'queens') {
                                    const newCounts = [...queensCount];
                                    newCounts[idx] = Math.max(0, newCounts[idx] - 1);
                                    setQueensCount(newCounts);
                                  } else if (selectedGameId === 'diamonds') {
                                    const newCounts = [...diamondsCount];
                                    newCounts[idx] = Math.max(0, newCounts[idx] - 1);
                                    setDiamondsCount(newCounts);
                                  } else {
                                    const newCounts = [...plisCount];
                                    newCounts[idx] = Math.max(0, newCounts[idx] - 1);
                                    setPlisCount(newCounts);
                                  }
                                }}
                                disabled={count === 0}
                              >
                                <Minus className="w-6 h-6" />
                              </Button>
                              
                              <div className="flex gap-0.5 flex-wrap justify-center max-w-[120px]">
                                {Array.from({ length: maxCount }).map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={cn(
                                      "w-7 h-9 rounded-md border-2 transition-all flex items-center justify-center",
                                      i < count 
                                        ? `${iconColor} text-white shadow-[0_0_10px_${shadowColor}]` 
                                        : "bg-black/20 border-white/5 text-white/10"
                                    )}
                                  >
                                    <Icon className={cn("w-4 h-4", i < count ? "opacity-100" : "opacity-20")} />
                                  </div>
                                ))}
                              </div>

                              <Button
                                size="icon"
                                variant="outline"
                                className="h-12 w-12 rounded-full border-2 border-white/20 bg-white/5 text-white disabled:opacity-20"
                                onClick={() => {
                                  if (selectedGameId === 'queens') {
                                    const newCounts = [...queensCount];
                                    newCounts[idx] = Math.min(maxCount, newCounts[idx] + 1);
                                    setQueensCount(newCounts);
                                  } else if (selectedGameId === 'diamonds') {
                                    const newCounts = [...diamondsCount];
                                    newCounts[idx] = Math.min(maxCount, newCounts[idx] + 1);
                                    setDiamondsCount(newCounts);
                                  } else {
                                    const newCounts = [...plisCount];
                                    newCounts[idx] = Math.min(maxCount, newCounts[idx] + 1);
                                    setPlisCount(newCounts);
                                  }
                                }}
                                disabled={totalDistributed >= maxCount || count >= maxCount}
                              >
                                <Plus className="w-6 h-6" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleSubmitScores}
                  disabled={(selectedGameId === 'queens' ? queensCount : selectedGameId === 'diamonds' ? diamondsCount : plisCount).reduce((a, b) => a + b, 0) !== (selectedGameId === 'queens' ? 4 : 8)}
                  className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold text-lg mt-4 disabled:opacity-50 disabled:grayscale"
                >
                  SAVE SCORES & CONTINUE <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            ) : selectedGameId === 'trix' ? (
              <div className="space-y-6">
                <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardContent className="p-4 space-y-3">
                    {[-150, -100, -50, 0].map((baseScore, orderIdx) => {
                      const playerIdx = trixOrder[orderIdx];
                      const player = playerIdx !== undefined ? players[playerIdx] : null;
                      const isDoubled = playerIdx !== undefined && doubledPlayerIndices.includes(playerIdx);
                      const finalScore = isDoubled ? baseScore * 2 : baseScore;
                      
                      return (
                        <div 
                          key={orderIdx}
                          onClick={() => {
                            if (playerIdx !== undefined) {
                              setTrixOrder(prev => prev.filter(idx => idx !== playerIdx));
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer",
                            player ? "bg-white/10 border-yellow-400/50" : "bg-black/20 border-dashed border-white/10 h-16"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-yellow-500 text-emerald-950 flex items-center justify-center font-black">
                              {orderIdx + 1}
                            </span>
                            {player ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-white flex items-center gap-2">
                                  {player.name}
                                  {isDoubled && <Badge className="bg-yellow-500 text-emerald-950 text-[10px]">2X</Badge>}
                                </span>
                                <span className="text-[10px] text-emerald-200/50 uppercase">Tap to remove</span>
                              </div>
                            ) : (
                              <span className="text-white/30 italic">
                                {orderIdx === 0 ? "1st Place 🥇" : orderIdx === 1 ? "2nd Place 🥈" : orderIdx === 2 ? "3rd Place 🥉" : "4th Place"}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-right">
                            {player ? (
                              <>
                                <div className="font-black text-lg text-yellow-400">
                                  {finalScore} pts
                                </div>
                                {isDoubled && (
                                  <div className="text-[10px] text-emerald-200/50 uppercase">Doubled from {baseScore}</div>
                                )}
                              </>
                            ) : (
                              <div className="text-sm font-medium text-emerald-200/30">
                                {baseScore} pts
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm font-medium text-emerald-100">Remaining Players:</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setTrixOrder([])}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {players.map((p, idx) => {
                      const isPlaced = trixOrder.includes(idx);
                      if (isPlaced) return null;
                      return (
                        <Button
                          key={idx}
                          onClick={() => setTrixOrder(prev => [...prev, idx])}
                          variant="outline"
                          className="h-16 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-bold"
                        >
                          {p.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <Button 
                  onClick={handleSubmitScores}
                  disabled={trixOrder.length < 4}
                  className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold text-lg mt-4 disabled:opacity-50 disabled:grayscale"
                >
                  SAVE SCORES & CONTINUE <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
                <CardContent className="p-6 space-y-6">
                  {/* CAPOT Selection for general and queen-spades */}
                  {(selectedGameId === 'general' || selectedGameId === 'queen-spades') && (
                    <div className="space-y-3 pb-4 border-b border-white/10">
                      <Label className="text-emerald-50 text-sm font-bold uppercase tracking-wider">Capot Player (Optional)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {players.map((p, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => setCapotPlayerIndex(capotPlayerIndex === idx ? null : idx)}
                            className={cn(
                              "h-10 border-2 transition-all",
                              capotPlayerIndex === idx 
                                ? "bg-red-500/20 border-red-500 text-white" 
                                : "bg-white/5 border-white/10 text-white/70"
                            )}
                          >
                            {p.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {capotPlayerIndex === null ? (
                    players.map((p, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-emerald-50 flex items-center gap-2">
                            {p.name}
                            {doubledPlayerIndices.includes(idx) && <Badge className="bg-yellow-500 text-emerald-950 text-[10px]">2X</Badge>}
                          </Label>
                          {doubledPlayerIndices.includes(idx) && (
                            <span className="text-[10px] text-yellow-400 font-bold">Points will be doubled</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={roundScores[idx] || ''}
                            onChange={(e) => {
                              const newScores = [...roundScores];
                              newScores[idx] = parseInt(e.target.value) || 0;
                              setRoundScores(newScores);
                            }}
                            className="bg-white/5 border-white/10 text-white h-12 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <div className="w-20 bg-white/5 rounded-md flex items-center justify-center border border-white/10">
                            <span className="text-yellow-400 font-black">
                              {doubledPlayerIndices.includes(idx) ? (roundScores[idx] * 2) : roundScores[idx]}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-xl text-center space-y-3">
                      <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                        <Ban className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-white uppercase tracking-tight">
                          {players[capotPlayerIndex].name}
                        </p>
                        <p className="text-red-200 font-bold">MARKED AS CAPOT!</p>
                      </div>
                      <p className="text-xs text-red-200/70 max-w-[200px] mx-auto">
                        {selectedGameId === 'general' 
                          ? "This player gets 0 points, and all other players get 600 points." 
                          : "This player gets 0 points, and all other players get 180 points."}
                      </p>
                      <Button 
                        variant="link" 
                        onClick={() => setCapotPlayerIndex(null)}
                        className="text-white/50 hover:text-white text-xs"
                      >
                        Cancel Capot
                      </Button>
                    </div>
                  )}

                  <Button 
                    onClick={handleSubmitScores}
                    className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-emerald-950 font-bold text-lg mt-4"
                  >
                    SAVE SCORES & CONTINUE <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {gamePhase === 'game-over' && (
          <div className="space-y-8 text-center py-8">
            <div className="space-y-2">
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto drop-shadow-lg" />
              <h2 className="text-4xl font-black text-white italic">GAME OVER</h2>
            </div>

            <Card className="bg-white/10 border-white/20 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-white/5">
                <CardTitle className="text-white">Final Standings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {[...players].sort((a, b) => b.totalScore - a.totalScore).map((p, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-center justify-between p-4 border-b border-white/10",
                      idx === 0 ? "bg-yellow-500/10" : ""
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-bold">{p.name}</span>
                    </div>
                    <span className="text-xl font-black text-yellow-400">{p.totalScore}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3">
              {!isSaved ? (
                <Button 
                  onClick={handleSaveSession}
                  disabled={isSaving}
                  className="w-full h-16 text-lg font-black bg-yellow-500 hover:bg-yellow-400 text-emerald-950 shadow-[0_4px_0_0_#ca8a04]"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  ) : (
                    <Trophy className="mr-2 w-5 h-5" />
                  )}
                  SAVE TO HALL OF RECORDS
                </Button>
              ) : (
                <div className="bg-emerald-500/20 border border-emerald-500/50 p-4 rounded-lg flex items-center justify-center gap-2 text-emerald-400 font-bold">
                  <ShieldCheck className="w-5 h-5" /> SESSION SAVED
                </div>
              )}

              {history.length > 0 && !isSaved && (
                <Button 
                  onClick={handleUndo}
                  variant="outline"
                  className="w-full h-14 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <RotateCcw className="mr-2 w-5 h-5" /> UNDO LAST ROUND
                </Button>
              )}
              <Button 
                onClick={resetGame}
                variant="outline"
                className="w-full h-14 border-white/20 text-white hover:bg-white/10"
              >
                <RotateCcw className="mr-2 w-5 h-5" /> START NEW GAME
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Undo Button */}
      {history.length > 0 && gamePhase !== 'game-over' && (
        <div className="fixed bottom-6 left-6">
           <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full w-12 h-12 shadow-xl bg-amber-600 hover:bg-amber-500 border border-white/20 text-white"
            onClick={handleUndo}
           >
            <RotateCcw className="w-5 h-5" />
           </Button>
        </div>
      )}

      {/* Reset Button */}
      {gamePhase !== 'game-over' && (
        <div className="fixed bottom-6 right-6">
           <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full w-12 h-12 shadow-xl bg-emerald-800 border border-white/20 text-white"
            onClick={() => {
              if (confirm("Reset current game?")) resetGame();
            }}
           >
            <X className="w-5 h-5" />
           </Button>
        </div>
      )}
    </main>
  )
}

