import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
async function highlightly(path) {
  if (!HIGHLIGHTLY_KEY) {
    throw new Error("Highlightly API key is missing.");
  }

  const response = await fetch(`${HIGHLIGHTLY_BASE}${path}`, {
    headers: {
      "x-rapidapi-key": HIGHLIGHTLY_KEY
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Highlightly error: ${response.status}`);
  }

  return data;
}
app.use(express.json());
app.use(express.static("public"));

const KEY = process.env.API_FOOTBALL_KEY;
const HIGHLIGHTLY_KEY = process.env.HIGHLIGHTLY_API_KEY;
const HIGHLIGHTLY_BASE = "https://soccer.highlightly.net";
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

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    configured: !!HIGHLIGHTLY_KEY,
    provider: "Highlightly",
    highlightlyConfigured: !!HIGHLIGHTLY_KEY,
    apiFootballConfigured: !!KEY
  });
});
app.get("/api/highlightly-test", async (req, res) => {
  try {
    const key = process.env.HIGHLIGHTLY_API_KEY;
    if (!key) throw new Error("Highlightly API key is missing.");

    const response = await fetch(
     "https://soccer.highlightly.net/events/1403751665",
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
app.get("/api/highlightly-team-test", async (req, res) => {
  try {
    const name = req.query.name || "Orlando Pirates";

    const body = await highlightly(
      `/teams?name=${encodeURIComponent(name)}&type=club`
    );

    const results = Array.isArray(body) ? body : (body.data ?? []);

    res.json({
      ok: true,
      provider: "Highlightly",
      search: name,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
app.get("/api/highlightly-form-test", async (req, res) => {
  try {
    const teamId = req.query.teamId || "2298484";

    const body = await highlightly(
      `/last-five-games?teamId=${encodeURIComponent(teamId)}`
    );

    const results = Array.isArray(body) ? body : (body.data ?? []);

    res.json({
      ok: true,
      provider: "Highlightly",
      teamId,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
app.get("/api/highlightly-match-test", async (req, res) => {
  try {
    const matchId = req.query.matchId || "1402591752";

    const body = await highlightly(`/matches/${matchId}`);

    res.json({
      ok: true,
      provider: "Highlightly",
      matchId,
      result: body
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
app.get("/api/highlightly-h2h-test", async (req, res) => {
  try {
    const teamIdOne = req.query.teamIdOne || "2298484";
    const teamIdTwo = req.query.teamIdTwo || "13222771";

    const body = await highlightly(
      `/head-2-head?teamIdOne=${encodeURIComponent(teamIdOne)}&teamIdTwo=${encodeURIComponent(teamIdTwo)}`
    );

    const results = Array.isArray(body) ? body : (body.data ?? []);

    res.json({
      ok: true,
      provider: "Highlightly",
      teamIdOne,
      teamIdTwo,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
app.get("/api/highlightly-statistics-test", async (req, res) => {
  try {
    const matchId = req.query.matchId || "1402591752";

    const body = await highlightly(`/statistics/${matchId}`);

    const results = Array.isArray(body) ? body : (body.data ?? []);

    res.json({
      ok: true,
      provider: "Highlightly",
      matchId,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.get("/api/highlightly-leagues-test", async (req, res) => {
  try {
    const country = req.query.country || "South Africa";

    const body = await highlightly(
      `/leagues?countryName=${encodeURIComponent(country)}`
    );

    const results = Array.isArray(body) ? body : (body.data ?? []);

    res.json({
      ok: true,
      provider: "Highlightly",
      country,
      count: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.get("/api/leagues", async (req, res) => {
  try {
    const search = String(req.query.search || "").toLowerCase();
    const cacheKey = "highlightlyLeagueCatalog";

    if (
      !globalThis[cacheKey] ||
      Date.now() - globalThis[cacheKey].at > 12 * 60 * 60 * 1000
    ) {
      let offset = 0;
      let total = 1;
      const all = [];

      // Limit requests to protect the BASIC daily quota.
      do {
        const body = await highlightly(
          `/leagues?limit=100&offset=${offset}`
        );

        const leagues = Array.isArray(body)
          ? body
          : (body.data ?? []);

        all.push(...leagues);

        total = Number(body.pagination?.totalCount || all.length);
        offset += 100;
      } while (offset < total && offset < 500);

      globalThis[cacheKey] = {
        at: Date.now(),
        data: all
      };
    }

    const list = globalThis[cacheKey].data
      .filter(x =>
        !search ||
        `${x.name} ${x.country?.name} Football`
          .toLowerCase()
          .includes(search)
      )
      .map(x => ({
        id: x.id,
        name: x.name,
        country: x.country?.name,
        type: "Football",
        season:
          x.seasons?.find(s => s.season === currentSeason())?.season ||
          x.seasons?.[0]?.season ||
          currentSeason(),
        logo: x.logo
      }))
      .filter(x => x.id && x.name);

    res.json({
      provider: "Highlightly",
      leagues: list,
      count: list.length
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});


async function cached(path, ttl = 60 * 60 * 1000) {
  const key = "hl_" + path;
  const saved = globalThis[key];

  if (saved && Date.now() - saved.at < ttl) {
    return saved.data;
  }

  const data = await highlightly(path);

  globalThis[key] = {
    at: Date.now(),
    data
  };

  return data;
}
app.post("/api/analyse", async (req, res) => {
  try {
    const { home, away, leagueId, season } = req.body || {};

    if (!home || !away || !leagueId) {
      return res.status(400).json({
        error: "Home team, away team and league are required."
      });
    }

    
    function rows(body) {
      if (Array.isArray(body)) return body;
      if (Array.isArray(body?.data)) return body.data;
      return [];
    }

    // Search for both teams.
    const [homeBody, awayBody] = await Promise.all([
      cached(`/teams?name=${enc(home)}&type=club`, 12 * 60 * 60 * 1000),
      cached(`/teams?name=${enc(away)}&type=club`, 12 * 60 * 60 * 1000)
    ]);

    function findTeam(body, name) {
      const teams = rows(body);
      return teams.find(t =>
        String(t.name || "").toLowerCase() === name.toLowerCase()
      ) || teams[0];
    }

    const ht = findTeam(homeBody, home);
    const at = findTeam(awayBody, away);

    if (!ht?.id || !at?.id) {
      throw new Error(
        "Could not identify both teams. Check their spelling."
      );
    }

    const hid = ht.id;
    const aid = at.id;

    // Retrieve recent form and head-to-head records.
    const [homeForm, awayForm, h2hBody] = await Promise.all([
      cached(`/last-five-games?teamId=${hid}`, 30 * 60 * 1000),
      cached(`/last-five-games?teamId=${aid}`, 30 * 60 * 1000),
      cached(
        `/head-2-head?teamIdOne=${hid}&teamIdTwo=${aid}`,
        6 * 60 * 60 * 1000
      )
    ]);

    // Highlightly provides the score as a string, e.g. "2 - 1".
    function getScore(match) {
      const value = match.state?.score?.current;

      if (typeof value === "string") {
        const found = value.match(/(\d+)\s*[-–:]\s*(\d+)/);
        if (found) {
          return {
            home: Number(found[1]),
            away: Number(found[2])
          };
        }
      }

      return null;
    }

    function summarize(body, teamId) {
      const matches = rows(body);
      const fixtures = [];

      let gf = 0;
      let ga = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;

      for (const match of matches) {
        const score = getScore(match);
        if (!score) continue;

        const homeId = String(match.homeTeam?.id);
        const awayId = String(match.awayTeam?.id);
        const id = String(teamId);

        let scored, conceded;

        if (homeId === id) {
          scored = score.home;
          conceded = score.away;
        } else if (awayId === id) {
          scored = score.away;
          conceded = score.home;
        } else {
          continue;
        }

        gf += scored;
        ga += conceded;

        if (scored > conceded) wins++;
        else if (scored === conceded) draws++;
        else losses++;

        fixtures.push({
          date: match.date,
          home: match.homeTeam?.name,
          away: match.awayTeam?.name,
          score: `${score.home}-${score.away}`
        });
      }

      const played = fixtures.length;

      return {
        played,
        gf: played ? gf / played : 1.2,
        ga: played ? ga / played : 1.2,
        wins,
        draws,
        losses,
        fixtures
      };
    }

    const hs = summarize(homeForm, hid);
    const as = summarize(awayForm, aid);

    if (!hs.played || !as.played) {
      throw new Error(
        "Insufficient recent match data for one or both teams."
      );
    }

    // Baseline goal expectation using recent form.
    const lambdaH = Math.max(
      0.15,
      Math.min(4.5, (hs.gf + as.ga) / 2)
    );

    const lambdaA = Math.max(
      0.15,
      Math.min(4.5, (as.gf + hs.ga) / 2)
    );

    // Independent Poisson probability model.
    function poisson(k, lambda) {
      let factorial = 1;

      for (let n = 2; n <= k; n++) {
        factorial *= n;
      }

      return Math.exp(-lambda) *
        Math.pow(lambda, k) / factorial;
    }

    let p1 = 0;
    let px = 0;
    let p2 = 0;
    const scores = [];

    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const probability =
          poisson(i, lambdaH) * poisson(j, lambdaA);

        scores.push({
          score: `${i}-${j}`,
          p: probability
        });

        if (i > j) p1 += probability;
        else if (i === j) px += probability;
        else p2 += probability;
      }
    }

    const total = p1 + px + p2;

    p1 /= total;
    px /= total;
    p2 /= total;

    const outcomes = [
      { pick: "1", name: ht.name, p: p1 },
      { pick: "X", name: "Draw", p: px },
      { pick: "2", name: at.name, p: p2 }
    ].sort((a, b) => b.p - a.p);

    // Head-to-head history.
    const h2hRows = rows(h2hBody)
      .map(match => {
        const score = getScore(match);
        if (!score) return null;

        return {
          date: match.date,
          home: match.homeTeam?.name,
          away: match.awayTeam?.name,
          score: `${score.home}-${score.away}`
        };
      })
      .filter(Boolean);

    res.json({
      provider: "Highlightly",
      retrievedAt: new Date().toISOString(),
      season: Number(season) || currentSeason(),

      fixture: null,

      teams: {
        home: ht.name,
        away: at.name
      },

      recent: {
        home: hs,
        away: as
      },

      h2h: h2hRows,

      injuries: {
        home: [],
        away: []
      },

      model: {
        lambdaHome: lambdaH,
        lambdaAway: lambdaA,

        probabilities: {
          home: p1,
          draw: px,
          away: p2
        },

        pick: outcomes[0],

        scores: scores
          .sort((a, b) => b.p - a.p)
          .slice(0, 8)
      },

      notes: [
        "Data provider: Highlightly.",
        "Recent form uses the latest five available matches.",
        "The prediction uses a baseline independent-Poisson model.",
        "Recent form is not adjusted for opponent strength, confirmed lineups or tactical changes.",
        "Upcoming fixture details and injury information are not yet integrated.",
        "Probabilities are estimates, not guarantees."
      ]
    });

  } catch (e) {
    console.error("Highlightly analysis error:", e);

    res.status(502).json({
      error: e.message
    });
  }
});

// ==========================================
// MATCH INTELLIGENCE AI
// PREDICTION INTELLIGENCE ENGINE v1.0
// ==========================================

app.post("/api/predictions", async (req, res) => {
  try {
    const { home, away, leagueId, season } = req.body || {};

    if (!home || !away || !leagueId) {
      return res.status(400).json({
        ok: false,
        error: "Home team, away team and league are required."
      });
    }

    const getRows = body =>
      Array.isArray(body) ? body :
      Array.isArray(body?.data) ? body.data : [];

    const getScore = match => {
      const value = match.state?.score?.current;

      if (typeof value !== "string") return null;

      const found = value.match(/(\d+)\s*[-–:]\s*(\d+)/);

      return found ? {
        home: Number(found[1]),
        away: Number(found[2])
      } : null;
    };

    // Identify both teams.
    const [homeBody, awayBody] = await Promise.all([
      cached(`/teams?name=${enc(home)}&type=club`, 12 * 60 * 60 * 1000),
      cached(`/teams?name=${enc(away)}&type=club`, 12 * 60 * 60 * 1000)
    ]);

    function findTeam(body, name) {
      const teams = getRows(body);

      return teams.find(t =>
        String(t.name || "").toLowerCase() ===
        String(name).toLowerCase()
      ) || teams[0];
    }

    const homeTeam = findTeam(homeBody, home);
    const awayTeam = findTeam(awayBody, away);

    if (!homeTeam?.id || !awayTeam?.id) {
      throw new Error("Could not identify both teams.");
    }

    if (String(homeTeam.id) === String(awayTeam.id)) {
      throw new Error("Home and away teams cannot be identical.");
    }

    // Retrieve recent matches.
    const [homeBodyForm, awayBodyForm] = await Promise.all([
      cached(`/last-five-games?teamId=${homeTeam.id}`, 30 * 60 * 1000),
      cached(`/last-five-games?teamId=${awayTeam.id}`, 30 * 60 * 1000)
    ]);

    function summarize(body, teamId) {
      const matches = getRows(body);

      let gf = 0;
      let ga = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;

      const fixtures = [];

      for (const match of matches) {
        const score = getScore(match);
        if (!score) continue;

        const hid = String(match.homeTeam?.id);
        const aid = String(match.awayTeam?.id);

        let scored, conceded;

        if (hid === String(teamId)) {
          scored = score.home;
          conceded = score.away;
        } else if (aid === String(teamId)) {
          scored = score.away;
          conceded = score.home;
        } else {
          continue;
        }

        gf += scored;
        ga += conceded;

        const result =
          scored > conceded ? "W" :
          scored === conceded ? "D" : "L";

        if (result === "W") wins++;
        else if (result === "D") draws++;
        else losses++;

        fixtures.push({
          date: match.date,
          home: match.homeTeam?.name,
          away: match.awayTeam?.name,
          score: `${score.home}-${score.away}`,
          result
        });
      }

      const played = fixtures.length;

      return {
        played,
        goalsScored: gf,
        goalsConceded: ga,
        averageScored: played ? gf / played : 0,
        averageConceded: played ? ga / played : 0,
        wins,
        draws,
        losses,
        fixtures
      };
    }

    const homeForm = summarize(homeBodyForm, homeTeam.id);
    const awayForm = summarize(awayBodyForm, awayTeam.id);

    if (!homeForm.played || !awayForm.played) {
      throw new Error("Insufficient completed match data.");
    }

    // Expected goals.
    const lambdaHome = Math.max(
      0.15,
      Math.min(5,
        (homeForm.averageScored +
         awayForm.averageConceded) / 2
      )
    );

    const lambdaAway = Math.max(
      0.15,
      Math.min(5,
        (awayForm.averageScored +
         homeForm.averageConceded) / 2
      )
    );

    // Poisson distribution.
    function poisson(k, lambda) {
      let factorial = 1;

      for (let n = 2; n <= k; n++) {
        factorial *= n;
      }

      return Math.exp(-lambda) *
        Math.pow(lambda, k) / factorial;
    }

    // Build probability matrix.
    const matrix = [];
    let matrixTotal = 0;

    for (let h = 0; h <= 12; h++) {
      for (let a = 0; a <= 12; a++) {
        const probability =
          poisson(h, lambdaHome) *
          poisson(a, lambdaAway);

        matrix.push({ h, a, p: probability });
        matrixTotal += probability;
      }
    }

    // Normalize probabilities.
    for (const item of matrix) {
      item.p /= matrixTotal;
    }

    const round = value =>
      Number((value * 100).toFixed(2));

    const probability = condition =>
      matrix.reduce(
        (sum, item) =>
          sum + (condition(item.h, item.a) ? item.p : 0),
        0
      );

    // Core outcomes.
    const homeWin = probability((h, a) => h > a);
    const draw = probability((h, a) => h === a);
    const awayWin = probability((h, a) => h < a);

    // Goal markets.
    const goalLines = [0.5, 1.5, 2.5, 3.5, 4.5];

    const overUnder = goalLines.map(line => ({
      line,
      over: round(probability((h, a) => h + a > line)),
      under: round(probability((h, a) => h + a < line))
    }));

    // Both teams to score.
    const bttsYes = probability((h, a) => h > 0 && a > 0);
    const bttsNo = 1 - bttsYes;

    // Team goal totals.
    function teamTotals(isHome) {
      return goalLines.map(line => ({
        line,
        over: round(probability((h, a) =>
          (isHome ? h : a) > line
        )),
        under: round(probability((h, a) =>
          (isHome ? h : a) < line
        ))
      }));
    }

    // Double chance.
    const doubleChance = {
      "1X": round(homeWin + draw),
      "X2": round(draw + awayWin),
      "12": round(homeWin + awayWin)
    };

    // Draw No Bet.
    const dnb = {
      home: {
        win: round(homeWin),
        push: round(draw),
        lose: round(awayWin),
        conditionalWinProbability:
          round(homeWin / (homeWin + awayWin))
      },
      away: {
        win: round(awayWin),
        push: round(draw),
        lose: round(homeWin),
        conditionalWinProbability:
          round(awayWin / (homeWin + awayWin))
      }
    };

    // European handicap.
    function europeanHandicap(homeHandicap) {
      const adjustedHome = probability((h, a) =>
        h + homeHandicap > a
      );

      const adjustedDraw = probability((h, a) =>
        h + homeHandicap === a
      );

      const adjustedAway = probability((h, a) =>
        h + homeHandicap < a
      );

      return {
        home: round(adjustedHome),
        draw: round(adjustedDraw),
        away: round(adjustedAway)
      };
    }

    const europeanHandicaps = [-2, -1, 1, 2].map(line => ({
      homeHandicap: line,
      probabilities: europeanHandicap(line)
    }));

    // Asian half-goal handicaps.
    function asianHalfHandicap(line) {
      return {
        homeWin: round(probability((h, a) =>
          h + line > a
        )),
        push: round(probability((h, a) =>
          h + line === a
        )),
        awayWin: round(probability((h, a) =>
          h + line < a
        ))
      };
    }

    const asianHandicaps = [-1.5, -0.5, 0.5, 1.5].map(line => ({
      homeHandicap: line,
      probabilities: asianHalfHandicap(line)
    }));

    // Correct scores.
    const correctScores = matrix
      .map(item => ({
        score: `${item.h}-${item.a}`,
        probability: round(item.p)
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 12);

    // Winning margins.
    const winningMargins = {
      homeBy2OrMore: round(
        probability((h, a) => h - a >= 2)
      ),
      homeByExactly1: round(
        probability((h, a) => h - a === 1)
      ),
      draw: round(draw),
      awayByExactly1: round(
        probability((h, a) => a - h === 1)
      ),
      awayBy2OrMore: round(
        probability((h, a) => a - h >= 2)
      )
    };

    // Clean sheets.
    const cleanSheets = {
      home: round(probability((h, a) => a === 0)),
      away: round(probability((h, a) => h === 0))
    };

    // Highest-probability 1X2 selection.
    const outcomes = [
      { selection: "Home", probability: round(homeWin) },
      { selection: "Draw", probability: round(draw) },
      { selection: "Away", probability: round(awayWin) }
    ].sort((a, b) => b.probability - a.probability);

    const warnings = [
      "This is a statistical projection, not a guaranteed result.",
      "Recent form uses the latest available five completed matches.",
      "The selected league is not yet used to filter historical team matches.",
      "No opponent-strength adjustment or confirmed home advantage is applied.",
      "Half-time, cards, corners, shots and player markets require additional data.",
      "Correct-score probabilities are calculated from the same goal model."
    ];

    if (homeForm.played < 5 || awayForm.played < 5) {
      warnings.push("One or both teams have fewer than five usable matches.");
    }

    res.json({
      ok: true,
      provider: "Highlightly",
      engine: "Match Intelligence AI Poisson v1.0",
      retrievedAt: new Date().toISOString(),

      fixture: {
        home: homeTeam.name,
        away: awayTeam.name,
        leagueId,
        season: Number(season) || currentSeason()
      },

      teams: {
        home: {
          id: homeTeam.id,
          name: homeTeam.name,
          logo: homeTeam.logo || null,
          form: homeForm
        },
        away: {
          id: awayTeam.id,
          name: awayTeam.name,
          logo: awayTeam.logo || null,
          form: awayForm
        }
      },

      model: {
        method: "Independent Poisson",
        expectedGoals: {
          home: Number(lambdaHome.toFixed(3)),
          away: Number(lambdaAway.toFixed(3))
        },
        outcomes: {
          home: round(homeWin),
          draw: round(draw),
          away: round(awayWin)
        },
        topOutcome: outcomes[0]
      },

      markets: {
        coreOutcomes: {
          oneXtwo: {
            home: round(homeWin),
            draw: round(draw),
            away: round(awayWin)
          },
          doubleChance,
          drawNoBet: dnb,
          europeanHandicaps,
          asianHandicaps
        },

        goals: {
          overUnder,
          bothTeamsToScore: {
            yes: round(bttsYes),
            no: round(bttsNo)
          },
          correctScores,
          homeTeamTotals: teamTotals(true),
          awayTeamTotals: teamTotals(false),
          cleanSheets,
          winningMargins
        },

        halfAndIntervals: {
          available: false,
          reason: "Half-time and event-timing data are not integrated."
        },

        disciplinary: {
          available: false,
          reason: "Reliable card and booking statistics are not integrated."
        },

        matchEvents: {
          available: false,
          reason: "Corner, shot, foul and penalty statistics are not integrated."
        },

        playerProps: {
          available: false,
          reason: "Player-level statistics and confirmed lineups are not integrated."
        }
      },

      warnings
    });

  } catch (error) {
    console.error("Prediction engine error:", error);

    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});

// ==========================================
// END PREDICTION INTELLIGENCE ENGINE v1.0
// ==========================================

app.get("/api/team-form", async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();

    if (!name) {
      return res.status(400).json({
        error: "Please provide a team name."
      });
    }

    // Search Highlightly for the requested team.
    const teamBody = await cached(
      `/teams?name=${enc(name)}&type=club`,
      12 * 60 * 60 * 1000
    );

    const teams = Array.isArray(teamBody)
      ? teamBody
      : (teamBody.data || []);

    const team = teams.find(t =>
      String(t.name || "").toLowerCase() === name.toLowerCase()
    ) || teams[0];

    if (!team?.id) {
      return res.status(404).json({
        error: "Team not found. Check the spelling."
      });
    }

    // Retrieve the team's latest five matches.
    const body = await cached(
      `/last-five-games?teamId=${team.id}`,
      30 * 60 * 1000
    );

    const matches = Array.isArray(body)
      ? body
      : (body.data || []);

    let gf = 0;
    let ga = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    const fixtures = [];

    for (const match of matches) {
      const value = match.state?.score?.current;

      if (typeof value !== "string") continue;

      const score = value.match(/(\d+)\s*[-–:]\s*(\d+)/);
      if (!score) continue;

      const homeGoals = Number(score[1]);
      const awayGoals = Number(score[2]);

      const homeId = String(match.homeTeam?.id);
      const awayId = String(match.awayTeam?.id);
      const teamId = String(team.id);

      let scored, conceded;

      if (homeId === teamId) {
        scored = homeGoals;
        conceded = awayGoals;
      } else if (awayId === teamId) {
        scored = awayGoals;
        conceded = homeGoals;
      } else {
        continue;
      }

      gf += scored;
      ga += conceded;

      const result =
        scored > conceded ? "W" :
        scored === conceded ? "D" : "L";

      if (result === "W") wins++;
      else if (result === "D") draws++;
      else losses++;

      fixtures.push({
        date: match.date,
        home: match.homeTeam?.name,
        away: match.awayTeam?.name,
        score: `${homeGoals}-${awayGoals}`,
        result
      });
    }

    const played = fixtures.length;

    if (!played) {
      return res.status(404).json({
        error: "No completed recent matches were found for this team."
      });
    }

    res.json({
      ok: true,
      provider: "Highlightly",
      team: {
        id: team.id,
        name: team.name,
        logo: team.logo || null
      },
      statistics: {
        played,
        wins,
        draws,
        losses,
        goalsScored: gf,
        goalsConceded: ga,
        averageScored: Number((gf / played).toFixed(2)),
        averageConceded: Number((ga / played).toFixed(2))
      },
      fixtures
    });

  } catch (e) {
    res.status(502).json({
      error: e.message
    });
  }
});

app.listen(PORT,()=>console.log(`Match Intelligence AI running at http://localhost:${PORT}`));
