# Ballrs - Game Mechanics

## Daily Puzzle

### How It Works

1. Each day, a mystery player is selected (same for all users)
2. User types a player name to guess
3. A row appears showing the guessed player's stats
4. Each stat cell is color-coded:
   - **Green** = Exact match with mystery player
   - **Yellow** = Partial match (same conference, similar position)
   - **Gray** = No match
5. Numerical stats show arrows: ↑ (mystery is higher) or ↓ (mystery is lower)
6. User has 8 guesses to find the mystery player
7. Each sport has its own daily puzzle

### Stats Shown (by sport)

**NBA:**
- Name, Team, Conference, Division, Position, Height, Age, Jersey Number

**Premier League:**
- Name, Team, Nationality, Position, Age, Jersey Number

---

## Points System

### Daily Puzzle Points

Points awarded based on number of guesses:

| Guesses | Points |
|---------|--------|
| 1 | 6 |
| 2 | 5 |
| 3 | 4 |
| 4 | 3 |
| 5 | 2 |
| 6 | 1 |
| 7+ | 1 |
| Failed | 0 |

### Where Points Go

- Global leaderboard (all users)
- All leagues the user belongs to (if sport matches)

---

## Streaks

### How Streaks Work

- Solve the daily puzzle = streak continues
- Miss a day or fail = streak resets to 0
- Each sport tracks its own streak separately

### Streak Bonuses

- Daily XP bonus: 10 × current streak day
- Achievements unlock at 7-day and 30-day streaks

---

## XP & Leveling

### Earning XP

| Action | XP Earned |
|--------|-----------|
| Solve daily puzzle | 100 - (guesses × 10), minimum 50 |
| Streak bonus | 10 × streak day |
| Win a duel | 75 |
| Lose a duel | 25 |
| First puzzle in new sport | 200 |
| Achievement unlocked | Varies (50-500) |

### Level Thresholds

- Level 1: 0 XP
- Level 2: 200 XP
- Level 3: 500 XP
- Level 4+: Previous threshold + 400 XP

### Level Titles

| Levels | Title |
|--------|-------|
| 1-5 | Rookie |
| 6-10 | Starter |
| 11-15 | Pro |
| 16-20 | All-Star |
| 21-25 | MVP |
| 26-30 | Legend |

---

## Duels

### Quick Duel (Random Matchmaking)

1. User taps "Quick Duel"
2. System checks for waiting duels
3. If found: joins as player 2, game starts
4. If not found: creates new duel, waits for opponent
5. Both players get same mystery player
6. First to guess correctly wins
7. Winner: 75 XP, Loser: 25 XP

### Friend Duel (Invite)

1. User taps "Challenge Friend"
2. System generates 6-character invite code
3. User shares code via native share sheet
4. Friend enters code to join
5. Same gameplay as quick duel

---

## Leagues

### League Types

- **Public leagues**: Anyone can join
- **Private leagues**: Invite code required

### League Settings

- Sport filter: NBA only, Premier League only, or All Sports
- Maximum 50 members per league

### League Rankings

Three separate leaderboards:

1. **Weekly** - Resets every Monday at midnight UTC
2. **Monthly** - Resets on the 1st of each month at midnight UTC
3. **All-Time** - Never resets

### Earning League Points

Same as daily puzzle points (1-6 based on guesses). Points automatically added to all qualifying leagues when you complete a puzzle.

---

## Share Results

After completing a puzzle, users can share a spoiler-free result:

```
Ballrs NBA 🏀
🟩⬛🟩🟩⬛🟩
Streak: 5
```

- Green squares = correct attribute
- Black squares = incorrect guess before that hint
- Shared via native share sheet (WhatsApp, iMessage, etc.)
