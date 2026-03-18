
import { loadShareDeckFromCode } from './menu.js';
import { onShowLibrary } from './library.js';
import { onShowDeck, loadDeckFromLocalIndex, getValueFromDeckCards } from './deck.js';
import { showInput, showConfirm, showOption } from './dom.modal.js';
import { storage } from './storage.js';
import { showToast } from './cards.shared.js';

const buttonContainerEle = document.querySelector('mainMenu menuButtons');
const saveSlotEles = document.querySelectorAll('mainMenu savesmenu menuButton.saveSlot');
const savesMenuEle = document.querySelector('mainMenu > savesMenu');

const learnButtonEle = buttonContainerEle.querySelector('.learnToPlay');
const myListsButtonEle = buttonContainerEle.querySelector('.myLists');
const shareCodeButtonEle = buttonContainerEle.querySelector('.shareCodeInput');
const browseButtonEle = buttonContainerEle.querySelector('.libraryMode');

export const handleLoad = async (loadSlotIdx) => {
  var localJsonDecks = storage.getStoredDecks();
  if (!localJsonDecks[loadSlotIdx]) {
    const newDeckName = await showInput("New Deck Name<br><br>");

    const newDeckFaction = await showOption("Select Faction for Deck<br><br>", ["Advocate", "Adversary", "Wild"]);

    if (!newDeckFaction) {
      updateSaveSlots();

      return;
    }

    // now write the new deck to this slot
    const newDeck = {
      deckName: newDeckName || `${newDeckFaction} Deck`,
      deckFaction: newDeckFaction,
      deck: []
    };

    const storedDecks = storage.getStoredDecks();
    const rewroteDecks = { ...storedDecks };

    rewroteDecks[loadSlotIdx] = newDeck;

    storage.setStoredDecks(rewroteDecks);
  }

  loadDeckFromLocalIndex(loadSlotIdx);

  onShowDeck(true);
};

export const initMainMenuEvents = () => {
  saveSlotEles.forEach(saveSlotEle => {
    const idx = saveSlotEle.getAttribute('idx');

    saveSlotEle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx !== null) {
        handleLoad(idx);
      }
    });

    const renameEle = saveSlotEle.querySelector("saveSlotRename");
    if (renameEle) {
      renameEle.addEventListener("click", async (e) => {
        e.stopPropagation();
        const storedDecks = storage.getStoredDecks();
        const renameDeck = storedDecks[idx] || { deckName: "Empty Slot" };

        const newName = await showInput("Rename Deck", renameDeck.deckName);

        if (newName) {
          const rewroteDecks = { ...storedDecks };

          rewroteDecks[idx] = { deck: [], ...renameDeck, deckName: newName };

          storage.setStoredDecks(rewroteDecks);

          showMainMenu();
        }
      });
    }

    const deleteEle = saveSlotEle.querySelector("saveSlotDelete");
    if (deleteEle) {
      deleteEle.addEventListener("click", async (e) => {
        e.stopPropagation();
        const storedDecks = storage.getStoredDecks();

        const deleteDeck = storedDecks[idx] || { deckName: "Empty Slot" };

        // confirm delete
        const confirmDelete = await showConfirm(`Are you sure you want to delete, ${deleteDeck.deckName}?`);

        if (confirmDelete) {
          const rewroteDecks = { ...storedDecks };

          delete rewroteDecks[idx];

          storage.setStoredDecks(rewroteDecks);

          updateSaveSlots();
        }
      });
    }
  });

  if (learnButtonEle) {
    learnButtonEle.addEventListener('click', () => {
      window.open('https://relicblade.com', '_blank');
    });
  }

  if (myListsButtonEle) {
    myListsButtonEle.addEventListener('click', () => {
      savesMenuEle.classList.remove('hidden');
      buttonContainerEle.classList.add('hidden');
    });
  }

  const saveReturnButton = document.querySelector('mainMenu > savesMenu > .saveReturn');
  if (saveReturnButton) {
    saveReturnButton.addEventListener('click', () => {
      savesMenuEle.classList.add('hidden');
      buttonContainerEle.classList.remove('hidden');
    });
  }

  if (shareCodeButtonEle) {
    shareCodeButtonEle.addEventListener('click', async () => {
      const code = await showInput("Enter Share Code");
      if (code) {
        if (!(await loadShareDeckFromCode(code))) {
          return;
        }
        onShowDeck(true);
      }
    });
  }

  if (browseButtonEle) {
    browseButtonEle.addEventListener('click', onShowLibrary);
  }
};

const updateSaveSlots = () => {
  const storedDecks = storage.getStoredDecks();

  [...document.querySelectorAll("menuButton.saveSlot")].forEach((saveSlotEle) => {
    const saveSlotIdx = saveSlotEle.getAttribute("idx");

    // update the save slots names
    const localJsonDeckIdx = storedDecks[saveSlotIdx];

    const labelEle = saveSlotEle.querySelector("saveSlotLabel");
    if (!labelEle) return;

    if (!localJsonDeckIdx) {
      labelEle.innerText = `Empty Slot`;
      saveSlotEle.classList.add('empty-slot');
      return;
    }

    const deckValue = getValueFromDeckCards(localJsonDeckIdx.deck);
    const deckFaction = localJsonDeckIdx.deckFaction ?? "Wild";
    labelEle.innerText = `${localJsonDeckIdx.deckName} - (${deckValue})`;
    saveSlotEle.classList.remove('empty-slot');
  });
}

export const showMainMenu = () => {
  document.body.setAttribute("showing", "menu");
  // Clear any mode when returning to main menu
  document.body.removeAttribute("mode");
  savesMenuEle.classList.add('hidden');
  buttonContainerEle.classList.remove('hidden');
  updateSaveSlots();
}