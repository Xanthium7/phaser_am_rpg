import { GridEngine, Direction } from "grid-engine";
import * as Phaser from "phaser";
import { Scene } from "phaser";
import DialogueBox from "./DialogueBox";
import { Ai_response_log } from "@/actions/actions";
// import { Ai_response } from "@/actions/actions";

// to prevent chat controls from messing with game controls
declare global {
  interface Window {
    isChatFocused: boolean;
  }
}

export default class Preloader extends Scene {
  private gridEngine!: GridEngine;
  private socket!: SocketIOClient.Socket;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private name!: string;
  private players: { [id: string]: Phaser.GameObjects.Sprite } = {};
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};
  private characterGridWidths: { [id: string]: number } = {};
  private dialogueBox!: DialogueBox;
  private npcIsInteracting: boolean = false;

  constructor() {
    super("Preloader");
  }

  init(data: { socket: SocketIOClient.Socket }) {
    this.socket = data.socket;
    this.shiftKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    this.input.keyboard!.addCapture([Phaser.Input.Keyboard.KeyCodes.SHIFT]);
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  preload() {
    // const character_grid_width = 136 * Math.floor(Math.random() * 10);

    this.load.tilemapTiledJSON("map", "/assets/map1.json");
    this.load.image("tileset", "/assets/Overworld1.png");
    this.load.spritesheet("hero", "/assets/character.png", {
      frameWidth: 16,
      frameHeight: 32,
    });
    this.load.spritesheet("npc_log", "/assets/log.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }
  create() {
    const map = this.make.tilemap({ key: "map" });
    const tileset = map.addTilesetImage("Overworld", "tileset");
    const groundLayer = map.createLayer("ground", tileset!, 0, 0);
    const fenceLayer = map.createLayer("colliding", tileset!, 0, 0);
    const vaseLayer = map.createLayer("vases", tileset!, 0, 0);

    this.input.keyboard?.removeCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);

    //* Video call trigger
    this.input.keyboard!.on("keydown-F4", () => {
      this.handleVideoCall();
    });

    // Set the starting position
    const startPosition = { x: 130, y: 80 };

    this.dialogueBox = new DialogueBox(this, 50, 330, 850, 145);
    this.add.existing(this.dialogueBox);
    this.dialogueBox.show("Welcome to your new world!");

    // Create grid engine
    this.gridEngine.create(map, {
      characters: [
        {
          id: this.socket.id,
          sprite: this.players[this.socket.id],
          // speed: 1000,
          speed: 4,
          startPosition: startPosition,
        },
      ],
    });

    // Walk aimation for NPC
    this.anims.create({
      key: "npc_walk_down",
      frames: this.anims.generateFrameNumbers("npc_log", { start: 0, end: 3 }),
      frameRate: 16,
      repeat: -1,
    });

    this.anims.create({
      key: "npc_walk_left",
      frames: this.anims.generateFrameNumbers("npc_log", {
        start: 18,
        end: 21,
      }),
      frameRate: 16,
      repeat: -1,
    });

    this.anims.create({
      key: "npc_walk_right",
      frames: this.anims.generateFrameNumbers("npc_log", {
        start: 12,
        end: 15,
      }),
      frameRate: 16,
      repeat: -1,
    });

    this.anims.create({
      key: "npc_walk_up",
      frames: this.anims.generateFrameNumbers("npc_log", {
        start: 6,
        end: 9,
      }),
      frameRate: 16,
      repeat: -1,
    });

    this.addNPCLog();

    // Set up movement event listeners
    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      const sprite = this.players[charId];
      if (sprite) {
        sprite.anims.play(`${charId}_${direction}`);
      }
    });

    this.gridEngine.movementStopped().subscribe(({ charId, direction }) => {
      const sprite = this.players[charId];
      if (sprite) {
        sprite.anims.stop();
        const characterGridWidth = this.characterGridWidths[charId];
        sprite.setFrame(this.getStopFrame(direction, characterGridWidth));
      }
    });

    this.gridEngine.directionChanged().subscribe(({ charId, direction }) => {
      const sprite = this.players[charId];
      if (sprite) {
        const characterGridWidth = this.characterGridWidths[charId];
        sprite.setFrame(this.getStopFrame(direction, characterGridWidth));
      }
    });

    // Handle keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.socket.emit("getCurrentPlayers");
    this.setupMultiplayerEvents();

    // Handle player movement
    this.gridEngine.movementStopped().subscribe(({ charId }) => {
      if (charId === this.socket.id) {
        const newPosition = this.gridEngine.getPosition(charId);
        console.log(
          `Player moved to position: x=${newPosition.x}, y=${newPosition.y}`
        );
        this.socket.emit("playerMovement", {
          id: charId,
          x: newPosition.x,
          y: newPosition.y,
          speed: 4,
        });
      }
    });
  }

  private lastDirection: string = "down";

  private addNPCLog(): void {
    const startGridPosition = { x: 147, y: 70 }; // Grid coordinates
    const npcLog = this.add.sprite(0, 0, "npc_log");

    this.gridEngine.addCharacter({
      id: "npc_log",
      sprite: npcLog,
      startPosition: startGridPosition,
      speed: 2,
    });

    // Initialize NPC facing down
    // npcLog.play("npc_walk_down");

    // Listen to GridEngine movement events
    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      if (charId === "npc_log") {
        this.lastDirection = direction;
        npcLog.play(`npc_walk_${direction}`);
      }
    });
    this.gridEngine.movementStopped().subscribe(({ charId }) => {
      if (charId === "npc_log") {
        npcLog.anims.stop();
        // Set frame based on last direction
        switch (this.lastDirection) {
          case "up":
            npcLog.setFrame(6);
            break;
          case "down":
            npcLog.setFrame(0);
            break;
          case "left":
            npcLog.setFrame(13);
            break;
          case "right":
            npcLog.setFrame(8);
            break;
        }
      }
    });

    // Setup random movement via GridEngine
    this.time.addEvent({
      delay: 3000,
      callback: () => {
        // if (this.npcIsInteracting) {
        //   return; // Prevent movement during interaction
        // }
        const directions = ["up", "down", "left", "right"];
        const randomDirection = Phaser.Utils.Array.GetRandom(directions);

        const movementRange = 2; // Number of tiles to move from start position in any direction

        const currentPos = this.gridEngine.getPosition("npc_log");

        let newX = currentPos.x;
        let newY = currentPos.y;

        switch (randomDirection) {
          case "up":
            newY = currentPos.y - movementRange;
            break;
          case "down":
            newY = currentPos.y + movementRange;
            break;
          case "left":
            newX = currentPos.x - movementRange;
            break;
          case "right":
            newX = currentPos.x + movementRange;
            break;
        }

        // Clamp new position within movement boundaries around start
        const minX = startGridPosition.x - movementRange;
        const maxX = startGridPosition.x + movementRange;
        const minY = startGridPosition.y - movementRange;
        const maxY = startGridPosition.y + movementRange;

        newX = Phaser.Math.Clamp(newX, minX, maxX);
        newY = Phaser.Math.Clamp(newY, minY, maxY);

        // If new position is different, move NPC
        if (newX !== currentPos.x || newY !== currentPos.y) {
          this.gridEngine.moveTo("npc_log", { x: newX, y: newY });
        }
      },
      loop: true,
    });
  }

  private handleVideoCall(): void {
    const currentPlayerId = this.socket.id;
    const facingDirection = this.gridEngine.getFacingDirection(currentPlayerId);
    const currentPosition = this.gridEngine.getPosition(currentPlayerId);

    const targetPosition = { ...currentPosition }; // Copy the current position
    switch (facingDirection) {
      case "up":
        targetPosition.y -= 1;
        break;
      case "down":
        targetPosition.y += 1;
        break;
      case "left":
        targetPosition.x -= 1;
        break;
      case "right":
        targetPosition.x += 1;
        break;
    }

    // Check if another player occupies that tile
    const playersInFront = Object.keys(this.players).filter((id) => {
      if (id === currentPlayerId) return false;
      const pos = this.gridEngine.getPosition(id);
      return pos.x === targetPosition.x && pos.y === targetPosition.y;
    });

    if (playersInFront.length > 0) {
      const targetPlayerId = playersInFront[0]; // Single player
      this.socket.emit("initiate-video-call", { targetId: targetPlayerId });
    } else {
      this.dialogueBox.show("No player is in front of you.");
    }
  }
  private lastInteractionTime: number = 0;
  private interactionCooldown: number = 500; // 500ms cooldown

  private handleInteractivity(): void {
    const currentTime = Date.now();
    if (currentTime - this.lastInteractionTime < this.interactionCooldown) {
      return; // Prevent spamming
    }
    this.lastInteractionTime = currentTime;

    const currentPlayerId = this.socket.id;
    const facingDirection = this.gridEngine.getFacingDirection(currentPlayerId);
    const currentPosition = this.gridEngine.getPosition(currentPlayerId);

    const targetPosition = { ...currentPosition }; // Copy the current position
    switch (facingDirection) {
      case "up":
        targetPosition.y -= 1;
        break;
      case "down":
        targetPosition.y += 1;
        break;
      case "left":
        targetPosition.x -= 1;
        break;
      case "right":
        targetPosition.x += 1;
        break;
    }

    // this.dialogueBox.show(
    //   `You interacted at position X:${targetPosition.x}, Y:${targetPosition.y}`
    // );
    if (
      (targetPosition.x === 82 && targetPosition.y === 89) ||
      (targetPosition.x === 81 && targetPosition.y === 89) ||
      (targetPosition.x === 81 && targetPosition.y === 88) ||
      (targetPosition.x === 82 && targetPosition.y === 88)
    ) {
      this.showJukeBoxModal();
    }
    if (
      (targetPosition.x === 21 && targetPosition.y === 107) ||
      (targetPosition.x === 22 && targetPosition.y === 106) ||
      (targetPosition.x === 23 && targetPosition.y === 107) ||
      (targetPosition.x === 23 && targetPosition.y === 108) ||
      (targetPosition.x === 23 && targetPosition.y === 109)
    ) {
      this.dialogueBox.show("This looks a bit... SUS..");
    }
    if (
      (targetPosition.x === 142 && targetPosition.y === 77) ||
      (targetPosition.x === 141 && targetPosition.y === 77) ||
      (targetPosition.x === 142 && targetPosition.y === 76) ||
      (targetPosition.x === 141 && targetPosition.y === 76)
    ) {
      this.dialogueBox.show("YO ANGELO!");
    }
    if (targetPosition.x === 196 && targetPosition.y === 78) {
      this.dialogueBox.show("I built a cool castle here but a caseo ate it");
    }
    if (targetPosition.x === 118 && targetPosition.y === 50) {
      this.dialogueBox.show("Welcome to Chill-Mart");
    }
    if (targetPosition.x === 162 && targetPosition.y === 32) {
      this.dialogueBox.show("Welcome to DroopyVille");
    }
    if (targetPosition.x === 177 && targetPosition.y === 26) {
      this.dialogueBox.show("'sign seems too worn down to read...'");
    }
    if (targetPosition.x === 181 && targetPosition.y === 53) {
      this.dialogueBox.show("The Dead dont tell tales..");
    }
    if (targetPosition.x === 162 && targetPosition.y === 32) {
      this.dialogueBox.show("Drop by DroopyVille");
    }
    if (targetPosition.x === 58 && targetPosition.y === 32) {
      this.dialogueBox.show("CHILLINGTON PARK");
    }
    if (targetPosition.x === 49 && targetPosition.y === 44) {
      this.dialogueBox.show(
        "'Hello.. Can u hear me... Im under the water... here too much raining.. weeps*"
      );
    }
    if (targetPosition.x === 46 && targetPosition.y === 78) {
      this.dialogueBox.show("PUBLIC LIBRARY");
    }

    if (
      (targetPosition.x === 207 && targetPosition.y === 66) ||
      (targetPosition.x === 206 && targetPosition.y === 66) ||
      (targetPosition.x === 205 && targetPosition.y === 66)
    ) {
      this.dialogueBox.show("Glad they are not placed on Soul Soil..");
    }
    const npcGridPosition = this.gridEngine.getPosition("npc_log");
    const distance = Phaser.Math.Distance.Between(
      targetPosition.x,
      targetPosition.y,
      npcGridPosition.x,
      npcGridPosition.y
    );

    if (distance <= 1) {
      this.npcIsInteracting = true;
      const prompt = window.prompt("Talk to groot: ");
      if (prompt?.startsWith("go to")) {
      }
      // Extract coordinates from the prompt
      const coordinates = prompt?.split(" ").slice(2);
      if (coordinates?.length === 2) {
        const x = parseInt(coordinates[0], 10);
        const y = parseInt(coordinates[1], 10);
        if (!isNaN(x) && !isNaN(y)) {
          this.gridEngine.moveTo("npc_log", { x, y });
          this.dialogueBox.show(`NPC is moving to (${x}, ${y})`);
        }
      } else if (prompt !== null) {
        Ai_response_log(prompt, this.name).then((response: any) => {
          this.dialogueBox.show(response);
        });
      }
    }
  }

  private showJukeBoxModal() {
    this.socket.emit("showJukeboxModal");
  }

  // ANIAMTION LOGIC
  private createPlayerAnimation(
    name: string,
    startFrame: number,
    endFrame: number
  ) {
    this.anims.create({
      key: name,
      frames: this.anims.generateFrameNumbers("hero", {
        start: startFrame,
        end: endFrame,
      }),
      frameRate: 16,
      repeat: -1,
      yoyo: true,
    });
  }
  private getStopFrame(direction: string, characterGridWidth: number): number {
    switch (direction) {
      case "up":
        return 34 + characterGridWidth;
      case "right":
        return 17 + characterGridWidth;
      case "down":
        return 0 + characterGridWidth;
      case "left":
        return 51 + characterGridWidth;
      default:
        return 0 + characterGridWidth;
    }
  }

  private setupMultiplayerEvents() {
    // Handle new player joining
    this.socket.on("newPlayer", (playerInfo: any) => {
      console.log(`New player connected: ${playerInfo.id}`);
      this.addPlayer(playerInfo, false);
    });

    // Handle current players already in the game
    this.socket.on("currentPlayers", (players: any) => {
      console.log("Received currentPlayers:", players);
      Object.keys(players).forEach((id) => {
        const playerInfo = players[id];
        console.log(`Processing player ID: ${id}`);
        if (id === this.socket.id) {
          console.log("Adding current player");
          this.addPlayer(playerInfo, id === this.socket.id);
          // Current player already added
        } else {
          console.log("Adding other player");
          this.addPlayer(playerInfo, id === this.socket.id);
        }
      });
    });

    // Handle player movement
    this.socket.on("playerMoved", (playerInfo: any) => {
      if (playerInfo.id !== this.socket.id) {
        const player = this.players[playerInfo.id];
        if (player && this.gridEngine.hasCharacter(playerInfo.id)) {
          this.gridEngine.moveTo(playerInfo.id, {
            x: playerInfo.x,
            y: playerInfo.y,
          });
          this.gridEngine.setSpeed(playerInfo.id, playerInfo.speed);
        }
      }
    });

    // Handle player disconnect
    this.socket.on("playerDisconnected", (id: string) => {
      console.log(`Player disconnected: ${id}`);
      if (this.players[id]) {
        this.gridEngine.removeCharacter(id);
        this.players[id].destroy();
        delete this.players[id];
      }
      if (this.nameTexts[id]) {
        this.nameTexts[id].destroy();
        delete this.nameTexts[id];
      }
    });
  }

  private addPlayer(playerInfo: any, isCurrentPlayer: boolean) {
    const x = playerInfo.x * 16;
    const y = playerInfo.y * 16;

    const hash = playerInfo.id
      .split("")
      .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const characterGridWidth = 136 * (hash % 10);
    this.characterGridWidths[playerInfo.id] = characterGridWidth;

    const sprite = this.add.sprite(x, y, "hero", characterGridWidth);

    // Create animations
    this.createPlayerAnimation(
      `${playerInfo.id}_down`,
      0 + characterGridWidth,
      3 + characterGridWidth
    );
    this.createPlayerAnimation(
      `${playerInfo.id}_right`,
      17 + characterGridWidth,
      20 + characterGridWidth
    );
    this.createPlayerAnimation(
      `${playerInfo.id}_up`,
      34 + characterGridWidth,
      37 + characterGridWidth
    );
    this.createPlayerAnimation(
      `${playerInfo.id}_left`,
      51 + characterGridWidth,
      54 + characterGridWidth
    );

    this.players[playerInfo.id] = sprite;

    const playerName = playerInfo.name || "Chigga";
    this.name = playerName;

    //These values dodnt matter cause we set it in the update function
    const nameText = this.add
      .text(0, 0, playerName, {
        fontSize: "8px",
        fontStyle: "bold",
        color: "#ffffff",
        fontFamily: "monaco, monospace",
        resolution: 1,
      })
      .setOrigin(0.5, 1);
    nameText.setDepth(10);
    this.nameTexts[playerInfo.id] = nameText;

    this.gridEngine.addCharacter({
      id: playerInfo.id,
      sprite: sprite,
      startPosition: { x: playerInfo.x, y: playerInfo.y },
      speed: playerInfo.speed || 4,
    });
    if (isCurrentPlayer) {
      this.cameras.main.startFollow(sprite, true);
      this.cameras.main.setFollowOffset(-sprite.width, -sprite.height);
    }
  }
  //   const COLORS = ["BLUE", "WHITE", "BLACK", "BASIC", "PINK", "BROWN", "VIOLET", "YELLOW", "GREEN", "CYAN"];

  update() {
    const playerId = this.socket.id;

    // Update Player Name positions
    Object.keys(this.players).forEach((id) => {
      const sprite = this.players[id];
      const nameText = this.nameTexts[id];
      if (sprite && nameText) {
        nameText.setPosition(sprite.x + sprite.width / 2, sprite.y);
      }
    });

    if (!this.gridEngine.hasCharacter(playerId)) {
      // console.log(`Character with ID ${playerId} does not exist in GridEngine`);
      return;
    }
    // **Check if chat input is focused**
    if (window.isChatFocused) {
      return;
    }

    if (!this.gridEngine.isMoving(playerId)) {
      let moved = false;
      const speed = this.shiftKey.isDown ? 8 : 4;
      this.gridEngine.setSpeed(playerId, speed);

      if (this.cursors.left.isDown) {
        this.gridEngine.move(playerId, Direction.LEFT);
        moved = true;
      } else if (this.cursors.right.isDown) {
        this.gridEngine.move(playerId, Direction.RIGHT);
        moved = true;
      } else if (this.cursors.up.isDown) {
        this.gridEngine.move(playerId, Direction.UP);
        moved = true;
      } else if (this.cursors.down.isDown) {
        this.gridEngine.move(playerId, Direction.DOWN);
        moved = true;
      } else if (this.cursors.space.isDown) {
        this.handleInteractivity();
      } else {
      }
      if (moved) {
        const currentPosition = this.gridEngine.getPosition(playerId);
        this.socket.emit("playerMovement", {
          id: playerId,
          x: currentPosition.x,
          y: currentPosition.y,
          speed: speed, // Include current speed
        });
      }
    }
  }
}
