'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Pipe {
  x: number;
  gapStart: number;
  gapHeight: number;
}

interface GameState {
  birdPosition: number;
  birdVelocity: number;
  pipes: Pipe[];
  score: number;
  gameOver: boolean;
  level: number;
}

export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const birdRef = useRef<HTMLImageElement | null>(null);
  const tubeRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(0);
  const [gameState, setGameState] = useState<GameState>({
    birdPosition: 250,
    birdVelocity: 0,
    pipes: [],
    score: 0,
    gameOver: false,
    level: 1,
  });

  const gravity = 0.5;
  const jumpStrength = -8;
  const baseGameSpeed = 3;
  const pipeWidth = 52; // Adjusted for tube sprite
  const gapHeight = 150;
  const minPipeHeight = 50;
  const birdSize = 48; // Visual size
  const birdHitboxSize = {
    width: birdSize * 0.6,  // Smaller width for more accurate collisions
    height: birdSize * 0.4  // Even smaller height since the bird sprite has transparent space
  };

  // Calculate game speed based on level
  const gameSpeed = baseGameSpeed + (gameState.level - 1) * 0.5;

  // Initialize game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    // Load all images
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          setAssetsLoaded(prev => prev + 1);
          resolve(img);
        };
        img.onerror = reject;
      });
    };

    Promise.all([
      loadImage('/images/bg.jpg'),
      loadImage('/images/bird.png'),
      loadImage('/images/tube.png')
    ]).then(([bgImage, birdImage, tubeImage]) => {
      backgroundRef.current = bgImage;
      birdRef.current = birdImage;
      tubeRef.current = tubeImage;
      setIsInitialized(true);
      console.log('All assets loaded');
    }).catch(error => {
      console.error('Failed to load assets:', error);
      setIsInitialized(true); // Initialize anyway with fallback graphics
    });

    // Initial draw
    ctx.fillStyle = '#87CEEB'; // Sky blue fallback
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Generate random pipe height
  const generatePipe = useCallback((canvasHeight: number): Pipe => {
    const minGap = minPipeHeight;
    const maxGap = canvasHeight - minPipeHeight - gapHeight;
    const gapStart = Math.floor(Math.random() * (maxGap - minGap + 1)) + minGap;
    
    return {
      x: 800, // Canvas width
      gapStart,
      gapHeight,
    };
  }, []);

  const handleJump = useCallback(() => {
    if (!gameState.gameOver) {
      setGameState((prev) => ({
        ...prev,
        birdVelocity: jumpStrength,
      }));
    } else {
      // Reset game
      setGameState({
        birdPosition: 250,
        birdVelocity: 0,
        pipes: [],
        score: 0,
        gameOver: false,
        level: 1,
      });
    }
  }, [gameState.gameOver]);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handleJump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleJump]);

  // Game loop using requestAnimationFrame
  const updateAndDraw = useCallback((timestamp: number) => {
    if (!isInitialized) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate delta time
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    if (!gameState.gameOver) {
      setGameState((prev) => {
        // Update bird position with delta time
        const newBirdPosition = prev.birdPosition + prev.birdVelocity * (deltaTime / 16);
        const newBirdVelocity = prev.birdVelocity + gravity * (deltaTime / 16);

        // Update pipes
        const newPipes = prev.pipes
          .map(pipe => ({ ...pipe, x: pipe.x - gameSpeed * (deltaTime / 16) }))
          .filter(pipe => pipe.x + pipeWidth > 0);

        // Generate new pipes
        if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < 600) {
          newPipes.push(generatePipe(canvas.height));
        }

        // Check for scoring
        const scoringPipe = newPipes.find(pipe => 
          pipe.x + pipeWidth <= 100 && pipe.x + pipeWidth > 100 - gameSpeed
        );

        let newScore = prev.score;
        let newLevel = prev.level;

        if (scoringPipe) {
          newScore += 1;
          newLevel = Math.floor(newScore / 5) + 1;
        }

        // Check collisions with improved hitbox
        const birdX = 100;
        const birdY = newBirdPosition;
        const birdLeft = birdX - birdHitboxSize.width / 2;
        const birdRight = birdX + birdHitboxSize.width / 2;
        const birdTop = birdY - birdHitboxSize.height / 2;
        const birdBottom = birdY + birdHitboxSize.height / 2;

        const hasCollision = newPipes.some(pipe => {
          // Check collision with top pipe
          const topPipeCollision = 
            birdRight > pipe.x && 
            birdLeft < pipe.x + pipeWidth &&
            birdTop < pipe.gapStart;

          // Check collision with bottom pipe
          const bottomPipeCollision = 
            birdRight > pipe.x && 
            birdLeft < pipe.x + pipeWidth &&
            birdBottom > pipe.gapStart + pipe.gapHeight;

          return topPipeCollision || bottomPipeCollision;
        });

        const outOfBounds = birdTop < 0 || birdBottom > canvas.height;

        return {
          ...prev,
          birdPosition: newBirdPosition,
          birdVelocity: newBirdVelocity,
          pipes: newPipes,
          score: newScore,
          level: newLevel,
          gameOver: hasCollision || outOfBounds,
        };
      });
    }

    // Draw game state
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (backgroundRef.current) {
      ctx.drawImage(backgroundRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Fallback background
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#90EE90';
      ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
    }

    // Draw pipes using tube sprite
    if (tubeRef.current) {
      gameState.pipes.forEach(pipe => {
        // Draw top pipe (flipped)
        ctx.save();
        ctx.translate(pipe.x, pipe.gapStart);
        ctx.scale(1, -1);
        ctx.drawImage(tubeRef.current!, 0, 0, pipeWidth, pipe.gapStart);
        ctx.restore();

        // Draw bottom pipe
        ctx.drawImage(
          tubeRef.current!,
          pipe.x,
          pipe.gapStart + pipe.gapHeight,
          pipeWidth,
          canvas.height - (pipe.gapStart + pipe.gapHeight)
        );
      });
    }

    // Draw bird with rotation based on velocity
    if (birdRef.current) {
      ctx.save();
      ctx.translate(100, gameState.birdPosition);
      const rotation = Math.min(Math.max(gameState.birdVelocity * 0.1, -0.5), 0.5);
      ctx.rotate(rotation);
      ctx.drawImage(
        birdRef.current,
        -birdSize / 2,
        -birdSize / 2,
        birdSize,
        birdSize
      );

      // Uncomment to debug hitbox
      // ctx.strokeStyle = 'red';
      // ctx.lineWidth = 2;
      // ctx.strokeRect(
      //   -birdHitboxSize.width / 2,
      //   -birdHitboxSize.height / 2,
      //   birdHitboxSize.width,
      //   birdHitboxSize.height
      // );
      
      ctx.restore();
    }

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(updateAndDraw);
  }, [isInitialized, gameState, gameSpeed, generatePipe]);

  // Start and cleanup game loop
  useEffect(() => {
    if (!isInitialized) return;

    console.log('Starting game loop');
    animationFrameRef.current = requestAnimationFrame(updateAndDraw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, updateAndDraw]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute top-4 left-4 z-10 flex gap-4">
          <div className="bg-black/70 p-2 rounded text-white">
            Level: {gameState.level}
          </div>
          <div className="bg-black/70 p-2 rounded text-white">
            Score: {gameState.score}
          </div>
        </div>
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            Loading assets... ({assetsLoaded}/3)
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border-2 border-foreground rounded-lg shadow-lg"
          onClick={handleJump}
        />
        {gameState.gameOver && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center bg-black/70 p-6 rounded-lg text-white">
            <h2 className="mb-4 text-2xl font-bold">Game Over!</h2>
            <p className="text-lg">Score: {gameState.score}</p>
            <p className="text-md mt-2">Level: {gameState.level}</p>
            <p className="mt-4 text-sm">Press Space or Click to play again</p>
          </div>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-600">
        Press Space or Click to jump
      </div>
    </div>
  );
} 