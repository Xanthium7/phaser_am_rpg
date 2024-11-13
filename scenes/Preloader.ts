

import {GridEngine, Direction} from "grid-engine";
import Phaser, {Scene} from "phaser";



export default class Preloader extends Scene {
    private gridEngine!: GridEngine;
    private socket!: SocketIOClient.Socket;
    private players: { [id: string]: Phaser.GameObjects.Sprite } = {};
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    constructor() {
        super('Preloader');
    }

    init(data: { socket: SocketIOClient.Socket }) {
      this.socket = data.socket;
      this.cursors = this.input.keyboard!.createCursorKeys();
    }

    preload(){

        this.load.tilemapTiledJSON('map', 'assets/map.json');
        this.load.image('tileset', 'assets/Overworld.png');
        this.load.spritesheet('hero', 'assets/character.png', { frameWidth: 16, frameHeight: 32 });
    }
    create() {
      const map = this.make.tilemap({ key: 'map' });
      const tileset = map.addTilesetImage('Overworld', 'tileset');
      const groundLayer = map.createLayer('ground', tileset!, 0, 0);
      const fenceLayer = map.createLayer('fence', tileset!, 0, 0);
    
      
    
      // Set the starting position
      const startPosition = { x: 25, y: 20 };
      
      // Initialize your own player
      
      // Create grid engine
      this.gridEngine.create(map, {
        characters: [
          {
            id: this.socket.id,
            sprite: this.players[this.socket.id],
            startPosition: startPosition,
          },
        ],
      });
      
      this.addPlayer({ id: this.socket.id, x: startPosition.x, y: startPosition.y }, true);
      this.socket.emit('playerMovement', { id: this.socket.id, x: startPosition.x, y: startPosition.y });
    
      // Handle keyboard input
      this.cursors = this.input.keyboard!.createCursorKeys();
    
      // Setup multiplayer events
      this.setupMultiplayerEvents();
    
      // Handle player movement
      this.gridEngine.movementStopped().subscribe(({ charId }) => {
        if (charId === this.socket.id) {
          const newPosition = this.gridEngine.getPosition(charId);
          console.log(`Player moved to position: x=${newPosition.x}, y=${newPosition.y}`);
          this.socket.emit('playerMovement', {
            id: charId,
            x: newPosition.x,
            y: newPosition.y,
          });
        }
      });
      
    }
    
    private setupMultiplayerEvents() {
      
    
      // Handle new player joining
      this.socket.on("newPlayer", (playerInfo: any) => {
        console.log(`New player connected: ${playerInfo.id}`);
        this.addPlayer(playerInfo, false);
      });

      // Handle current players already in the game
      this.socket.on("currentPlayers", (players: any) => {
        console.log('Received currentPlayers:', players);
        Object.keys(players).forEach((id) => {
          const playerInfo = players[id];
          console.log(`Processing player ID: ${id}`);
          if (id === this.socket.id) {
            console.log('Adding current player');
            //this.addPlayer({ id, x: playerInfo.x, y: playerInfo.y },  id === this.socket.id);
            // Current player already added
          } else {
            console.log('Adding other player');
            this.addPlayer({ id, x: playerInfo.x, y: playerInfo.y },  id === this.socket.id);
          }
        });
      });
    
      // Handle player movement
      this.socket.on("playerMoved", (playerInfo: any) => {
        if (playerInfo.id !== this.socket.id) {
          const player = this.players[playerInfo.id];
          if (player && this.gridEngine.hasCharacter(playerInfo.id)) {
            this.gridEngine.moveTo(playerInfo.id, { x: playerInfo.x, y: playerInfo.y });
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
      });
    }
    
    private addPlayer(playerInfo: any, isCurrentPlayer: boolean) {
      const sprite = this.add.sprite(playerInfo.x * 16, playerInfo.y * 16, 'hero');
      this.players[playerInfo.id] = sprite;
    
      this.gridEngine.addCharacter({
        id: playerInfo.id,
        sprite: sprite,
        startPosition: { x: playerInfo.x, y: playerInfo.y },
      });
      if (isCurrentPlayer) {
        this.cameras.main.startFollow(sprite, true);
        this.cameras.main.setFollowOffset(-sprite.width, -sprite.height);
      }
      // if (!isCurrentPlayer) {
      //   this.gridEngine.addCharacter({
      //     id: playerInfo.id,
      //     sprite: sprite,
      //     startPosition: { x: playerInfo.x, y: playerInfo.y },
      //   });
      // }

      // if (!this.gridEngine.hasCharacter(playerInfo.id)) {
      //   this.gridEngine.addCharacter({
      //     id: playerInfo.id,
      //     sprite: sprite,
      //     startPosition: { x: playerInfo.x, y: playerInfo.y },
      //   });
      // }
    }

  // private addPlayer(playerInfo: any, isCurrentPlayer: boolean) {
  //   const sprite = this.add.sprite(0, 0, 'hero');
  //   this.players[playerInfo.id] = sprite;
  
  //   const characterConfig = {
  //     id: playerInfo.id,
  //     sprite: sprite,
  //     startPosition: { x: playerInfo.x, y: playerInfo.y },
  //     speed: 4,
  //     collides: true,
  //   };
  
  //   this.gridEngine.addCharacter(characterConfig);
  
  //   if (isCurrentPlayer) {
  //     this.cameras.main.startFollow(sprite, true);
  //     this.cameras.main.setFollowOffset(-sprite.width, -sprite.height);
  //   }
  // }
  update() {
    const playerId = this.socket.id;
  
    if (!this.gridEngine.hasCharacter(playerId)) {
      console.log(`Character with ID ${playerId} does not exist in GridEngine`);
      return;
    }


    if (!this.gridEngine.isMoving(playerId)) {
        let moved = false;

        if (this.cursors.left.isDown) {
            console.log("Left key is down");
            this.gridEngine.move(playerId, Direction.LEFT);
            moved = true;
        } else if (this.cursors.right.isDown) {
            console.log("Right key is down");
            this.gridEngine.move(playerId, Direction.RIGHT);
            moved = true;
        } else if (this.cursors.up.isDown) {
            console.log("Up key is down");
            this.gridEngine.move(playerId, Direction.UP);
            moved = true;
        } else if (this.cursors.down.isDown) {
            console.log("Down key is down");
            this.gridEngine.move(playerId, Direction.DOWN);
            moved = true;
        } else {
            console.log("No movement keys are pressed");
        }
  
    // Listen for movement completion
    // if(moved){

      
    // }
  }
}}