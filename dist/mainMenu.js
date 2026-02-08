
import { overlayMenuEle, loadShareDeckFromCode, handleLoad } from './menu.js';
import { onShowLibrary } from './library.js';
import { onShowDeck } from './deck.js';
import { showInput } from './dom.modal.js';
import { showToast } from './cards.shared.js';

export const initMainMenuEvents = () => {
  const buttonContainerEle = document.querySelector('mainMenu menuButtons');
  const buttonEles = [...document.querySelectorAll('mainMenu menuButtons menuButton')];
  const saveSlots = document.querySelectorAll('mainMenu menuControl.saveSlot');
  
  saveSlots.forEach(slot => {
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = slot.getAttribute('idx');
      if (idx !== null) {
        handleLoad(idx);
      }
    });
  });

  const learnButtonEle = buttonEles.find(b => b.innerText.match(/Learn/i));
  const myListsButtonEle = buttonEles.find(b => b.innerText.match(/My Lists/i));
  const shareCodeButtonEle = buttonEles.find(b => b.innerText.match(/Share Code/i));
  const browseButtonEle = buttonEles.find(b => b.innerText.match(/Browse/i));

  if (learnButtonEle) {
    learnButtonEle.addEventListener('click', () => {
      window.open('https://relicblade.com', '_blank');
    });
  }



  if (myListsButtonEle) {
    myListsButtonEle.addEventListener('click', () => {
      overlayMenuEle.setAttribute('saveMode', 'load');
      const savesMenuEle = document.querySelector('mainMenu > savesMenu');
      if (savesMenuEle) savesMenuEle.classList.remove('hidden');
      buttonEles.forEach(b => b.classList.add('hidden'));
    });
  }
  
  const saveReturnButton = document.querySelector('mainMenu > savesMenu > .saveReturn');
  if (saveReturnButton) {
    saveReturnButton.addEventListener('click', () => {
      document.querySelector('mainMenu > savesMenu').classList.add('hidden');
      buttonEles.forEach(b => b.classList.remove('hidden'));
    });
  }

  if (shareCodeButtonEle) {
    shareCodeButtonEle.addEventListener('click', async () => {
      const code = await showInput("Enter Share Code");
      if (code) {
        await loadShareDeckFromCode(code);
        onShowDeck();
      }
    });
  }

  if (browseButtonEle) {
    browseButtonEle.addEventListener('click', onShowLibrary);
  }
};
