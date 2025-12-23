# Ballrs - Database Schema (Supabase)

## Authentication

Handled by Supabase Auth. Users table managed automatically.

---

## Tables

### profiles

User profile information.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key, references auth.users |
| username | text | Unique, 3+ chars, alphanumeric |
| selected_icon | text | Currently selected profile icon |
| selected_frame | text | Currently selected profile frame |
| created_at | timestamp | Auto-generated |

### user_stats

User statistics and progression.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | - | Primary key, references auth.users |
| xp | integer | 0 | Total XP earned |
| level | integer | 1 | Current level |
| nba_current_streak | integer | 0 | |
| nba_best_streak | integer | 0 | |
| nba_total_solved | integer | 0 | |
| pl_current_streak | integer | 0 | Premier League |
| pl_best_streak | integer | 0 | |
| pl_total_solved | integer | 0 | |
| created_at | timestamp | now() | |
| updated_at | timestamp | now() | |

### achievements

Master list of all achievements.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Display name |
| description | text | How to unlock |
| icon | text | Emoji icon |
| xp_reward | integer | XP given when unlocked |
| requirement_type | text | e.g., "streak", "puzzles_solved", "duels_won" |
| requirement_value | integer | e.g., 7 for 7-day streak |
| is_secret | boolean | Hidden until unlocked |

### user_achievements

Tracks which achievements each user has unlocked.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | References auth.users |
| achievement_id | uuid | References achievements |
| unlocked_at | timestamp | When unlocked |

### duels

Duel matches between two players.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| player1_id | uuid | References auth.users |
| player2_id | uuid | References auth.users (nullable) |
| sport | text | "nba" or "pl" |
| mystery_player_id | text | ID of player to guess |
| player1_guesses | integer | Number of guesses |
| player2_guesses | integer | Number of guesses |
| winner_id | uuid | References auth.users (nullable) |
| status | text | "waiting", "invite", "active", "completed" |
| invite_code | text | 6-char code for friend invites |
| created_at | timestamp | |

### friends

Friend relationships between users.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | References auth.users |
| friend_id | uuid | References auth.users |
| created_at | timestamp | |

### leagues

Private and public leagues.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | League name |
| created_by | uuid | References auth.users |
| invite_code | text | Unique 6-char code |
| sport | text | "nba", "pl", or "all" |
| created_at | timestamp | |

### league_members

Users in each league with their scores.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | - | Primary key |
| league_id | uuid | - | References leagues |
| user_id | uuid | - | References auth.users |
| points_weekly | integer | 0 | Resets Mondays |
| points_monthly | integer | 0 | Resets 1st of month |
| points_all_time | integer | 0 | Never resets |
| joined_at | timestamp | now() | |

### profile_icons

Available profile icons.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Display name |
| icon_url | text | Image URL or emoji |
| unlock_requirement | text | Level number or achievement ID |

### profile_frames

Available profile frames.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Display name |
| frame_style | text | CSS/style reference |
| unlock_level | integer | Level required |

---

## Row Level Security (RLS)

All tables have RLS enabled:

- **profiles**: Publicly readable, only owner can update
- **user_stats**: Only owner can read/write
- **achievements**: Publicly readable, no writes
- **user_achievements**: Only owner can read/write
- **duels**: Only participants can read/write
- **friends**: Only involved users can read/write
- **leagues**: Members can read, creator can update
- **league_members**: Members can read, only own row can update

---

## Realtime Enabled

These tables have realtime subscriptions enabled:

- duels (for live duel updates)
- league_members (for live leaderboard updates)

---

## Scheduled Jobs (Supabase Edge Functions)

### reset_weekly_points

- Runs: Every Monday at 00:00 UTC
- Action: Sets all league_members.points_weekly to 0

### reset_monthly_points

- Runs: 1st of each month at 00:00 UTC
- Action: Sets all league_members.points_monthly to 0
