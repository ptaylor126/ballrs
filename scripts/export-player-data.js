const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const outputFile = path.join(__dirname, '..', 'player-data-review.md');

const sportFiles = [
  { file: 'nba-players-clues.json', name: 'NBA Players' },
  { file: 'pl-players-clues.json', name: 'Premier League Players' },
  { file: 'nfl-players-clues.json', name: 'NFL Players' },
  { file: 'mlb-players-clues.json', name: 'MLB Players' },
];

let output = '# Player Data Review\n\n';
output += `Generated: ${new Date().toISOString().split('T')[0]}\n\n`;

let totalPlayers = 0;

for (const sport of sportFiles) {
  const filePath = path.join(dataDir, sport.file);

  if (!fs.existsSync(filePath)) {
    output += `## ${sport.name}\n\n`;
    output += `_File not found: ${sport.file}_\n\n---\n\n`;
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const players = data.players || [];

  output += `## ${sport.name} (${players.length} players)\n\n`;
  totalPlayers += players.length;

  for (const player of players) {
    output += `### ${player.name}\n`;
    output += `- **Team:** ${player.team}\n`;
    if (player.position) output += `- **Position:** ${player.position}\n`;
    if (player.jerseyNumber) output += `- **Jersey:** #${player.jerseyNumber}\n`;
    if (player.difficulty) output += `- **Difficulty:** ${player.difficulty}\n`;
    output += '\n';

    if (player.clues && player.clues.length > 0) {
      player.clues.forEach((clue, i) => {
        output += `**Clue ${i + 1}:** ${clue}\n\n`;
      });
    }

    output += '---\n\n';
  }
}

output += '\n## Summary\n\n';
output += `- **Total Players:** ${totalPlayers}\n`;

fs.writeFileSync(outputFile, output);
console.log(`Created: ${outputFile}`);
console.log(`Total players: ${totalPlayers}`);
