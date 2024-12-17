import { PDF_SCALE, PDF_CARD_WIDTH, PDF_CARD_HEIGHT, PDF_CARD_OFFSET_X, PDF_CARD_OFFSET_Y, PDF_CARD_ROW_OFFSET, CARD_SLIDE_DURATION, API_URL, SHARE_URL } from './constants.js';
import { storage, init as initStorage } from './storage.js';
import { getCardFromPoint, getPointerCardEle, getCenterCardEle } from './dom.js';

import { initTokens } from './tokens.js';

import { awaitFrame, awaitTime, getSId, clamp, getAllCardsIdsInDeck, readFile } from './utils.js';

import { showInteractCard, hideInteractCard, showConfirm, showInput, showOption, isModalShowing, init as initModal } from './dom.modal.js';

import { loadCardsFromUrl, loadCardDataFromUrl } from './dom.pdf.js';

import { getCardStore } from './store.web.js';

var deckName = "";
var deck = [];

var deckFocusCard;

var attachCharacter;

var hasRelicInLibrary = false;

var scrolledDeckCard;
var scrolledLibraryCard;

var lastClipboardFind;
var lastLoadedSharedDeck;

const cardsStore = await getCardStore();

const cardScrollerDeckEle = document.querySelector('cardScroller.deck');
const cardDeckListEle = cardScrollerDeckEle.querySelector('cardList');
const cardScrollerLibraryEle = document.querySelector('cardScroller.library');
const cardLibraryListEle = cardScrollerLibraryEle.querySelector('cardList');
const cardTopControlsEle = document.querySelector('cardTopControls');

const searchInputEles = document.querySelectorAll('searchContainer input');
const searchInputClearEle = document.querySelector('searchContainer searchicon[type="clear"]');
const gridButtonEle = document.querySelector('.grid');
const legalButtonEle = document.querySelector('.legal');

const previewEle = document.querySelector('preview');
const cropperEle = document.querySelector('cropper');

const showLibraryButton = document.querySelector("cardButton.showLibrary");
const searchButton = document.querySelector("cardButton.search");
const showDeckButton = document.querySelector("cardButton.showDeck");
const addCharacterButton = document.querySelector("add");

const deckTitleInput = document.querySelector("input#title");
const deckTitleInputMirror = document.querySelector("deckTitleMirror#titleMirror");

const removeLibraryCardEle = document.querySelector('.removeLibraryCard');
const returnEle = document.querySelector('menuControl.return');
const saveReturnEle = document.querySelector('menuControl.saveReturn');
const newDeckEle = document.querySelector('menuControl.newDeck');
const saveDeckEle = document.querySelector('menuControl.saveDeck');
const loadDeckEle = document.querySelector('menuControl.loadDeck');
const overlayMenuEle = document.querySelector('overlayMenu');

const descriptionEle = document.querySelector('description');

const updateDeck = () => {
  // work out total points in deck :D
  const cards = deck.map(deckStore => [deckStore, ...(deckStore.upgrades || [])]).flat().map(deckStore => cardsStore[deckStore.uid]);
  const cost = cards.reduce((sum, card) => card ? sum + (parseInt(card.cost) || 0) : sum, 0);

  const deckCostEle = document.getElementById('points');

  deckCostEle.innerHTML = cost ? `&nbsp;(${cost})` : '';

  storage.setStoredDeck(deckName, deck);
};

const getCurrentCardScrollerEle = () => {
  return document.body.getAttribute("showing") == "library" 
    ? cardScrollerLibraryEle 
    : cardScrollerDeckEle;
}

const scrollDeckScroller = async (left) => {
  cardScrollerDeckEle.scrollTo({left, top: 0, behavior: 'instant'});

  await awaitFrame();

  await awaitScrollStop();
}

const scrollDeckToCard = async (cardEle) => {
  const closestCardContainerEle = cardEle.closest("cardDeckWrapper");
  const cardWidth = closestCardContainerEle.clientWidth;

  const offsetCenterLeft = window.innerWidth * 0.5 - cardWidth * 0.5;
  const cardScrollX = closestCardContainerEle.offsetLeft || 0;

  scrollDeckScroller(cardScrollX - offsetCenterLeft);
};

const scrollLibraryScroller = async (left) => {
  if (document.body.getAttribute("displayType") == "grid") {
    left = Math.max(left, window.innerWidth * 0.4);
  }
  cardScrollerLibraryEle.scrollTo({left, top: 0, behavior: 'instant'});

  applyCarousel();

  await awaitFrame();

  await awaitScrollStop();
};

const setDeckFocusCard = (newDeckFocusCard) => {
  // check if they're different
  if (deckFocusCard == newDeckFocusCard) return; 

  deckFocusCard = newDeckFocusCard;
};

const getParentCardEleFromAny = (ele) => {
  // find the top level parent
  while (ele.parentElement && ele.parentElement.tagName == "CARD") {
    ele = ele.parentElement;
  }

  return ele;
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

const awaitScrollStop = async () => {
  const currentCardScrollerEle = getCurrentCardScrollerEle();
  const startTime = Date.now();

  var lastScrollLeft = currentCardScrollerEle.scrollLeft;

  await awaitFrame();

  while (lastScrollLeft != currentCardScrollerEle.scrollLeft) {
    lastScrollLeft = currentCardScrollerEle.scrollLeft;
    await awaitFrame();
  }
  return startTime - Date.now();
};

const getDeckUpgradeRangeScalar = (containerCardEle, _scrollY) => {
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

// initially as you scroll down, only the container moves down
// then after that hits the bottom, the next card starts to go towards the bototm
// so everything needs to raise till the container hits the bottom.
const applyDeckCardTopScroll = (containerCardEle, rangeScalar, setScalar = true) => {
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

  // the first card is different, lets treat it as different.

  rangeScalar = Math.max(0, scaledRangeScalar);

  const focusedCardIndex = (scaledRangeScalar - 1);

  for (const cardEle of cardList) {
    const cardIndex = cardList.indexOf(cardEle);
    const beforeFocusedOffsetPx = cardOffset * (parseInt(cardIndex) + 1);

    const indexOffset = cardIndex - focusedCardIndex;

    // if the index is greater than 1 or less than -1, it shouldn't be animating toward anything
    // 0 is the focused card, as the focused card goes toward 1, it moves down, and the card above moves down too

    // if we're at the focused card index, we should be just below the top
    
    // we should take into account how the top card is moving, and normalize?

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

const getDeckIndexOfCardEle = (cardEle) => {
  const cardWrapperEle = cardEle.closest("cardDeckWrapper");
  if (!cardWrapperEle) return -1;

  return [...cardDeckListEle.children].filter(ele => ele.tagName == "CARDDECKWRAPPER").indexOf(cardWrapperEle);

};

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
  
  // add a snap point infront and behind it
  const beforeSnapEle = document.createElement("snapPoint");
  cardDeckListEle.insertBefore(beforeSnapEle, wrapperEle);

  const cardCloneEle = cardEle.cloneNode(true);
  cardCloneEle.className = "";
  wrapperEle.append(cardCloneEle);

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

      boxEle.classList.toggle("marked", willBeMarked);

      // get the cards index by the sid
      const cardIndex = deck.findIndex(card => card.sid == sessionId);
      if (cardIndex == -1) return;

      deck[cardIndex].marked = deck[cardIndex].marked || [];
      deck[cardIndex].marked[index] = willBeMarked;

      updateDeck();
    });
  });

  if (updateDeckStore) {
    deck.push({
      uid
    });
  }
  // give it a new SID
  data.sid = sessionId;

  if (data.upgrades) {
    data.upgrades.forEach((upgrade) => {
      addUpgradeToCharacter(upgrade.uid, cardCloneEle, data, false);
    })
  }
  applyDeckCardTopScroll(cardCloneEle, 0, false);

  return cardCloneEle;
};

const getUpgradeType = (upgrade) => {
  try {
    return /(tactic|item|potion|spell|weapon)/.exec(cardsStore[upgrade.uid].types)[0];
  } 
  catch (e) {
    console.error(`unable to get upgrade type for ${upgrade.uid}`);
    console.error(e);
    return true;
  }
}
const canCharacterEquipUpgrade = (attachCharacter, upgradeUid) => {
  // assume that it can take the upgrade, due to the filter.
  const upgradeBean = cardsStore[upgradeUid];
  if (!upgradeBean) return false;

  const characterBean = cardsStore[attachCharacter.uid];
  if (!characterBean) return false;

  const upgradeType = getUpgradeType(upgradeBean);
  if (!upgradeType) return true;
  
  const acceptableUpgradeTypes = characterBean.upgradeTypes
    .split(" ")
    .map(s => s.trim())
    .reduce((acc, type) => {
      acc[type] = acc[type] ? acc[type] + 1 : 1;

      return acc;
    }, {})

  // check the number of upgrades of that type, the character already has
  const currentCharacterUpgradeTypes = [...(attachCharacter.upgrades || []), upgradeBean]
    .map(getUpgradeType)
    .filter(v => v == upgradeType);

  for (const currentCharacterUpgradeType of currentCharacterUpgradeTypes) {
    if (acceptableUpgradeTypes[currentCharacterUpgradeType] === undefined) continue;

    acceptableUpgradeTypes[currentCharacterUpgradeType]--;

    if (acceptableUpgradeTypes[currentCharacterUpgradeType] < 0) return false;
  }

  return true;
};

const addUpgradeToCharacter = (upgradeUID, characterCardEle, deckCharacter, updateDeckStore = true) => {
  if (!upgradeUID) return;

  const upgradeCardStore = cardsStore[upgradeUID];
  if (!upgradeCardStore) return;

  const libraryCardEles = [...cardLibraryListEle.children];
  const cardEle = libraryCardEles.find(ele => ele.getAttribute('uid') == upgradeUID);
  if (!cardEle) return;

  const cardCloneEle = cardEle.cloneNode(true);
  cardCloneEle.className = "";
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
      applyDeckCardTopScroll(characterCardEle, deckCharacter.upgrades.length, false);
      });
  }

  return cardCloneEle
};

const performSearchForString = (newSearchText) => {
  const currentFocusCard = getCenterCardEle();

  const libraryCardEles = [...cardLibraryListEle.children];
  const previousActiveLibraryCardEles = libraryCardEles.filter(e => !e.classList.contains('inactive'));

  setSearchText(newSearchText);
  
  const currentActiveLibraryCardEles = libraryCardEles.filter(e => !e.classList.contains('inactive'));

  if (currentActiveLibraryCardEles.length != previousActiveLibraryCardEles.length) {
    // scroll to the current focus card
    const currentFocusCardIndex = currentActiveLibraryCardEles.indexOf(currentFocusCard);

    if (currentFocusCardIndex != -1) {
      const currentFocusCardEle = currentActiveLibraryCardEles[currentFocusCardIndex];
      const scrollLeft = currentFocusCardEle.offsetLeft;
      scrollLibraryScroller(scrollLeft);
    } else {
      scrollLibraryScroller(0);
    }
  }

  applyCarousel();

  // try to maintain the scroll?

  cardTopControlsEle.classList.toggle('searched', !!getSearchText());
};

const loadDeckFromLocal = () => {
  // clear the deck.
  [...cardDeckListEle.children].filter(ele => ["CARDDECKWRAPPER", "SNAPPOINT"].includes(ele.tagName)).forEach(ele => ele.remove());
  
  const storedDeck = storage.getStoredDeck();

  console.log(`sd: ${JSON.stringify(storedDeck)}`);
  
  const libraryCards = [...cardLibraryListEle.children].map(ele => ({uid: ele.getAttribute("uid")}));

  // inital deck production
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

  // update the deckstore
  [...document.querySelectorAll("menuControl.saveSlot")].forEach((saveSlotEle) => {
    const saveSlotIdx = saveSlotEle.getAttribute("idx");
    const localJsonDeckIdx = storedDecks[saveSlotIdx] || {deckName: "Empty Slot"};

    saveSlotEle.innerText = `${saveSlotIdx}. ${localJsonDeckIdx.deckName}`;
  });
};
const isShareCodeFormat = (code) => {
  const trimmedCode = code.trim();

  const codeRegex = /[a-zA-Z\d]{12}/;

  if (!codeRegex.test(trimmedCode)) return false;

  // check if all it matches the regex;
  return true;
}
const getDeckFromShareCode = async(code) => {
  try {
    var sharedResponse = await fetch(`${API_URL}/sharedDeck?id=${code}`);
  } catch (e) {
    console.error(e);
    
    return false;
  }
  
  return await sharedResponse.json();
}
const placeDeckFromShareCodeIntoLocal = async (deckData) => {
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

    deck = JSON.parse(deckData.deck || "[]");
    deckName = deckData.deckName || "";

    // save to that slot

    storage.setStoredDeck(deckName, deck);

    loadDeckFromLocal();
  } catch (e) {
    console.error(e);
    showToast("Failed to load shared deck");

    return;
  }

  showToast(`${deckName || "Shared Deck"} Loaded`);
}
const loadShareDeckFromCode = async (code) => {
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

/* #REGION LOAD SCRIPTS */
  const getCardLibraryPlacementBeforeEle = (placeCard) => {
    const libraryCardEles = [...cardLibraryListEle.children];

    const getCardSortWeighting = (cardEle) => {
      const cardUID = cardEle.getAttribute('uid');
      const cardStore = cardsStore[cardUID];

      if (!cardStore) return;

      // is character / summon adjacent
      const isSummonOrCharacter = !!cardStore.types.match(/(character|summon)/i);
      const isAdvocate = !!cardStore.factions.match(/advocate/i);
      const isAdversary = !!cardStore.factions.match(/adversary/i);
      const isLegend = !!cardStore.keywords.match(/legend/i);
      const cardSet = cardUID.substr(0, cardUID.length - 4);

      const isUpgrade = !!cardStore.types.match(/upgrade/i);
      const isRelic = !!cardStore.types.match(/relic/i);

      const isCampaign = !!cardStore.types.match(/campaign/i);
      const isReference = !!cardStore.types.match(/reference/i);

      const score = (() => {
        if (isSummonOrCharacter) {
          if (isCampaign) {
            return 'b';
          }
          if (isAdvocate) {
            if (isLegend) {
              return 6
            }
            return 0;
          } 
          if (isAdversary) {
            if (isLegend) {
              return 7
            }
            return 1;
          }
          if (isLegend) {
            return 8
          }
          return 2;
        }
        if (isUpgrade) {
          if (isCampaign) {
            return 9;
          }
          return 3;
        }
        if (isRelic) {
          if (isCampaign) {
            return 'a';
          }
          return 4;
        }
        return 5;
      })();

      return `${score}${cardSet}${cardStore.name}`
    }

    const placeCardWeighting = getCardSortWeighting(placeCard);

    for (const card of libraryCardEles) {
      const cardWeighting = getCardSortWeighting(card);

      if (placeCardWeighting < cardWeighting) {
        return card;
      }
    }
    return undefined;
  };

  const addMissingCardFromStore = (cardStoreData) => {
    const cardEle = document.createElement('card');

    cardEle.setAttribute('uid', cardStoreData.uid);
    cardEle.setAttribute('name', cardStoreData.name);

    cardEle.setAttribute('not-owned', true);

    cardLibraryListEle.append(cardEle);
  }
  
  const loadCard = (card) => {
    if (!card) return;

    // check if the card is already in the library
    const existingCardEle = cardLibraryListEle.querySelector(`card[uid="${card.uid}"]`);

    if (existingCardEle) {
      existingCardEle.remove();
    }

    const cardEle = document.createElement('card');

    cardEle.setAttribute('uid', card.uid);
    cardEle.setAttribute('index', card.index);

    const cardStoreData = cardsStore[card.uid];

    // check the card type is a relic
    if (cardStoreData?.types?.match(/relic/i)) {
      hasRelicInLibrary = true;
    }

    // const cardStore = cardsStore[]
    // if (card. == "DELETE"

    // where should it be placed.
    const beforeEle = getCardLibraryPlacementBeforeEle(cardEle);

    if (beforeEle) {
      cardLibraryListEle.insertBefore(cardEle, beforeEle);
    } else {
      cardLibraryListEle.append(cardEle);
    }

    cardEle.style.setProperty('background-image', `url('${card.image}')`);
  };
/* #ENDREGION LOAD SCRIPTS */

/* #REGION FILTER SCRIPTS */
  const filterCharactersEle = document.querySelector('cardControl.filterCharacter');
  const filterAdvocateEle = document.querySelector('cardControl.filterAdvocate');
  const filterAdversaryEle = document.querySelector('cardControl.filterAdversary');
  const filterNeutralEle = document.querySelector('cardControl.filterNeutral');

  const filterUpgradeEle = document.querySelector('cardControl.filterUpgrade');
  const filterTacticEle = document.querySelector('cardControl.filterTactic');
  const filterPotionEle = document.querySelector('cardControl.filterPotion');
  const filterItemEle = document.querySelector('cardControl.filterItem');
  const filterWeaponEle = document.querySelector('cardControl.filterWeapon');
  const filterSpellEle = document.querySelector('cardControl.filterSpell');
  const filterRelicUpgradeEle = document.querySelector('cardControl.filterRelicUpgrade');

  const filterRelicEle = document.querySelector('cardControl.filterRelic');

  var searchText = '';
  var subFilter;
  var specifiedFilters;
  const filters = {
    character: {
      ele: filterCharactersEle,
      filter: /character/i,
      active: false
    },
    advocate: {
      ele: filterAdvocateEle,
      filter: /advocate/i,
      active: false
    },
    adversary: {
      ele: filterAdversaryEle,
      filter: /adversary/i,
      active: false
    },
    neutral: {
      ele: filterNeutralEle,
      filter: /neutral/i,
      active: false
    },
    upgrade: {
      ele: filterUpgradeEle,
      filter: /upgrade/i,
      active: false
    },
    tactic: {
      ele: filterTacticEle,
      filter: /tactic/i,
      active: false
    },
    potion: {
      ele: filterPotionEle,
      filter: /potion/i,
      active: false
    },
    item: {
      ele: filterItemEle,
      filter: /item/i,
      active: false
    },
    weapon: {
      ele: filterWeaponEle,
      filter: /weapon/i,
      active: false
    },
    spell: {
      ele: filterSpellEle,
      filter: /spell/i,
      active: false
    },
    relicUpgrade: {
      ele: filterRelicUpgradeEle,
      filter: /relic/i,
      active: false
    },
    relic: {
      ele: filterRelicEle,
      filter: /relic/i,
      active: false
    }
  };

  const setSubFilter = (newFilter, newSpecifiedFilters) => {
    if (subFilter == newFilter) return;

    subFilter = newFilter;
    specifiedFilters = newSpecifiedFilters;
    document.body.setAttribute("subFilter", newFilter || "");

    // clear all the filters
    Object.values(filters).forEach(filter => {
      filter.active = false;
      filter.ele.classList.add("inactive");
    });

    // work out where the library scroller should be
    applyFilters();

    if (scrolledLibraryCard && !scrolledLibraryCard.classList.contains("inactive")) {
      const scrollLibraryScrolledCard = scrolledLibraryCard.offsetLeft - window.innerWidth * 0.5;

      scrollLibraryScroller(scrollLibraryScrolledCard)
    }
    else {
      scrollLibraryScroller(0);
    }

  }

  const setSearchText = (newSearchText) => {
    searchText = newSearchText;
    applyFilters();
  }
  const getSearchText = () => {
    return searchText;
  }

  const applyFilters = () => {
    const legal = document.body.getAttribute("legal") != "false";

    const allFalse = !Object.values(filters).find(o => o.active);

    const libraryCardEles = [...cardLibraryListEle.children];

    for (const cardEle of libraryCardEles) {
      const uid = cardEle.getAttribute('uid');
      const cardStore = cardsStore[uid];

      if (!cardStore) {
        cardEle.classList.toggle('inactive', subFilter || !allFalse || !!getSearchText().trim());

        continue;
      }

      const cardStoreValues = Object.values({...cardStore, uid: /[A-z ]*/.exec(cardStore.uid)[0]}).join(" ").toLowerCase();

      const filterShow = Object.values(filters).find(o => {
        // lets stop using base, lets just use everything.
        return o.active && cardStoreValues.match(o.filter);
      });

      const searchShow = cardStoreValues.includes(getSearchText().toLowerCase());

      const subFilterShow = !subFilter || (() => {
        if (subFilter == 'upgrade') {  
          return cardStore.types.match(/(upgrade|relic)/i);
        } 
        if (subFilter == 'character') {
          return cardStore.types.match(/(character|summon)/i);
        }
      })();

      const specifiedFiltersShow = !!specifiedFilters && (() => {
        if (!legal) return false;
        
        return Object.keys(specifiedFilters)
          .reduce((shouldHide, key) => {

            const keyValue = specifiedFilters[key];

            if (key == "upgradeType") {
              if (cardStore.types == "relic") return shouldHide;

              // do some fucky
              // separate out these upgradeTypes
              const upgradeTypes = keyValue.split(" ");

              // check if the cardStore has a type matching
              const cardStoreTypes = cardStore.types.split(" ");

              const foundType = cardStoreTypes.find(type => upgradeTypes.includes(type));

              return !foundType || shouldHide;
            } else if (key == "classes") {
              if (cardStore.classes == "") return shouldHide;

              const filterClasses = keyValue.split(" ");
              const cardStoreClasses = cardStore.classes.split(" ");

              const foundClass = cardStoreClasses.find(cls => filterClasses.includes(cls));

              return !foundClass || shouldHide;
            }

            return shouldHide;
          }, false);
      })();

      cardEle.classList.toggle('inactive', (!allFalse && !filterShow) || !searchShow || !subFilterShow || specifiedFiltersShow);
    }
    const libraryText = (() => {
      if (attachCharacter && subFilter == "upgrade") {
        const attachedCharacterStore = cardsStore[attachCharacter?.uid];
  
        if (!attachedCharacterStore) {
          return;
        };
  
        return `Showing <b>upgrades</b> for <b>${attachedCharacterStore.name}</b>`;
      }
      if (subFilter) {
        return `Showing <b>${subFilter}</b> cards`;
      }
      return;
    })() || `Showing Library`;
    const searchText = getSearchText();

    const descriptor = `${libraryText}${searchText ? ` matching <b>${searchText}</b>` : ''}`;
    // input the explanation into it.
    descriptionEle.innerHTML = descriptor;
  }

  const addCardToDatabase = async (image, uid) => {
    // check if the card uid is in the card store
    if (!cardsStore[uid]) {
      // alert the user that the card is not in the store.
      // open up a resolver modal

      const cardStoreNames = Object.keys(cardsStore)
        .filter(key => !cardsStore[key].types.match(/purchase/i))
        .filter(key => cardsStore[key].name != 'delete')
        .map(key => cardsStore[key].name)
        .sort();

      // show the card on the screen.6
      previewEle.style.setProperty('background-image', `url('${image}')`);
      previewEle.style.setProperty('opacity', `1`);

      const cardStoreName = await showInput(`Card could not be automatically resolved, please enter the card name`, {
        dataList: cardStoreNames,
        acceptText: "Add Card",
        returnText: "Skip Card"
      });

      if (!cardStoreName) {
        previewEle.style.setProperty('opacity', `0`);
        await awaitTime(400);
        previewEle.style.setProperty('background-image', `none`);
        await awaitTime(400);
        return false;
      }
      // check if it's a custom card.
      const cardStoreKey = Object.keys(cardsStore).find(key => cardsStore[key].name.toLowerCase() == cardStoreName.toLowerCase());

      if (!cardStoreKey) {
        showToast(`Card not found, custom cards not supported.`);
        await awaitTime(500);
        previewEle.style.setProperty('opacity', `0`);
        await awaitTime(1000);
        previewEle.style.setProperty('background-image', `none`);
        return false;
      }
      showToast(`Adding ${cardStoreName}`);
      
      await awaitTime(1000);
      previewEle.style.setProperty('opacity', `0`);
      await awaitTime(1000);
      previewEle.style.setProperty('background-image', `none`);

      // hide the preview
      
      // update the uid.
      uid = Object.keys(cardsStore).find(key => cardsStore[key].name.toLowerCase() == cardStoreName.toLowerCase());
    }

    try {
      const result = await storage.writeCardToDatabase(uid, image);

      if (!result) {
        return false;
      }

      loadCard(result);

      return true;
    } catch (e) {
      showToast(`Failed to add card ${uid}`);
      
      return false;
    }
  };
/* #END FILTER */

/* #REGION CAROUSEL SCRIPTS */
  const carouselEle = document.querySelector("cardCarousel");
  const carouselCanvasEle = document.querySelector('cardCarousel canvas');

  const updateCarousel = () => {
    // rerender the whole thing with index being the selected element, so render that one last.
    if (!cardLibraryListEle.clientWidth) return;

    const scrollPadding = cardScrollerLibraryEle.clientWidth * 0.5;
    const scrollScalar = (cardScrollerLibraryEle.scrollLeft) / (cardLibraryListEle.clientWidth - scrollPadding * 2);

    const rawLibraryCardEles = [...cardLibraryListEle.children];
    const libraryCardEles = rawLibraryCardEles.filter(e => !e.classList.contains('inactive'));
    const notInLibraryCardEles = rawLibraryCardEles.filter(e => e.getAttribute('not-owned'));
    const count = libraryCardEles.length;

    const blueLineCount = count - notInLibraryCardEles.length;

    const cardDrawWidth = (PDF_CARD_WIDTH / PDF_CARD_HEIGHT) * carouselCanvasEle.height;

    const drawWidth = carouselCanvasEle.width - cardDrawWidth;
    const drawOffsetX = cardDrawWidth * 0.5;

    // 1, center - 3
    // 2, 25%, 75% - 4
    // 3, 25%, 50%, 75% - 5
    const intervalWidth = drawWidth / (count + 1);

    const context = carouselCanvasEle.getContext('2d');
    // black out the carousel
    context.clearRect(0, 0, carouselCanvasEle.width, carouselCanvasEle.height);
    
    context.strokeStyle = `#2b8c9abb`;
    context.lineWidth = count > 50 ? 1 : 2;

    const linePaddin = 4;

    // render lines at each width;
    for (var i = 0; i < count; i++) {
      context.strokeStyle = i < blueLineCount ? `#2b8c9abb` : `#2b8c9a44`;

      const x = drawOffsetX + intervalWidth * (i + 1);

      context.beginPath();
      context.moveTo(x, linePaddin);
      context.lineTo(x, carouselCanvasEle.height - linePaddin);
      context.stroke();
    }

    const viewWidth = drawWidth - intervalWidth;
    const viewX = drawOffsetX + viewWidth * scrollScalar - cardDrawWidth * 0.5 + intervalWidth * 0.5;

    // current scroll 
    context.strokeStyle = `#58d5e6`;
    context.fillStyle = "#2b8c9abb";
    context.lineWidth = 2;
    context.beginPath();
    context.rect(viewX, 0, cardDrawWidth, carouselCanvasEle.height - 2);
    context.fill();
    context.stroke();
  }

  const applyCarousel = () => {
    // get the filtered card count
    const containerRect = carouselEle.getBoundingClientRect();

    carouselCanvasEle.width = containerRect.width - 32;
    carouselCanvasEle.height = containerRect.height - 6;

    updateCarousel();
  }
/* #END CAROUSEL */

const onShowLibrary = async (event) => {
  if (event) {
    attachCharacter = undefined;
  }
  
  document.body.className = '';

  scrolledDeckCard = getCenterCardEle();

  if (document.body.getAttribute("showing") !== 'deck') return;
  // get the top level element

  // scroll to the last library focused' card
  document.body.setAttribute("showing", "library");

  applyCarousel();
};
const onShowDeck = async () => {
  if (document.body.getAttribute("showing") !== 'library') return;

  scrolledLibraryCard = getCenterCardEle();

  setSubFilter();

  // scroll to the last library focused' card
  document.body.setAttribute("showing", "deck");

  await awaitScrollStop();
};
const startAttachUpgrade = async () => {
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

  setSubFilter('upgrade', { classes: cardStore.classes, upgradeType: cardStore.upgradeTypes});

  onShowLibrary();
};
const finishAttachUpgrade = async () => {
  if (!attachCharacter) return;

  const currentCardEle = document.querySelector('card.highlight');
  if (!currentCardEle) return;

  const uid = currentCardEle.getAttribute("uid");
  if (!uid) return;

  // check if the character can use the card
  const isAcceptable = canCharacterEquipUpgrade(attachCharacter, uid);
  const upgradeType = getUpgradeType(cardsStore[uid]);
  const dontAdd = !isAcceptable && !(await showConfirm(`This character already has too many, ${upgradeType}s. Do you want to still add this?`));

  if (!isAcceptable) {
    await awaitTime(200);
  }
  
  hideInteractCard(dontAdd);
  currentCardEle.classList.toggle("highlight", false);

  if (dontAdd) {
    // prompt the user saying the character can't ususally use this
    return;
  }

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
const attachRandomRelic = async () => {
  // get all the relics
  const relicEles = [...cardLibraryListEle.children].filter(ele => {
    const uid = ele.getAttribute("uid")
    const cardStore = cardsStore[uid];

    if (ele.getAttribute("not-owned")) return false;

    return cardStore && cardStore.types.match(/relic/i);
  });

  // get the attach character
  const selectedCardEle = document.querySelector('card.highlight');
  if (!selectedCardEle) return;

  const randomRelicEle = relicEles[Math.floor(Math.random() * relicEles.length)];
  if (!randomRelicEle) return;

  const upgradeUId = randomRelicEle.getAttribute("uid");

  const currentCardIndex = getDeckIndexOfCardEle(selectedCardEle);
  const deckAttachCharacter = deck[currentCardIndex];

  const cardEleClone = addUpgradeToCharacter(upgradeUId, selectedCardEle, deckAttachCharacter, true);
  if (!cardEleClone) return;

  updateDeck();

  await awaitTime(200);

  // scroll to the newly created card
  showToast(`Random Relic Added`);

  // highlight the card
  cardEleClone.classList.add("highlight");

  await awaitTime(500);
  cardEleClone.classList.remove("highlight");
};
const addCharacter = async () => {
  const currentCardEle = document.querySelector('card.highlight');
  if (!currentCardEle) return;

  const uid = currentCardEle.getAttribute("uid");

  const cardEleClone = addCharacterToDeck({uid});
  if (!cardEleClone) return;

  updateDeck();
  setDeckFocusCard(cardEleClone);
  showToast(`Card added to deck`);
  scrollDeckToCard(cardEleClone);
  currentCardEle.classList.toggle("highlight", false);
  await onShowDeck();
};
const removeCharacter = async () => {
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

  const currentFocusSubIndex = parentCardEle 
    ? [...parentCardEle.querySelectorAll("card")].indexOf(selectedCardEle) + 1
    : parentCardEle.currentRangeScalar || 0;

  if (!currentFocusSubIndex) {
    const confirmValue = await showConfirm('Are you sure you want to remove this card, and all it\'s upgrades from this deck?');
    await awaitTime(200);

    if (!confirmValue) return;

    deck.splice(currentCardIndex, 1);
    containerCardEle.remove();
  } else {
    const upgradeIndex = currentFocusSubIndex - 1;

    deck[currentCardIndex].upgrades.splice(upgradeIndex, 1);
    const upgradeCardEle = [...parentCardEle.querySelectorAll("card")][upgradeIndex];

    upgradeCardEle.remove();

    applyDeckCardTopScroll(parentCardEle, 0);
  }
  updateDeck();

  showToast(`Card removed from deck`);
};
const onCarouselInteraction = event => {
  if (!event.touches) return;

  const touch = event.touches[0];
  const touchX = touch.clientX - carouselCanvasEle.offsetLeft;
  const scrollRatio = touchX / carouselCanvasEle.clientWidth;
  const newScroll = cardLibraryListEle.clientWidth * scrollRatio;

  scrollLibraryScroller(newScroll);
};
const handleSave = async (saveSlotIdx) => {
  var storedDecks = storage.getStoredDecks();
  
  // check if a save is already up there
  if (storedDecks[saveSlotIdx]) {
    const confirmValue = await showConfirm(`Are you sure you want to override ${storedDecks[saveSlotIdx].deckName || 'Untitled Deck'}?`);

    await awaitTime(200);

    if (!confirmValue) {
      return;
    }
  }
  // save to that slot
  storedDecks[saveSlotIdx] = {deck, deckName};

  try {
    const deckString = JSON.stringify({deck: JSON.stringify(deck), deckName});

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
  // hide the menu
  overlayMenuEle.classList.add("hidden");

  showToast(`Deck, ${deckName} saved to slot ${saveSlotIdx}`);
};
const handleLoad = async (loadSlotIdx) => {
  var localJsonDecks = storage.getStoredDecks();
  
  // check if a save is already up there
  if (!localJsonDecks[loadSlotIdx]) {
    showToast(`Deck slot, ${loadSlotIdx} is empty`);
    return;
  }

  if (deck.length) {
    const confirmValue = await showConfirm("If your current deck is unsaved, it will be lost. Are you sure you want to load a new deck?");

    await awaitTime(200);

    if (!confirmValue) {
      return;
    }
  }
  // save to that slot
  deck = localJsonDecks[loadSlotIdx].deck || {};
  deckName = localJsonDecks[loadSlotIdx].deckName || "";

  storage.setStoredDeck(deckName, deck);

  loadDeckFromLocal();
  // hide the menu
  overlayMenuEle.classList.add("hidden");

  // show deck
  onShowDeck();

  // scroll to the front
  scrollLibraryScroller(0);

  showToast(`Deck, ${deckName || "Untitled Deck"} loaded!`);
};
const onAppFocus = async (event) => {
  try {
  } catch (e) {
  }
}

const updateAppSize = async (event) => {
  // check if it's landscape or portrait
  const isLandscape = window.innerWidth > window.innerHeight;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  try {
    if (isLandscape) {
      await Capacitor.Plugins.StatusBar.hide();
      await Capacitor.Plugins.NavigationBar.hide();
    } else {
      await Capacitor.Plugins.StatusBar.show();
      await Capacitor.Plugins.NavigationBar.show();
    }
  }
  catch (e) {
    console.error("Capacitor failed to initialize", e);
  }

  await awaitFrame();

  const doc = document.documentElement;

  const currentScreenWidth = doc.style.getPropertyValue('--screen-width');

  try {
    var {insets} = await Capacitor.Plugins.SafeArea.getSafeAreaInsets();

    var isAndroid = Capacitor?.getPlatform() == 'android';
  } finally {
    if (!insets || isAndroid) {
      doc.style.setProperty('--safe-area-top', `0px`);
      doc.style.setProperty('--safe-area-bottom', `0px`);

      doc.style.setProperty('--screen-height', `${screenHeight}px`);
      doc.style.setProperty('--screen-width', `${screenWidth}px`);
  
      doc.style.setProperty('--screen-width-raw', `${screenWidth}`);
      
      return;
    }
  }
  
  if (window.innerWidth > window.innerHeight) {
    doc.style.setProperty('--safe-area-top', `0px`);
    doc.style.setProperty('--safe-area-bottom', `0px`);

    doc.style.setProperty('--screen-height', `${screenHeight}px`);
    doc.style.setProperty('--screen-width', `${screenWidth}px`);

    doc.style.setProperty('--screen-width-raw', `${screenWidth}`);
    return;
  }

  console.log(`safe area`, JSON.stringify(insets));
  const safeTop = insets.top ?? 0;
  const safeBottom = insets.bottom ?? 0;

  const safeAreaHeight = screenHeight - safeTop - safeBottom;

  // elegantly set the result somewhere in app state
  doc.style.setProperty('--safe-area-top', `${safeTop}px`);
  doc.style.setProperty('--safe-area-bottom', `${safeBottom}px`);

  doc.style.setProperty('--screen-width', `${screenWidth}px`);
  doc.style.setProperty('--screen-height', `${safeAreaHeight}px`);
};
const onResize = async (event) => {
  await updateAppSize();  

  const characterCardEles = [...cardDeckListEle.querySelectorAll('cardDeckWrapper > card')];

  for (const characterCardEle of characterCardEles) {
    applyDeckCardTopScroll(characterCardEle, 0, 0);
  }
}
const triggerReload = async () => {
  console.log('assessing reload?')
  // check to see if the dimensions have changed
  const doc = document.documentElement;
  const currentScreenWidth = doc.style.getPropertyValue('--screen-width');
  console.log(`sw: ${currentScreenWidth} vs ${window.innerWidth}px`);

  if (currentScreenWidth == `${window.innerWidth}px`) return;

  // check if we're loading
  while (document.body.className == 'loading') {
    await awaitFrame();
  }

  await awaitFrame();
  window.location.reload();
};

// initialize the database.
const init = async () => {
  await initStorage();

  document.body.setAttribute("displayType", storage.getStoredDisplayType() || "");

  // constantly measure the scrolling
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    return false; 
  });

  document.body.setAttribute("data-long-press-delay", 450);
  document.body.addEventListener("long-press", (event) => {
    event.preventDefault();
    awaitFrame().then(() => {
      document.body.click();
    });
    return false;
  });

  try {
    Capacitor.Plugins.App.addListener("backButton", (event) => {

      // exit the menu
      if (overlayMenuEle.className != "hidden") {

        if (overlayMenuEle.getAttribute("showing") != "mainMenu") {
          overlayMenuEle.setAttribute("showing", "mainMenu");

          return;
        }

        overlayMenuEle.className = 'hidden';
        return;
      }
      
      if (isModalShowing()) {
        // no idea what to do...
        return;
      }

      const isLibrary = document.body.getAttribute("showing") == "library";
    
      if (isLibrary) {
        onShowDeck();

        return;
      }

      Capacitor.Plugins.App.exitApp();
      return;
    });
  } catch (e) {
    
  }

  try {
    const handleURLLoadAttempt = async (event) => {
      console.log(`hit here?, ${JSON.stringify(event)}`);
      // check the url
      const url = event.url;
      const urlParams = new URL(url);
      const searchParams = urlParams.searchParams;

      if (searchParams.has("id")) {
        // check if it's a deck
        const code = searchParams.get('id');
        
        if (!isShareCodeFormat(code)) return;

        const deckData = await getDeckFromShareCode(code);

        if (!deckData) return;
        
        const doLoad = await showConfirm(`Load, ${deckData.deckName || "shared deck"}? This will override any unsaved progress`);

        if (!doLoad) return;

        await placeDeckFromShareCodeIntoLocal(deckData);

        showToast(`${deckName || "Shared deck"} loaded`);
      }
    }
    Capacitor.Plugins.App.addListener("appUrlOpen", async (event) => {
      document.body.className = 'loading';
      try {
        await handleURLLoadAttempt(event);
      } catch (e) {

      }
      document.body.className = '';
    });
  } catch (e) {
  };

  document.addEventListener("resume", triggerReload);
  window.addEventListener('resize', onResize);

  document.addEventListener("visibilitychange", () => {
    onAppFocus();
  })
  onResize();

  // load cards from cardstore

  await storage.init();
  
  const cards = await storage.getAllCards();

  for (const card of cards) {
    loadCard(card);
  }

  const cardStoreKeys = Object.keys(cardsStore);

  for (const key of cardStoreKeys) {
    const cardStoreData = cardsStore[key];
    const cardStoreUid = cardStoreData.uid;

    if (cards.some(card => card.uid == cardStoreUid)) continue;
    if (cardStoreData.types.match(/purchase/i)) continue;
    if (cardStoreData.name == 'delete') continue;

    if (cardStoreData.keywords.includes("legends")) continue;
    if (cardStoreData.types.includes("campaign")) continue;
    if (cardStoreData.keywords.includes("monster")) continue;
    if (cardStoreData.keywords.includes("patreon")) continue;

    addMissingCardFromStore(cardStoreData);
  }

  // check if we have an id in our query params
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has("id")) {
    try {
      await loadShareDeckFromCode(urlParams.get("id"));
    } catch (e) {
      loadDeckFromLocal();
    }

    // remove the id params
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    loadDeckFromLocal();
  }

  const deckCardContainerEles = [...cardScrollerDeckEle.querySelectorAll("cardDeckWrapper")];
  const deckCardOffsetSum = deckCardContainerEles.map(ele => ele.offsetLeft).reduce((s, v) => s + v, 0);
  const deckCardCenter = deckCardOffsetSum / (deckCardContainerEles.length || 1);
  const halfScreenWidth = window.innerWidth * 0.5;

  scrollLibraryScroller(0)
  scrollDeckScroller(deckCardCenter - halfScreenWidth);

  applyFilters();
  applyCarousel();

  document.body.className = '';

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

  // initialize other modules
  initModal();
  initTokens();

  // TODO remove all event listener initialization to here.
  // adding event listeners here.

  // get the size of things
  [...document.querySelectorAll('label.imageUpload')].map((ele) => {
    const getDataImageDimensions = (dataURL) => {
      const image = new Image();
      image.src = dataURL;
    
      return new Promise((resolve, reject) => {
        image.onload = () => {
          resolve([image.width, image.height]);
        }
      });
    };
    const resizeDataImage = (dataURL, width, height) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
    
      canvas.width = width;
      canvas.height = height;
    
      const image = new Image();
      image.src = dataURL;
    
      context.drawImage(image, 0, 0, width, height);
    
      return canvas.toDataURL('image/jpeg', 0.94);
    };
    
    ele.addEventListener('click', async (event) => {
      document.body.className = 'loading';
      overlayMenuEle.className = 'hidden';

      try {
        let pickedFile = false;

        awaitTime(2000).then(() => {
          if (pickedFile) return;

          document.body.className = '';
        });

        const [fileHandle] = await window.showOpenFilePicker({
          types: [
            {accept: {'image/*': ['.png', '.jpeg', '.jpg']}}
          ]
        });
        if (fileHandle) {
          pickedFile = true;
          document.body.className = 'loading';
        }

        const file = await fileHandle.getFile();

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // start the clipper
            const imageDom = document.getElementById('cropper');
      
            // get the reader image size.
            const [imageWidth, imageHeight] = await getDataImageDimensions(reader.result);

            // get an image with a dimension of the above.

            const MAX_IMAGE_WIDTH = 2048;
            const dimension = imageWidth / imageHeight;

            const newWidth = Math.min(MAX_IMAGE_WIDTH, imageWidth);
            const newHeight = parseInt(newWidth / dimension);

            const smallerImageUrl = resizeDataImage(reader.result, newWidth, newHeight);

            // lets crop down the reader result size

            imageDom.src = smallerImageUrl;

            cropperEle.style.setProperty('opacity', 1);

            const cropper = new Cropper(imageDom, {
              viewMode: 1,
              guides: false,
              crop(event) {
              },
            });

            const confirmValue = await showConfirm("Crop the image to the correct size and press confirm", {
              acceptText: "Add Card",
              returnText: "Cancel"
            });

            const cropperCanvas = cropper.getCroppedCanvas();

            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d');

            tempCanvas.width = PDF_CARD_WIDTH * 4;
            tempCanvas.height = PDF_CARD_HEIGHT * 4;

            tempContext.drawImage(cropperCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // get the tempCanvasUri
            const tempUrl = tempCanvas.toDataURL('image/jpeg', 0.75);

            cropper.destroy();
            cropperEle.style.setProperty('opacity', 0);

            if (!confirmValue) {
              return;
            }

            await addCardToDatabase(tempUrl, '');

            applyFilters();
            applyCarousel();
          } finally {
            document.body.className = '';
          }
        }
        reader.readAsDataURL(file)
      } catch (err) {
        console.log(err);
        document.body.className = '';
      }
    });
  });
  [...document.querySelectorAll('label.fileUpload')].map((ele) => {
    ele.addEventListener('click', async (event) => {
      document.body.className = 'loading';
      overlayMenuEle.className = 'hidden';

      // accept a pdf
      try {
        let foundFile = false;

        awaitTime(2000).then(() => {
          if (foundFile) return;

          document.body.className = '';
        });

        const fileHandles = await window.showOpenFilePicker({multiple: true, types: [{accept: {'application/pdf': ['.pdf']}}]});
        
        if (fileHandles.length) {
          foundFile = true;
          document.body.className = 'loading';
        }

        const loadedCards = [];

        for (const fileHandle of fileHandles) {
          const file = await fileHandle.getFile();
  
          const fileData = await readFile(file);

          const fileCards = await loadCardsFromUrl(fileData);

          loadedCards.push(...fileCards);
        }

        var cardsAdded = [];
        // now go through all the cards

        for (const card of loadedCards) {
          const addCardSuccess = await addCardToDatabase(card.image, card.id);
          
          if (addCardSuccess) {
            cardsAdded.push(card);
          }
        }

        showToast(`${cardsAdded.length} cards added to library`);

        applyFilters();
        applyCarousel();
        
        document.body.className = '';
      } catch (err) {
        showToast(`File Upload Failed: ${err}`);
        console.error(err);
        document.body.className = '';
      }
    });
  });
  showLibraryButton.addEventListener('click', onShowLibrary);
  searchButton.addEventListener('click', async () => {
    // check if we're already searching
    if (document.body.getAttribute("showing") !== 'library') return;

    const hasSearched = cardTopControlsEle.classList.contains('searched');
    if (hasSearched) {
      searchButton.classList.remove("searched");

      performSearchForString("");
      return;
    }
    
    const searchValue = await showInput("Search for a card");
    performSearchForString(searchValue || "");

    if (!searchValue) return;
    searchButton.classList.add("searched");
  });
  showDeckButton.addEventListener('click', onShowDeck);
  addCharacterButton.addEventListener('click', () => {
    if (document.body.getAttribute("showing") !== 'deck') return;
    attachCharacter = undefined;

    setSubFilter('character');

    onShowLibrary();
  });

  // Search crap
  searchInputEles.forEach(searchInputEle => searchInputEle.addEventListener('keyup', async event => {
    if (event.keyCode === 13) {
      event.preventDefault();
      event.target.blur();
    }

    performSearchForString(searchInputEle.value);
  }));
  searchInputClearEle.addEventListener("click", () => {
    searchInputEles.forEach(searchInputEle => searchInputEle.value = "");

    setSearchText("");

    applyCarousel();
    cardTopControlsEle.classList.toggle('searched', !!getSearchText());
  })

  // remove card from library
  removeLibraryCardEle.addEventListener('click', async (event) => {
    overlayMenuEle.className = 'hidden';
    if (event.cancelable) event.preventDefault();

    setTimeout(async () => {
      const currentCardEle = document.querySelector('card.highlight');
      if (!currentCardEle) return;
      
      const confirmValue = await showConfirm('Are you sure you want to remove this card from your library?');

      await awaitTime(200);

      if (!confirmValue) return;
  
      // remove it from the library.
      await storage.removeCardFromDatabase(currentCardEle.getAttribute('uid'));

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

  document.querySelector('.newShare').addEventListener('click', async () => {
    overlayMenuEle.classList.add("hidden");
    // we need to put it into share mode.
    // disable the library, etc.
    const rawCode = await showInput("Enter the share code", { acceptText: "Enter Code" });

    if (!rawCode) return;
    
    // we want everything before an equals, if one exists
    const codeSeparated = rawCode.split("=");
    const code = codeSeparated[codeSeparated.length - 1];

    await loadShareDeckFromCode(code);
  });

  document.querySelector('share').addEventListener('click', async () => {
    // show a confirm
    const confirmValue = await showConfirm(`Would you like to generate a link to share ${deckName || "this deck"}?`);

    if (!confirmValue) return;

    // set loading
    document.body.className = 'loading';

    const deckString = JSON.stringify({deck: JSON.stringify(deck), deckName});

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
    const uploadCards = responseJson.uploadCards;

    if (uploadCards) {
      // do the upload cards
      for (const cardUid of uploadCards) {
        const cardImage = cardStore[cardUid].image;

        try {
          await fetch(`${API_URL}/uploadCard`, {
            method: 'POST',
            contentType: 'text/plain',
            body: JSON.stringify({uid: cardUid, image: cardImage})
          });
        } catch (uploadCardError) {
          showToast("Failed to generate a share link -- Related to using photo-uploaded cards");

          document.body.className = "";
          return;
        }
      }
    } 
    document.body.className = "";

    // check if we need to upload any cards.
    // show the share link using the share navigator, otherwise fallback to a modal

    const shareUrl = `${SHARE_URL}/decks/index.html?id=${shareCode}`;

    const shareData = {
      title: `Relicblade Deck - ${deckName || "Untitled"}`,
      text: `Check out this Relicblade Deck`,
      url: shareUrl
    };

    try {
      await navigator.share(shareData);
      
      // we have a success
    } catch (navigatorError) {
      // we have a failure, show a thingie
      var copiedLink = true;

      try{
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

  legalButtonEle.addEventListener('click', async () => {
    const currentLegal = document.body.getAttribute("legal");
    const newLegal = currentLegal == "false" ? "" : "false";

    document.body.setAttribute("legal", newLegal);

    applyFilters();
    applyCarousel();
  });

  gridButtonEle.addEventListener('click', () => {
    const currentDisplayType = document.body.getAttribute("displayType");
    const nextDisplayType = currentDisplayType == 'grid' ? '' : 'grid';

    document.body.setAttribute("displayType", nextDisplayType);
    storage.setStoredDisplayType(nextDisplayType);

    if (currentDisplayType != "grid") return;
    applyCarousel();
  });

  cardScrollerLibraryEle.addEventListener("scroll", event => {
    if (document.body.getAttribute("showing") != "library") return;
    if (document.body.getAttribute("displayType") == "grid") return;

    applyCarousel();
  });

  cardScrollerDeckEle.addEventListener("touchstart", event => {
    // check if we're in the deck
    if (document.body.getAttribute("showing") != "deck") return;
    
    const touch = event.touches[0];

    setDeckFocusCard(getPointerCardEle(touch));
    if (!deckFocusCard) return;
  
    deckFocusCard.touchStart = Date.now();
    deckFocusCard.deckDragging = false;

    return;
  }, {passive: false});
  cardScrollerDeckEle.addEventListener("touchmove", event => {
    // check if a modal is active
    if (isModalShowing()) return;

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

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return;
    }
    if (event.cancelable) event.preventDefault();

    deckFocusCard.hasVerticallity = true;

    const rangeDelta = getDeckUpgradeRangeScalar(deckFocusCard, deltaY);
    const rangeScalar = deckFocusCard.currentRangeScalar + rangeDelta;
    
    deckFocusCard.momentumY += (rangeDelta || 0);

    applyDeckCardTopScroll(deckFocusCard, rangeScalar);
  }, {passive: false});
  
  cardScrollerDeckEle.addEventListener("touchend", async (event) => {
    if (document.body.getAttribute("showing") != "deck") return;

    if (!deckFocusCard) return;
    if (!deckFocusCard.deckDragging) return;

    const focusCard = deckFocusCard;

    const upgradeCardEles = [...focusCard.children].filter(ele => ele.tagName == "CARD");

    if (!focusCard.hasVerticallity) return;

    // do the flickkkkk
    // animate it toward the closest scalar;
    const unsnappedTime = focusCard.unsnappedTime;
    const unsnappedRangeScalar = focusCard.unsnappedRangeScalar;
    const momentumScaled = focusCard.momentumY * 2;
    const maxCardIndex = Math.ceil(unsnappedRangeScalar);
    const minCardIndex = Math.floor(unsnappedRangeScalar);
    const targetRangeScalar = Math.max(0, Math.min(upgradeCardEles.length, maxCardIndex, Math.max(0, minCardIndex, Math.round(unsnappedRangeScalar + momentumScaled))));

    // animate to the card.
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
      // move the thing toward it.
    } while (delta < 1);

    // do the next crap.
  });

  [cardScrollerDeckEle, cardScrollerLibraryEle].forEach(cardScrollerEle => {
    cardScrollerEle.setAttribute("data-long-press-delay", 200);
    cardScrollerEle.addEventListener("long-press", async (event) => {
      var touchEndEvent = new Event("touchend");
      cardScrollerEle.dispatchEvent(touchEndEvent);

      // force touch up
      event.preventDefault();

      const selectedCardEle = event.target;

      if (!selectedCardEle) return;
      if (selectedCardEle.tagName != "CARD") return;

      // check if it's owned?
      if (selectedCardEle.getAttribute("not-owned")) {
        // prompt the user to add it.
        await showOption(`${selectedCardEle.getAttribute("name")} is not in your library, you can add it via 'Add cards from PDF' in the menu.`,[]);

        return;
      }

      // add selected to the card
      awaitTime(100).then(() => {
        selectedCardEle.classList.toggle("highlight", true);
      });
    
      // are we in deck mode?
      if (document.body.getAttribute("showing") == "deck") {
        const parentCardEle = selectedCardEle.parentElement.tagName == "CARD" ? selectedCardEle.parentElement : selectedCardEle;

        const deckIndex = getDeckIndexOfCardEle(parentCardEle);
        const upgradeIndex = [...parentCardEle.querySelectorAll("card")].indexOf(selectedCardEle);

        applyDeckCardTopScroll(parentCardEle, upgradeIndex + 1);

        // center the card
        showInteractCard(selectedCardEle);

        const currentFocusCard = cardsStore[selectedCardEle.getAttribute("uid")];

        // show a modal with add upgrade, remove, cancel
        const options = [];

        // check if we're selecting a character
        if (currentFocusCard.types == "character") {
          options.push("Add Upgrade");
          // check if we have a relic in our library
          if (hasRelicInLibrary) {
            options.unshift("Add Random Relic");
          }
          options.unshift("Remove Character");
          
        }
        else {
          options.push("Remove Upgrade");
        }

        const optionResult = await showOption(`<h4>${currentFocusCard.name} selected</h4> `, options);

        if (optionResult == "Add Upgrade") {
          await startAttachUpgrade();
          // center the card
        } else if (optionResult == "Remove Character" || optionResult == "Remove Upgrade") {
          await removeCharacter();
        } else if (optionResult == "Add Random Relic") {
          await attachRandomRelic();
        }
        // remove the highlight
        hideInteractCard(!optionResult);
        selectedCardEle.classList.toggle("highlight", false);
        
        return;
      }

      // are we in attach upgrade mode?
      if (attachCharacter && subFilter == "upgrade") {
        showInteractCard(selectedCardEle);
        
        const attachedCharacterStore = cardsStore[attachCharacter.uid];
        const confirmResult = await showConfirm(`Do you want to attach this card to ${attachedCharacterStore.name}?`);

        if (confirmResult) {
          await finishAttachUpgrade();

          return;
        }

        hideInteractCard(!confirmResult);
        selectedCardEle.classList.toggle("highlight", false);

        return;
      }

      showInteractCard(selectedCardEle);
      // finally we're in add character mode
      const confirmResult = await showConfirm(`Do you want to add this character to your deck?`);
      hideInteractCard(!confirmResult);

      await awaitTime(200);

      // await scrolling stopping
      await awaitScrollStop();

      if (confirmResult) {
        await addCharacter();
      }
      selectedCardEle.classList.toggle("highlight", false);

      return;
    });

    cardScrollerEle.addEventListener("click", async (event) => {
      const clickedCardEle = event?.target;
      if (!clickedCardEle) return;
      if (clickedCardEle.tagName != "CARD") return;
    
      if (document.body.getAttribute("showing") !== 'library') {
        const deckIndex = getDeckIndexOfCardEle(clickedCardEle);
        
        if (deckIndex == -1) return;

        const parentCardEle = getParentCardEleFromAny(clickedCardEle);
        const upgradeIndex = [...parentCardEle.querySelectorAll("card")].indexOf(clickedCardEle);

        // scroll to the thingie
        applyDeckCardTopScroll(parentCardEle, upgradeIndex + 1);

        return;
      }

      if (document.body.getAttribute("displayType") !== "grid") {
        const centerCard = getCenterCardEle();
    
        if (centerCard.getAttribute("index") !== clickedCardEle.getAttribute("index")) {
          // scroll to focus the clicked card, both in the x and "y" coordinates
    
          // work out the centre of the screen
          const cardWidth = clickedCardEle.clientWidth;
          const cardsPerScreen = Math.floor(window.innerWidth / cardWidth);
    
          const offsetCenterLeft = cardsPerScreen * 0.5 * cardWidth;
          
          // check if we're in the center already
          
          const timeToStop = await awaitScrollStop();
    
          if (timeToStop < 50) {
            const cardScrollX = clickedCardEle.offsetLeft || 0;
            scrollLibraryScroller(cardScrollX - offsetCenterLeft);
          }
          
          return;
        }

        // do the weird cards
        switch (clickedCardEle.tagName) {
          case "PURCHASE":
            try {
              // open a browser window.
              window.open("https://relicblade.com", "_blank");
            } catch (error) {
              showToast(error.message);
            }
            return;
          case "IMPORT":
            document.querySelector("#fileUpload").click();
            return;
        }

        // do the cool cards.
      }
    
      if (document.body.getAttribute("displayType") == "grid") {
        // target the new card and swap display type
        const timeToStop = await awaitScrollStop();
        
        // work out the centre of the screen
        const cardWidth = clickedCardEle.clientWidth;
        const cardsPerScreen = Math.floor(window.innerWidth / cardWidth);

        const offsetCenterLeft = cardsPerScreen * 0.5 * cardWidth;

        const cardScrollX = clickedCardEle.offsetLeft || 0;
        scrollLibraryScroller(cardScrollX - offsetCenterLeft);
    
        return;
      }
      
      // get the xy of where was clicked
      // get card bounds
      // const cardBounds = clickedCardEle.getBoundingClientRect();
    
      // const markBoxX = (event.clientX - cardBounds.left) / cardBounds.width;
      // const markBoxY = (event.clientY - cardBounds.top) / cardBounds.height;
    
      // cardStore.markBoxes = cardStore.markBoxes || [];
      // cardStore.markBoxes.push([markBoxX, markBoxY, 0]);
    
      // console.log(`[${markBoxX}, ${markBoxY}, 0], `);
    });
  });

  carouselEle.addEventListener("touchstart", onCarouselInteraction);
  carouselEle.addEventListener("touchmove", onCarouselInteraction);

  deckTitleInput.addEventListener("input", event => {
    deckTitleInputMirror.innerText = deckTitleInput.value || deckTitleInput.placeholder;
    deckName = deckTitleInput.value;
    
    storage.setStoredDeck(deckName, deck);
  });

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
  document.body.className = 'loading';
    const value = await showConfirm("If your current deck is unsaved, it will be lost. Are you sure you want to create a new deck?");

    await awaitTime(200);

    if (!value) {
      return;
    }

    overlayMenuEle.classList.add("hidden");

    storage.setStoredDeck("", []);

    loadDeckFromLocal();
    document.body.className = '';
  });
  
  returnEle.addEventListener("click", event => {
    overlayMenuEle.classList.add("hidden");
  });

  setTimeout(() => {
    onAppFocus();
  }, 1000);
};

init();