

import {GridEngine, Direction} from "grid-engine";
import Phaser, {Scene} from "phaser";



export default class Preloader extends Scene {
    private gridEngine!: GridEngine;
    constructor() {
        super('Preloader');
    }
    preload(){

        this.load.tilemapTiledJSON('map', 'assets/map.json');
        this.load.image('tileset', 'assets/Overworld.png');
        this.load.spritesheet('hero', 'assets/character.png', { frameWidth: 16, frameHeight: 32 });
    }
    create(){
        // this.tileWidth = 16;
        // this.tileHeight = 16;
    
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('TilesetNameInTiled', 'tileset');
  
  // Create layers based on layer names in Tiled
        const groundLayer = map.createLayer('ground', tileset!, 0, 0);
        const fenceLayer = map.createLayer('fence', tileset!, 0, 0);
        fenceLayer!.setCollisionByProperty({ collides: true });
    
        const heroSprite = this.physics.add.sprite(0, 0, 'hero');
        
        
        // Camera follow logic >o<
        this.cameras.main.startFollow(heroSprite, true)
        this.cameras.main.setFollowOffset(-heroSprite.width, -heroSprite.height)
    
        const gridEngineConfig = {
            characters: [{
                id: 'hero',
                sprite: heroSprite,
                startPosition: { x: 8, y: 8 },
            }],
        };
        this.gridEngine.create(map, gridEngineConfig);

        // Objects
        
    }

    update(){
        const cursors = this.input?.keyboard?.createCursorKeys();

        if (cursors) {
            if (cursors.left.isDown) {
                this.gridEngine.move('hero', Direction.LEFT);
            } else if (cursors.right.isDown) {
                this.gridEngine.move('hero', Direction.RIGHT);
            } else if (cursors.up.isDown) {
                this.gridEngine.move('hero', Direction.UP);
            } else if (cursors.down.isDown) {
                this.gridEngine.move('hero', Direction.DOWN);
            }
        }
    }
}