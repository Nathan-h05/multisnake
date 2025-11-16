import { useEffect, useRef, useState } from "react";
import socket from "./socket";

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
  const [otherPlayers, setOtherPlayers] = useState<Record<string, { segments: Position[] }>>({});

  // keep a ref of the latest snake so we can emit reliably from the interval
  const snakeRef = useRef<Position[]>(snake);

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

      // sync ref
      snakeRef.current = newSnake;

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

    // Draw other players in blue
    ctx.fillStyle = "deepskyblue";
    Object.values(otherPlayers).forEach((player) => {
      player.segments.forEach((p) => {
        ctx.fillRect(p.x * CELL_SIZE, p.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      });
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

  // keep ref synced if snake changed elsewhere
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);

  // Game loop (8 FPS = classic snake)
  useEffect(() => {
    const interval = setInterval(() => {
      gameTick();
      draw();

      // emit our current snake to the server so others can see us
      try {
        if ((socket as any) && (socket as any).connected) {
          socket.emit("state", { segments: snakeRef.current });
        }
      } catch (e) {
        // ignore for now
      }
    }, 125);
    return () => clearInterval(interval);
  });

  // Listen for players updates from server
  useEffect(() => {
    const handler = (players: Record<string, any>) => {
      // remove our own id from the otherPlayers list
      const copy: Record<string, { segments: Position[] }> = {};
      Object.keys(players || {}).forEach((id) => {
        if (id === (socket as any).id) return;
        copy[id] = { segments: players[id].segments || [] };
      });
      setOtherPlayers(copy);
    };

    socket.on("players", handler);
    // request an initial players list (server will broadcast updates when states arrive)
    try { socket.emit("state", { segments: snakeRef.current }); } catch {}

    return () => {
      try { socket.off("players", handler); } catch {}
    };
  }, []);

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
