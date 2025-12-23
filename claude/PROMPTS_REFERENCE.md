# Ballrs - Claude Code Prompts Reference

This document contains all the prompts used to build Ballrs. Use these as reference for future features or if you need to rebuild something.

---

## Initial Setup

### Project Scaffold

```
Create a React Native app using Expo. Set it up with:
- TypeScript
- React Navigation for screens
- A basic folder structure with /screens, /components, and /data
- A home screen that shows "Ballrs" as the title and buttons for "Daily Puzzle" and "Duel"
- Use a dark theme with a sports aesthetic
```

---

## NBA Puzzle

### Player Database

```
Create a JSON file at /data/nba-players.json with 50 NBA players. Each player should have: id, name, team, position, age, jerseyNumber, nationality, and difficulty (rookie, allstar, or legend). Include a mix of current stars and legends.
```

### Poeltl-Style Puzzle

```
Redesign the daily puzzle to work like Poeltl. Here's how it should work:

1. User types a player name and submits their guess
2. A row appears showing that guessed player's stats in columns: Name, Team, Conference, Division, Position, Height, Age, Number
3. Each cell is color-coded:
   - Green = exact match with mystery player
   - Yellow = partial match (same conference but wrong team, or same position group like Guard vs Point Guard)
   - Gray = no match
4. For numerical stats (Age, Height, Number), also show an arrow: ↑ if mystery player is higher, ↓ if lower
5. Each wrong guess adds a new row above, building a grid of clues
6. Player has 8 guesses to find the mystery player
7. Update the player data to include: team, conference, division, position, height, age, jerseyNumber

Make the grid visually clean with the dark theme. Each row should be easy to scan.
```

### Autocomplete

```
Update the DailyPuzzle screen so the text input shows autocomplete suggestions as the user types. Filter the player list by what they've typed and show matching names in a dropdown. When they tap a name, submit it as their guess.
```

---

## Streaks & Sharing

### Streak Tracking

```
Add streak tracking that:
- Stores the user's current streak and best streak in local storage
- Increments current streak when they solve the puzzle
- Resets current streak if they miss a day or fail
- Shows both streaks on a simple stats modal accessible from the home screen
```

### Share Modal

```
Update the share functionality after the puzzle ends. Instead of silently copying to clipboard:

1. Show a modal that displays the shareable result text (the emoji grid, streak, etc.)
2. Use the native device share sheet (React Native's Share API) so users can choose where to share — WhatsApp, iMessage, Instagram, email, etc.
3. Also include a "Copy to clipboard" button in the modal as a backup option
4. When they tap "Copy to clipboard", show a brief confirmation message like "Copied!" that disappears after 2 seconds

The share result format should be:

Ballrs NBA 🏀
🟩⬛🟩🟩⬛🟩
Streak: 5

Make the modal look clean with the dark theme.
```

---

## Premier League

### Player Data

```
Create a JSON file at /data/premier-league-players.json with 50 Premier League players. Each player should have: id, name, team, nationality, position, age, jerseyNumber. 

For position, use: GK, DEF, MID, FWD

Include a mix of:
- Current stars (Haaland, Salah, Saka, etc.)
- Key players from top 6 clubs
- Some players from mid-table and lower clubs for harder puzzles

Make sure the data is current for the 2024-25 season.
```

### Multi-Sport Support

```
Add multi-sport support:

1. Update the home screen to show sport options: NBA and Premier League. Each sport has its own Daily Puzzle button.

2. Create a PremierLeaguePuzzle screen that works like the NBA puzzle but with football-relevant columns: Name, Team, Nationality, Position, Age, Number

3. Color coding rules:
   - Green = exact match
   - Yellow = partial match (for position: same general area like DEF/MID being close)
   - Gray = no match
   - Arrows for Age and Number (↑ higher, ↓ lower)

4. Each sport should track its own daily puzzle and streak separately

5. Use a football emoji ⚽ for Premier League (instead of 🏀 for NBA)
```

---

## User Accounts (Supabase)

### Setup

```
Install Supabase and set up authentication:

1. Install @supabase/supabase-js
2. Create a /lib/supabase.js file that initializes the Supabase client
3. For now, use placeholder values for SUPABASE_URL and SUPABASE_ANON_KEY — I'll replace them with my real credentials
4. Create an AuthContext that tracks the current user and provides login/logout functions
5. Wrap the app in this AuthContext
```

### Auth Screens

```
Create authentication screens:

1. A SignUp screen with email and password fields
2. A Login screen with email and password fields
3. A simple Profile screen that shows the user's email and a logout button
4. Add a Profile button to the home screen (only shows if logged in)
5. If not logged in, show Login/Sign Up buttons on the home screen instead

Keep the dark theme consistent.
```

### Database Tables

```
In Supabase, create tables for user stats. Give me the SQL I should run in the Supabase SQL Editor to create:

1. A "user_stats" table with columns:
   - id (uuid, primary key, references auth.users)
   - nba_current_streak (integer, default 0)
   - nba_best_streak (integer, default 0)
   - nba_total_solved (integer, default 0)
   - pl_current_streak (integer, default 0)
   - pl_best_streak (integer, default 0)
   - pl_total_solved (integer, default 0)
   - created_at (timestamp)
   - updated_at (timestamp)

2. Enable Row Level Security so users can only read/write their own data
```

### Connect App to Database

```
Update the app to save and load user stats from Supabase instead of local storage:

1. When a user logs in, fetch their stats from the user_stats table (create a row if it doesn't exist)
2. When they complete a puzzle, update their streak and total_solved in the database
3. Keep local storage as a fallback for users who aren't logged in
4. Show their stats on the Profile screen
```

---

## Leaderboards

### Leaderboard Tables

```
Give me the SQL to create a leaderboard view in Supabase that:

1. Creates a "profiles" table with: id (references auth.users), username (unique), created_at
2. Shows a leaderboard ranking users by total puzzles solved (nba_total_solved + pl_total_solved)
3. Enable Row Level Security so profiles are publicly readable but only editable by the owner
```

### Username Selection

```
After a user signs up, prompt them to choose a username before they can play. 

1. Create a SetUsername screen that asks for a username
2. Validate it's at least 3 characters, alphanumeric, and not already taken
3. Save it to the profiles table
4. Redirect to home screen after username is set
5. If user already has a username, skip this screen
```

### Leaderboard Screen

```
Create a Leaderboard screen that:

1. Shows top 50 users ranked by total puzzles solved
2. Displays: rank, username, total solved, best streak
3. Highlights the current user's row if they're in the list
4. Add a Leaderboard button to the home screen
5. Pull to refresh
```

---

## Duels

### Duel Tables

```
Give me the SQL for Supabase to support duels:

1. A "duels" table with: id, player1_id, player2_id, sport (nba/pl), mystery_player_id, player1_guesses (integer), player2_guesses (integer), winner_id, status (waiting/active/completed), created_at
2. Enable realtime on this table
3. Row Level Security so users can only see duels they're part of
```

### Matchmaking

```
Create a duel system:

1. Add a "Quick Duel" button on the home screen for each sport
2. When tapped, check if there's a duel with status "waiting" — if yes, join it as player2 and set status to "active"
3. If no waiting duels, create a new one with status "waiting" and show a "Waiting for opponent..." screen
4. Use Supabase realtime to detect when an opponent joins
5. Once matched, both players go to the DuelGame screen
```

### Duel Game Screen

```
Create a DuelGame screen that:

1. Works like the daily puzzle (same guess grid, same hints)
2. Both players get the same mystery player
3. Shows a live indicator of opponent's progress (number of guesses made)
4. When someone guesses correctly, they win — update the duel record and show results to both players
5. Use Supabase realtime to sync game state between players
```

---

## Friend Duels

### Invite System

```
Add friend duel invites:

1. Add a "Challenge Friend" button next to the Quick Duel button for each sport
2. When tapped, create a duel with status "invite" and generate a unique invite code (6 characters, alphanumeric)
3. Show a screen with the invite code and a "Share Invite" button that uses the native share sheet
4. The share message should say: "Think you can beat me at Ballrs? Join my duel: [CODE]" with a link like ballrs://duel/[CODE]
5. Add an "Enter Code" button on the home screen where users can paste a friend's code to join their duel
```

### Handle Invite Codes

```
Update the duel system to handle invite codes:

1. When a user enters an invite code, look up the duel with that code and status "invite"
2. If found and not expired (less than 24 hours old), join as player2 and set status to "active"
3. If not found or expired, show an error message
4. Use Supabase realtime so player1 sees when their friend joins
5. Both players then go to the DuelGame screen
```

### Friends List

```
Add a simple friends system:

1. After completing a friend duel, prompt both players to add each other as friends
2. Create a "friends" table: id, user_id, friend_id, created_at
3. On the Challenge Friend screen, show a list of existing friends for quick rematch
4. Tapping a friend's name creates an invite and notifies them (if they're online via realtime)
```

---

## Leagues

### League Tables

```
Give me the SQL for Supabase to support private leagues:

1. A "leagues" table with: id, name, created_by (references auth.users), invite_code (unique, 6 chars), sport (nba/pl/all), created_at
2. A "league_members" table with: id, league_id, user_id, points_weekly, points_monthly, points_all_time, joined_at
3. Row Level Security so only league members can view their league's data
4. Enable realtime on league_members
```

### Create and Join

```
Add league creation and joining:

1. Add a "Leagues" button on the home screen
2. Create a Leagues screen that shows leagues the user is a member of
3. Add a "Create League" button that opens a form: league name, sport (NBA, Premier League, or All Sports)
4. After creating, generate an invite code and show a share button
5. Add a "Join League" button where users enter an invite code
6. Limit leagues to 50 members max
```

### League Standings

```
Create a LeagueDetail screen that:

1. Shows league name and invite code (with share button)
2. Shows member standings in a table: rank, username, weekly points, monthly points, all-time points
3. Add tabs to switch between Weekly / Monthly / All-Time rankings
4. Highlight the current user's row
5. Pull to refresh
6. Show a "Leave League" button (except for the creator)
```

### Award Points

```
Update puzzle completion to award league points:

1. When a user completes a daily puzzle, award points to all their leagues (that match the sport or are "all sports")
2. Points formula: 
   - Solved in 1 guess = 6 points
   - Solved in 2 guesses = 5 points
   - Solved in 3 guesses = 4 points
   - And so on (7 guesses or more = 1 point, failed = 0)
3. Update weekly, monthly, and all-time totals
4. Reset weekly points every Monday at midnight UTC
5. Reset monthly points on the 1st of each month at midnight UTC
```

---

## XP & Achievements (Next)

*See ROADMAP.md for upcoming prompts*
