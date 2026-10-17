// script.js: how the page BEHAVES.
// Plan: (1) settings, (2) fetch the sheet, (3) turn it into tidy data, (4) draw the page, (5) react to clicks.


// ---------- 1. SETTINGS ----------
// The only things you should ever need to change are in this section.

// Your published Google Sheet (CSV format)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSK2YOnU1Rt3uZpEOI-sPSQGnpnNf_nnLA_9Tn8N-ou1zYYmbPxkBGH8Q8hpoRIzFXZ4yllj31ZbRlN/pub?gid=1095806745&single=true&output=csv";

// Your Apps Script address, which reads the hyperlinks behind the "Link" cells
const LINKS_API_URL = "https://script.google.com/macros/s/AKfycby79gR3VoCG60BFNiC3AbM0f0awxvbaGCkx6HQ818ifHHzOCZiFiV1FtMHvB_3c_QVo/exec";

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
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


// ---------- 2. THE PAGE'S MEMORY ----------
// "let" creates a variable, a labelled box that holds a value which can change.
let season = null;          // all the data, once it has loaded
let sortBy = "rank";        // which column the table is sorted by
let sortDirection = 1;      // 1 = lowest first, -1 = highest first
let selectedName = null;    // the player the visitor clicked on


// ---------- 3. SMALL HELPERS ----------
// A shortcut: $("title") is easier to type than document.getElementById("title")
function $(id) {
  return document.getElementById(id);
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
  const parts = raw.split("/");
  if (parts.length < 2) return raw;
  return Number(parts[0]) + " " + MONTHS[Number(parts[1]) - 1];
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

// Turns the raw rows into a tidy "season" object we can use everywhere else.
// We find things by their LABELS ("Rank", "Date:") so the sheet can grow without breaking us.
function buildSeason(rows) {
  const headerIndex = rows.findIndex(row => row[0].trim() === "Rank");
  if (headerIndex === -1) throw new Error("Couldn't find the 'Rank' row. Is this the right tab?");

  // Week 1 is the column headed "1", after the first 7 columns
  const firstWeek = rows[headerIndex].findIndex((cell, i) => i >= 7 && cell.trim() === "1");

  const dateRow = rows.find(row => row.some(cell => cell.trim() === "Date:"));
  const countRow = rows.find(row => row.some(cell => cell.trim() === "No of Players:"));

  // Collect the dates, stopping at the first empty one (weeks that haven't happened yet)
  const dates = [];
  for (let i = firstWeek; i < dateRow.length && dateRow[i].trim() !== ""; i++) {
    dates.push(dateRow[i].trim());
  }

  const playerCounts = dates.map((date, i) => Number(countRow[firstWeek + i]) || 0);

  // Every row below the header that starts with a rank number is a player
  const players = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const hasRank = /^\d+$/.test(row[0].trim());
    if (!hasRank || row[1].trim() === "") continue;

    // An empty cell means "didn't play" (null). A 0 means "played and scored zero". They differ.
    const weeks = dates.map((date, i) => {
      const cell = (row[firstWeek + i] || "").trim();
      return cell === "" ? null : Number(cell);
    });

    players.push({
      rank: Number(row[0]),
      name: row[1].trim(),
      score: Number(row[2]) || 0,
      played: Number(row[3]) || 0,
      winRate: parseFloat(row[4]) || 0,
      wins: Number(row[5]) || 0,
      weeks: weeks
    });
  }

  return { title: rows[0][0].trim(), dates, playerCounts, players, links: [] };
}

// Gets the Discord link for each week. Tries the script first, then falls back to our saved list.
// "async/await" means "go and fetch this, and wait for the answer before carrying on".
async function loadLinks(weekCount) {
  let links = [];
  try {
    const response = await fetch(LINKS_API_URL);
    const data = await response.json();
    links = data.links || [];
  } catch (error) {
    console.warn("Link script unavailable, using the backup list.", error);
  }

  const gotAny = links.some(link => link.startsWith("http"));
  if (!gotAny) {
    links = BACKUP_LINK_IDS.map(id => LINK_PREFIX + id);
  }

  // Keep one link per week, and blank out anything that isn't a proper web address
  return links.slice(0, weekCount).map(link => link.startsWith("http") ? link : "");
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
      const height = Math.max(2, (score / MAX_SCORE) * 20);
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
        <td>${escapeHtml(player.name)}</td>
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
    if (score === null) { bars += '<div class="slot"></div>'; return; }

    const height = (score / MAX_SCORE) * 100;
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
    <h2>${escapeHtml(player.name)}</h2>
    <div class="stats">
      <div><b>${player.score}</b><span>Best 20 total</span></div>
      <div><b>${player.played}</b><span>Weeks played</span></div>
      <div><b>${player.winRate}%</b><span>Match win rate</span></div>
      <div><b>${player.wins}</b><span>4-0 nights</span></div>
      <div><b>${average}</b><span>Average of last 5</span></div>
    </div>
    <div class="bars">${bars}</div>
    <div class="day-labels">${dayLabels}</div>
    <p class="note">Bar height is the score out of ${MAX_SCORE}. Click a bar to open that night's results.</p>`;
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
  $("footer").textContent = "Loaded at " + new Date().toLocaleTimeString();
  drawLeaderboard();
  drawPlayer();
  drawWeeks();
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


// ---------- 7. START ----------
async function start() {
  try {
    const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("the sheet returned error " + response.status);

    season = buildSeason(parseCsv(await response.text()));
    season.links = await loadLinks(season.dates.length);
    drawPage();
  } catch (error) {
    $("message").hidden = false;
    $("message").textContent = "Couldn't load the sheet: " + error.message;
  }
}

start();
