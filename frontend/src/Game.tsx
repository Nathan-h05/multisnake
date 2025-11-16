import { useEffect, useRef, useState } from "react";

const CELL_SIZE = 20;
const BOARD_WIDTH = 30;
const BOARD_HEIGHT = 20;

type Position = { x: number; y: number };

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snake, setSnake] = useState<Position[]>([
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ]);
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 });
  const [apple, setApple] = useState<Position>({ x: 10, y: 10 });

  // Spawn a new apple somewhere random
  const spawnApple = () => {
    setApple({
      x: Math.floor(Math.random() * BOARD_WIDTH),
      y: Math.floor(Math.random() * BOARD_HEIGHT),
    });
  };

  const gameTick = () => {
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = { x: head.x + direction.x, y: head.y + direction.y };

      // Wrap around
      if (newHead.x < 0) newHead.x = BOARD_WIDTH - 1;
      if (newHead.x >= BOARD_WIDTH) newHead.x = 0;
      if (newHead.y < 0) newHead.y = BOARD_HEIGHT - 1;
      if (newHead.y >= BOARD_HEIGHT) newHead.y = 0;

      let newSnake = [newHead, ...prevSnake];

      // Eat apple
      if (newHead.x === apple.x && newHead.y === apple.y) {
        spawnApple();
      } else {
        newSnake.pop(); // move without growing
      }

      return newSnake;
    });
  };

  // Draw everything on canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    ctx.fillStyle = "lime";
    snake.forEach((p) => {
      ctx.fillRect(p.x * CELL_SIZE, p.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    // Draw apple
    ctx.fillStyle = "red";
    ctx.fillRect(apple.x * CELL_SIZE, apple.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  };

  // Handle arrow keys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && direction.y !== 1) setDirection({ x: 0, y: -1 });
      if (e.key === "ArrowDown" && direction.y !== -1) setDirection({ x: 0, y: 1 });
      if (e.key === "ArrowLeft" && direction.x !== 1) setDirection({ x: -1, y: 0 });
      if (e.key === "ArrowRight" && direction.x !== -1) setDirection({ x: 1, y: 0 });
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [direction]);

  // Game loop (8 FPS = classic snake)
  useEffect(() => {
    const interval = setInterval(() => {
      gameTick();
      draw();
    }, 125);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex justify-center items-center h-screen">
      <canvas
        ref={canvasRef}
        width={BOARD_WIDTH * CELL_SIZE}
        height={BOARD_HEIGHT * CELL_SIZE}
        style={{ border: "3px solid white" }}
      />
    </div>
  );
}
