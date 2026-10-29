// script.js: how the page BEHAVES.
// Plan: (1) settings, (2) fetch the sheet, (3) turn it into tidy data, (4) draw the page, (5) react to clicks.


// ---------- 1. SETTINGS ----------

// Your published Google Sheet (CSV format)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeTe-iIN0az5b5fHbg1PutxX6ZhPcr83r06TGpAS3wriBFHpsE_4NIXo__N0O4SBENSI0ePQJCnWP/pub?gid=0&single=true&output=csv";

// Your Apps Script address, which reads the hyperlinks behind the "Link" cells
const LINKS_API_URL = "https://script.google.com/macros/s/AKfycbxtKV8TNZT1opGsSZUSgHDVLU1Top-01sFGhl_o4B-xPdwi_4wGNhCxe8zXhB2vCvI/exec";

// Backup Discord links, used if the script above can't be reached.
const LINK_PREFIX = "https://discord.com/channels/1312801614825787513/1312828783895511070/";

const BACKUP_LINK_IDS = [
  "1457385501769076847", "1459923877504356353", "1465001701059858564", "1467535585869692979",
  "1470070317232816305", "1472610642862149675", "1475140161577681036", "1477674974809559225",
  "1480218399450033841", "1482761787270107338", "1485283361907015840", "1487813507444510760",
  "1490346536436236588", "1492880468289388614", "1497959795334844579", "1500494213178064897",
  "1503032780588585142", "1505579024976711791", "1508194008290033714", "1510639470226047127",
  "1513182103246868683", "1515713125716987945", "1518264671851774022", "1520787838889623702",
  "1523430409021554758", "1525862113787117640", "1528396856676057149", "1530937360273903848",
  "1533471545685442600", "1538549771227111496", "1541176057997164744", "1543619974667702372",
  "1546260268894658682", "1548693419080294463", "1551228095179137065", "1556296618452451389",
  "1558844334034391041"
];

const BEST_RESULTS_COUNTED = 20;
const MAX_SCORE = 12;

// Each player's signature Magic card.
// Player names must match the spreadsheet exactly.
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
  "Ruben":                  "Teferi, hero of dominaria",
  "Aaron Rubra":            "Barrowgoyf",
  "Jennifer Bytheway":      "Ornery Tumblewagg",
  "Matt Ellis":             "Troll of Khazadum",
  "Philip":                 "Jacked Rabbit",
  "Summer Wright":          "Kumena, Tyrant of Orazca",
  "Thomas Cheslin":         "Golgari grave troll",
  "Zack Ibell":             "Faithless looting",
  "Michael Boardman":       "Simic growth chamber"
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


// ---------- 2. PAGE STATE ----------

let season = null;
let sortBy = "rank";
let sortDirection = 1;
let selectedName = null;


// ---------- 3. HELPERS ----------

function $(id) {
  return document.getElementById(id);
}

function hideLoading() {
  const loading = $("loading");
  if (loading) loading.remove();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(raw) {
  const parts = String(raw ?? "").split("/");
  if (parts.length < 2) return raw;

  const month = MONTHS[Number(parts[1]) - 1];
  if (!month) return raw;

  return Number(parts[0]) + " " + month;
}

function cardImage(playerName, version) {
  const cardName = PLAYER_CARDS[playerName];
  if (!cardName) return "";

  const url = "https://api.scryfall.com/cards/named?fuzzy=" +
    encodeURIComponent(cardName) + "&format=image&version=" + version;

  return `<img class="card-art" src="${url}" alt="${escapeHtml(cardName)}"
          title="${escapeHtml(cardName)}" loading="lazy" onerror="this.remove()">`;
}


// ---------- 4. LOAD AND PARSE THE SHEET ----------

// Parse CSV while respecting commas inside quoted cells.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // Add the final cell and row.
  row.push(cell);
  rows.push(row);

  return rows;
}


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


// ---------- 5. DISCORD LINKS ----------

// Use the saved backup links immediately.
function backupLinks(weekCount) {
  return BACKUP_LINK_IDS
    .slice(0, weekCount)
    .map(id => LINK_PREFIX + id);
}

// Ask the Apps Script for the latest links.
// If it fails, keep the backup links.
async function fetchScriptLinks(weekCount) {
  try {
    const response = await fetch(LINKS_API_URL);

    if (!response.ok) {
      throw new Error("Links service returned error " + response.status);
    }

    const data = await response.json();

    const links = (Array.isArray(data.links) ? data.links : [])
      .slice(0, weekCount)
      .map(link =>
        typeof link === "string" && link.startsWith("http") ? link : ""
      );

    return links.some(link => link !== "") ? links : null;
  } catch (error) {
    console.warn(
      "Link script unavailable, keeping the backup list.",
      error
    );
    return null;
  }
}


// ---------- 6. DRAW THE LEADERBOARD ----------

// Determine which weeks count towards a player's best 20 scores.
function countedWeeks(weeks) {
  const played = [];

  weeks.forEach((score, weekNumber) => {
    if (score !== null) {
      played.push({ score, weekNumber });
    }
  });

  played.sort((a, b) => b.score - a.score);

  const best = played.slice(0, BEST_RESULTS_COUNTED);

  return new Set(best.map(item => item.weekNumber));
}


// Draw the small score bars in the leaderboard table.
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
  const searchBox = $("search");
  const searchText = searchBox ? searchBox.value.toLowerCase() : "";

  const shown = season.players
    .filter(player => player.name.toLowerCase().includes(searchText))
    .sort((a, b) => {
      const first = a[sortBy];
      const second = b[sortBy];

      if (typeof first === "string") {
        return first.localeCompare(second) * sortDirection;
      }

      return (first - second) * sortDirection;
    });

  let html = "";

  for (const player of shown) {
    const selected = player.name === selectedName ? "selected" : "";
    const wins = player.wins > 0
      ? `<span class="gold">${player.wins}</span>`
      : "0";

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


// Draw the detailed card for the selected player.
function drawPlayer() {
  const card = $("player-card");
  const player = season.players.find(p => p.name === selectedName);

  if (!player) {
    card.hidden = true;
    return;
  }

  card.hidden = false;

  const counted = countedWeeks(player.weeks);

  // Average of the last five results.
  const results = player.weeks.filter(score => score !== null);
  const last5 = results.slice(-5);
  const sum = last5.reduce((total, score) => total + score, 0);
  const average = last5.length
    ? (sum / last5.length).toFixed(1)
    : "-";

  // Draw one bar per week.
  let bars = "";

  player.weeks.forEach((score, i) => {
    const date = season.dates[i] || "";

    if (score === null) {
      bars += `<div class="slot" title="${formatDate(date)}: did not play"></div>`;
      return;
    }

    const height = Math.max((score / MAX_SCORE) * 100, 3);
    const className = counted.has(i) ? "" : "dropped";
    const bar = `<i class="${className}" style="height:${height}%"></i>`;
    const title = formatDate(date) + ": " + score;
    const link = season.links[i];

    if (link) {
      bars += `<a class="slot" href="${escapeHtml(link)}" target="_blank" rel="noopener" title="${escapeHtml(title)}">${bar}</a>`;
    } else {
      bars += `<div class="slot" title="${escapeHtml(title)}">${bar}</div>`;
    }
  });

  const dayLabels = season.dates
    .map(date => `<span>${formatDate(date).split(" ")[0]}</span>`)
    .join("");

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
    <p class="note">Bar height is the score out of ${MAX_SCORE}. A tiny bar means the player attended and scored 0, and a gap means they didn't play. Click a bar to open that night's results.</p>`;
}


// Draw the weekly links and attendance counts.
function drawWeeks() {
  const weeksCard = $("weeks-card");
  const weeksContainer = $("weeks");

  const anyLinks = season.links.some(link => link !== "");

  if (weeksCard) weeksCard.hidden = !anyLinks;

  let html = "";

  season.dates.forEach((date, i) => {
    if (season.playerCounts[i] === 0) return;

    const label =
      `${formatDate(date)}<small>${season.playerCounts[i]} players</small>`;

    const link = season.links[i];

    html += link
      ? `<a class="week-box" href="${escapeHtml(link)}" target="_blank" rel="noopener">${label}</a>`
      : `<span class="week-box">${label}</span>`;
  });

  weeksContainer.innerHTML = html;
}


function drawPage() {
  const weeksPlayed = season.playerCounts.filter(count => count > 0).length;

  document.title = season.title;
  $("title").textContent = season.title;

  $("subtitle").textContent =
    `${weeksPlayed} weeks played, ${season.players.length} players. Only each player's best ${BEST_RESULTS_COUNTED} results count.`;

  $("footer").textContent =
    "Loaded at " + new Date().toLocaleTimeString() +
    ". Card images from Scryfall. Magic: The Gathering is © Wizards of the Coast.";

  drawLeaderboard();
  drawPlayer();
  drawWeeks();
}


// ---------- 7. REACT TO VISITOR ACTIONS ----------

// Typing in the search box.
$("search").addEventListener("input", drawLeaderboard);


// Clicking a column heading sorts the table.
document.querySelector("thead").addEventListener("click", event => {
  const column = event.target.dataset.sort;

  if (!column) return;

  if (sortBy === column) {
    sortDirection = -sortDirection;
  } else {
    sortBy = column;
    sortDirection = (column === "rank" || column === "name") ? 1 : -1;
  }

  drawLeaderboard();
});


// Clicking a player row shows their season.
$("leaderboard").addEventListener("click", event => {
  const row = event.target.closest("tr");

  if (!row) return;

  selectedName = row.dataset.name;

  drawLeaderboard();
  drawPlayer();

  $("player-card").scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
});


// ---------- 8. START ----------

async function start() {
  try {
    // Fetch the published spreadsheet.
    const response = await fetch(SHEET_CSV_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("The sheet returned error " + response.status);
    }

    const csvText = await response.text();

    if (!csvText.trim()) {
      throw new Error("The published sheet returned an empty CSV.");
    }

    season = buildSeason(parseCsv(csvText));

    // Display the page immediately using the saved Discord links.
    season.links = backupLinks(season.dates.length);

    hideLoading();
    drawPage();

    // Quietly fetch updated links and redraw the relevant sections.
    const freshLinks = await fetchScriptLinks(season.dates.length);

    if (freshLinks) {
      season.links = freshLinks;
      drawPlayer();
      drawWeeks();
    }
  } catch (error) {
    console.error("Leaderboard load failed:", error);

    hideLoading();

    const message = $("message");

    if (message) {
      message.hidden = false;
      message.textContent =
        "Couldn't load the sheet: " + error.message;
    }
  }
}

start();
