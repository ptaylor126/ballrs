# Ballrs - Technical Stack

## Frontend

| Technology | Purpose |
|------------|---------|
| React Native | Cross-platform mobile framework |
| Expo | Development tooling, builds, OTA updates |
| TypeScript | Type-safe JavaScript |
| React Navigation | Screen navigation |

## Backend

| Technology | Purpose |
|------------|---------|
| Supabase | Backend-as-a-service |
| Supabase Auth | User authentication |
| Supabase Database | PostgreSQL database |
| Supabase Realtime | Live subscriptions for duels |
| Supabase Edge Functions | Scheduled jobs (point resets) |

## Data Storage

| Type | Technology |
|------|------------|
| User data | Supabase PostgreSQL |
| Player data | Local JSON files (bundled with app) |
| Local fallback | AsyncStorage (for non-logged-in users) |

## Development Tools

| Tool | Purpose |
|------|---------|
| Claude Code | AI-assisted coding |
| Cursor | Code editor |
| Expo Go | Testing on physical devices |
| Git | Version control |

---

## Project Structure

```
ballrs/
├── App.tsx                 # Entry point
├── app.json               # Expo config
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
│
├── /screens               # Screen components
│   ├── HomeScreen.tsx
│   ├── DailyPuzzleScreen.tsx
│   ├── PremierLeaguePuzzleScreen.tsx
│   ├── DuelGameScreen.tsx
│   ├── LeaderboardScreen.tsx
│   ├── LeaguesScreen.tsx
│   ├── LeagueDetailScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── LoginScreen.tsx
│   ├── SignUpScreen.tsx
│   └── SetUsernameScreen.tsx
│
├── /components            # Reusable components
│   ├── GuessGrid.tsx
│   ├── PlayerAutocomplete.tsx
│   ├── ShareModal.tsx
│   ├── XPProgressBar.tsx
│   └── ...
│
├── /data                  # Static data files
│   ├── nba-players.json
│   └── premier-league-players.json
│
├── /lib                   # Utilities and services
│   ├── supabase.ts        # Supabase client
│   ├── AuthContext.tsx    # Auth state management
│   └── ...
│
└── /assets               # Images, fonts, etc.
```

---

## Key Dependencies

```json
{
  "expo": "~50.x",
  "react": "18.x",
  "react-native": "0.73.x",
  "@react-navigation/native": "^6.x",
  "@react-navigation/stack": "^6.x",
  "@supabase/supabase-js": "^2.x",
  "@react-native-async-storage/async-storage": "^1.x"
}
```

---

## Environment Variables

Store in `.env` file (not committed to git):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

---

## Building for Production

### iOS

```bash
eas build --platform ios
```

Requires Apple Developer account ($99/year).

### Android

```bash
eas build --platform android
```

Requires Google Play Developer account ($25 one-time).

### Both

```bash
eas build --platform all
```

---

## Deployment

### App Updates

- Use EAS Update for over-the-air JavaScript updates
- Full rebuilds needed for native code changes

### Database

- Supabase handles hosting, backups, scaling
- Run migrations via Supabase SQL Editor

---

## Testing

### Local Development

1. Run `npx expo start`
2. Scan QR with Expo Go app
3. App hot-reloads on save

### Device Testing

- iOS Simulator: Press `i` in terminal (Mac only, needs Xcode)
- Android Emulator: Press `a` in terminal (needs Android Studio)
- Physical device: Scan QR with Expo Go

### Production Testing

- Use TestFlight (iOS) for beta testing
- Use Internal Testing track (Android) for beta testing
