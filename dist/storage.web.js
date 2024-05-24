var database;
// we'll maintain a close approximation of all the cards that we can.
var localData = [];

export const hasLoadedBase = () => {
  return localStorage.getItem('baseLoaded') === 'true';
}

export const setBaseLoaded = (value) => {
  localStorage.setItem('baseLoaded', !!value ? 'true' : 'false');
};

export const setStoredDeck = (deckName, deck) => {
  localStorage.setItem("deck", JSON.stringify(deck));
  localStorage.setItem("deckName", deckName);
};

export const getStoredDisplayType = () => {
  return localStorage.getItem("displayType") || "";
};

export const setStoredDisplayType = (displayType) => {
  return localStorage.setItem("displayType", displayType);
};

export const getStoredDeck = () => {
  var storedDeck = [];
  var storedDeckName = "";
  try {

    storedDeck = JSON.parse(localStorage.getItem('deck') || '[]');
    storedDeckName = localStorage.getItem('deckName') || '';
  } catch (e) { }

  return { deck: storedDeck, deckName: storedDeckName };
};

export const getStoredDecks = () => {
  var storedDecks = {};
  try {
    storedDecks = JSON.parse(localStorage.getItem('decks') || '{}');
  } catch (e) { }

  return storedDecks;
}

export const setStoredDecks = async (decks) => {
  localStorage.setItem('decks', JSON.stringify(decks));
};

export const writeCardToDatabase = async (uid, image) => {
  // check if the card exists in localData
  const cardIndex = localData.findIndex(card => card.uid === uid);

  if (cardIndex !== -1) {
    // we need to put the image into the database
    const card = localData[cardIndex];

    card.image = image;

    const transaction = database.transaction('cards', 'readwrite');
    const objectStore = transaction.objectStore('cards');

    try {
      await objectStore.put({uid, image, index: card.index});
    } catch(err) {
      console.error(err);
    }
    return false;
  }

  // write a new card
  const transaction = database.transaction('cards', 'readwrite');

  try {
    // check if the card is in there.
    const objectStore = transaction.objectStore('cards');
    const storeId = await objectStore.add({uid, image});

    const result = await objectStore.get(storeId);

    // write the card to localData
    localData.push({uid, image, index: storeId});

    return result;
  } catch(err) {
    console.error(err);
    return false;
  }
};

export const removeCardFromDatabase = async (uid) => {
  // remove the card from the database + local data
  const transaction = database.transaction('cards', 'readwrite');
  const objectStore = transaction.objectStore('cards');

  const cardIndex = localData.findIndex(card => card.uid === uid);

  if (cardIndex === -1) {
    return false;
  }

  const card = localData[cardIndex];

  try {
    await objectStore.delete(card.index);

    // remove the card from localData
    localData.splice(cardIndex, 1);

    return true;
  } catch(err) {
    console.error(err);
    return false;
  }
};

export const getAllCards = async () => {
  return localData;
};

const getAllCardsFromDatabase = async () => {
  const baseTransaction = database.transaction('cards', 'readwrite');
  const baseObjectStore = baseTransaction.objectStore('cards');

  const allCards = await baseObjectStore.getAll();

  return allCards;
};

export const init = async () => {
  database = await idb.openDB('relicbladeCards', 3, {
    upgrade: (db, oldVersion) => {
      if (oldVersion < 2) {
        setStoredDeck("", []);
      }
      if (oldVersion < 3) {
        try {
          db.deleteObjectStore('cards');
        } catch (err) {
          // ignore error
        }
      }

      const cardObjectStore = db.createObjectStore('cards', { keyPath: 'index', autoIncrement: true }); 

      cardObjectStore.createIndex('uid', 'uid', { unique: true });
    }});
  
  // check to see if we've loaded the basecards
  if (!hasLoadedBase()) {
    const baseCards = await import('./baseCards.js');

    baseCards.default.forEach(async card => {
      await writeCardToDatabase(card.uid, card.image);
    });

    setBaseLoaded(true);
  }

  localData = await getAllCardsFromDatabase();
};