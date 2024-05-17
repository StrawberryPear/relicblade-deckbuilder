export var storage = {};

export const deck = {};
export const deckName = "";

export var libraryFocusCard;
export var deckFocusCard;

export var attachCharacter;
export var dragToken;

export const init = async () => {  
  if (!Capacitor?.getPlatform || Capacitor?.getPlatform() == "web") {
    console.log('loading web storage');
    storage = await import('./storage.web.js');

    return;
  }
  console.log('loading capacitor storage');
  storage = await import('./storage.cap.js');

  return;
};