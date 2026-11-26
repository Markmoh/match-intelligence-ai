import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("public"));

const KEY = process.env.API_FOOTBALL_KEY;
const BASE = "https://v3.football.api-sports.io";
const PORT = process.env.PORT || 3000;

async function api(path) {
  if (!KEY) throw new Error("API_FOOTBALL_KEY is missing. Add your API key to the .env file.");
  const r = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
  if (!r.ok) throw new Error(`Football data provider returned HTTP ${r.status}`);
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) throw new Error(JSON.stringify(j.errors));
  return j;
}
const enc = encodeURIComponent;
const currentSeason = () => {
  const d = new Date();
  return d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear();
};
const arr = x => Array.isArray(x) ? x : [];
const avg = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;

app.get("/api/health", (_req,res) => res.json({ok:true, configured:!!KEY, provider:"API-Football"}));
app.get("/api/highlightly-test", async (req, res) => {
  try {
    const key = process.env.HIGHLIGHTLY_API_KEY;
    if (!key) throw new Error("Highlightly API key is missing.");

    const response = await fetch(
     "https://soccer.highlightly.net/statistics/1361925015",
      { headers: { "x-rapidapi-key": key } }
    );

    const body = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: "Highlightly",
        error: body
      });
    }

    const results = Array.isArray(body) ? body : (body.data ?? []);

res.json({
  ok: true,
  provider: "Highlightly",
  count: results.length,
  results: results,
  pagination: body.pagination ?? null,
  plan: body.plan ?? null
});
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/leagues", async (req,res) => {
  try {
    const search = String(req.query.search || "").toLowerCase();
    const cacheKey = "leagueCatalog";
    if (!globalThis[cacheKey] || Date.now()-globalThis[cacheKey].at > 12*60*60*1000) {
      const j = await api(`/leagues?current=true`);
const all = arr(j.response);
globalThis[cacheKey] = {at:Date.now(), data:all};
      do {
        const j = await api(`/leagues?current=true&page=${page}`);
        all.push(...arr(j.response));
        total = Number(j.paging?.total || 1);
        page++;
      } while (page <= total && page <= 100);
      globalThis[cacheKey] = {at:Date.now(), data:all};
    }
    const list = globalThis[cacheKey].data
      .filter(x => !search || `${x.league?.name} ${x.country?.name} ${x.league?.type}`.toLowerCase().includes(search))
      .map(x => ({id:x.league?.id, name:x.league?.name, country:x.country?.name, type:x.league?.type, season:x.seasons?.find(s=>s.current)?.year || currentSeason(), logo:x.league?.logo}))
      .filter(x=>x.id && x.name);
    res.json({leagues:list, count:list.length});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.post("/api/analyse", async (req,res) => {
  try {
    const {home, away, leagueId, season} = req.body || {};
    if (!home || !away || !leagueId) return res.status(400).json({error:"Home team, away team and league are required."});
    const yr = Number(season) || currentSeason();
    const league = Number(leagueId);
    const [homeSearch, awaySearch] = await Promise.all([
      api(`/teams?search=${enc(home)}&league=${league}&season=${yr}`),
      api(`/teams?search=${enc(away)}&league=${league}&season=${yr}`)
    ]);
    const pick = (data, name) => {
      const teams = arr(data.response);
      return teams.find(t=>t.team?.name?.toLowerCase()===name.toLowerCase()) || teams[0];
    };
    const ht = pick(homeSearch, home), at = pick(awaySearch, away);
    if (!ht?.team?.id || !at?.team?.id) throw new Error("Could not match both team names in the selected league/season. Check spelling or choose the correct competition.");
    const hid=ht.team.id, aid=at.team.id;
    const [hfx,afx,h2h,hstats,astats,hinj,ainj] = await Promise.all([
      api(`/fixtures?team=${hid}&last=10&season=${yr}`),
      api(`/fixtures?team=${aid}&last=10&season=${yr}`),
      api(`/fixtures/headtohead?h2h=${hid}-${aid}&last=10`),
      api(`/teams/statistics?league=${league}&season=${yr}&team=${hid}`),
      api(`/teams/statistics?league=${league}&season=${yr}&team=${aid}`),
      api(`/injuries?team=${hid}&season=${yr}`),
      api(`/injuries?team=${aid}&season=${yr}`)
    ]);
    const finished = data => arr(data.response).filter(f=>["FT","AET","PEN"].includes(f.fixture?.status?.short));
    const summarize = (data, teamId) => {
      const fs=finished(data);
      let gf=[],ga=[],wins=0,draws=0,losses=0;
      for(const f of fs){
        const isHome=f.teams?.home?.id===teamId;
        const scored=Number(isHome?f.goals?.home:f.goals?.away);
        const conceded=Number(isHome?f.goals?.away:f.goals?.home);
        if(!Number.isFinite(scored)||!Number.isFinite(conceded)) continue;
        gf.push(scored);ga.push(conceded);
        if(scored>conceded)wins++;else if(scored===conceded)draws++;else losses++;
      }
      return {played:gf.length, gf:avg(gf), ga:avg(ga), wins,draws,losses, fixtures:fs.slice(0,10).map(f=>({date:f.fixture?.date,home:f.teams?.home?.name,away:f.teams?.away?.name,score:`${f.goals?.home}-${f.goals?.away}`}))};
    };
    const hs=summarize(hfx,hid), as=summarize(afx,aid);
    const statVal = (d,path) => path.split(".").reduce((o,k)=>o?.[k],d.response);
    const hHomeFor=Number(statVal(hstats,"goals.for.average.home"));
    const aAwayFor=Number(statVal(astats,"goals.for.average.away"));
    const hHomeAgainst=Number(statVal(hstats,"goals.against.average.home"));
    const aAwayAgainst=Number(statVal(astats,"goals.against.average.away"));
    const hAttack=Number.isFinite(hHomeFor)&&hHomeFor>0?hHomeFor:hs.gf;
    const aAttack=Number.isFinite(aAwayFor)&&aAwayFor>0?aAwayFor:as.gf;
    const hConcede=Number.isFinite(hHomeAgainst)&&hHomeAgainst>0?hHomeAgainst:hs.ga;
    const aConcede=Number.isFinite(aAwayAgainst)&&aAwayAgainst>0?aAwayAgainst:as.ga;
    const lambdaH=(hAttack+aConcede)/2;
    const lambdaA=(aAttack+hConcede)/2;
    const poisson=(k,l)=>Math.exp(-l)*Math.pow(l,k)/[1,1,2,6,24,120,720,5040,40320,362880,3628800][k];
    let p1=0,px=0,p2=0,scores=[];
    for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=poisson(i,lambdaH)*poisson(j,lambdaA);scores.push({score:`${i}-${j}`,p});if(i>j)p1+=p;else if(i===j)px+=p;else p2+=p;}
    const norm=p1+px+p2; p1/=norm;px/=norm;p2/=norm;
    const outcomes=[{pick:"1",name:ht.team.name,p:p1},{pick:"X",name:"Draw",p:px},{pick:"2",name:at.team.name,p:p2}].sort((a,b)=>b.p-a.p);
    const upcoming=arr((await api(`/fixtures?team=${hid}&next=10&season=${yr}`)).response);
    const next=upcoming.find(f=>[f.teams?.home?.id,f.teams?.away?.id].includes(aid) && f.league?.id===league);
    const h2hRows=finished(h2h).map(f=>({date:f.fixture?.date,home:f.teams?.home?.name,away:f.teams?.away?.name,score:`${f.goals?.home}-${f.goals?.away}`}));
    res.json({
      provider:"API-Football", retrievedAt:new Date().toISOString(), season:yr,
      fixture: next ? {date:next.fixture?.date, status:next.fixture?.status?.long, venue:next.fixture?.venue?.name} : null,
      teams:{home:ht.team.name,away:at.team.name},
      recent:{home:hs,away:as}, h2h:h2hRows,
      injuries:{home:arr(hinj.response).map(x=>({player:x.player?.name,type:x.player?.type,reason:x.player?.reason})),away:arr(ainj.response).map(x=>({player:x.player?.name,type:x.player?.type,reason:x.player?.reason}))},
      model:{lambdaHome:lambdaH,lambdaAway:lambdaA,probabilities:{home:p1,draw:px,away:p2},pick:outcomes[0],scores:scores.sort((a,b)=>b.p-a.p).slice(0,8)},
      notes:["Baseline independent-Poisson estimate. Lambdas are the mean of available home/away team goal averages and recent match averages where available.","This API workflow does not independently verify manager changes, tactical systems, confirmed lineups or bookmaker prices. Those sections must be added through separate research sources before treating the report as complete.","Team statistics and injury coverage depend on competition and subscription coverage."]
    });
  } catch(e) { res.status(502).json({error:e.message}); }
});
app.listen(PORT,()=>console.log(`Match Intelligence AI running at http://localhost:${PORT}`));
