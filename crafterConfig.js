
const crafter = require('./crafter.js');
const Vec3 = require('vec3');

let isAutoCrafting = false;

async function autocraftloop(bot, mcData, minWait) {
  isAutoCrafting = true;
  const delay = 600;

  const itemsToCraft = [
    {name: 'gold_block', chest: [964, 65, -34], storeChest: [946, 65, -34], crafting: true}
  ];


console.log('Starting auto crafting loop');
while (isAutoCrafting) {
  await crafter.autoCraftMain(bot, mcData, itemsToCraft, delay);
  await wait(minWait*60*1000);
}
}

function stopAutoCraftingLoop() {
  isAutoCrafting = false;
}
function wait(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
  module.exports = {
  autocraftloop,
  stopAutoCraftingLoop
}