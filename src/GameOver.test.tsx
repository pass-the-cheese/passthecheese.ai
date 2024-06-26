import { render, screen } from '@testing-library/react';
import GameOver from './GameOver';
import { Player } from './models/Player';
import { GameState } from './models/GameState';

const players: Player[] = [
  { uid: '1', name: 'Player 1', score: 100 },
  { uid: '2', name: 'Player 2', score: 50 }
];

const gameState: GameState = {
  players: players,
  macroState: 'gameOver',
  turnState: 'rolling',
  diceValues: [],
  currentPlayer: 0,
  rolling: false,
  scoreGoal: 100,
  maxPlayers: 4,
  createdBy: 'admin',
  scoringDice: [],
  turnScore: 0,
  deck: [],
  currentCard: null,
  discardedCards: []
};

describe('GameOver Component', () => {
  it('renders the correct message for player 1', () => {
    render(<GameOver gameState={gameState} />);
    expect(screen.getByText(/Game Over! Player 1 wins with 100 points!/i)).toBeInTheDocument();
  });

  it('renders the final scores', () => {
    render(<GameOver gameState={gameState} />);
    expect(screen.getByText(/Player 1 wins/i)).toBeInTheDocument();
    expect(screen.getByText(/Player 2/i)).toBeInTheDocument();
  });
});
