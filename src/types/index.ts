// NBA Types
export type Conference = 'East' | 'West';
export type Division = 'Atlantic' | 'Central' | 'Southeast' | 'Northwest' | 'Pacific' | 'Southwest';
export type NBAPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface Player {
  id: number;
  name: string;
  team: string;
  teamAbbr: string;
  conference: Conference;
  division: Division;
  position: NBAPosition;
  height: number; // in inches
  age: number;
  jerseyNumber: number;
}

export interface PlayersData {
  players: Player[];
}

// NFL Types
export type NFLConference = 'AFC' | 'NFC';
export type NFLDivision = 'AFC East' | 'AFC West' | 'AFC North' | 'AFC South' | 'NFC East' | 'NFC West' | 'NFC North' | 'NFC South';
export type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'CB' | 'S' | 'K';

export interface NFLPlayer {
  id: number;
  name: string;
  team: string;
  teamAbbr: string;
  conference: NFLConference;
  division: NFLDivision;
  position: NFLPosition;
  age: number;
  jerseyNumber: number;
}

export interface NFLPlayersData {
  players: NFLPlayer[];
}

export interface GuessedNFLPlayer {
  player: NFLPlayer;
  matches: NFLMatchResult;
}

export interface NFLMatchResult {
  team: MatchStatus;
  conference: MatchStatus;
  division: MatchStatus;
  position: MatchStatus;
  age: { status: MatchStatus; direction: NumberDirection };
  jerseyNumber: { status: MatchStatus; direction: NumberDirection };
}

// Premier League Types
export type FootballPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface FootballPlayer {
  id: number;
  name: string;
  team: string;
  teamAbbr: string;
  nationality: string;
  position: FootballPosition;
  age: number;
  jerseyNumber: number;
}

export interface FootballPlayersData {
  players: FootballPlayer[];
}

export interface GuessedFootballPlayer {
  player: FootballPlayer;
  matches: FootballMatchResult;
}

export interface FootballMatchResult {
  team: MatchStatus;
  nationality: MatchStatus;
  position: MatchStatus;
  age: { status: MatchStatus; direction: NumberDirection };
  jerseyNumber: { status: MatchStatus; direction: NumberDirection };
}

export interface GuessedPlayer {
  player: Player;
  matches: MatchResult;
}

export type MatchStatus = 'correct' | 'partial' | 'wrong';
export type NumberDirection = 'higher' | 'lower' | 'equal';

export interface MatchResult {
  team: MatchStatus;
  conference: MatchStatus;
  division: MatchStatus;
  position: MatchStatus;
  height: { status: MatchStatus; direction: NumberDirection };
  age: { status: MatchStatus; direction: NumberDirection };
  jerseyNumber: { status: MatchStatus; direction: NumberDirection };
}

export interface DailyGameState {
  date: string;
  guessedPlayerIds: number[];
  solved: boolean;
  // New clue-based fields
  revealedClues?: number;
  wrongGuesses?: number;
  failed?: boolean;
}

export interface StatsData {
  currentStreak: number;
  bestStreak: number;
  gamesPlayed: number;
  gamesWon: number;
  lastPlayedDate: string;
}
