const {
  pathfinder,
  Movements,
  goals: {
      GoalNear
  }
} = require('mineflayer-pathfinder');
const {
  Vec3
} = require('vec3');
const PrismarineItem = require('prismarine-item');
let defaultMove;

function init(defaultMov, bot, mcData) {
  defaultMove = defaultMov;
}



async function autoCraftMain(bot, mcData, itemsToCraft, delay) {

  for (let i = 0; i < itemsToCraft.length; i++) {
      const item = itemsToCraft[i];
      const chest = new Vec3(item.chest[0], item.chest[1], item.chest[2]);
      const storeChestVec = new Vec3(item.storeChest[0], item.storeChest[1], item.storeChest[2]);
      //if it is night pause until morning
      if (bot.time.timeOfDay > 13000) {
          //wait until morning
      }
      await wait(delay);
      await autoCraftItem(bot, chest, storeChestVec, mcData, item.name, item.crafting, delay);
  }

}

async function autoCraftItem(bot, chest, storeChest, mcData, item, craft, delay) {
  let craftingItem = item;
  let minCount = 0;
  if (craft) {
      craftingItem = await getFirstIngredient(bot, item, mcData);
      minCount = await getMinCount(bot, item, mcData);
  }
  // Open the chest and steal as many crafting items as possible
  await openChest(bot, chest, mcData);
  const window = await onceWindowOpen(bot);
  const slotss = await stealChest(bot, window, mcData, chest, craftingItem, minCount, craft);
  if (slotss < 0) {
      return Math.abs(slotss);
  }
  if (craft) {
      const itemCount = await countInventoryItems(bot, craftingItem);
      if (itemCount >= minCount) {
          let count = Math.floor(itemCount / minCount);
          await craftItem(bot, item, count, mcData);
          await wait(delay);
      }
  }

  // Wait delay, then open the storeChest box and dump the crafted items
  await wait(delay);
  await openChest(bot, storeChest, mcData);
  const storeChestWindow = await onceWindowOpen(bot);
  const storeChestInventory = await dumpChest(bot, storeChestWindow, mcData, storeChest, item);
  // Check if the storeChest box is full, if so, say so
  if (craft && await countInventoryItems(bot, craftingItem) > 0) {
      await openChest(bot, chest, mcData);
      const chestWindow = await onceWindowOpen(bot);
      await dumpChest(bot, chestWindow, mcData, chest, craftingItem);
  }

  if (storeChestInventory === 0) {
      console.log('Chest is full');
  }

  return slotss
}

// Helper function to wait for a window to open
function onceWindowOpen(bot) {
  return new Promise(resolve => {
      bot.once('windowOpen', window => {
          resolve(window);
      });
  });
}

// Helper function to wait for a specified amount of time
function wait(ms) {
  return new Promise(resolve => {
      setTimeout(resolve, ms);
  });
}

async function getFirstIngredient(bot, itemName, mcData) {
  const recipes = bot.recipesAll(mcData.itemsByName[itemName].id, null, true)[0].delta;
  if (recipes && recipes.length > 0) {
      const recipe = recipes[0];
      const firstIngredientId = recipe.id;
      return mcData.items[firstIngredientId].name;
  } else {
      return "No recipe found for " + itemName;
  }
}

async function getMinCount(bot, itemName, mcData) {
  const recipes = bot.recipesAll(mcData.itemsByName[itemName].id, null, true)[0].delta;
  if (recipes && recipes.length > 0) {
      const recipe = recipes[0];
      return Math.abs(recipe.count);
  } else {
      return "No recipe found for " + itemName;
  }
}

async function openChest(bot, chestPosition, mcData) {
  // navigate to the chest position
  bot.pathfinder.setMovements(defaultMove);
  bot.pathfinder.setGoal(new GoalNear(chestPosition.x, chestPosition.y, chestPosition.z, 4));
  // open the chest
  await bot.once('goal_reached', () => {
      const chest = bot.blockAt(chestPosition);
      if (chest) {
          //if is type of chest
          if (chest.type === mcData.blocksByName.chest.id || chest.type === mcData.blocksByName.trapped_chest.id)
              bot.openChest(chest);
          else if (chest.name === "shulker_box")
              bot.openBlock(chest, new Vec3(0, 1, 0));
          else
              bot.openContainer(chest);
          //get how many items in chest
      }
  });
  return true;
}

function closeChest(bot) {
  // close the current window if it is a chest
  const window = bot.currentWindow;
  if (window) {
      bot.closeWindow(window);
  }
}

async function countInventoryItems(bot, itemName) {
  await wait(70);
  if (bot.currentWindow) {
      const window = bot.currentWindow;
      let start = window.slots.length - 36;
      let emptySlots = 0;
      for (let i = start; i < window.slots.length; i++) {
          if (window.slots[i] != null && (window.slots[i].name === itemName || itemName === "*")) {
              emptySlots += window.slots[i].count;
          }
      }
      return emptySlots;
  }
  let itemCount = 0;
  for (const item of bot.inventory.items()) {
      if (item.name === itemName || itemName === "*") {
          itemCount += item.count;
      }
  }
  return itemCount;
}


async function countInventorySlots(bot) {
  await wait(70);
  if (bot.currentWindow) {
      const window = bot.currentWindow;
      let start = window.slots.length - 36;
      let emptySlots = 0;
      for (let i = start; i < window.slots.length; i++) {
          if (window.slots[i] != null) {
              emptySlots++;
          }
      }
      return emptySlots;
  }
  let itemCount = 0;
  for (const item of bot.inventory.items()) {
      if (item.name === itemName || itemName === "*") {
          itemCount++;
      }
  }
  return itemCount;
}

async function countChestItems(bot, window, itemName) {
  await wait(200);
  let emptySlots = 0;
  for (let i = 0; i < window.slots.length; i++) {
      if (window.slots[i] != null && (window.slots[i].name === itemName || itemName === "*")) {
          emptySlots += window.slots[i].count;
      }
  }
  return emptySlots;
}



async function reloadInventory(bot, window, block) {
  if (block)
      await bot.closeWindow(window);
  await bot.activateBlock(block);
  await bot.once('windowOpen', (window) => {
      bot.closeWindow(window);
  });

};

async function stealChest(bot, window, mcData, position, item, minCount, craft) {
  let chestSize = window.slots.length - 36;
  const promises = [];
  let emptySlots = await countEmptySlots(bot, window, mcData, position, '*');
  if (emptySlots === chestSize) {
      return chestSize * -1;
  } else if (craft && await countChestItems(bot, window, item) < minCount) {
      return (chestSize - 1) * -1;
  }
  for await (let i of Array(chestSize).keys()) {
      if (window.slots[i] != null && window.slots[i].name === item) {

          promises.push(shiftLeftClick(bot, i, window));
      }


  }

  await Promise.all(promises);
  emptySlots = await countEmptySlots(bot, window, mcData, position, item);

  await reloadInventory(bot, window, bot.blockAt(position));

  return emptySlots;
}



async function dumpChest(bot, window, mcData, position, item) {
  let chestSize = window.slots.length - 36;
  const promises = [];
  let emptySlots = undefined;
  for (let i = chestSize; i < window.slots.length; i++) {
      if (window.slots[i] != null && window.slots[i].name === item || window.slots[i] != null && item === '*') {
          promises.push(await shiftLeftClick(bot, i, window));
      }
  }
  await Promise.all(promises);
  await wait(100);
  await reloadInventory(bot, window, bot.blockAt(position));
  if (item != '*') {
      await openChest(bot, position, mcData);
      const shulkerWindow = await onceWindowOpen(bot);
      emptySlots = await countEmptySlots(bot, shulkerWindow, mcData, position, '*');
      await wait(100);
      await bot.closeWindow(shulkerWindow);
  }
  return emptySlots;
}

async function countEmptySlots(bot, window, mcData, position, item) {
  let chestSize = window.slots.length - 36;
  let emptySlots = 0;
  let slots = 0;
  for (let i = 0; i < chestSize; i++) {
      if (window.slots[i] == null || window.slots[i] != null && item && window.slots[i].name === item && window.slots[i].count < mcData.itemsByName[item].stackSize) {
          emptySlots++;
      }
      slots++;
  }

  return emptySlots;

}

async function putOneItem(bot, window, mcData, position, item) {
  let i = window.slots.length - 36;

  while (i <= window.slots.length && !(window.slots[i] != null && window.slots[i].name === item)) {
      i++;
  }

  if (i <= window.slots.length) {
      await shiftLeftClick(bot, i, window);
  }

  await reloadInventory(bot, window, bot.blockAt(position));
}


async function getOneItem(bot, window, mcData, position, item) {
  let invstart = window.slots.length - 36;
  let i = 0;

  while (i < invstart && !(window.slots[i] != null && window.slots[i].name === item)) {
      i++;
  }

  if (i < invstart) {
      await shiftLeftClick(bot, i, window);
  }

  await reloadInventory(bot, window, bot.blockAt(position));
}



async function shiftLeftClick(bot, slot, window) {
  await bot._client.write('window_click', {
      stateId: bot._client.state,
      windowId: window.id,
      cursorItem: PrismarineItem(bot.registry).toNotch(bot.inventory.cursor),
      changedSlots: [],
      mouseButton: 0,
      slot: slot,
      mode: 1,
  });
}

async function craftItem(bot, item, count, mcData) {
  // find a nearby crafting table block
  const craftingTable = bot.findBlock({
      matching: mcData.blocksByName['crafting_table'].id,
      maxDistance: 64,
      count: 1
  });

  // if no crafting table is found, notify the user and return
  if (!craftingTable) {
      bot.chat('No crafting table found near spawn');
      return;
  }

  // get the ID of the item to be crafted
  const blockID = mcData.itemsByName[item].id;

  // find a recipe for the specified item at the crafting table
  const recipe = bot.recipesFor(blockID, null, count, craftingTable)[0];

  // if no recipe is found, notify the user and return
  if (!recipe || count === 0) {
      //console.log('Nope');
      return;
  }

  // set the bot's pathfinder to navigate to the crafting table
  bot.pathfinder.setMovements(defaultMove);
  bot.pathfinder.setGoal(new GoalNear(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 2));
  await new Promise((resolve) => {
      bot.once('goal_reached', () => {
          resolve();
      });
  });
  // activate the crafting table to open its inventory window
  await bot.activateBlock(craftingTable);
  const windowOpen = await onceWindowOpen(bot, craftingTable);
  // send a craft_recipe_request packet for each item in the recipe's inShape array
  for (let i = 0; i < Math.ceil(count / mcData.itemsByName[item].stackSize); i++) {
      await bot._client.write('craft_recipe_request', {
          windowId: windowOpen.id,
          recipe: "minecraft:" + item,
          makeAll: true
      });
      // simulate a left-click on the output slot to craft the item
      await shiftLeftClick(bot, 0, windowOpen)

  }
  // wait a short period of time for the crafting to complete
  // close the crafting table window
  await reloadInventory(bot, windowOpen, craftingTable)


}

module.exports = {
  craftItem,
  openChest,
  closeChest,
  countInventoryItems,
  stealChest,
  reloadInventory,
  dumpChest,
  putOneItem,
  getOneItem,
  init,
  getFirstIngredient,
  shiftLeftClick,
  autoCraftItem,
  autoCraftMain,
  getMinCount,
};