// Centralized state management for the multiplayer snake game
// This module exports getters and setters to maintain clean encapsulation

let socket = null;
let currentRoomCode = null;
let localGameState = null;
let userId = null;
let isHost = false;
let lastDirectionSent = null;
let userName = null;
let timerIntervalId = null;

// Socket
export function getSocket() { return socket; }
export function setSocket(newSocket) { socket = newSocket; }

// Room Code
export function getRoomCode() { return currentRoomCode; }
export function setRoomCode(code) { currentRoomCode = code; }

// Game State
export function getGameState() { return localGameState; }
export function setGameState(state) { localGameState = state; }

// User ID
export function getUserId() { return userId; }
export function setUserId(id) { userId = id; }

// Host Status
export function getIsHost() { return isHost; }
export function setIsHost(host) { isHost = host; }

// Last Direction Sent
export function getLastDirectionSent() { return lastDirectionSent; }
export function setLastDirectionSent(dir) { lastDirectionSent = dir; }

// User Name
export function getUserName() { return userName; }
export function setUserName(name) { userName = name; }

// Timer Interval
export function getTimerIntervalId() { return timerIntervalId; }
export function setTimerIntervalId(id) { timerIntervalId = id; }
