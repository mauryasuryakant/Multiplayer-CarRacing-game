import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.score = 0;
        this.isGameOver = false;
        this.topScore = parseInt(localStorage.getItem('topScore')) || 0;
    }

    preload() {
        // Assets are in the public folder, Vite serves it from root
        this.load.image('road', '/road.jpg');
        this.load.image('player-car', '/white-car.avif');
        this.load.image('enemy-red', '/red-car.avif');
        this.load.image('enemy-blue', '/blue-car.avif');
        this.load.image('enemy-yellow', '/yellow-car.avif');
    }

    create() {
        // Reset state
        this.score = 0;
        this.isGameOver = false;
        this.updateScoreUI();

        // Create Scrolling Road (TileSprite)
        // Make sure it covers the screen but allows cars to look proportional
        this.road = this.add.tileSprite(200, 300, 400, 600, 'road');
        this.road.setTileScale(1, 1);

        // Player Setup (White Car)
        this.player = this.physics.add.sprite(200, 500, 'player-car');
        this.player.setScale(0.15); // Scale down to fit the road
        this.player.setCollideWorldBounds(true);
        
        // Enemy Group
        this.enemies = this.physics.add.group();

        // Input Setup (WASD)
        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Spawn Enemies
        this.spawnTimer = this.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Collision Detection
        this.physics.add.overlap(this.player, this.enemies, this.handleCollision, null, this);

        // Restart logic
        document.getElementById('restart-btn').onclick = () => {
            document.getElementById('game-over-modal').classList.add('hidden');
            this.scene.restart();
        };

        // Update Top Score initially
        document.getElementById('top-score').innerText = `Top Score: ${this.topScore}`;
    }

    update() {
        if (this.isGameOver) return;

        // Scroll Road
        this.road.tilePositionY -= 8;

        // Player Movement (Smoother)
        const speed = 350;
        let vx = 0;
        let vy = 0;

        if (this.keys.left.isDown) vx = -speed;
        else if (this.keys.right.isDown) vx = speed;

        if (this.keys.up.isDown) vy = -speed;
        else if (this.keys.down.isDown) vy = speed;

        this.player.setVelocity(vx, vy);

        // Handle enemies passing through
        this.enemies.getChildren().forEach((enemy) => {
            if (enemy.y > 700) {
                this.score++;
                this.updateScoreUI();
                enemy.destroy();
            }
        });
    }

    spawnEnemy() {
        if (this.isGameOver) return;

        const enemyTypes = ['enemy-red', 'enemy-blue', 'enemy-yellow'];
        const randomType = Phaser.Utils.Array.GetRandom(enemyTypes);
        // Ensure they spawn within the road lanes (adjusting based on 400px width)
        const x = Phaser.Math.Between(80, 320);
        
        const enemy = this.enemies.create(x, -100, randomType);
        enemy.setScale(0.15); // Match player scale
        enemy.setVelocityY(Phaser.Math.Between(250, 450));
        
        // Slightly increase difficulty over time
        this.spawnTimer.delay = Math.max(600, 1500 - (this.score * 15));
    }

    handleCollision() {
        this.isGameOver = true;
        this.physics.pause();
        this.spawnTimer.remove();

        // Update Top Score
        if (this.score > this.topScore) {
            this.topScore = this.score;
            localStorage.setItem('topScore', this.topScore);
            document.getElementById('top-score').innerText = `Top Score: ${this.topScore}`;
        }

        // Show Game Over UI
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over-modal').classList.remove('hidden');
    }

    updateScoreUI() {
        document.getElementById('score').innerText = `Score: ${this.score}`;
    }
}
