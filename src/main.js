import Phaser from 'phaser';
import GameScene from './GameScene';

const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: GameScene
};

const game = new Phaser.Game(config);
