const Filesystem = Capacitor.Plugins.Filesystem;
const directory = 'DOCUMENTS';
const encoding = 'utf8';

const FILE_SYSTEM_PREFRENCES_PATH = `relicblade-preferences.json`;
const FILE_SYSTEM_DATA_PATH = `relicblade-data.json`;

var localPreferences = {};
var localData = [];

var dataWriteTimeout = null;
var preferencesWriteTimeout = null;

const writePreferences = async () => {
  console.log('Attempting write preferences to file');
  try {
    await Filesystem.writeFile({
      path: FILE_SYSTEM_PREFRENCES_PATH,
      data: JSON.stringify(localPreferences),
      directory,
      encoding
    });
  }
  catch (e) {
    console.error(e);
    return;
  }
  console.log('Wrote preferences to file');
};

const queueWritePreferences = async () => {
  console.log('Queuing write preferences to file');
  if (preferencesWriteTimeout) {
    clearTimeout(preferencesWriteTimeout);
  }

  preferencesWriteTimeout = setTimeout(() => {
    writePreferences();
  }, 1000);
};

const readPreferences = async () => {
  console.log('Attempting read preferences from file');
  try {
    var contents = await Filesystem.readFile({
      path: FILE_SYSTEM_PREFRENCES_PATH,
      directory,
      encoding
    });

    console.log(`Got preferences from file ${contents.data}`);
    localPreferences = JSON.parse(contents.data);
  } catch (e) {
    console.error(e);
    return;
  }

  console.log('Read preferences from file');
  console.log(contents.data);

  try {
    localPreferences = JSON.parse(contents.data);
  } catch (e) {
    console.error(e);
  }
};

export const hasLoadedBase = () => {
  return localPreferences.baseLoaded === 'true';
}

export const setBaseLoaded = (value) => {
  localPreferences.baseLoaded = !!value ? 'true' : 'false';
  
  queueWritePreferences();
};

export const setStoredDeck = (deckName, deck) => {
  localPreferences.deck = JSON.stringify(deck);
  localPreferences.deckName = deckName;

  queueWritePreferences();
};

export const getStoredDisplayType = () => {
  return localPreferences.displayType || "";
};

export const setStoredDisplayType = (displayType) => {
  localPreferences.displayType = displayType;

  queueWritePreferences();
};

export const getStoredDeck = () => {
  var storedDeck = [];
  var storedDeckName = "";
  try {
    storedDeck = JSON.parse(localPreferences.deck || '[]');
    storedDeckName = localPreferences.deckName || '';
  } catch (e) { }

  return { deck: storedDeck, deckName: storedDeckName };
};

export const getStoredDecks = () => {
  var storedDecks = {};
  try {
    storedDecks = JSON.parse(localPreferences.decks || '{}');
  } catch (e) { }

  return storedDecks;
}

export const setStoredDecks = async (decks) => {
  localPreferences.decks = JSON.stringify(decks);

  queueWritePreferences();
};

export const writeCardToDatabase = async (uid, image) => {
  console.log('Attempting write card to database');
  const cardIndex = localData.findIndex(card => card.uid === uid);

  if (cardIndex != -1) {
    localData[cardIndex].image = image;

    queueWriteLocalData();

    return false;
  }

  localData.push({ uid, image });

  queueWriteLocalData();

  return { uid, image };
};

const writeLocalDataToDatabase = async () => {
  console.log('Attempting write local data to file');
  try {
    await Filesystem.writeFile({
      path: FILE_SYSTEM_DATA_PATH,
      data: JSON.stringify(localData),
      directory,
      encoding
    });
    
    console.log('Wrote local data to file');
  } catch (e) {
    console.error(e);
  }
};

const queueWriteLocalData = async () => {
  console.log('Queuing write local data to file');
  if (dataWriteTimeout) {
    clearTimeout(dataWriteTimeout);
  }

  dataWriteTimeout = setTimeout(() => {
    writeLocalDataToDatabase();
  }, 1000);
};

export const removeCardFromDatabase = async (uid) => {
  const cardIndex = localData.findIndex(card => card.uid === uid);

  if (cardIndex === -1) {
    return false;
  }

  localData.splice(cardIndex, 1);

  await queueWriteLocalData();
};

export const getAllCards = async () => {
  return localData;
};

export const init = async () => {
  console.log('Attempting to initialize storage');
  // lets start with preferences
  try {
    await readPreferences();
  } catch (e) {
    // this is the first load.  We'll just ignore the error, we only write preferences from here.
    console.error(e);
  }

  if (!localPreferences.version || localPreferences.version <= 1) {
    console.log('Removing dependency on localdb');

    localPreferences = {
      deck: localStorage.getItem('deck') || '[]',
      deckName: localStorage.getItem('deckName') || '',
      decks: localStorage.getItem('decks') || '{}',
      version: 2
    };
    await writePreferences();
    
    var database = await idb.openDB('relicbladeCards', 3, {
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
    
    console.log('gatheredCards from localdb');
    // lets get all the cards
    const dataBaseCards = await (async () => {
      const baseTransaction = database.transaction('cards', 'readwrite');
      const baseObjectStore = baseTransaction.objectStore('cards');
  
      const allCards = await baseObjectStore.getAll();
  
      return [...allCards].map(card => {
        return { uid: card.uid, image: card.image };
      })
    })();

    console.log('Writing localdb cards to filesystem');

    // now we have to write them all to the filesystem
    try {
      await Filesystem.writeFile({
        path: FILE_SYSTEM_DATA_PATH,
        data: JSON.stringify(dataBaseCards),
        directory,
        encoding
      });
    } catch (e) {
      console.error(e);
    }
  }
  // read the data in
  try {
    console.log('Attempting to read local data from file');

    const contents = await Filesystem.readFile({
      path: FILE_SYSTEM_DATA_PATH,
      directory,
      encoding
    });
    
    console.log('Read local data from file');
    localData = (contents.data ? JSON.parse(contents.data) : []) || [];

    console.log(`Parsed file data - ${contents.data.length}`);
    console.log(`Found ${localData.length} entries`);

    if (!localData.length) {
      setBaseLoaded(false);
    }
  } catch (e) {
    console.log(e);
    localData = [];
  }

  // check to see if we've loaded the basecards
  if (!hasLoadedBase()) {
    console.log('Attempting to load base cards');
    const baseCards = await import('./baseCards.js');

    for (const baseCard of baseCards.default) {
      const isInLocalData = localData.find(localCard => localCard.uid === baseCard.uid);

      if (isInLocalData) {
        continue;
      }
      console.log(`Adding ${baseCard.uid} to local data`);

      localData.push(baseCard);
    };

    await writeLocalDataToDatabase();

    setBaseLoaded(true);
  }
};