import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, ArrowLeft, Trophy, ChevronUp, ChevronDown, Search, Filter } from "lucide-react"
import { useNavigate } from "react-router"
import { cn } from "@/lib/utils"

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function StatsPage() {
  const navigate = useNavigate();
  const statsData = useQuery(api.players.getStats);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'elM3allem', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState("");
  const [minSessions, setMinSessions] = useState("0");

  const players = statsData?.players || [];

  const highlights = useMemo(() => {
    if (!players.length) return null;
    const topM3allem = [...players].sort((a, b) => b.elM3allem - a.elM3allem)[0];
    const topBhim = [...players].sort((a, b) => b.bhimEttawla - a.bhimEttawla)[0];
    const topMkabbatha = [...players].sort((a, b) => b.mkabbatha - a.mkabbatha)[0];
    const topWakelRay = [...players].sort((a, b) => b.wakelRay - a.wakelRay)[0];

    return { topM3allem, topBhim, topMkabbatha, topWakelRay };
  }, [players]);

  const filteredAndSortedPlayers = useMemo(() => {
    let result = players.filter(p => {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMinSessions = p.sessionsPlayed >= parseInt(minSessions);
      return matchName && matchMinSessions;
    });
    
    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'avgScore') {
          aValue = a.sessionsPlayed > 0 ? a.totalScore / a.sessionsPlayed : 0;
          bValue = b.sessionsPlayed > 0 ? b.totalScore / b.sessionsPlayed : 0;
        } else {
          aValue = a[sortConfig.key as keyof typeof a];
          bValue = b[sortConfig.key as keyof typeof b];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [players, sortConfig, searchTerm, minSessions]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  if (statsData === undefined) {
    return (
      <div className="min-h-screen bg-[#064e3b] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
      </div>
    );
  }

  const HighlightCard = ({ title, player, statKey, statName, colorClass }: { title: string, player: any, statKey: string, statName: string, colorClass: string }) => {
    if (!player || player.sessionsPlayed === 0) return null;
    return (
      <Card className="bg-white/10 border-white/20 backdrop-blur-sm border-0 shadow-xl flex flex-col items-center p-6 text-center hover:bg-white/15 transition-all">
        <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-2">{title}</h3>
        <p className="text-2xl font-black text-white mb-1 truncate w-full">{player.name}</p>
        <p className={cn("text-3xl font-black", colorClass)}>{player[statKey]} <span className="text-sm font-medium text-white/50">{statName}</span></p>
      </Card>
    );
  };

  return (
    <main className="min-h-screen bg-[#064e3b] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black italic text-yellow-400 tracking-tighter flex items-center gap-3">
              <Trophy className="w-10 h-10" /> HALL OF RECORDS
            </h1>
            <p className="text-emerald-100/70 font-medium">All-time player statistics and rankings</p>
          </div>
          <Button 
            onClick={() => navigate('/')}
            variant="outline"
            className="bg-white/10 border-white/20 hover:bg-white/20 text-white self-start"
          >
            <ArrowLeft className="mr-2 w-4 h-4" /> Back to Game
          </Button>
        </div>

        {highlights && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <HighlightCard title="👑 Top M3allem" player={highlights.topM3allem} statKey="elM3allem" statName="Wins" colorClass="text-emerald-400" />
            <HighlightCard title="🫏 Bhim Ettawla" player={highlights.topBhim} statKey="bhimEttawla" statName="Losses" colorClass="text-red-400" />
            <HighlightCard title="🧹 Capot Master" player={highlights.topMkabbatha} statKey="mkabbatha" statName="Capots" colorClass="text-purple-400" />
            <HighlightCard title="💔 King of Hearts" player={highlights.topWakelRay} statKey="wakelRay" statName="Hearts" colorClass="text-red-500" />
          </div>
        )}

        <Card className="bg-white/10 border-white/20 backdrop-blur-sm overflow-hidden border-0 shadow-2xl">
          <CardHeader className="bg-black/20 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
            <CardTitle className="text-white flex items-center gap-2 text-xl">
              Leaderboard
            </CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search player..."
                  className="bg-black/20 border-white/10 text-white pl-9 w-full focus-visible:ring-emerald-500 placeholder:text-white/40"
                />
              </div>
              <Select value={minSessions} onValueChange={setMinSessions}>
                <SelectTrigger className="w-[140px] bg-black/20 border-white/10 text-white focus:ring-emerald-500">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-white/50" />
                    <SelectValue placeholder="Games" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-[#064e3b] border-white/20 text-white">
                  <SelectItem value="0" className="hover:bg-white/10 focus:bg-white/10">All players</SelectItem>
                  <SelectItem value="5" className="hover:bg-white/10 focus:bg-white/10">Min 5 games</SelectItem>
                  <SelectItem value="10" className="hover:bg-white/10 focus:bg-white/10">Min 10 games</SelectItem>
                  <SelectItem value="20" className="hover:bg-white/10 focus:bg-white/10">Min 20 games</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-emerald-100 font-bold cursor-pointer whitespace-nowrap" onClick={() => requestSort('name')}>
                    <div className="flex items-center gap-1">
                      Name {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('sessionsPlayed')}>
                    <div className="flex items-center justify-center gap-1">
                      Games {sortConfig?.key === 'sessionsPlayed' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('avgScore')}>
                    <div className="flex items-center justify-center gap-1">
                      Avg Score {sortConfig?.key === 'avgScore' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('elM3allem')}>
                    <div className="flex items-center justify-center gap-1">
                      EL M3allem 👑 {sortConfig?.key === 'elM3allem' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('bhimEttawla')}>
                    <div className="flex items-center justify-center gap-1">
                      Bhim Ettawla 🫏 {sortConfig?.key === 'bhimEttawla' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('mkabbatha')}>
                    <div className="flex items-center justify-center gap-1">
                      Mkabbatha 🧹 {sortConfig?.key === 'mkabbatha' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('wakelRay')}>
                    <div className="flex items-center justify-center gap-1">
                      Wakel Ray 💔 {sortConfig?.key === 'wakelRay' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="text-emerald-100 font-bold text-center cursor-pointer whitespace-nowrap" onClick={() => requestSort('elMrabba3')}>
                    <div className="flex items-center justify-center gap-1">
                      EL Mrabba3 ♦️ {sortConfig?.key === 'elMrabba3' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPlayers.map((player, idx) => {
                  const avgScore = player.sessionsPlayed > 0 ? Math.round(player.totalScore / player.sessionsPlayed) : 0;
                  return (
                    <TableRow key={player.name} className={cn("border-white/5 hover:bg-white/5", idx === 0 && "bg-yellow-500/5")}>
                      <TableCell className="font-bold text-white">{player.name}</TableCell>
                      <TableCell className="text-center font-medium text-emerald-100">{player.sessionsPlayed}</TableCell>
                      <TableCell className="text-center font-black text-yellow-400">{avgScore}</TableCell>
                      <TableCell className="text-center font-bold text-emerald-400">{player.elM3allem}</TableCell>
                      <TableCell className="text-center font-bold text-red-400">{player.bhimEttawla}</TableCell>
                      <TableCell className="text-center font-bold text-purple-400">{player.mkabbatha}</TableCell>
                      <TableCell className="text-center font-bold text-red-500">{player.wakelRay}</TableCell>
                      <TableCell className="text-center font-bold text-blue-400">{player.elMrabba3}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredAndSortedPlayers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-emerald-100/50">
                      No records found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
