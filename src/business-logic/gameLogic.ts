import { v4 as uuidv4 } from 'uuid';
import { GameState } from '../models/GameState';
import { Player } from "../models/Player";
import { Card, cards } from '../models/Card';

const NUMBER_OF_DICE = 6;
const INITIAL_DICE_VALUE = 1;

export const isCurrentUserInGame = (players: Player[], currentUserId: string): boolean => {
  return players.some(player => player.uid === currentUserId);
};

export const addPlayer = (gameState: GameState, playerName: string, userId: string): GameState => {
  if (gameState.players.length >= gameState.maxPlayers) {
    throw new Error('Maximum number of players reached');
  }

  if (isCurrentUserInGame(gameState.players, userId)) {
    throw new Error('User is already in the game');
  }

  const newPlayer: Player = { uid: userId, name: playerName, score: 0 };
  const updatedPlayers = [...gameState.players, newPlayer];
  return { ...gameState, players: updatedPlayers };
};

export const startGame = (gameState: GameState, currentUserId: string): GameState => {
  if (gameState.createdBy !== currentUserId) {
    throw new Error('Only the game creator can start the game');
  }

  return { ...gameState, macroState: 'inProgress', turnState: 'drawing' };
};

export const createGame = (maxPlayers: number, scoreGoal: number, createdBy: string): { gameId: string, initialState: GameState } => {
  const gameId = uuidv4().split('-')[0];
  const initialState: GameState = {
    diceValues: Array(NUMBER_OF_DICE).fill(INITIAL_DICE_VALUE),
    currentPlayer: 1,
    rolling: false,
    scoreGoal,
    maxPlayers,
    players: [],
    macroState: 'waiting',
    turnState: 'rolling',
    createdBy,
    scoringDice: [],
    turnScore: 0,
    deck: createAndShuffleDeck(), // Add shuffled deck
    currentCard: null,
    discardedCards: []
  };
  return { gameId, initialState };
};

const rollDiceValues = (numDice: number): number[] => Array.from({ length: numDice }, () => Math.floor(Math.random() * 6) + 1);

const calculateNewScores = (gameState: GameState): Player[] => {
  const newPlayers = [...gameState.players];
  newPlayers[gameState.currentPlayer - 1].score += gameState.turnScore;
  if (gameState.diceValues.length === 0 && gameState.currentCard) {
    newPlayers[gameState.currentPlayer - 1].score += gameState.currentCard.bonus;  // Use bonus from currentCard
  }
  return newPlayers;
};

const determineNextPlayer = (gameState: GameState, newGameOver: boolean): number => {
  return newGameOver ? gameState.currentPlayer : (gameState.currentPlayer % gameState.players.length) + 1;
};

export const preRoll = (gameState: GameState, currentUserId: string): GameState => {
  const currentPlayerId = gameState.players[gameState.currentPlayer - 1].uid;

  if (currentUserId !== currentPlayerId) {
    throw new Error('It is not your turn to roll the dice');
  }

  if (gameState.macroState === 'gameOver' || gameState.rolling) {
    return gameState;
  }

  return { ...gameState, rolling: true };
};

export const postRoll = (gameState: GameState): GameState => {
  const numDiceToRoll = 6 - gameState.scoringDice.length;
  const newValues = rollDiceValues(numDiceToRoll);

  return {
    ...gameState,
    diceValues: newValues,
    rolling: false,
    turnState: 'settingAside',  // Update turn state to "settingAside"
  };
};

export const endTurn = (gameState: GameState, cutTheCheese: boolean): GameState => {
  if (!canEndTurn(gameState)) {
    throw new Error('You must fill the card requirements before ending the turn');
  }

  let newPlayers = cutTheCheese ? gameState.players : calculateNewScores(gameState);
  const newGameOver = newPlayers[gameState.currentPlayer - 1].score >= gameState.scoreGoal;
  const newCurrentPlayer = determineNextPlayer(gameState, newGameOver);

  return {
    ...gameState,
    players: newPlayers,
    currentPlayer: newCurrentPlayer,
    macroState: newGameOver ? 'gameOver' : 'inProgress',
    turnScore: 0,
    scoringDice: [],
    diceValues: [1, 1, 1, 1, 1, 1],  // Reset diceValues to six dice with value 1
    turnState: 'drawing'  // Set turnState back to drawing
  };
};

export const setAsideDice = (gameState: GameState, diceIndices: number[]): GameState => {
  if (gameState.macroState !== 'inProgress') {
    throw new Error('Game is not in progress');
  }

  const newScoringDice = [...gameState.scoringDice];
  const remainingDiceValues = gameState.diceValues.filter((_, index) => !diceIndices.includes(index));
  const diceToScore = diceIndices.map(index => {
    if (index < 0 || index >= gameState.diceValues.length) {
      throw new Error('Invalid dice index');
    }
    return gameState.diceValues[index];
  });

  const { totalScore: newScore } = scoreDice(diceToScore);
  const turnScore = gameState.turnScore + newScore;

  return {
    ...gameState,
    diceValues: remainingDiceValues,
    scoringDice: [...newScoringDice, ...diceToScore],
    turnScore,
    turnState: 'deciding'  // Update turn state to "deciding"
  };
};

export const scoreDice = (dice: number[]): { totalScore: number, unscoredDice: number[], scoringDetails: { reason: string, values: number[], points: number }[] } => {
  if (dice.length < 1) {
    return { totalScore: 0, unscoredDice: [], scoringDetails: [] };
  }

  if (dice.length > 6) {
    throw new Error('Invalid number of dice');
  }

  const diceCount = new Array(7).fill(0);
  dice.forEach(die => diceCount[die]++);

  let totalScore = 0;
  const scoringDetails: { reason: string, values: number[], points: number }[] = [];
  const unscoredDice: number[] = [];

  // Check for a straight
  if (dice.length === 6 && diceCount.slice(1).every(count => count === 1)) {
    return {
      totalScore: 1500,
      unscoredDice: [],
      scoringDetails: [{ reason: 'Straight', values: dice, points: 1500 }]
    };
  }

  // Check for three of a kind
  for (let i = 1; i <= 6; i++) {
    if (diceCount[i] >= 3) {
      const score = (i === 1 ? 1000 : i * 100);
      totalScore += score;
      scoringDetails.push({ reason: 'Three of a kind', values: Array(3).fill(i), points: score });
      diceCount[i] -= 3;
    }
  }

  // Check for single 1s and 5s
  if (diceCount[1] > 0) {
    const score = diceCount[1] * 100;
    totalScore += score;
    scoringDetails.push({ reason: 'Single 1s', values: Array(diceCount[1]).fill(1), points: score });
    diceCount[1] = 0;
  }

  if (diceCount[5] > 0) {
    const score = diceCount[5] * 50;
    totalScore += score;
    scoringDetails.push({ reason: 'Single 5s', values: Array(diceCount[5]).fill(5), points: score });
    diceCount[5] = 0;
  }

  // Collect unscored dice
  for (let i = 1; i <= 6; i++) {
    for (let j = 0; j < diceCount[i]; j++) {
      unscoredDice.push(i);
    }
  }

  return {
    totalScore,
    unscoredDice,
    scoringDetails
  };
};

// Function to create and shuffle the deck
export function createAndShuffleDeck(): Card[] {
  const deck: Card[] = [];

  // Add cards to the deck based on their quantity
  cards.forEach(card => {
    for (let i = 0; i < card.quantity; i++) {
      deck.push({ ...card });
    }
  });

  // Shuffle the deck using Fisher-Yates algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export const drawCard = (gameState: GameState): GameState => {
  if (gameState.turnState !== 'drawing') {
    return gameState; // Return the current state if it's not the drawing phase
  }

  if (gameState.deck.length === 0) {
    if (gameState.discardedCards.length === 0) {
      throw new Error('No cards left in the deck or discard pile');
    }
    gameState.deck = createAndShuffleDeck();
    gameState.discardedCards = [];
  }

  const currentCard = gameState.deck.pop();
  const discardedCards = gameState.currentCard ? [...gameState.discardedCards, gameState.currentCard] : gameState.discardedCards;

  return {
    ...gameState,
    currentCard: currentCard ?? null,
    deck: gameState.deck,
    discardedCards,
    turnState: 'rolling'  // Set turnState to "rolling"
  };
};

export const hasPassedTheCheese = (gameState: GameState): boolean => {
  return gameState.diceValues.length === 0;
};

export const hasCutTheCheese = (gameState: GameState): boolean => {
  const { totalScore: diceValuesScore } = scoreDice(gameState.diceValues);
  return gameState.turnState === 'settingAside' && (diceValuesScore === 0 || hasPassedTheCheese(gameState));
};

export const canEndTurn = (gameState: GameState): boolean => {
  if (hasPassedTheCheese(gameState) || hasCutTheCheese(gameState)) {
    return true;
  }

  const mustPassButHasntPassed = gameState.currentCard?.kind === 'MustPass' && gameState.diceValues.length > 0;
  if (mustPassButHasntPassed) {
    return false;
  }

  return gameState.turnState === 'deciding';
};