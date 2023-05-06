const mineflayer = require('mineflayer');
const {pathfinder, Movements} = require('mineflayer-pathfinder');
const inventoryViewer = require('mineflayer-web-inventory');
const collectBlock = require('mineflayer-collectblock').plugin;
const autoeat = require('mineflayer-auto-eat').plugin;
const crafter = require('./crafter.js');
const crafterraid = require('./crafterConfig.js');
const readline = require('readline');

const bot = mineflayer.createBot({
	host: 'some.server.ip', // minecraft server ip
	username: 'SomeEmail', // minecraft username/email
	//password: '', // minecraft password, comment out if you want to log into online-mode=false servers
	port: 25565, // only set if you need a port that isn't 25565
	version: "1.19.3", // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
	auth: 'microsoft' // only set if you need microsoft auth, then set this to 'microsoft'
})

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

inventoryViewer(bot)
let mcData;
bot.loadPlugin(pathfinder)
bot.loadPlugin(collectBlock);
bot.loadPlugin(autoeat);
//get the position of the bot and print it out


let defaultMove;
bot.once('spawn', () => {
    mcData = require('minecraft-data')(bot.version);
    defaultMove = new Movements(bot, mcData);
    defaultMove.canDig = false;
    defaultMove.allow1by1towers = false;
    bot.collectBlock.movements = defaultMove;
    crafter.init(defaultMove , bot, mcData);
    bot.autoEat.options.offhand = true;
    const commands = {
        start: (min) => {
            crafterraid.autocraftloop(bot, mcData, min);
        },
        say: (...args) => {
            const message = args.join(' ');
          bot.chat(message);
        },
        quit: () => {
          bot.quit();
          process.exit();
        }
      };
    
      rl.on('line', (input) => {
        // Parse the input into a command and its arguments
        const [command, ...args] = input.trim().split(' ');
    
        // Execute the command, or show an error message if the command is not recognized
        if (commands[command]) {
          commands[command](...args);
        } else {
          console.log(`Unknown command: ${command}`);
        }
      });
    });


bot.on('kicked', console.log);
bot.on('error', console.log);