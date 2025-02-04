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

interface Dimensions {
  width: number;
  height: number;
  scale: number;
}

export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const birdRef = useRef<HTMLImageElement | null>(null);
  const tubeRef = useRef<HTMLImageElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 800,
    height: 600,
    scale: 1
  });
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
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Constants scaled by screen size
  const getScaledConstants = useCallback(() => {
    const scale = dimensions.scale;
    return {
      gravity: 0.5 * scale,
      jumpStrength: -8 * scale,
      baseGameSpeed: 3 * scale,
      pipeWidth: 52 * scale,
      gapHeight: 150 * scale,
      minPipeHeight: 50 * scale,
      birdSize: 48 * scale,
      birdHitboxSize: {
        width: 48 * 0.6 * scale,
        height: 48 * 0.4 * scale,
      },
    };
  }, [dimensions.scale]);

  const constants = getScaledConstants();

  // Initialize audio
  useEffect(() => {
    const audio = new Audio('/audio/bgsong.mp3');
    audio.loop = true;
    audioRef.current = audio;

    // Try to load the audio
    audio.load();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle game state changes for audio
  useEffect(() => {
    if (!audioRef.current || !audioInitialized) return;

    if (gameState.gameOver) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else if (!gameState.gameOver && isInitialized && !isMuted) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Audio playback failed:', error);
        });
      }
    }
  }, [gameState.gameOver, isInitialized, audioInitialized, isMuted]);

  // Initialize audio on first interaction
  const initializeAudio = useCallback(() => {
    if (!audioInitialized && audioRef.current && !isMuted) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAudioInitialized(true);
          })
          .catch(error => {
            console.error('Audio initialization failed:', error);
          });
      }
    }
  }, [audioInitialized, isMuted]);

  // Handle jump action
  const handleJump = useCallback(() => {
    // Initialize audio on first jump
    initializeAudio();

    if (!gameState.gameOver) {
      setGameState((prev) => ({
        ...prev,
        birdVelocity: constants.jumpStrength,
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
  }, [gameState.gameOver, constants.jumpStrength, initializeAudio]);

  // Draw bird function
  const drawBird = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!birdRef.current) return;

    ctx.save();
    const scaledX = 100 * dimensions.scale;
    ctx.translate(scaledX, gameState.birdPosition * dimensions.scale);
    const rotation = Math.min(Math.max(gameState.birdVelocity * 0.1, -0.5), 0.5);
    ctx.rotate(rotation);
    ctx.drawImage(
      birdRef.current,
      -constants.birdSize / 2,
      -constants.birdSize / 2,
      constants.birdSize,
      constants.birdSize
    );
    ctx.restore();
  }, [gameState.birdPosition, gameState.birdVelocity, dimensions.scale, constants.birdSize]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;

      const maxWidth = Math.min(800, window.innerWidth - 32); // -32 for padding
      const maxHeight = Math.min(600, window.innerHeight - 100); // -100 for score and instructions
      const scale = Math.min(maxWidth / 800, maxHeight / 600);

      setDimensions({
        width: 800 * scale,
        height: 600 * scale,
        scale
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize game with new dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

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
      setIsInitialized(true);
    });

    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [dimensions]);

  // Handle touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      handleJump();
    };

    canvas.addEventListener('touchstart', handleTouch);
    return () => canvas.removeEventListener('touchstart', handleTouch);
  }, [handleJump]);

  // Generate random pipe height
  const generatePipe = useCallback((canvasHeight: number): Pipe => {
    const minGap = constants.minPipeHeight;
    const maxGap = canvasHeight - minGap - constants.gapHeight;
    const gapStart = Math.floor(Math.random() * (maxGap - minGap + 1)) + minGap;
    
    return {
      x: 800, // Canvas width
      gapStart,
      gapHeight: constants.gapHeight,
    };
  }, [constants.gapHeight, constants.minPipeHeight]);

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
        const newBirdVelocity = prev.birdVelocity + constants.gravity * (deltaTime / 16);

        // Update pipes
        const newPipes = prev.pipes
          .map(pipe => ({ ...pipe, x: pipe.x - constants.baseGameSpeed * (deltaTime / 16) }))
          .filter(pipe => pipe.x + constants.pipeWidth > 0);

        // Generate new pipes
        if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < 600) {
          newPipes.push(generatePipe(canvas.height));
        }

        // Check for scoring
        const scoringPipe = newPipes.find(pipe => 
          pipe.x + constants.pipeWidth <= 100 && pipe.x + constants.pipeWidth > 100 - constants.baseGameSpeed
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
        const birdLeft = birdX - constants.birdHitboxSize.width / 2;
        const birdRight = birdX + constants.birdHitboxSize.width / 2;
        const birdTop = birdY - constants.birdHitboxSize.height / 2;
        const birdBottom = birdY + constants.birdHitboxSize.height / 2;

        const hasCollision = newPipes.some(pipe => {
          // Check collision with top pipe
          const topPipeCollision = 
            birdRight > pipe.x && 
            birdLeft < pipe.x + constants.pipeWidth &&
            birdTop < pipe.gapStart;

          // Check collision with bottom pipe
          const bottomPipeCollision = 
            birdRight > pipe.x && 
            birdLeft < pipe.x + constants.pipeWidth &&
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
        ctx.drawImage(tubeRef.current!, 0, 0, constants.pipeWidth, pipe.gapStart);
        ctx.restore();

        // Draw bottom pipe
        ctx.drawImage(
          tubeRef.current!,
          pipe.x,
          pipe.gapStart + pipe.gapHeight,
          constants.pipeWidth,
          canvas.height - (pipe.gapStart + pipe.gapHeight)
        );
      });
    }

    // Draw bird with rotation based on velocity
    drawBird(ctx);

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(updateAndDraw);
  }, [isInitialized, gameState, constants, generatePipe, drawBird]);

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div ref={containerRef} className="relative w-full max-w-[800px]">
        <div className="absolute top-4 left-4 z-10 flex gap-4">
          <div className="bg-black/70 p-2 rounded text-white text-sm sm:text-base">
            Level: {gameState.level}
          </div>
          <div className="bg-black/70 p-2 rounded text-white text-sm sm:text-base">
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
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
          className="border-2 border-foreground rounded-lg shadow-lg touch-none"
          onClick={handleJump}
        />
        {gameState.gameOver && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center bg-black/70 p-4 sm:p-6 rounded-lg text-white">
            <h2 className="mb-4 text-xl sm:text-2xl font-bold">Game Over!</h2>
            <p className="text-base sm:text-lg">Score: {gameState.score}</p>
            <p className="text-sm sm:text-md mt-2">Level: {gameState.level}</p>
            <p className="mt-4 text-xs sm:text-sm">Tap or Press Space to play again</p>
          </div>
        )}
      </div>
      <div className="mt-4 text-xs sm:text-sm text-gray-600">
        Tap screen or Press Space to jump
      </div>
      <button
        onClick={() => {
          if (audioRef.current) {
            if (isMuted) {
              setIsMuted(false);
              if (audioInitialized && !gameState.gameOver) {
                audioRef.current.play().catch(console.error);
              }
            } else {
              setIsMuted(true);
              audioRef.current.pause();
            }
          }
        }}
        className="absolute top-4 right-4 bg-black/70 p-2 rounded text-white text-sm sm:text-base hover:bg-black/80 transition-colors"
      >
        {isMuted ? '🔇 Unmute' : '🔊 Mute'}
      </button>
      {!audioInitialized && !isMuted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 p-2 rounded text-white text-xs sm:text-sm">
          Tap or press Space to start with music
        </div>
      )}
    </div>
  );
} 