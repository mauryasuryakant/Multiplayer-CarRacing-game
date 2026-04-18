// const config = {
//     type: Phaser.AUTO,
//     width: 400,
//     height: 600,
//     parent: 'game-container',
//     transparent: true, // This is the key!
//     physics: {
//         default: 'arcade',
//     },
//     scene: { preload, create, update }
// };

// window.onload = () => {
//     const game = new Phaser.Game(config);
// };

// let player;
// let cursors;

// function preload() {
//     // Generate the car texture via code (no images needed)
//     const graphics = this.add.graphics();
//     graphics.fillStyle(0xff0000, 1);
//     graphics.fillRect(0, 0, 40, 70);
//     // Adding some "headlights" so we can see the front
//     graphics.fillStyle(0xffff00, 1);
//     graphics.fillRect(5, 0, 10, 5);
//     graphics.fillRect(25, 0, 10, 5);
    
//     graphics.generateTexture('car', 40, 70);
//     graphics.destroy();
// }

// function create() {
//     player = this.physics.add.sprite(200, 500, 'car');
//     player.setCollideWorldBounds(true);
//     cursors = this.input.keyboard.createCursorKeys();
// }

// function update() {
//     player.setVelocity(0);

//     if (cursors.left.isDown) {
//         player.setVelocityX(-250);
//     } else if (cursors.right.isDown) {
//         player.setVelocityX(250);
//     }
// }


// At the top of public/game.js
import { Game, AUTO, Scene } from '/phaser.esm.js';

class MainScene extends Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
        // Essential graphics-based car (no external images)
        const graphics = this.add.graphics();
        graphics.fillStyle(0xff0000, 1);
        graphics.fillRect(0, 0, 40, 70);
        graphics.generateTexture('car', 40, 70);
        graphics.destroy();
    }

    create() {
        this.player = this.physics.add.sprite(200, 500, 'car');
        this.player.setCollideWorldBounds(true);
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    update() {
        this.player.setVelocity(0);
        if (this.cursors.left.isDown) this.player.setVelocityX(-250);
        else if (this.cursors.right.isDown) this.player.setVelocityX(250);
    }
}

const config = {
    type: AUTO,
    width: 400,
    height: 600,
    parent: 'game-container',
    transparent: true,
    physics: { default: 'arcade' },
    scene: MainScene
};

new Game(config);
