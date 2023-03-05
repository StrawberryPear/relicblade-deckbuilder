const SCALE = 1.5;

const CARD_WIDTH = Math.round(179.333333 * SCALE);
const CARD_HEIGHT = Math.round(244.666667 * SCALE);

const CARD_OFFSET_X = Math.round(36.6666666667 * SCALE);
const CARD_OFFSET_Y = Math.round(18.6666666667 * SCALE);

const CARD_ROW_OFFSET = Math.round(6.66666666667 * SCALE);

var database;
var deckName = "";
var deck = [];

var libraryFocusCard;
var deckFocusCard;

var attachCharacter;

const cardScrollerEle = document.querySelector('cardScroller');
const cardLibraryListEle = document.querySelector('cardList.library');
const cardDeckListEle = document.querySelector('cardList.deck');
const cardTopControlsEle = document.querySelector('cardTopControls');

const searchInputEle = document.querySelector('searchContainer input');
const searchInputClearEle = document.querySelector('searchContainer searchicon[type="clear"]');
const gridButtonEle = document.querySelector('topButton.grid');

const removeFromDeckButton = document.querySelector("cardButton.removeFromDeck");
const showLibraryButton = document.querySelector("cardButton.showLibrary");
const addUpgradeButton = document.querySelector("cardButton.addUpgrade");
const showDeckButton = document.querySelector("cardButton.showDeck");
const addToDeckButton = document.querySelector("cardButton.addToDeck");
const addCharacterButton = document.querySelector("add");
const attachUpgradeButton = document.querySelector("cardButton.attachUpgrade");

const deckTitleInput = document.querySelector("input#title");
const deckTitleInputMirror = document.querySelector("deckTitleMirror#titleMirror");

const removeLibraryCardEle = document.querySelector('menuControl.removeLibraryCard');
const returnEle = document.querySelector('menuControl.return');
const saveReturnEle = document.querySelector('menuControl.saveReturn');
const newDeckEle = document.querySelector('menuControl.newDeck');
const saveDeckEle = document.querySelector('menuControl.saveDeck');
const loadDeckEle = document.querySelector('menuControl.loadDeck');
const overlayMenuEle = document.querySelector('overlayMenu');

const awaitFrame = () => new Promise(resolve => {
  window.requestAnimationFrame(resolve);
});

const updateDeck = () => {
  // work out total points in deck :D
  const cards = deck.map(deckStore => [deckStore, ...(deckStore.upgrades || [])]).flat().map(deckStore => cardsStore[deckStore.uid]);
  const cost = cards.reduce((sum, card) => card ? sum + (parseInt(card.cost) || 0) : sum, 0);

  const deckCostEle = document.getElementById('points');

  deckCostEle.innerHTML = cost ? `&nbsp;(${cost})` : '';

  localStorage.setItem("deck", JSON.stringify(deck));
};

const scrollScroller = async (left) => {
  cardScrollerEle.scrollTo({left, top: 0, behavior: 'instant'});

  const startTime = Date.now();

  do {
    await awaitFrame();
  } while (Date.now() - startTime < 1600);
}

const setDeckFocusCard = (newDeckFocusCard) => {
  // check if they're different
  if (deckFocusCard == newDeckFocusCard) return; 

  deckFocusCard = newDeckFocusCard;
};

const getCurrentDeckCardEle = () => {
  const pointEles = document.elementsFromPoint(window.innerWidth * 0.5, window.innerHeight * 0.5);
  const cardWrapperEle = pointEles.find(ele => ["CARDDECKWRAPPER"].includes(ele.tagName));
  if (!cardWrapperEle) return;
  const cardEle = cardWrapperEle.querySelector("card");

  return cardEle;
};

const getCurrentCardEle = (canBePurchase) => {
  const pointEles = document.elementsFromPoint(window.innerWidth * 0.5, window.innerHeight * 0.5);
  const cardEle = pointEles.find(ele => ["CARD", "PURCHASE", "IMPORT"].includes(ele.tagName));

  if (cardEle?.tagName == 'CARD' || (canBePurchase && ["PURCHASE", "IMPORT"].includes(cardEle?.tagName))) {
    return cardEle;
  }
};

const modalOverlayEle = document.querySelector("modalOverlay");
const modalOverlayTextEle = modalOverlayEle.querySelector("modalText");
const modalOverlayReturnButtonEle = modalOverlayEle.querySelector("modalButton#modalReturn");
const modalOverlayAcceptButtonEle = modalOverlayEle.querySelector("modalButton#modalAccept");
const showConfirm = async (content) => {
  // hide the background 
  modalOverlayEle.classList.remove("hidden");

  // change the text, return true if they hit true/false false. 
  modalOverlayTextEle.innerHTML = content;

  const returnValue = await new Promise((resolve, reject) => {
    const onFinished = (event) => {
      // remove the button binds.
      // unbind the buttons.
      const id = event.target.getAttribute("id");

      modalOverlayAcceptButtonEle.removeEventListener("click", onFinished);
      modalOverlayReturnButtonEle.removeEventListener("click", onFinished);

      resolve(id == "modalAccept");
    };
  
    modalOverlayAcceptButtonEle.addEventListener("click", onFinished);
    modalOverlayReturnButtonEle.addEventListener("click", onFinished);
  });

  // hide the overlay
  modalOverlayEle.classList.add("hidden");

  return returnValue;
};

const showToast = (() => {
  var currentToastTimeout;

  const toastEle = document.querySelector('toast');

  window.addEventListener('touchstart', () => {
    toastEle.style.setProperty('opacity', 0);
  });

  return (toastText) => {
    if (currentToastTimeout) {
      clearTimeout(currentToastTimeout);
    }

    toastEle.innerHTML = toastText;
    toastEle.style.setProperty('opacity', 0.9);

    currentToastTimeout = setTimeout(() => {
      toastEle.style.setProperty('opacity', 0);
    }, 4000);
  }
})();

const getDeckUpgradeRangeScalar = (containerCardEle, _scrollY) => {
  const scrollY = _scrollY * -1.3;
  // work out how many cards are there to stack
  const upgradeCardEles = [...containerCardEle.children].filter(ele => ele.tagName == "CARD");

  const cardHeight = containerCardEle.clientHeight;

  const upgradeOffsetY = scrollY;

  // we'll make the top card go down by a card height
  const rangeCardOffsetY = (0.175 / upgradeCardEles.length) * cardHeight;
  const rangeScalar = (-upgradeOffsetY) / cardHeight;

  return rangeScalar;
}

// initially as you scroll down, only the container moves down
// then after that hits the bottom, the next card starts to go towards the bototm
// so everything needs to raise till the container hits the bottom.
const applyDeckCardTopScroll = (containerCardEle, rangeScalar, setScalar = true) => {
  if (!containerCardEle) return;

  if (setScalar) {
    containerCardEle.unsnappedRangeScalar = rangeScalar;
    containerCardEle.unsnappedTime = Date.now();
  }
  containerCardEle.currentRangeScalar = rangeScalar;

  // work out how many cards are there to stack
  const upgradeCardEles = [...containerCardEle.children].filter(ele => ele.tagName == "CARD");

  const cardHeight = containerCardEle.clientHeight;
  const rangeCardOffsetY = (0.175 / upgradeCardEles.length) * cardHeight;
  const containerOffsetY = Math.min(1, rangeScalar) * -cardHeight;

  for (const upgradeCardIndex in upgradeCardEles) {
    const upgradeCardEle = upgradeCardEles[upgradeCardIndex];

    const offsetCardOffsetY = rangeCardOffsetY * (parseInt(upgradeCardIndex) + 1);
    const upgradeScalar = Math.max(-0, Math.min(1, rangeScalar - (parseInt(upgradeCardIndex) + 1)));

    const minPoint = 0;
    const maxPoint = cardHeight;

    const range = maxPoint - minPoint;
    const rangeValue = range * upgradeScalar;

    const scrollDown = containerOffsetY + rangeValue - Math.max(containerOffsetY - offsetCardOffsetY, offsetCardOffsetY);

    upgradeCardEle.style.setProperty("transform", `translateY(${scrollDown}px) translateZ(-${upgradeCardIndex + 1}px)`);
  }

  // slowly move the container down
  const range = rangeCardOffsetY * rangeScalar * 0.5;

  containerCardEle.style.setProperty("transform", `translateY(${-containerOffsetY + range}px)`);
  // find the snap point stuff
}

const addCharacterToDeck = (data, updateDeckStore = true) => {
  const uid = data.uid;
  if (!uid) return;

  const cardStore = cardsStore[uid];
  if (!cardStore) return;

  const libraryCardEles = [...cardLibraryListEle.children];
  const cardEle = libraryCardEles.find(ele => ele.getAttribute('uid') == uid);
  if (!cardEle) return;

  const wrapperEle = document.createElement("cardDeckWrapper");
  cardDeckListEle.insertBefore(wrapperEle, addCharacterButton);

  const cardCloneEle = cardEle.cloneNode(true);
  cardCloneEle.className = "";
  wrapperEle.append(cardCloneEle);

  // create mark boxes...
  (cardStore.markBoxes || []).forEach(([boxX, boxY, marked]) => {
    const boxEle = document.createElement("markBox");

    cardCloneEle.append(boxEle);

    boxEle.style.setProperty("top", `${boxY * 100}%`);
    boxEle.style.setProperty("left", `${boxX * 100}%`);
    boxEle.style.setProperty("transform", `translate(-50%, -50%) rotate(${Math.random() * 10 - 5}deg)`);

    boxEle.addEventListener("click", () => {
      boxEle.classList.toggle("marked");
    });
  });

  if (updateDeckStore) {
    deck.push({
      uid
    });
  }

  if (data.upgrades) {
    data.upgrades.forEach((upgrade) => {
      addUpgradeToCharacter(upgrade.uid, cardCloneEle, data, false);
    })
  }
  applyDeckCardTopScroll(cardCloneEle, 0, false);

  return cardCloneEle;
};

const addUpgradeToCharacter = (upgradeUID, characterCardEle, deckCharacter, updateDeckStore = true) => {
  if (!upgradeUID) return;

  const upgradeCardStore = cardsStore[upgradeUID];
  if (!upgradeCardStore) return;

  const libraryCardEles = [...cardLibraryListEle.children];
  const cardEle = libraryCardEles.find(ele => ele.getAttribute('uid') == upgradeUID);
  if (!cardEle) return;

  const cardCloneEle = cardEle.cloneNode(true);
  characterCardEle.append(cardCloneEle);

  // create mark boxes...
  (upgradeCardStore.markBoxes || []).forEach(([boxX, boxY, marked]) => {
    const boxEle = document.createElement("markBox");

    cardCloneEle.append(boxEle);

    boxEle.style.setProperty("top", `${boxY * 100}%`);
    boxEle.style.setProperty("left", `${boxX * 100}%`);
    boxEle.style.setProperty("transform", `translate(-50%, -50%) rotate(${Math.random() * 10 - 5}deg)`);

    boxEle.addEventListener("click", () => {
      boxEle.classList.toggle("marked");
    });
  });

  if (updateDeckStore) {
    deckCharacter.upgrades = deckCharacter.upgrades || [];
    deckCharacter.upgrades.push({
      uid: upgradeUID
    });
    awaitFrame()
    .then(awaitFrame)
    .then(
      () => {
      applyDeckCardTopScroll(characterCardEle, 0, false);
      });
  }

  return cardCloneEle
};

const loadDeckFromLocal = () => {
  // clear the deck.
  [...cardDeckListEle.children].filter(ele => ele.tagName == "CARDDECKWRAPPER").forEach(ele => ele.remove());
  
  var localJsonDeck = [];
  var localDeckName = "";
  try {
    localJsonDeck = JSON.parse(localStorage.getItem('deck') || '[]');
    localDeckName = localStorage.getItem('deckName') || '';
  } catch (e) { }

  const libraryCards = [...cardLibraryListEle.children].map(ele => ({uid: ele.getAttribute("uid")}));

  // inital deck production
  deck = localJsonDeck.filter(v => v && libraryCards.find(card => card.uid == v.uid));
  deckName = localDeckName ;

  deckTitleInput.value = deckName;
  deckTitleInputMirror.innerText = deckName || deckTitleInput.placeholder;

  updateDeck();

  for (const cardData of deck) {
    addCharacterToDeck(cardData, false);
  }

  var localJsonDecks = {};

  try {
    localJsonDecks = JSON.parse(localStorage.getItem('decks') || '{}');
  } catch (e) { }

  // update the deckstore
  [...document.querySelectorAll("menuControl.saveSlot")].forEach((saveSlotEle) => {
    const saveSlotIdx = saveSlotEle.getAttribute("idx");
    const localJsonDeckIdx = localJsonDecks[saveSlotIdx] || {deckName: "Empty Slot"};

    saveSlotEle.innerText = `${saveSlotIdx}. ${localJsonDeckIdx.deckName}`;
  });
}

// initialize the database.
const init = async () => {
  const updateAppSize = () => {
    const doc = document.documentElement;
    doc.style.setProperty('--screen-height', `${window.innerHeight}px`);
    doc.style.setProperty('--screen-width', `${window.innerWidth}px`);

    window?.plugins?.safearea?.get(
      (result) => {
        // elegantly set the result somewhere in app state
        doc.style.setProperty('--safe-area-top', `${result.top}px`);
        doc.style.setProperty('--safe-area-bottom', `${result.bottom}px`);

        doc.style.setProperty('--screen-height', `${window.innerHeight - result.top - result.bottom}px`);
      },
      (error) => {
        // maybe set some sensible fallbacks?
      }
    );
  }
  document.addEventListener("resume", updateAppSize);
  window.addEventListener('resize', updateAppSize)
  updateAppSize()

  database = await idb.openDB('relicbladeCards', 2, {
    upgrade: (db, oldVersion) => {
      if (oldVersion == 1) {
        localStorage.setItem("deck", JSON.stringify([]));
        db.deleteObjectStore('cards');
      }

      const cardObjectStore = db.createObjectStore('cards', { keyPath: 'index', autoIncrement: true }); 

      cardObjectStore.createIndex('uid', 'uid', { unique: true });

    }});

  await (async () => {
    const baseTransaction = database.transaction('cards', 'readwrite');
    const baseObjectStore = baseTransaction.objectStore('cards');

    for (const baseCard of baseCards) {
      try {
        await baseObjectStore.add({uid: baseCard.uid, image: baseCard.image});
      } catch (err) {
        console.error(err);
      }
    }
  })();
  
  const transaction = database.transaction('cards');
  const cardStore = transaction.objectStore('cards');

  const cards = (await cardStore.getAll() || []).sort((ca, cb) => ca.index - cb.index);

  for (const card of cards) {
    loadCard(card);
  }

  applyFilters();
  applyCarousel();
  document.body.className = '';

  [...document.querySelectorAll('label.fileUpload')].map(ele => ele.addEventListener('click', event => {
    overlayMenuEle.className = 'hidden';
  }));

  [...document.querySelectorAll('input[type="file"]')].map(ele => {
    ele.addEventListener('change', (event) => {
      document.body.className = 'loading';
      try {
        let [file] = event.target.files;
        if (!file) {
          document.body.className = '';
        };

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            await loadCardsFromUrl(reader.result);

            applyFilters();
            applyCarousel();
          } finally {
            document.body.className = '';
          }
        }
        reader.readAsDataURL(file)
      } catch (error) {
        console.error(error);
        showToast('Something failed... Sorry.')
      }
    })
  });

  loadDeckFromLocal();

  Object.keys(filters)
    .forEach(key => {
      const object = filters[key];
      object.ele.addEventListener('click', () => {
        const startsInactive = object.ele.classList.contains('inactive');
        object.ele.classList.toggle('inactive');
    
        const isActive = !!startsInactive;
        object.active = isActive;
        
        applyFilters();
        applyCarousel();
      });
    });
  scrollScroller(0);
  // cardScrollerEle.scrollTo({left: 0, top: 0, behavior: 'instant'});
    
  applyFilters();
  applyCarousel();

  showLibraryButton.addEventListener('click', async () => {
    document.body.className = '';

    if (document.body.getAttribute("showing") !== 'deck') return;
    setDeckFocusCard(getCurrentDeckCardEle());
    // get the top level element

    // scroll to the last library focused' card
    document.body.setAttribute("showing", "library");

    applyCarousel();

    const time = Date.now();
    while (Date.now() - time < 600) {
      await awaitFrame();

      const cardScrollX = libraryFocusCard?.offsetLeft || 0;
      // cardScrollerEle.scrollTo({left: cardScrollX, top: 0, behavior: 'instant'});
      scrollScroller(cardScrollX);
    }
  });
  showDeckButton.addEventListener('click', async () => {
    if (document.body.getAttribute("showing") !== 'library') return;

    setSubFilter();

    const currentCard = getCurrentCardEle(true);
    libraryFocusCard = currentCard;

    // scroll to the last library focused' card
    document.body.setAttribute("showing", "deck");

    const time = Date.now();
    while (Date.now() - time < 600) {
      await awaitFrame();

      const cardScrollX = deckFocusCard?.parentElement.offsetLeft || 0;
      scrollScroller(cardScrollX);
      // cardScrollerEle.scrollTo({left: cardScrollX, top: 0, behavior: 'instant'});
    }
  });
  addUpgradeButton.addEventListener('click', () => {
    if (document.body.getAttribute("showing") !== 'deck') return;

    const deckCurrentCardEle = getCurrentDeckCardEle();
    if (!deckCurrentCardEle) {
      showToast("Can't attach upgrade to that");
      return;
    }

    const uid = deckCurrentCardEle.getAttribute("uid");
    const cardStore = cardsStore[uid];
    if (!cardStore) return;

    const currentCardIndex = [...cardDeckListEle.children].indexOf(deckCurrentCardEle.parentElement);

    // TODO: get what upgrades the character can use
    setSubFilter('upgrade', { classes: cardStore.classes, upgradeType: cardStore.upgradeTypes});

    setDeckFocusCard(deckCurrentCardEle);
    attachCharacter = deck[currentCardIndex];

    showLibraryButton.click();
  });
  addCharacterButton.addEventListener('click', () => {
    if (document.body.getAttribute("showing") !== 'deck') return;

    setSubFilter('character');

    showLibraryButton.click();
  });

  removeFromDeckButton.addEventListener('click', async () => {
    const currentCardEle = getCurrentDeckCardEle();

    if (!currentCardEle) {
      showToast('Can\'t remove that');
      return;
    }

    const currentCardIndex = [...cardDeckListEle.children].indexOf(currentCardEle.parentElement);

    if (currentCardIndex == -1) {
      showToast('Can\'t remove that');
      return;
    };

    const currentFocusSubIndex = currentCardEle.currentRangeScalar || 0;

    if (!currentFocusSubIndex) {
      const confirmValue = await showConfirm('Are you sure you want to remove this card, and all it\'s upgrades from this deck?');
      if (!confirmValue) return;

      deck.splice(currentCardIndex, 1);
      currentCardEle.parentElement.remove();
    } else {
      const upgradeIndex = currentFocusSubIndex - 1;

      deck[currentCardIndex].upgrades.splice(upgradeIndex, 1);
      const upgradeCardEle = [...currentCardEle.querySelectorAll("card")][upgradeIndex];

      upgradeCardEle.remove();

      applyDeckCardTopScroll(currentCardEle, 0);
    }
    updateDeck();

    showToast(`Card removed from deck`);
  });
  addToDeckButton.addEventListener('click', () => {
    const currentCardEle = getCurrentCardEle();
    if (!currentCardEle) return;

    const uid = currentCardEle.getAttribute("uid");

    const cardEleClone = addCharacterToDeck({uid});
    if (!cardEleClone) return;

    updateDeck();
    setDeckFocusCard(cardEleClone);
    showToast(`Card added to deck`);
    showDeckButton.click();
  });
  attachUpgradeButton.addEventListener('click', (e) => {
    if (!attachCharacter) return;

    const currentCardEle = getCurrentCardEle();
    if (!currentCardEle) return;

    const uid = currentCardEle.getAttribute("uid");
    if (!uid) return;

    const cardEleClone = addUpgradeToCharacter(uid, deckFocusCard, attachCharacter, true);

    if (!cardEleClone) return;
    updateDeck();

    showToast(`Upgrade Attached`);
    showDeckButton.click();
  });
  cardScrollerEle.addEventListener('click', async (e) => {
    // get the card that was clicked
    const cardEle = e.target;

    if (!["CARD", "PURCHASE", "IMPORT"].includes(cardEle.tagName)) {
      // not a valid type;
      return;
    }

    if (document.body.getAttribute("displayType") == "grid") {
      // target the new card and swap display type
      document.body.setAttribute("displayType", "");

      applyCarousel();

      const scrollLeft = cardEle.offsetLeft;
      scrollScroller(scrollLeft);
      // cardScrollerEle.scrollTo({left: scrollLeft, top: 0, behavior: 'instant'});

      return;
    }

    // if it's a grid, convert it to a non-grid with that card in view
    
    const currentCardEle = getCurrentCardEle(true);
    if (!currentCardEle) return;
    
    const uid = currentCardEle.getAttribute("uid");
    const cardStore = cardsStore[uid];
    if (!cardStore) return;

    // get the xy of where was clicked
    // get card bounds
    // const cardBounds = currentCardEle.getBoundingClientRect();

    // const markBoxX = (e.clientX - cardBounds.left) / cardBounds.width;
    // const markBoxY = (e.clientY - cardBounds.top) / cardBounds.height;

    // cardStore.markBoxes = cardStore.markBoxes || [];
    // cardStore.markBoxes.push([markBoxX, markBoxY, 0]);

    // console.log(`box marked: ${markBoxX} - ${markBoxY}`);

    switch (currentCardEle.tagName) {
      case "PURCHASE":
        try {
          const status = await buyProduct(uid);

          if (status) {
            // install the cards.
            await installProduct(uid);
          }
        } catch (error) {
          showToast(error.message);
        }
        break;
    }
  });

  searchInputEle.addEventListener('keyup', async () => {
    searchText = searchInputEle.value;

    applyFilters();
    applyCarousel();

    cardTopControlsEle.classList.toggle('searched', !!searchText);
  });
  searchInputClearEle.addEventListener("click", () => {
    searchText = "";
    searchInputEle.value = "";

    applyFilters();
    applyCarousel();
    cardTopControlsEle.classList.toggle('searched', !!searchText);
  })

  removeLibraryCardEle.addEventListener('click', async (event) => {
    overlayMenuEle.className = 'hidden';
    if (event.cancelable) event.preventDefault();

    setTimeout(async () => {
      const currentCardEle = getCurrentCardEle();
      if (!currentCardEle) return;
      
      const confirmValue = await confirm('Are you sure you want to remove this card from your library?');
      if (!confirmValue) return;
  
      // remove it from the library.
      const transaction = database.transaction(['cards'], 'readwrite');
      const objectStore = transaction.objectStore('cards');
  
      const index = parseInt(currentCardEle.getAttribute('index'))
  
      await objectStore.delete(index);
  
      showToast('Card Removed');
      currentCardEle.remove();
    }, 200);
  });

  overlayMenuEle.addEventListener('click', e => {
    if (e.target !== overlayMenuEle) return;
    overlayMenuEle.className = 'hidden';
  });

  document.querySelector('ham').addEventListener('click', () => {
    overlayMenuEle.className = '';
    overlayMenuEle.setAttribute("showing", "mainMenu");
  });

  gridButtonEle.addEventListener('click', () => {
    const currentDisplayType = document.body.getAttribute("displayType");

    document.body.setAttribute("displayType", currentDisplayType == 'grid' ? '' : 'grid');

    if (currentDisplayType != "grid") return;
    applyCarousel();
  });

  var scrollTimeout;
  cardScrollerEle.addEventListener("scroll", event => {
    updateCarousel();
    //TODO make the buttons update
  });

  cardScrollerEle.addEventListener("touchstart", event => {
    // check if we're in the deck
    if (document.body.getAttribute("showing") != "deck") return;

    setDeckFocusCard(getCurrentDeckCardEle());
    if (!deckFocusCard) return;

    const touch = event.touches[0];
  
    deckFocusCard.touchStart = Date.now();
    deckFocusCard.deckDragging = false;

    return;
  }, {passive: false});
  cardScrollerEle.addEventListener("touchmove", event => {
    // check if we're in the deck
    if (document.body.getAttribute("showing") != "deck") return;
    if (!deckFocusCard) return;
    
    const touch = event.touches[0];
    if (!deckFocusCard.deckDragging) {
        
      deckFocusCard.currentRangeScalar = deckFocusCard.currentRangeScalar || 0;
      
      deckFocusCard.scrollY = 0;
      deckFocusCard.momentumY = 0;

      deckFocusCard.previousX = touch.pageX;
      deckFocusCard.previousY = touch.pageY;

      deckFocusCard.deckDragging = true;
    }

    const currentX = touch.pageX;
    const currentY = touch.pageY;

    const deltaX = currentX - deckFocusCard.previousX;
    const deltaY = currentY - deckFocusCard.previousY;
  
    deckFocusCard.previousX = currentX;
    deckFocusCard.previousY = currentY;

    deckFocusCard.momentumY = deckFocusCard.momentumY * 0.8;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return;
    }
    if (event.cancelable) event.preventDefault();
    
    const rangeDelta = getDeckUpgradeRangeScalar(deckFocusCard, deltaY);
    const rangeScalar = deckFocusCard.currentRangeScalar + rangeDelta;
    
    deckFocusCard.momentumY += (rangeDelta || 0);

    applyDeckCardTopScroll(deckFocusCard, rangeScalar);
  }, {passive: false});
  cardScrollerEle.addEventListener("touchend", async (event) => {
    if (document.body.getAttribute("showing") != "deck") return;

    if (!deckFocusCard) return;
    if (!deckFocusCard.deckDragging) return;

    const focusCard = deckFocusCard;

    const upgradeCardEles = [...focusCard.children].filter(ele => ele.tagName == "CARD");

    // do the flickkkkk
    // animate it toward the closest scalar;
    const unsnappedTime = focusCard.unsnappedTime;
    const unsnappedRangeScalar = focusCard.unsnappedRangeScalar;
    const momentumScaled = focusCard.momentumY * 2;
    const maxCardIndex = Math.ceil(unsnappedRangeScalar);
    const minCardIndex = Math.floor(unsnappedRangeScalar);
    const targetRangeScalar = Math.min(upgradeCardEles.length, maxCardIndex, Math.max(0, minCardIndex, Math.round(unsnappedRangeScalar + momentumScaled)));

    // animate to the card.
    const animationDuration = 300;

    do {
      if (unsnappedTime != focusCard.unsnappedTime) return;
      await awaitFrame();

      var delta = Math.min(1, (Date.now() - unsnappedTime) / animationDuration);
      const tweenDelta = delta * delta;

      const range = targetRangeScalar - unsnappedRangeScalar;

      const newRangeScalar = unsnappedRangeScalar + range * tweenDelta;

      applyDeckCardTopScroll(focusCard, newRangeScalar, false);
      // move the thing toward it.
    } while (delta < 1);
  });

  cardScrollerEle.addEventListener("click", event => {
    const currentCardEle = getCurrentCardEle();
    if (!currentCardEle) return;

    // scroll to focus the clicked card, both in the x and "y" coordinates
    
  })

  const onCarouselInteraction = event => {
    if (!event.touches) return;

    const touch = event.touches[0];
    const touchX = touch.clientX - carouselCanvasEle.offsetLeft;
    const scrollRatio = touchX / carouselCanvasEle.clientWidth;
    const newScroll = cardLibraryListEle.clientWidth * scrollRatio;

    scrollScroller(newScroll);
    // cardScrollerEle.scrollTo({left: newScroll, top: 0, behavior: 'instant'});
  }

  carouselEle.addEventListener("touchstart", onCarouselInteraction);
  carouselEle.addEventListener("touchmove", onCarouselInteraction);

  carouselEle.addEventListener("mousedown", onCarouselInteraction);
  carouselEle.addEventListener("mousemove", onCarouselInteraction);

  deckTitleInput.addEventListener("input", event => {
    deckTitleInputMirror.innerText = deckTitleInput.value || deckTitleInput.placeholder;
    deckName = deckTitleInput.value;
    localStorage.setItem("deckName", deckName);
  });

  const handleSave = async (saveSlotIdx) => {
    var localJsonDecks = {};
  
    try {
      localJsonDecks = JSON.parse(localStorage.getItem('decks') || '{}');
    } catch (e) { }

    // check if a save is already up there
    if (localJsonDecks[saveSlotIdx]) {
      const confirmValue = await showConfirm(`Are you sure you want to override ${localJsonDecks[saveSlotIdx].deckName || 'Untitled Deck'}?`);

      if (!confirmValue) {
        return;
      }
    }
    // save to that slot
    localJsonDecks[saveSlotIdx] = {deck, deckName};

    localStorage.setItem('decks', JSON.stringify(localJsonDecks));

    loadDeckFromLocal();
    // hide the menu
    overlayMenuEle.classList.add("hidden");

    showToast(`Deck, ${deckName} saved to slot ${saveSlotIdx}`);
  };

  const handleLoad = async (loadSlotIdx) => {
    var localJsonDecks = {};
  
    try {
      localJsonDecks = JSON.parse(localStorage.getItem('decks') || '{}');
    } catch (e) { }

    // check if a save is already up there
    if (!localJsonDecks[loadSlotIdx]) {
      showToast(`Deck slot, ${loadSlotIdx} is empty`);
      return;
    }

    if (deck.length) {
      const confirmValue = await showConfirm("If your current deck is unsaved, it will be lost. Are you sure you want to load a new deck?");

      if (!confirmValue) {
        return;
      }
    }
    // save to that slot
    deck = localJsonDecks[loadSlotIdx].deck || {};
    deckName = localJsonDecks[loadSlotIdx].deckName || "";

    localStorage.setItem('deck', JSON.stringify(deck));
    localStorage.setItem('deckName', deckName);

    loadDeckFromLocal();
    // hide the menu
    overlayMenuEle.classList.add("hidden");

    showToast(`Deck, ${deckName || "Untitled Deck"} loaded!`);
  };

  [...document.querySelectorAll("menuControl.saveSlot")].forEach((saveSlotEle) => {
    // add event listeners to each to save 
    saveSlotEle.addEventListener("click", (event) => {
      const isSaveState = overlayMenuEle.getAttribute("saveMode") == "save";
      const saveIdx = saveSlotEle.getAttribute("idx");

      if (isSaveState) {
        handleSave(saveIdx);
      } else {
        handleLoad(saveIdx);
      }
    });
  });

  saveReturnEle.addEventListener("click", event => {
    // show deckslots
    overlayMenuEle.setAttribute("showing", "mainMenu");
  });

  saveDeckEle.addEventListener("click", event => {
    // show deckslots
    overlayMenuEle.setAttribute("showing", "savesMenu");
    overlayMenuEle.setAttribute("saveMode", "save");
  });

  loadDeckEle.addEventListener("click", event => {
    // show decklists
    overlayMenuEle.setAttribute("showing", "savesMenu");
    overlayMenuEle.setAttribute("saveMode", "load");
  });

  newDeckEle.addEventListener("click", async (event) => {
    // create new deck
    const value = await showConfirm("If your current deck is unsaved, it will be lost. Are you sure you want to create a new deck?");

    if (!value) {
      return;
    }

    overlayMenuEle.classList.add("hidden");

    localStorage.setItem("deck", "[]");
    localStorage.setItem("deckName", "");

    loadDeckFromLocal();
  });
  
  returnEle.addEventListener("click", event => {
    overlayMenuEle.classList.add("hidden");
  });
};

init();