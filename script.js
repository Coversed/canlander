// script.js: how the page BEHAVES.
// Plan: (1) settings, (2) fetch the sheet, (3) turn it into tidy data, (4) draw the page, (5) react to clicks.


// ---------- 1. SETTINGS ----------
// The only things you should ever need to change are in this section.

// Your published Google Sheet (CSV format)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeTe-iIN0az5b5fHbg1PutxX6ZhPcr83r06TGpAS3wriBFHpsE_4NIXo__N0O4SBENSI0ePQJCnWP/pub?gid=0&single=true&output=csv";

// Your Apps Script address, which reads the hyperlinks behind the "Link" cells
const LINKS_API_URL = "https://script.google.com/macros/s/AKfycbxtKV8TNZT1opGsSZUSgHDVLU1Top-01sFGhl_o4B-xPdwi_4wGNhCxe8zXhB2vCvI/exec";

// The published CSV of the "decks" tab (File > Share > Publish to web > pick that tab > CSV).
// Leave it as "" to switch the Decks page off.
const DECKS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeTe-iIN0az5b5fHbg1PutxX6ZhPcr83r06TGpAS3wriBFHpsE_4NIXo__N0O4SBENSI0ePQJCnWP/pub?gid=1599000471&single=true&output=csv";

// The decks tab spells some names differently from the main sheet.
// Left: how it's written on the decks tab. Right: how it's written on the main sheet.
const NAME_ALIASES = {
  "Ani Jackson": "Ani",
  "Cherie Baker": "Cherie",
  "Daniel": "Daniel Hughes",
  "Duncan Sabin": "Dunc Sabin",
  "Ellis": "Matt Ellis",
  "JJ Pinnick": "JJ",
  "Jenny Bytheway": "Jennifer Bytheway",
  "Rory Miller": "Rory",
  "Summer": "Summer Wright"
};

// Backup Discord links, used if the script above can't be reached.
// Every address starts the same way, so we only store the unique ending of each one.
const LINK_PREFIX = "https://discord.com/channels/1312801614825787513/1312828783895511070/";
const BACKUP_LINK_IDS = [
  "1457385501769076847", "1459923877504356353", "1465001701059858564", "1467535585869692979",
  "1470070317232816305", "1472610642862149675", "1475140161577681036", "1477674974809559225",
  "1480218399454793841", "1482761787270107338", "1485283361907015840", "1487813507444510760",
  "1490346536436236588", "1492880468289388614", "1497959795334844579", "1500494213178064897",
  "1503032780588585142", "1505579024976711791", "1508194008290033714", "1510639470226047127",
  "1513182103246868683", "1515713125716987945", "1518264671851774022", "1520787838889623702",
  "1523430409021554758", "1525862113787117640", "1528396856676057149", "1530937360273903848",
  "1533471545685442600", "1538549771227111496", "1541176057997164744", "1543619974667702372",
  "1546260268894658682", "1548693419080294463", "1551228095179137065", "1556296618452451389",
  "1558844334034391041"
];

const BEST_RESULTS_COUNTED = 20;   // only each player's best 20 scores count
const MAX_SCORE = 12;              // a 4-0 night is worth 12 points
// Each player's signature card, shown beside their name.
// Type a Magic card name between the empty quotes. Leave it as "" and that player gets no picture.
// The names on the left must match the sheet exactly. For a new player, add a line in the same format.
const PLAYER_CARDS = {
  "Ember Smithers":         "Screaming Nemesis",
  "Helena Jackson":         "Elixir of Immortality",
  "Jethro Sutherland":      "Emrakul, the promised end",
  "James Ding":             "Cryptic Command",
  "George Hunt":            "Tolarian Academy",
  "Jae Austin-Loczy":       "Parallax Tide",
  "Alex Hazard":            "Protean Hulk",
  "Edward Sanderson":       "Tinker",
  "Henry Clayton":          "Fountainport",
  "Gregory Painter":        "Verdant Command",
  "Mark Punter":            "Aang, at the crossroads",
  "Hazel Shilling":         "Knight of the reliquary",
  "Hal Hewlett":            "Counterbalance",
  "Sammi Austin-Loczy":     "Ulamog, the defiler",
  "Dunc Sabin":             "Boromir, Warden of the Tower",
  "Niall Maxwell-Thompson": "Nadu, winged wisdom",
  "Kieran Drinkwater":      "Time vault",
  "Owen Davis":             "Price of progress",
  "Matt Clay":              "Black lotus",
  "Francesco Vitiello":     "Lazav, Wearer of Faces",
  "Matt Errock":            "Archon of Emeria",
  "Ben Epstein":            "Sab Sunen, luxa embodied",
  "Fuzz":                   "Urza's saga",
  "JJ":                     "Icetill explorer",
  "Arvid Briscoe":          "Channel",
  "Toni":                   "Aven Mindcensor",
  "Daniel Hughes":          "Mole man, Moloid Master",
  "Alys Lloyd":             "Flash",
  "Tom Wilkinson":          "Baleful strix",
  "Ani":                    "Kappa Cannoneer",
  "Zach Cox":               "Emperor of bones",
  "Lucy Adams":             "Shallow Grave",
  "Cass Taylor":            "Simulacrum Synthesiser",
  "Maia":                   "Pteromander",
  "Rory":                   "Conspicuous Snoop",
  "Cherie":                 "Faithful Watchdog",
  "Jess Roslind";           "Nethergoyf",
  "Ruben":                  "Teferi, hero of dominaria",
  "Aaron Rubra":            "Barrowgoyf",
  "Jennifer Bytheway":      "Ornery Tumblewagg",
  "Matt Ellis":             "Troll of Khazadum",
  "Philip":                 "Jacked Rabbit",
  "Summer Wright":          "Kumena, Tyrant of Orazca",
  "Thomas Cheslin":         "Golgari grave troll",
  "Zack Ibell":             "Faithless looting",
  "Michael Boardman":       "Simic growth chamber",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


// ---------- 2. THE PAGE'S MEMORY ----------
// "let" creates a variable, a labelled box that holds a value which can change.
let season = null;          // all the data, once it has loaded
let sortBy = "rank";        // which column the table is sorted by
let sortDirection = 1;      // 1 = lowest first, -1 = highest first
let selectedName = null;    // the player the visitor clicked on
let decks = null;           // the deck data, once it has loaded (stays null if there isn't any)
let selectedDeck = null;    // the deck the visitor clicked on
let deckSortBy = "events";  // decks start sorted by most played
let deckSortDirection = -1;


// ---------- 3. SMALL HELPERS ----------
// A shortcut: $("title") is easier to type than document.getElementById("title")
function $(id) {
  return document.getElementById(id);
}

// Removes the "Loading..." message from the page. If it's already gone, do nothing.
function hideLoading() {
  const loading = $("loading");
  if (loading) loading.remove();
}

// Makes text safe to put inside HTML (stops names containing < or " from breaking the page)
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Turns "04/01" (day/month) into "4 Jan"
function formatDate(raw) {
  const parts = String(raw ?? "").split("/");
  if (parts.length < 2) return raw;

  const month = MONTHS[Number(parts[1]) - 1];
  if (!month) return raw;

  return Number(parts[0]) + " " + month;
}


// Turns a name from the decks tab into the name used on the main sheet
function canonicalName(name) {
  return NAME_ALIASES[name] || name;
}

// 62.5 becomes "62.5%"
function percent(number) {
  return number.toFixed(1) + "%";
}

// Builds the <img> tag for a player's card, using Scryfall's free image service.
// version can be "art_crop" (just the artwork) or "normal" (the whole card).
function cardImage(playerName, version) {
  const cardName = PLAYER_CARDS[playerName];
  if (!cardName) return "";                        // no card chosen for this player

  const url = "https://api.scryfall.com/cards/named?fuzzy=" +
    encodeURIComponent(cardName) + "&format=image&version=" + version;

  // loading="lazy": wait until the image is near the screen.
  // onerror: if Scryfall can't find the card, remove the broken image.
  return `<img class="card-art" src="${url}" alt="${escapeHtml(cardName)}"
          title="${escapeHtml(cardName)}" loading="lazy" onerror="this.remove()">`;
}


// ---------- 4. LOADING THE DATA ----------

// A CSV is just text where commas separate cells and new lines separate rows.
// This reads through the text one character at a time and builds a list of rows.
// Quote marks matter: a comma inside quotes is part of the cell, not a separator.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }   // "" means a literal quote mark
      else if (char === '"') { insideQuotes = false; }
      else { cell += char; }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;                  // Windows line endings
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

// Finds a column's position by its heading, trying several possible names.
// Returns -1 if none of them is there.
function findColumn(headerRow, names) {
  return headerRow.findIndex(cell => names.includes(cell.trim().toLowerCase()));
}

// Safely reads a cell. If the column doesn't exist, or the row is short, we get "" instead of an error.
function cellAt(row, index) {
  return index >= 0 && index < row.length ? row[index] : "";
}

// Turns the raw rows into a tidy "season" object we can use everywhere else.
function buildSeason(rows) {
  // Safely read a cell, even if the row is shorter than expected.
  const cellText = (row, index) =>
    String(row?.[index] ?? "").trim();

  // Find the main player table.
  const headerIndex = rows.findIndex(
    row => cellText(row, 0) === "Rank"
  );

  if (headerIndex === -1) {
    throw new Error(
      "Couldn't find the 'Rank' row. Check the published sheet and CSV tab."
    );
  }

  const header = rows[headerIndex];

  // Find the column where weekly scores begin.
  const firstWeek = header.findIndex(
    (cell, i) => i >= 7 && String(cell ?? "").trim() === "1"
  );

  if (firstWeek === -1) {
    throw new Error(
      "Couldn't find week 1 in the header row. Check the spreadsheet columns."
    );
  }

  // Find the row containing dates such as 04/01, 11/01 and 25/01.
  // The spreadsheet does not need a "Date:" label.
  const isDate = value =>
    /^\d{1,2}\/\d{1,2}$/.test(String(value ?? "").trim());

  let dateRow = null;
  let largestDateCount = 0;

  for (const row of rows) {
    const dateCount = row.filter(isDate).length;

    if (dateCount > largestDateCount) {
      largestDateCount = dateCount;
      dateRow = row;
    }
  }

  if (!dateRow || largestDateCount === 0) {
    throw new Error(
      "Couldn't find the row containing weekly dates, such as 04/01 or 11/01."
    );
  }

  // Keep dates in their left-to-right order.
  const dates = dateRow.filter(isDate).map(
    cell => String(cell).trim()
  );

  if (dates.length === 0) {
    throw new Error("No valid weekly dates were found.");
  }

  // Player counts may be in a labelled row, or in the top row of the sheet.
  // If we cannot confidently find them, use zero rather than stopping the page.
  const countRow = rows.find(row =>
    row.some(cell =>
      /No of Players:/i.test(String(cell ?? "").trim())
    )
  );

  let playerCounts = dates.map(() => 0);

  if (countRow) {
    playerCounts = dates.map((_, i) =>
      Number(cellText(countRow, firstWeek + i)) || 0
    );
  } else {
    // The current sheet puts player-count numbers in the first row.
    // Extract the numeric cells and use them as the weekly counts.
    const titleRow = rows[0] || [];
    const numericCounts = titleRow
      .map(cell => {
        const value = String(cell ?? "").trim();
        return value !== "" && /^\d+(?:\.\d+)?$/.test(value)
          ? Number(value)
          : null;
      })
      .filter(value => value !== null);

    playerCounts = dates.map((_, i) => numericCounts[i] ?? 0);
  }

  // Read each player's row.
  const players = [];

  for (const row of rows.slice(headerIndex + 1)) {
    if (!/^\d+$/.test(cellText(row, 0))) continue;
    if (!cellText(row, 1)) continue;

    const weeks = dates.map((_, i) => {
      const cell = cellText(row, firstWeek + i);
      if (cell === "") return null;

      const score = Number(cell);
      return Number.isFinite(score) ? score : null;
    });

    players.push({
      rank: Number(cellText(row, 0)),
      name: cellText(row, 1),
      score: Number(cellText(row, 2)) || 0,
      played: Number(cellText(row, 3)) || 0,
      winRate: parseFloat(cellText(row, 4)) || 0,
      wins: Number(cellText(row, 5)) || 0,
      weeks
    });
  }

  if (players.length === 0) {
    throw new Error(
      "No players were found. Check the Rank and Player columns in the published sheet."
    );
  }

  return {
    title: cellText(rows[0], 0) || "Canlander Leaderboard",
    dates,
    playerCounts,
    players,
    links: []
  };
}

// Like findColumn, but only looks to the right of a starting column.
// The decks tab has two blocks that both have "Events Played" and "Win Rate" headings.
function findColumnFrom(headerRow, name, startIndex) {
  return headerRow.findIndex((cell, i) => i > startIndex && cell.trim().toLowerCase() === name);
}

// Turns the "Player Deck Stats" tab into two lists:
//   entries: one per player + deck (who played what, and how it went), read straight from the tab
//   summary: one per deck, which we work out by adding up everyone who played it
function buildDecks(rows) {
  const headerIndex = rows.findIndex(row => findColumn(row, ["player"]) !== -1 && findColumn(row, ["deck"]) !== -1);
  if (headerIndex === -1) throw new Error("Couldn't find the 'Player' and 'Deck' headings on the decks tab.");
  const header = rows[headerIndex];

  // Columns: Player, Deck, Events Played, Win Rate, 4/0/0 Finishes
  const col = { player: findColumn(header, ["player"]), deck: findColumn(header, ["deck"]) };
  col.events = findColumnFrom(header, "events played", col.deck);
  col.winRate = findColumnFrom(header, "win rate", col.deck);
  col.finishes = findColumnFrom(header, "4/0/0 finishes", col.deck);

  const entries = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const player = cellAt(row, col.player).trim();
    const deck = cellAt(row, col.deck).trim();
    if (!player || !deck) continue;

    entries.push({
      player: player,
      deck: deck,
      events: Number(cellAt(row, col.events)) || 0,
      winRate: parseFloat(cellAt(row, col.winRate)) || 0,
      finishes: Number(cellAt(row, col.finishes)) || 0
    });
  }

  // A "Map" is a list of labelled boxes: here, one box per deck name
  const totals = new Map();
  for (const entry of entries) {
    if (!totals.has(entry.deck)) {
      totals.set(entry.deck, { name: entry.deck, events: 0, wins: 0, winPoints: 0, pilots: new Set() });
    }
    const deck = totals.get(entry.deck);
    deck.events += entry.events;
    deck.wins += entry.finishes;
    deck.winPoints += entry.winRate * entry.events;      // win rate counts for more when they played more events
    deck.pilots.add(canonicalName(entry.player));
  }

  const summary = [];
  for (const deck of totals.values()) {
    summary.push({
      name: deck.name,
      events: deck.events,
      wins: deck.wins,
      winRate: deck.events > 0 ? deck.winPoints / deck.events : 0,
      players: deck.pilots.size
    });
  }
  return { entries, summary };
}

// Fetches the decks tab. If anything goes wrong we return null, and the site simply has no Decks tab.
async function loadDecks() {
  if (!DECKS_CSV_URL || !$("decks-view")) return null;   // no link, or an older index.html: skip decks
  try {
    const response = await fetch(DECKS_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("error " + response.status);
    return buildDecks(parseCsv(await response.text()));
  } catch (error) {
    console.warn("Couldn't load the decks tab.", error);
    return null;
  }
}

// Our saved list of links: one per week, available instantly.
function backupLinks(weekCount) {
  return BACKUP_LINK_IDS.slice(0, weekCount).map(id => LINK_PREFIX + id);
}

// Asks the Apps Script for the latest links. Returns a list, or null if it couldn't.
// "async/await" means "go and fetch this, and wait for the answer before carrying on".
// This can take a few seconds, so the page doesn't wait for it (see start() below).
async function fetchScriptLinks(weekCount) {
  try {
    const response = await fetch(LINKS_API_URL);
    const data = await response.json();
    const links = (data.links || [])
      .slice(0, weekCount)
      .map(link => link.startsWith("http") ? link : "");   // blank out anything that isn't a web address
    return links.some(link => link !== "") ? links : null;
  } catch (error) {
    console.warn("Link script unavailable, keeping the backup list.", error);
    return null;
  }
}


// ---------- 5. DRAWING THE PAGE ----------

// Works out which weeks count towards a player's best 20.
// Returns a "Set": a list of week numbers with no duplicates, handy for asking "is this week in it?"
function countedWeeks(weeks) {
  const played = [];
  weeks.forEach((score, weekNumber) => {
    if (score !== null) played.push({ score, weekNumber });
  });
  played.sort((a, b) => b.score - a.score);               // highest first
  const best = played.slice(0, BEST_RESULTS_COUNTED);
  return new Set(best.map(item => item.weekNumber));
}

// The tiny bar chart in each leaderboard row
function miniStrip(player) {
  const counted = countedWeeks(player.weeks);
  let html = '<span class="strip">';
  player.weeks.forEach((score, i) => {
    if (score === null) {
      html += '<i style="height:1px; opacity:0.3"></i>';
    } else {
      const height = Math.max(3, (score / MAX_SCORE) * 20);
      const className = counted.has(i) ? "" : "dropped";
      html += `<i class="${className}" style="height:${height}px"></i>`;
    }
  });
  return html + "</span>";
}

function drawLeaderboard() {
  const searchText = $("search").value.toLowerCase();

  // Keep only players matching the search, then sort them
  const shown = season.players
    .filter(player => player.name.toLowerCase().includes(searchText))
    .sort((a, b) => {
      const first = a[sortBy];
      const second = b[sortBy];
      if (typeof first === "string") return first.localeCompare(second) * sortDirection;
      return (first - second) * sortDirection;
    });

  // Build one table row of HTML per player, then put it all on the page at once
  let html = "";
  for (const player of shown) {
    const selected = player.name === selectedName ? "selected" : "";
    const wins = player.wins > 0 ? `<span class="gold">${player.wins}</span>` : "0";
    html += `
      <tr class="${selected}" data-name="${escapeHtml(player.name)}">
        <td>${player.rank}</td>
        <td>${cardImage(player.name, "art_crop")}${escapeHtml(player.name)}</td>
        <td>${player.score}</td>
        <td>${player.played}</td>
        <td>${player.winRate}%</td>
        <td>${wins}</td>
        <td>${miniStrip(player)}</td>
      </tr>`;
  }
  $("leaderboard").innerHTML = html;
}

// The card with one player's season, shown when a row is clicked
function drawPlayer() {
  const card = $("player-card");
  const player = season.players.find(p => p.name === selectedName);
  if (!player) { card.hidden = true; return; }
  card.hidden = false;

  const counted = countedWeeks(player.weeks);

  // Average of their last 5 results
  const results = player.weeks.filter(score => score !== null);
  const last5 = results.slice(-5);
  const sum = last5.reduce((total, score) => total + score, 0);
  const average = last5.length ? (sum / last5.length).toFixed(1) : "-";

  // One bar per week. If the week has a Discord link, the bar becomes a clickable link.
  let bars = "";
  player.weeks.forEach((score, i) => {
    if (score === null) {
      bars += `<div class="slot" title="${formatDate(season.dates[i])}: did not play"></div>`;
      return;
    }

    // Math.max gives even a score of 0 a small visible stub, so "played and scored 0" differs from "didn't play"
    const height = Math.max((score / MAX_SCORE) * 100, 3);
    const className = counted.has(i) ? "" : "dropped";
    const bar = `<i class="${className}" style="height:${height}%"></i>`;
    const title = formatDate(season.dates[i]) + ": " + score;
    const link = season.links[i];

    if (link) {
      bars += `<a class="slot" href="${escapeHtml(link)}" target="_blank" rel="noopener" title="${title}">${bar}</a>`;
    } else {
      bars += `<div class="slot" title="${title}">${bar}</div>`;
    }
  });

  const dayLabels = season.dates.map(date => `<span>${formatDate(date).split(" ")[0]}</span>`).join("");

  card.innerHTML = `
    <div class="player-header">
      ${cardImage(player.name, "art_crop")}
      <h2>${escapeHtml(player.name)}</h2>
    </div>
    <div class="stats">
      <div><b>${player.score}</b><span>Best 20 total</span></div>
      <div><b>${player.played}</b><span>Weeks played</span></div>
      <div><b>${player.winRate}%</b><span>Match win rate</span></div>
      <div><b>${player.wins}</b><span>4-0 nights</span></div>
      <div><b>${average}</b><span>Average of last 5</span></div>
    </div>
    <div class="bars">${bars}</div>
    <div class="day-labels">${dayLabels}</div>
    <p class="note">Bar height is the score out of ${MAX_SCORE}. A tiny bar means the player attended and scored 0, and a gap means they didn't play. Click a bar to open that night's results.</p>
    ${playerDecksHtml(player.name)}`;
}

function drawWeeks() {
  const anyLinks = season.links.some(link => link !== "");
  $("weeks-card").hidden = !anyLinks;

  let html = "";
  season.dates.forEach((date, i) => {
    if (season.playerCounts[i] === 0) return;               // skip weeks not played yet
    const label = `${formatDate(date)}<small>${season.playerCounts[i]} players</small>`;
    const link = season.links[i];
    html += link
      ? `<a class="week-box" href="${escapeHtml(link)}" target="_blank" rel="noopener">${label}</a>`
      : `<span class="week-box">${label}</span>`;
  });
  $("weeks").innerHTML = html;
}

function drawPage() {
  const weeksPlayed = season.playerCounts.filter(count => count > 0).length;
  document.title = season.title;
  $("title").textContent = season.title;
  $("subtitle").textContent = `${weeksPlayed} weeks played, ${season.players.length} players. Only each player's best ${BEST_RESULTS_COUNTED} results count.`;
  $("footer").textContent = "Loaded at " + new Date().toLocaleTimeString() +
    ". Card images from Scryfall. Magic: The Gathering is © Wizards of the Coast.";
  drawLeaderboard();
  drawPlayer();
  drawWeeks();
}


// The "Decks played" list shown on a player's card
function playerDecksHtml(playerName) {
  if (!decks) return "";
  const mine = decks.entries
    .filter(entry => canonicalName(entry.player) === playerName)
    .sort((a, b) => b.events - a.events);
  if (mine.length === 0) return "";

  let rows = "";
  for (const entry of mine) {
    rows += `<tr><td>${escapeHtml(entry.deck)}</td><td>${entry.events}</td><td>${percent(entry.winRate)}</td><td>${entry.finishes}</td></tr>`;
  }
  return `
    <h3>Decks played</h3>
    <div class="table-wrap"><table class="mini static">
      <thead><tr><th>Deck</th><th>Events</th><th>Win %</th><th>4-0s</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// The row of big numbers at the top of the Decks tab
function drawDeckStats() {
  const entries = decks.entries.reduce((total, e) => total + e.events, 0);
  const finishes = decks.entries.reduce((total, e) => total + e.finishes, 0);
  const players = new Set(decks.entries.map(e => canonicalName(e.player))).size;
  $("deck-stats").innerHTML = `
    <div><b>${entries}</b><span>Player-event entries</span></div>
    <div><b>${finishes}</b><span>Perfect finishes</span></div>
    <div><b>${decks.summary.length}</b><span>Decks</span></div>
    <div><b>${players}</b><span>Players</span></div>`;
}

function drawDeckList() {
  const searchText = $("deck-search").value.toLowerCase();
  const minOnly = $("deck-min").checked;

  const shown = decks.summary
    .filter(deck => deck.name.toLowerCase().includes(searchText))
    .filter(deck => !minOnly || deck.events >= 10)
    .sort((a, b) => {
      const first = a[deckSortBy];
      const second = b[deckSortBy];
      if (typeof first === "string") return first.localeCompare(second) * deckSortDirection;
      return (first - second) * deckSortDirection;
    });

  let html = "";
  for (const deck of shown) {
    const selected = deck.name === selectedDeck ? "selected" : "";
    html += `
      <tr class="${selected}" data-name="${escapeHtml(deck.name)}">
        <td>${escapeHtml(deck.name)}</td>
        <td>${deck.events}</td>
        <td>${percent(deck.winRate)}</td>
        <td>${deck.wins}</td>
        <td>${deck.players}</td>
      </tr>`;
  }
  $("deck-list").innerHTML = html;
}

// The card showing who plays the selected deck
function drawDeckCard() {
  const card = $("deck-card");
  const deck = decks.summary.find(d => d.name === selectedDeck);
  if (!deck) { card.hidden = true; return; }
  card.hidden = false;

  const pilots = decks.entries
    .filter(entry => entry.deck === deck.name)
    .sort((a, b) => b.events - a.events);

  let rows = "";
  for (const pilot of pilots) {
    rows += `<tr><td>${escapeHtml(canonicalName(pilot.player))}</td><td>${pilot.events}</td><td>${percent(pilot.winRate)}</td><td>${pilot.finishes}</td></tr>`;
  }

  card.innerHTML = `
    <h2>${escapeHtml(deck.name)}</h2>
    <div class="stats">
      <div><b>${deck.events}</b><span>Events</span></div>
      <div><b>${percent(deck.winRate)}</b><span>Win rate</span></div>
      <div><b>${deck.wins}</b><span>4-0 wins</span></div>
      <div><b>${deck.players}</b><span>Players</span></div>
    </div>
    <h3>Played by</h3>
    <div class="table-wrap"><table class="mini static">
      <thead><tr><th>Player</th><th>Events</th><th>Win %</th><th>4-0s</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function drawDecks() {
  drawDeckStats();
  drawDeckList();
  drawDeckCard();
}

// Shows either the Players or the Decks section, depending on the end of the web address
function showTab() {
  if (!$("decks-view")) return;
  const tab = location.hash === "#decks" ? "decks" : "players";
  $("players-view").hidden = tab !== "players";
  $("decks-view").hidden = tab !== "decks";
  document.querySelectorAll(".tabs a").forEach(link => {
    link.classList.toggle("active", link.dataset.tab === tab);
  });
}


// ---------- 6. REACTING TO THE VISITOR ----------

// Typing in the search box
$("search").addEventListener("input", drawLeaderboard);

// Clicking a column heading sorts by it. Clicking it again reverses the order.
document.querySelector("thead").addEventListener("click", event => {
  const column = event.target.dataset.sort;                 // reads the data-sort="..." from the HTML
  if (!column) return;
  if (sortBy === column) {
    sortDirection = -sortDirection;
  } else {
    sortBy = column;
    sortDirection = (column === "rank" || column === "name") ? 1 : -1;
  }
  drawLeaderboard();
});

// Clicking a player's row shows their season
$("leaderboard").addEventListener("click", event => {
  const row = event.target.closest("tr");
  if (!row) return;
  selectedName = row.dataset.name;
  drawLeaderboard();
  drawPlayer();
  $("player-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
});


// Switching tabs: the browser tells us whenever the #something at the end of the address changes
window.addEventListener("hashchange", showTab);

// The decks tab: searching, the "10+ events" box, sorting, and clicking a deck
$("deck-search")?.addEventListener("input", () => { if (decks) drawDeckList(); });
$("deck-min")?.addEventListener("change", () => { if (decks) drawDeckList(); });

$("deck-head")?.addEventListener("click", event => {
  const column = event.target.dataset.sort;
  if (!column) return;
  if (deckSortBy === column) {
    deckSortDirection = -deckSortDirection;
  } else {
    deckSortBy = column;
    deckSortDirection = column === "name" ? 1 : -1;
  }
  drawDeckList();
});

$("deck-list")?.addEventListener("click", event => {
  const row = event.target.closest("tr");
  if (!row) return;
  selectedDeck = row.dataset.name;
  drawDeckList();
  drawDeckCard();
  $("deck-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
});


// ---------- 7. START ----------
async function start() {
  showTab();
  const decksRequest = loadDecks();     // starts now, so it loads at the same time as the main sheet

  try {
    // Step 1: get the sheet. This is the only thing the visitor has to wait for.
    const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("the sheet returned error " + response.status);
    season = buildSeason(parseCsv(await response.text()));

    // Step 2: show the page straight away, using the saved links
    season.links = backupLinks(season.dates.length);
    hideLoading();
    drawPage();

    // Step 3: add the deck data if we have it. Without it, the Decks tab simply stays hidden.
    decks = await decksRequest;
    if (decks) {
      $("decks-tab").hidden = false;
      drawDecks();
      drawPlayer();                     // redraw so the selected player's decks appear
    } else if (location.hash === "#decks") {
      location.hash = "#players";
    }

    // Step 4: quietly ask the script for newer links, and redraw those parts if it has some
    const freshLinks = await fetchScriptLinks(season.dates.length);
    if (freshLinks) {
      season.links = freshLinks;
      drawPlayer();
      drawWeeks();
    }
  } catch (error) {
    hideLoading();
    $("message").hidden = false;
    $("message").textContent = "Couldn't load the sheet: " + error.message;
  }
}

start();
