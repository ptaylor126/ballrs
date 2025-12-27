# Player Data Files

## File Structure

Each sport has two player data files:

### 1. `*-players-clues.json` (Mystery Players)
- Contains players that can appear as **mystery answers** in daily puzzles
- Includes detailed clues for each player
- Fields: `id`, `name`, `team`, `position`, `nationality`, `jerseyNumber`, `clues[]`

### 2. `*-all-players.json` (Searchable Players)
- Contains all players available in **autocomplete search**
- Users type player names and see matching suggestions from this list
- Fields: `id`, `name`, `team`

## IMPORTANT: Data Integrity Rule

**Every player in `*-players-clues.json` MUST also exist in `*-all-players.json`**

If a mystery player is not in the searchable list, users cannot type their name to guess them - making the puzzle unsolvable.

### Validation

The app validates this in development mode. When opening a puzzle, if any mystery players are missing from the searchable list, you'll see a console error:

```
[PL] DATA INTEGRITY ERROR: 1 mystery player(s) not in searchable list: Player Name
Fix: Add these players to data/*-all-players.json
```

### When Adding New Mystery Players

1. Add the player with clues to `*-players-clues.json`
2. **Also add** the player to `*-all-players.json` with at least `name` and `team`

### File Mapping

| Sport | Mystery Players | Searchable Players |
|-------|----------------|-------------------|
| Premier League | `pl-players-clues.json` | `pl-all-players.json` |
| NBA | `nba-players-clues.json` | `nba-all-players.json` |
| NFL | `nfl-players-clues.json` | `nfl-all-players.json` |
| MLB | `mlb-players-clues.json` | `mlb-all-players.json` |
