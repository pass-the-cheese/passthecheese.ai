import { DocumentReference, doc, FirestoreDataConverter, setDoc, getDoc } from 'firebase/firestore';
import { getDb } from '../firebaseConfig';
import { Player } from "./Player";
import { Card } from './Card';

// Constants
const GAMES_COLLECTION = 'games';

// GameState Interface
export interface GameState {
  diceValues: number[];
  currentPlayer: number;
  rolling: boolean;
  scoreGoal: number;
  maxPlayers: number;
  players: Player[];
  macroState: 'waiting' | 'inProgress' | 'gameOver';
  turnState: 'drawing' | 'rolling' | 'settingAside' | 'deciding';
  createdBy: string;
  scoringDice: number[];
  turnScore: number;
  deck: Card[]; // Added deck field
  currentCard: Card | null; // Added currentCard field
  discardedCards: Card[]; // Added discardedCards field
}

// Firestore data converter for GameState
export const gameStateConverter: FirestoreDataConverter<GameState> = {
  toFirestore: (gameState: GameState) => gameState,
  fromFirestore: (snapshot) => snapshot.data() as GameState,
};

// Get game document reference
export const getGameDocRef = (gameId: string | undefined): DocumentReference<GameState> | null => {
  if (!gameId) return null;
  return doc(getDb(), GAMES_COLLECTION, gameId).withConverter(gameStateConverter);
};

// Function to get GameState by Game ID
export const getGameStateById = async (gameId: string): Promise<GameState | null> => {
  const gameDocRef = getGameDocRef(gameId);
  if (!gameDocRef) return null;

  const gameSnapshot = await getDoc(gameDocRef);
  if (!gameSnapshot.exists()) return null;

  return gameSnapshot.data() as GameState;
};

// Function to save GameState by Game ID
export const saveGameState = async (gameId: string, gameState: GameState): Promise<void> => {
  const gameDocRef = getGameDocRef(gameId);
  if (!gameDocRef) throw new Error('Invalid game ID');

  await setDoc(gameDocRef, gameState);
};