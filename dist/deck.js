
import { cardsStore, showToast, awaitScrollStop, canCharacterEquipUpgrade, getUpgradeType, getParentCardEleFromAny } from './cards.shared.js';
import { storage } from './storage.js';
import { awaitFrame, awaitTime, getSId, clamp } from './utils.js';
import { showInteractCard, hideInteractCard, showConfirm, showOption, isModalShowing } from './dom.modal.js';
import { getPointerCardEle, getCenterCardEle } from './dom.js';
import { cardLibraryListEle, setSubFilter, applyCarousel, setScrolledLibraryCard, cardLibraryNameListEle } from './library.js';
import { CARD_SLIDE_DURATION } from './constants.js';

export var deckIdx = -1;
export var deck = [];
export var deckName = "";
export var deckFocusCard;
export var attachCharacter;
export var scrolledDeckCard;

export const setDeck = (d) => deck = d;
export const setDeckName = (n) => deckName = n;
export const setDeckFocusCard = (c) => {
  if (deckFocusCard == c) return;
  deckFocusCard = c;
};
export const setAttachCharacter = (c) => attachCharacter = c;
export const setScrolledDeckCard = (c) => scrolledDeckCard = c;

export const cardScrollerDeckEle = document.querySelector('cardScroller.deck');
export const cardDeckListEle = cardScrollerDeckEle.querySelector('cardList');
export const cardDeckNameListEle = cardScrollerDeckEle.querySelector('cardNameList');
export const addCharacterButtonEles = document.querySelectorAll("add");
export const showDeckButton = document.querySelector("cardButton.showDeck");

// imported from base.js originally
const deckTitleInput = document.querySelector("input#title");
const deckTitleInputMirror = document.querySelector("deckTitleMirror#titleMirror");

export const getDeckCardEleFromIndex = (deckIndex) => {
  return [...cardDeckListEle.children].filter(ele => ele.tagName === "CARDDECKWRAPPER")[deckIndex].querySelector("CARD");
};

export const getDeckUpgradeCardEleFromIndex = (deckIndex, upgradeIndex) => {
  const parentEle = getDeckCardEleFromIndex(deckIndex);

  return [...parentEle.querySelectorAll("CARD")][upgradeIndex];
};

export const getDeckNameCardEleFromIndex = (deckIndex) => {
  return [...cardDeckNameListEle.children].filter(ele => ele.tagName === "NAMECARD")[deckIndex];
}

export const getDeckNameUpgradeCardEleFromIndex = (deckIndex, upgradeIndex) => {
  const parentEle = getDeckNameCardEleFromIndex(deckIndex);

  return [...parentEle.querySelectorAll("NAMECARD")][upgradeIndex];
}

export const loadDeckFromLocalIndex = (idx) => {
  const localJsonDecks = storage.getStoredDecks();

  deckIdx = idx;

  setDeck(localJsonDecks[idx].deck || {});
  setDeckName(localJsonDecks[idx].deckName || "");

  storage.setStoredDeck(deckName, deck);

  loadDeckFromLocal();
}

export const getValueFromDeckCards = (deck) => {
  const cards = deck.map(deckStore => [deckStore, ...(deckStore.upgrades || [])]).flat().map(deckStore => cardsStore[deckStore.uid]);
  const cost = cards.reduce((sum, card) => card ? sum + (parseInt(card.cost) || 0) : sum, 0);

  return cost;
}

export const updateDeck = () => {
  // work out total points in deck :D
  const cost = getValueFromDeckCards(deck);

  const deckCostEle = document.getElementById('points');

  deckCostEle.innerHTML = cost ? `&nbsp;(${cost})` : '';

  storage.setStoredDeck(deckName, deck);

  // update the stored deck too
  const currentStoredDecks = storage.getStoredDecks();

  const newStoredDecks = { ...currentStoredDecks };

  newStoredDecks[deckIdx].deckName = deckName;
  newStoredDecks[deckIdx].deck = [...deck];

  storage.setStoredDecks(newStoredDecks);
};

export const scrollDeckScroller = async (left, top = 0) => {
  cardScrollerDeckEle.scrollTo({ left, top: top, behavior: 'instant' });

  await awaitFrame();
  await awaitScrollStop();
}

export const scrollDeckToCard = async (cardEle) => {
  // check if we're in list view
  if (document.body.getAttribute("listType") == "list") {
    // scroll to the top of it
    const offsetTop = cardEle.offsetTop;

    scrollDeckScroller(0, offsetTop);

    return;
  }

  const closestCardContainerEle = cardEle.closest("cardDeckWrapper");
  if (!closestCardContainerEle) return; // safety

  const cardWidth = closestCardContainerEle.clientWidth;

  const offsetCenterLeft = window.innerWidth * 0.5 - cardWidth * 0.5;
  const cardScrollX = closestCardContainerEle.offsetLeft || 0;

  scrollDeckScroller(cardScrollX - offsetCenterLeft);
};

export const getDeckUpgradeRangeScalar = (containerCardEle, _scrollY) => {
  const scrollY = _scrollY * 1.4;
  // work out how many cards are there to stack
  const upgradeCardEles = [...containerCardEle.children].filter(ele => ele.tagName == "CARD");

  const cardHeight = containerCardEle.clientHeight;

  const upgradeOffsetY = scrollY;

  // we'll make the top card go down by a card height
  const rangeCardOffsetY = (0.175 / upgradeCardEles.length) * cardHeight;
  const rangeScalar = (-upgradeOffsetY) / cardHeight;

  return rangeScalar;
};

export const applyDeckCardTopScroll = (containerCardEle, rangeScalar, setScalar = true) => {
  if (document.body.getAttribute("listType") == "list") return;

  // adjust the range scalar
  if (!containerCardEle) return;

  if (setScalar) {
    containerCardEle.unsnappedRangeScalar = rangeScalar;
    containerCardEle.unsnappedTime = Date.now();
  }
  containerCardEle.currentRangeScalar = rangeScalar;

  // work out how many cards are there to stack
  const upgradeCardEles = [...containerCardEle.children].filter(ele => ele.tagName == "CARD");

  if (upgradeCardEles.length == 0) {
    containerCardEle.style.setProperty("transform", `translateY(0px)`);
    return;
  }

  // lets try something new.
  const cardList = [...upgradeCardEles];

  // kind of want to bound the range scalar by sqrt or some king of smoothing
  const rangeScalarIntValue = Math.floor(rangeScalar);
  const rangeScalarDecimalValue = rangeScalar - rangeScalarIntValue;

  const scaledRangeScalar = rangeScalarIntValue + rangeScalarDecimalValue;

  // the offset should be an set y offset for each, no scaling
  const cardHeight = containerCardEle.clientHeight;
  const cardOffset = 0.175 * cardHeight;

  const containerMajorOffset = Math.min(1, scaledRangeScalar);
  const containerMinorOffset = Math.max(scaledRangeScalar - 1, 0);

  const adjustUp = clamp(cardList.length - scaledRangeScalar, 0, 2) * cardOffset * 0.65;

  const containerOffsetPx = containerMajorOffset * -cardHeight + containerMinorOffset * -cardOffset - adjustUp;

  containerCardEle.style.setProperty("transform", `translateY(${containerOffsetPx}px)`);

  rangeScalar = Math.max(0, scaledRangeScalar);

  const focusedCardIndex = (scaledRangeScalar - 1);

  for (const cardEle of cardList) {
    const cardIndex = cardList.indexOf(cardEle);
    const beforeFocusedOffsetPx = cardOffset * (parseInt(cardIndex) + 1);

    const indexOffset = cardIndex - focusedCardIndex;

    const focusedOffsetPx = clamp(scaledRangeScalar, 0, 1) * cardHeight + cardOffset * focusedCardIndex;

    const afterFocusedOffsetPx = focusedOffsetPx + cardOffset * (indexOffset + (1 - clamp(scaledRangeScalar, 0, 1)));

    const beforeDiffPx = beforeFocusedOffsetPx - focusedOffsetPx;
    const afterDiffPx = afterFocusedOffsetPx - focusedOffsetPx;

    if (indexOffset < 0) {
      const positionPx = focusedOffsetPx + beforeDiffPx * clamp(-indexOffset, 0, 1);

      cardEle.style.setProperty("transform", `translateY(${positionPx}px) translateZ(-${cardIndex + 1}px)`);
      continue;
    } else {
      const positionPx = focusedOffsetPx + afterDiffPx * clamp(indexOffset * 55, 0, 1);

      cardEle.style.setProperty("transform", `translateY(${positionPx}px) translateZ(-${cardIndex + 1}px)`);
      continue;
    }
  }
};

export const getDeckIndexOfCardEle = (cardEle) => {
  if (cardEle.tagName == "NAMECARD") {
    const cardWrapperEle = cardEle.parentElement.closest("nameCard") ?? cardEle;
    
    return [...cardDeckNameListEle.children].filter(ele => ele.tagName == "NAMECARD").indexOf(cardWrapperEle);
  }

  const cardWrapperEle = cardEle.closest("cardDeckWrapper");
  if (!cardWrapperEle) return -1;

  return [...cardDeckListEle.children].filter(ele => ele.tagName == "CARDDECKWRAPPER").indexOf(cardWrapperEle);
};

export const getUpgradeIndexOfCardEle = (cardEle) => {
    const parentCardEle = getParentCardEleFromAny(cardEle);

  if (cardEle.tagName == "NAMECARD") {
    const upgradeContainerEle = parentCardEle.querySelector("upgradeContainer");

    return [...upgradeContainerEle.children].filter(ele => ele.tagName == "NAMECARD").indexOf(cardEle);
  }

  return [...parentCardEle.children].filter(ele => ele.tagName == "CARD").indexOf(cardEle);
}

export const addCharacterToDeck = (data, updateDeckStore = true) => {
  const uid = data.uid;
  if (!uid) return;

  const cardStore = cardsStore[uid];
  if (!cardStore) return;

  const libraryCardEles = [...cardLibraryListEle.children]; // Imported from library.js
  const cardEle = libraryCardEles.find(ele => ele.getAttribute('uid') == uid);
  if (!cardEle) return;
  const libraryNameCardEles = [...cardLibraryNameListEle.children];
  const cardNameEle = libraryNameCardEles.find(ele => ele.getAttribute('uid') == uid);
  if (!cardNameEle) return;

  const wrapperEle = document.createElement("cardDeckWrapper");
  const cardDeckAddEle = cardDeckListEle.querySelector("add");
  cardDeckListEle.insertBefore(wrapperEle, cardDeckAddEle);

  // add a snap point infront and behind it
  const beforeSnapEle = document.createElement("snapPoint");
  cardDeckListEle.insertBefore(beforeSnapEle, wrapperEle);

  const cardCloneEle = cardEle.cloneNode(true);
  cardCloneEle.className = "";
  wrapperEle.append(cardCloneEle);

  // add the card name to the deck
  const cardNameCloneEle = cardNameEle.cloneNode(true);
  const addCardNameEle = cardDeckNameListEle.querySelector("add");
  const cardNameCloneHealthContainerEle = cardNameCloneEle.querySelector("nameCardHealthBoxes");

  cardDeckNameListEle.insertBefore(cardNameCloneEle, addCardNameEle);

  const sessionId = getSId();

  // create mark boxes...
  (cardStore.markBoxes || []).forEach(([boxX, boxY], index) => {
    // check if the box should be marked
    const dataMarked = (data.marked || [])[index];

    const boxEle = document.createElement("markBox");

    cardCloneEle.append(boxEle);

    boxEle.style.setProperty("top", `${boxY * 100}%`);
    boxEle.style.setProperty("left", `${boxX * 100}%`);
    boxEle.style.setProperty("transform", `translate(-50%, -50%) rotate(${Math.random() * 10 - 5}deg)`);

    if (dataMarked) {
      boxEle.classList.add("marked");
    }

    boxEle.addEventListener("click", () => {
      const willBeMarked = !boxEle.classList.contains("marked");
      namedBoxEle.classList.toggle("marked", willBeMarked);
      boxEle.classList.toggle("marked", willBeMarked);
      const cardIndex = deck.findIndex(card => card.sid == sessionId);
      if (cardIndex == -1) return;
      deck[cardIndex].marked = deck[cardIndex].marked || [];
      deck[cardIndex].marked[index] = willBeMarked;
      updateDeck();
    });

    // mark everything for the named thing
    const namedBoxEle = document.createElement("markBox");

    if (cardStore.criticalHealthBox == index) {
      namedBoxEle.classList.add("critical");
    }

    if (dataMarked) {
      namedBoxEle.classList.add("marked");
    }

    namedBoxEle.addEventListener("click", () => {
      const willBeMarked = !namedBoxEle.classList.contains("marked");
      namedBoxEle.classList.toggle("marked", willBeMarked);
      boxEle.classList.toggle("marked", willBeMarked);
      const cardIndex = deck.findIndex(card => card.sid == sessionId);
      if (cardIndex == -1) return;
      deck[cardIndex].marked = deck[cardIndex].marked || [];
      deck[cardIndex].marked[index] = willBeMarked;
      updateDeck();
    });

    cardNameCloneHealthContainerEle.append(namedBoxEle);
  });


  if (updateDeckStore) {
    deck.push({ uid });
  }
  data.sid = sessionId;

  if (data.upgrades) {
    data.upgrades.forEach((upgrade) => {
      addUpgradeToCharacter(upgrade.uid, cardCloneEle, data, false);
    })
  }
  applyDeckCardTopScroll(cardCloneEle, 0, false);

  return cardCloneEle;
};

export const addUpgradeToCharacter = (upgradeUID, characterCardEle, deckCharacter, updateDeckStore = true) => {
  if (!upgradeUID) return;

  const upgradeCardStore = cardsStore[upgradeUID];
  if (!upgradeCardStore) return;

  const libraryCardEles = [...cardLibraryListEle.children];
  const cardEle = libraryCardEles.find(ele => ele.getAttribute('uid') == upgradeUID);
  const nameCardEle = [...cardLibraryNameListEle.children].find(ele => ele.getAttribute('uid') == upgradeUID);
  if (!cardEle) return;

  const cardCloneEle = cardEle.cloneNode(true);
  cardCloneEle.className = "";
  characterCardEle.append(cardCloneEle);
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

  const characterCardIndex = deck.findIndex(deckCard => deckCard == deckCharacter);

  const nameCardCharacterEle = getDeckNameCardEleFromIndex(characterCardIndex);

  if (!nameCardCharacterEle) console.error("namedCharacter card mismatch!");

  const nameCardUpgradeEle = nameCardCharacterEle.querySelector('upgradeContainer');
  const nameCardCloneEle = nameCardEle.cloneNode(true);  
  const nameCardHealthBoxContainerEle = nameCardCloneEle.querySelector("nameCardHealthBoxes");

  (upgradeCardStore.markBoxes || []).forEach((_, index) => {
    const boxEle = document.createElement("markBox");

    nameCardHealthBoxContainerEle.append(boxEle);

    boxEle.addEventListener("click", () => {
      boxEle.classList.toggle("marked");
    });
  });

  nameCardUpgradeEle.append(nameCardCloneEle);

  if (updateDeckStore) {
    deckCharacter.upgrades = deckCharacter.upgrades || [];
    deckCharacter.upgrades.push({ uid: upgradeUID });
    awaitFrame()
      .then(awaitFrame)
      .then(
        () => {
          applyDeckCardTopScroll(characterCardEle, deckCharacter.upgrades.length, false);
        });
  }
  return cardCloneEle
};


export const removeCharacter = async () => {
  // check if there's a selected card
  const selectedCardEle = document.querySelector('card.highlight');
  const parentCardEle = getParentCardEleFromAny(selectedCardEle);
  const containerCardEle = parentCardEle.parentElement;

  if (!parentCardEle) {
    showToast('Can\'t remove that');
    return;
  }

  const currentCardIndex = getDeckIndexOfCardEle(selectedCardEle);
  if (currentCardIndex == -1) {
    showToast('Can\'t remove that');
    return;
  };

  const nameCardEle = getDeckNameCardEleFromIndex(currentCardIndex);

  const currentFocusSubIndex = parentCardEle
    ? [...parentCardEle.querySelectorAll("card")].indexOf(selectedCardEle) + 1
    : parentCardEle.currentRangeScalar || 0;

  if (!currentFocusSubIndex) {
    const confirmValue = await showConfirm('Are you sure you want to remove this card, and all it\'s upgrades from this deck?');
    await awaitTime(200);

    if (!confirmValue) return;

    deck.splice(currentCardIndex, 1);
    containerCardEle.remove();

    // find the corresponding nameCard

    nameCardEle.remove();
  } else {
    const upgradeIndex = currentFocusSubIndex - 1;

    deck[currentCardIndex].upgrades.splice(upgradeIndex, 1);
    const upgradeCardEle = [...parentCardEle.querySelectorAll("card")][upgradeIndex];

    upgradeCardEle.remove();

    applyDeckCardTopScroll(parentCardEle, 0);

    const upgradeNameCardEle = getDeckNameUpgradeCardEleFromIndex(currentCardIndex, upgradeIndex);

    upgradeNameCardEle.remove();
  }
  updateDeck();

  showToast(`Card removed from deck`);
};

export const onShowDeck = async (fromMainMenu) => {
  if (document.body.getAttribute("showing") == 'deck') return;

  setScrolledLibraryCard(getCenterCardEle());

  setSubFilter(); // From library.js

  // scroll to the last library focused' card
  document.body.setAttribute("showing", "deck");

  // if this is the first time showing the deck since we loaded, then we should minorly adjust the scrolls
  if (fromMainMenu) {
    await awaitFrame();
    const topLevelCardEles = [...cardDeckListEle.querySelectorAll("cardDeckWrapper > card")];

    for (const cardEle of topLevelCardEles) {
      if (!cardEle) continue;

      applyDeckCardTopScroll(cardEle, 0);
    }
  }

  await awaitScrollStop();
};

export const startAttachUpgrade = async () => {
  if (document.body.getAttribute("showing") !== 'deck') return;

  const deckCurrentCardEle = document.querySelector('card.highlight');
  if (!deckCurrentCardEle) {
    showToast("Can't attach upgrade to that");
    return;
  }

  const uid = deckCurrentCardEle.getAttribute("uid");
  const cardStore = cardsStore[uid];
  if (!cardStore) return;

  const currentCardIndex = getDeckIndexOfCardEle(deckCurrentCardEle);

  setDeckFocusCard(deckCurrentCardEle);
  attachCharacter = deck[currentCardIndex];

  setSubFilter('upgrade', { classes: cardStore.classes, upgradeType: cardStore.upgradeTypes });

  if (document.body.getAttribute("showing") !== 'deck') return;
  document.body.className = '';
  scrolledDeckCard = getCenterCardEle();
  document.body.setAttribute("showing", "library");
  applyCarousel();
};

export const finishAttachUpgrade = async () => {
  if (!attachCharacter) return;
  const currentCardEle = document.querySelector('card.highlight');
  if (!currentCardEle) return;
  const uid = currentCardEle.getAttribute("uid");
  if (!uid) return;
  const isAcceptable = canCharacterEquipUpgrade(attachCharacter, uid);
  const upgradeType = getUpgradeType(cardsStore[uid]);
  const dontAdd = !isAcceptable && !(await showConfirm(`This character already has too many, ${upgradeType}s. Do you want to still add this?`));
  if (!isAcceptable) await awaitTime(200);
  hideInteractCard(dontAdd);
  currentCardEle.classList.toggle("highlight", false);
  if (dontAdd) return;
  const cardEleClone = addUpgradeToCharacter(uid, deckFocusCard, attachCharacter, true);
  if (!cardEleClone) return;
  updateDeck();
  showToast(`Upgrade Attached`);
  scrollDeckToCard(deckFocusCard);
  onShowDeck();
  cardEleClone.classList.add("highlight");
  await awaitTime(500);
  cardEleClone.classList.remove("highlight");
};

export const addCharacter = async () => {
  const currentCardEle = document.querySelector('card.highlight');
  if (!currentCardEle) return;
  const uid = currentCardEle.getAttribute("uid");
  const cardEleClone = addCharacterToDeck({ uid });
  if (!cardEleClone) return;
  updateDeck();
  setDeckFocusCard(cardEleClone);
  showToast(`Card added to deck`);
  scrollDeckToCard(cardEleClone);
  currentCardEle.classList.toggle("highlight", false);
  await onShowDeck();
};

export const loadDeckFromLocal = () => {
  debugger;
  [...cardDeckListEle.children].filter(ele => ["CARDDECKWRAPPER", "SNAPPOINT"].includes(ele.tagName)).forEach(ele => ele.remove());
  [...cardDeckNameListEle.children].filter(ele => ["NAMECARD"].includes(ele.tagName)).forEach(ele => ele.remove());
  const storedDeck = storage.getStoredDeck();

  const libraryCards = [...cardLibraryListEle.children].map(ele => ({ uid: ele.getAttribute("uid") }));

  deck = storedDeck.deck.filter(v => v && libraryCards.find(card => card.uid == v.uid));
  deckName = storedDeck.deckName;
  deckTitleInput.value = deckName;
  deckTitleInputMirror.innerText = deckName || deckTitleInput.placeholder;

  updateDeck();
  for (const cardData of deck) {
    addCharacterToDeck(cardData, false);
  }
  scrollDeckScroller(0);
  var storedDecks = storage.getStoredDecks();
};

export const initDeckEvents = () => {
  cardScrollerDeckEle.addEventListener("touchstart", event => {
    if (document.body.getAttribute("showing") != "deck") return;
    const touch = event.touches[0];
    setDeckFocusCard(getPointerCardEle(touch));
    if (!deckFocusCard) return;
    deckFocusCard.touchStart = Date.now();
    deckFocusCard.deckDragging = false;
    return;
  }, { passive: false });

  cardScrollerDeckEle.addEventListener("touchmove", event => {
    if (isModalShowing()) return;
    if (document.body.getAttribute("showing") != "deck") return;
    if (!deckFocusCard) return;

    const touch = event.touches[0];
    if (!deckFocusCard.deckDragging) {
      deckFocusCard.currentRangeScalar = deckFocusCard.currentRangeScalar || 0;
      deckFocusCard.scrollY = 0;
      deckFocusCard.momentumY = 0;
      deckFocusCard.previousX = touch.pageX;
      deckFocusCard.previousY = touch.pageY;
      deckFocusCard.hasVerticallity = false;
      deckFocusCard.deckDragging = true;
    }

    const currentX = touch.pageX;
    const currentY = touch.pageY;
    const deltaX = currentX - deckFocusCard.previousX;
    const deltaY = currentY - deckFocusCard.previousY;
    deckFocusCard.previousX = currentX;
    deckFocusCard.previousY = currentY;
    deckFocusCard.momentumY = deckFocusCard.momentumY * 0.8;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) return;
    if (event.cancelable) event.preventDefault();
    deckFocusCard.hasVerticallity = true;
    const rangeDelta = getDeckUpgradeRangeScalar(deckFocusCard, deltaY);
    // Note: rangeDelta depends on state or logic?
    // getDeckUpgradeRangeScalar is exported function in this file.
    const rangeScalar = deckFocusCard.currentRangeScalar + rangeDelta;

    deckFocusCard.momentumY += (rangeDelta || 0);
    applyDeckCardTopScroll(deckFocusCard, rangeScalar);
  }, { passive: false });

  cardScrollerDeckEle.addEventListener("touchend", async (event) => {
    if (document.body.getAttribute("showing") != "deck") return;
    if (document.body.getAttribute("listType") === "list") return;

    if (!deckFocusCard) return;
    if (!deckFocusCard.deckDragging) return;

    const focusCard = deckFocusCard;
    const upgradeCardEles = [...focusCard.children].filter(ele => ele.tagName == "CARD");

    if (!focusCard.hasVerticallity) return;

    const unsnappedTime = focusCard.unsnappedTime;
    const unsnappedRangeScalar = focusCard.unsnappedRangeScalar;
    const momentumScaled = focusCard.momentumY * 2;
    const maxCardIndex = Math.ceil(unsnappedRangeScalar);
    const minCardIndex = Math.floor(unsnappedRangeScalar);
    const targetRangeScalar = Math.max(0, Math.min(upgradeCardEles.length, maxCardIndex, Math.max(0, minCardIndex, Math.round(unsnappedRangeScalar + momentumScaled))));

    const animationDuration = CARD_SLIDE_DURATION;
    focusCard.targetRangeScalar = targetRangeScalar;
    console.log(targetRangeScalar);

    do {
      if (unsnappedTime != focusCard.unsnappedTime) return;
      await awaitFrame();
      var delta = Math.min(1, (Date.now() - unsnappedTime) / animationDuration);
      const tweenDelta = delta * delta;
      const range = targetRangeScalar - unsnappedRangeScalar;
      const newRangeScalar = unsnappedRangeScalar + range * tweenDelta;
      applyDeckCardTopScroll(focusCard, newRangeScalar, false);
    } while (delta < 1);
  });

  cardScrollerDeckEle.addEventListener("click", async (event) => {
    if (document.body.getAttribute("showing") !== 'deck') {
      return;
    }

    event.preventDefault();

    const selectedCardEle = event.target;
    if (!selectedCardEle) return;
    if (!["CARD", "NAMECARD"].includes(selectedCardEle.tagName)) return;

    // check if it's the focused card
    const deckIndex = getDeckIndexOfCardEle(selectedCardEle);
    if (deckIndex == -1) return;
    const parentCardEle = getParentCardEleFromAny(selectedCardEle);
    const upgradeIndex = getUpgradeIndexOfCardEle(selectedCardEle);

    // check the deckcardtop scroll

    if (selectedCardEle.tagName === "CARD") {
      if (parentCardEle.currentRangeScalar !== (upgradeIndex + 1)) {
        applyDeckCardTopScroll(parentCardEle, upgradeIndex + 1);
        return;
      }
    }

    const deckParentCardEle = getDeckCardEleFromIndex(deckIndex);
    const deckCardEle = upgradeIndex === -1 
      ? deckParentCardEle 
      : getDeckUpgradeCardEleFromIndex(deckIndex, upgradeIndex);

    awaitTime(100).then(() => {
      deckCardEle.classList.toggle("highlight", true);
    });

    // Deck specific logic
    showInteractCard(deckCardEle);
    const currentFocusCard = cardsStore[deckCardEle.getAttribute("uid")];
    const options = [];
    if (currentFocusCard.types == "character") {
      options.push("Add Upgrade");
      options.unshift("Remove Character");
    } else {
      options.push("Remove Upgrade");
    }

    const optionResult = await showOption(`<h4>${currentFocusCard.name} selected</h4> `, options);
    if (optionResult == "Add Upgrade") {
      await startAttachUpgrade();
    } else if (optionResult == "Remove Character" || optionResult == "Remove Upgrade") {
      await removeCharacter();
    }
    hideInteractCard(!optionResult);
    selectedCardEle.classList.toggle("highlight", false);
    return;
  });

  deckTitleInput.addEventListener("input", event => {
    deckTitleInputMirror.innerText = deckTitleInput.value || deckTitleInput.placeholder;
    deckName = deckTitleInput.value;
    storage.setStoredDeck(deckName, deck);
  });

  [...addCharacterButtonEles].forEach(addCharacterButtonEle => {
    addCharacterButtonEle.addEventListener('click', () => {
      if (document.body.getAttribute("showing") !== 'deck') return;
      attachCharacter = undefined;
      setSubFilter('character');
      // navigateToLibrary(); // Calling implementation
      // Implementing locally again to avoid cycle if necessary or just import
      // Local:
      document.body.className = '';
      scrolledDeckCard = getCenterCardEle();
      document.body.setAttribute("showing", "library");
      applyCarousel();
    });
  });

  showDeckButton.addEventListener('click', onShowDeck);
};
