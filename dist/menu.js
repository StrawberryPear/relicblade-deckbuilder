
import { API_URL, SHARE_URL } from './constants.js';
import { storage } from './storage.js';
import { showToast } from './cards.shared.js';
import { getAllCardsIdsInDeck, awaitTime } from './utils.js';
import { cardLibraryListEle, scrollLibraryScroller, applyFilters, applyCarousel } from './library.js';
import { deck, deckName, setDeck, setDeckName, loadDeckFromLocal, onShowDeck } from './deck.js';
import { showConfirm, showOption, showInput, init as initModal } from './dom.modal.js';
import { showMainMenu } from './mainMenu.js';

export const overlayMenuEle = document.querySelector('overlayMenu');
export const descriptionEle = document.querySelector('description');

// Menu Element Selectors
export const returnEle = document.querySelector('menuControl.return');
export const showLegalEle = document.querySelector('menuControl.showLegal');
export const showIllegalEle = document.querySelector('menuControl.showIllegal');
export const showListEle = document.querySelector('menuControl.showList');
export const showCardsEle = document.querySelector('menuControl.showCards');

// Helpers
export const isShareCodeFormat = (code) => {
  const trimmedCode = code.trim();
  const codeRegex = /[a-zA-Z\d]{12}/;
  return codeRegex.test(trimmedCode);
}

export const getDeckFromShareCode = async (code) => {
  try {
    var sharedResponse = await fetch(`${API_URL}/sharedDeck?id=${code}`);
  } catch (e) {
    console.error(e);
    return false;
  }
  return await sharedResponse.json();
}

export const placeDeckFromShareCodeIntoLocal = async (deckData) => {
  try {
    const sharedDeck = JSON.parse(deckData.deck);
    const allCardUidsInDeck = getAllCardsIdsInDeck(sharedDeck);

    // look through the deck see if it has any cards we do not have in our library
    const libraryCardEles = [...cardLibraryListEle.children];
    const missingCards = allCardUidsInDeck.some(cardUid => {
      return !libraryCardEles.some(ele => ele.getAttribute('uid') == cardUid);
    });

    if (missingCards) {
      showToast("Shared deck contains cards not in your library.");
      document.body.className = '';
      return;
    }

    setDeck(JSON.parse(deckData.deck || "[]"));
    setDeckName(deckData.deckName || "");

    storage.setStoredDeck(deckName, deck);
    loadDeckFromLocal();
  } catch (e) {
    console.error(e);
    showToast("Failed to load shared deck");
    return;
  }
  showToast(`${deckName || "Shared Deck"} Loaded`);
}

export const loadShareDeckFromCode = async (code) => {
  document.body.className = 'loading';
  const deckData = await getDeckFromShareCode(code);
  if (!deckData) {
    showToast("Failed to load shared deck");
    document.body.className = '';
  }
  console.log(`sd: ${JSON.stringify(deckData)}`);
  await placeDeckFromShareCodeIntoLocal(deckData);
  document.body.className = '';
};


export const handleSave = async (saveSlotIdx) => {
  var storedDecks = storage.getStoredDecks();
  if (storedDecks[saveSlotIdx]) {
    const confirmValue = await showConfirm(`Are you sure you want to override ${storedDecks[saveSlotIdx].deckName || 'Untitled Deck'}?`);
    await awaitTime(200);
    if (!confirmValue) return;
  }
  storedDecks[saveSlotIdx] = { deck, deckName };
  try {
    const deckString = JSON.stringify({ deck: JSON.stringify(deck), deckName });
    console.log(`Saving deck for anonymous deck data pool`);
    fetch(`${API_URL}/storeDeck`, {
      method: 'POST',
      contentType: 'text/plain',
      body: deckString
    });
  } catch (e) {
    console.error(`Failure saving deck to deckpool, ${e}`);
  }
  storage.setStoredDecks(storedDecks);
  loadDeckFromLocal();
  overlayMenuEle.classList.add("hidden");

  // reset main menu state if we loaded from there
  const mainMenuSaves = document.querySelector('mainMenu > savesMenu');
  if (mainMenuSaves) {
    mainMenuSaves.classList.add('hidden');
    document.querySelectorAll('mainMenu menuButton').forEach(b => b.classList.remove('hidden'));
  }

  onShowDeck();
  showToast(`Deck, ${deckName} saved to slot ${saveSlotIdx}`);
};

export const onShowMenu = () => {
  // force a save if we're in deck mode
  if (document.body.getAttribute("showing") == "deck") {

  }
  overlayMenuEle.classList.add("hidden");
  showMainMenu();
};

export const initMenuEvents = () => {
  returnEle.addEventListener("click", event => {
    overlayMenuEle.classList.add("hidden");
  });

  overlayMenuEle.addEventListener('click', e => {
    if (e.target !== overlayMenuEle) return;
    overlayMenuEle.className = 'hidden';
  });

  document.querySelector('ham').addEventListener('click', () => {
    overlayMenuEle.className = '';
    overlayMenuEle.setAttribute("showing", "hamMenu");
  });



  document.querySelector('.returnToMenu').addEventListener('click', onShowMenu);

  showLegalEle.addEventListener('click', () => {
    document.body.setAttribute("legal", "");
    applyFilters();
    applyCarousel();
  });

  showIllegalEle.addEventListener('click', () => {
    document.body.setAttribute("legal", "false");
    applyFilters();
    applyCarousel();
  });

  showListEle.addEventListener('click', () => {
    document.body.setAttribute("listType", "list");
    storage.setStoredListType("list");
  });

  showCardsEle.addEventListener('click', () => {
    document.body.setAttribute("listType", "");
    storage.setStoredListType("");
    applyCarousel();
  });

  document.querySelector('share').addEventListener('click', async () => {
    const confirmValue = await showConfirm(`Would you like to generate a link to share ${deckName || "this deck"}?`);
    if (!confirmValue) return;
    document.body.className = 'loading';
    const deckString = JSON.stringify({ deck: JSON.stringify(deck), deckName });
    try {
      var response = await fetch(`${API_URL}/sharedDeck`, {
        method: 'POST',
        contentType: 'text/plain',
        body: deckString
      });
    } catch (e) {
      console.error(e);
      showToast("Failed to generate a share link");
      document.body.className = "";
      return;
    }
    const responseJson = await response.json();
    const shareCode = responseJson.id;
    const shareUrl = `${SHARE_URL}/decks/index.html?id=${shareCode}`;
    const shareData = {
      title: `Relicblade Deck - ${deckName || "Untitled"}`,
      text: `Check out this Relicblade Deck`,
      url: shareUrl
    };
    try {
      await navigator.share(shareData);
    } catch (navigatorError) {
      var copiedLink = true;
      try {
        navigator.clipboard.writeText(shareUrl);
      } catch (clipboardError) {
        copiedLink = false;
      }
      await showOption(`${copiedLink ? `<b>I've copied this link to your clipboard!</b> ` : ``}You can share the following link with all your Relicbuds<br><br><a href="${shareUrl}">${shareUrl}</a><br><br>`, []);
    }
  });

  document.querySelector('.contact').addEventListener('click', async () => {
    overlayMenuEle.classList.add("hidden");
    await showOption(`Made by Perry Fraser (<a href="mailto:perryfraser@gmail.com">perryfraser@gmail.com</a>)<br>Special Thanks to <a href="https://www.instagram.com/artofandyisaac/">Andy Isaac</a>.<br><br>Relicblade is a game by Sean Sutter at Metal King Studios. This is intended as a game aid for his 11/10 creation. <a href="https://www.relicblade.com/contact">https://www.relicblade.com/contact</a><br><br>`, []);
  });
};
