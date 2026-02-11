
import { PDF_CARD_WIDTH, PDF_CARD_HEIGHT } from './constants.js';
import { getCenterCardEle } from './dom.js';
import { cardsStore, awaitScrollStop, showToast } from './cards.shared.js';
import { attachCharacter, addCharacter, finishAttachUpgrade, getDeckIndexOfCardEle, applyDeckCardTopScroll, removeCharacter, startAttachUpgrade, onShowDeck, setAttachCharacter, setScrolledDeckCard } from './deck.js';
import { awaitTime, awaitFrame } from './utils.js';
import { showInteractCard, hideInteractCard, showConfirm, showOption, showInput } from './dom.modal.js';
import { storage } from './storage.js';

export const cardScrollerLibraryEle = document.querySelector('cardScroller.library');
export const cardLibraryListEle = cardScrollerLibraryEle.querySelector('cardList');
export const cardLibraryNameListEle = cardScrollerLibraryEle.querySelector('cardNameList');
export const cardTopControlsEle = document.querySelector('cardTopControls');
export const descriptionEle = document.querySelector('description');

// Filter Elements
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

// Top Controls
const showLibraryButton = document.querySelector("cardButton.showLibrary");
const searchButton = document.querySelector("cardButton.search");
const searchInputEles = document.querySelectorAll('searchContainer input');
const searchInputClearEle = document.querySelector('searchContainer searchicon[type="clear"]');

const gridButtonEle = document.querySelector('.grid');

var searchText = '';
var subFilter;
var specifiedFilters;

export var hasRelicInLibrary = false;
var scrolledLibraryCard;

export const setScrolledLibraryCard = (card) => scrolledLibraryCard = card;
export const getScrolledLibraryCard = () => scrolledLibraryCard;

export const filters = {
  character: { ele: filterCharactersEle, filter: /character/i, active: false },
  advocate: { ele: filterAdvocateEle, filter: /advocate/i, active: false },
  adversary: { ele: filterAdversaryEle, filter: /adversary/i, active: false },
  neutral: { ele: filterNeutralEle, filter: /neutral/i, active: false },
  upgrade: { ele: filterUpgradeEle, filter: /upgrade/i, active: false },
  tactic: { ele: filterTacticEle, filter: /tactic/i, active: false },
  potion: { ele: filterPotionEle, filter: /potion/i, active: false },
  item: { ele: filterItemEle, filter: /item/i, active: false },
  weapon: { ele: filterWeaponEle, filter: /weapon/i, active: false },
  spell: { ele: filterSpellEle, filter: /spell/i, active: false },
  relicUpgrade: { ele: filterRelicUpgradeEle, filter: /relic/i, active: false },
  relic: { ele: filterRelicEle, filter: /relic/i, active: false }
};

export const setSubFilter = (newFilter, newSpecifiedFilters) => {
  if (subFilter == newFilter) return;

  subFilter = newFilter;
  specifiedFilters = newSpecifiedFilters;
  document.body.setAttribute("subFilter", newFilter || "");

  Object.values(filters).forEach(filter => {
    filter.active = false;
    filter.ele.classList.add("inactive");
  });

  applyFilters();

  if (scrolledLibraryCard && !scrolledLibraryCard.classList.contains("inactive")) {
    const scrollLibraryScrolledCard = scrolledLibraryCard.offsetLeft - window.innerWidth * 0.5;
    scrollLibraryScroller(scrollLibraryScrolledCard)
  } else {
    scrollLibraryScroller(0);
  }
};

export const setSearchText = (newSearchText) => {
  searchText = newSearchText;
  applyFilters();
}
export const getSearchText = () => searchText;

export const scrollLibraryScroller = async (left) => {
  if (document.body.getAttribute("displayType") == "grid") {
    left = Math.max(left, window.innerWidth * 0.4);
  }
  cardScrollerLibraryEle.scrollTo({ left, top: 0, behavior: 'instant' });

  applyCarousel();
  await awaitFrame();
  await awaitScrollStop();
};

export const applyFilters = () => {
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
    const searchableCardStoreKeys = ["base", "cost", "name", "classes", "keywords", "types", "upgradeTypes", "factions"];
    const searchableCardStoreValues = searchableCardStoreKeys.map(key => cardStore[key]).filter(v => v);
    const cardStoreValues = Object.values({ ...searchableCardStoreValues, uid: /[A-z ]*/.exec(cardStore.uid)[0] }).join(" ").toLowerCase();

    const filterShow = Object.values(filters).find(o => o.active && cardStoreValues.match(o.filter));
    const searchShow = cardStoreValues.includes(getSearchText().toLowerCase());
    const subFilterShow = !subFilter || (() => {
      if (subFilter == 'upgrade') return cardStore.types.match(/(upgrade|relic)/i);
      if (subFilter == 'character') return cardStore.types.match(/(character|summon)/i);
    })();
    const specifiedFiltersShow = !!specifiedFilters && (() => {
      if (!legal) return false;
      return Object.keys(specifiedFilters).reduce((shouldHide, key) => {
        const keyValue = specifiedFilters[key];
        if (key == "upgradeType") {
          if (cardStore.types == "relic") return shouldHide;
          const upgradeTypes = keyValue.split(" ");
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
      if (!attachedCharacterStore) return;
      return `Showing <b>upgrades</b> for <b>${attachedCharacterStore.name}</b>`;
    }
    if (subFilter) return `Showing <b>${subFilter}</b> cards`;
    return;
  })() || `Showing Library`;

  const descSearchText = getSearchText();
  const descriptor = `${libraryText}${descSearchText ? ` matching <b>${descSearchText}</b>` : ''}`;
  descriptionEle.innerHTML = descriptor;
}

export const performSearchForString = (newSearchText) => {
  debugger;
  const currentFocusCard = getCenterCardEle();
  const libraryCardEles = [...cardLibraryListEle.children];
  const previousActiveLibraryCardEles = libraryCardEles.filter(e => !e.classList.contains('inactive'));

  setSearchText(newSearchText);

  const currentActiveLibraryCardEles = libraryCardEles.filter(e => !e.classList.contains('inactive'));

  if (currentActiveLibraryCardEles.length != previousActiveLibraryCardEles.length) {
    const currentFocusCardIndex = currentActiveLibraryCardEles.indexOf(currentFocusCard);
    if (currentFocusCardIndex != -1) {
      const currentFocusCardEle = currentActiveLibraryCardEles[currentFocusCardIndex];
      scrollLibraryScroller(currentFocusCardEle.offsetLeft);
    } else {
      scrollLibraryScroller(0);
    }
  }
  applyCarousel();
  cardTopControlsEle.classList.toggle('searched', !!getSearchText());
};

const carouselEle = document.querySelector("cardCarousel");
const carouselCanvasEle = document.querySelector('cardCarousel canvas');

const updateCarousel = () => {
  if (!cardLibraryListEle.clientWidth) return;
  const scrollPadding = cardScrollerLibraryEle.clientWidth * 0.5;
  const scrollScalar = (cardScrollerLibraryEle.scrollLeft) / (cardLibraryListEle.clientWidth - scrollPadding * 2);
  const rawLibraryCardEles = [...cardLibraryListEle.children];
  const libraryCardEles = rawLibraryCardEles.filter(e => !e.classList.contains('inactive'));
  const count = libraryCardEles.length;
  const blueLineCount = count;
  const cardDrawWidth = (PDF_CARD_WIDTH / PDF_CARD_HEIGHT) * carouselCanvasEle.height;
  const drawWidth = carouselCanvasEle.width - cardDrawWidth;
  const drawOffsetX = cardDrawWidth * 0.5;
  const intervalWidth = drawWidth / (count + 1);
  const context = carouselCanvasEle.getContext('2d');
  context.clearRect(0, 0, carouselCanvasEle.width, carouselCanvasEle.height);
  context.strokeStyle = `#2b8c9abb`;
  context.lineWidth = count > 50 ? 1 : 2;
  const linePaddin = 4;
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
  context.strokeStyle = `#58d5e6`;
  context.fillStyle = "#2b8c9abb";
  context.lineWidth = 2;
  context.beginPath();
  context.rect(viewX, 0, cardDrawWidth, carouselCanvasEle.height - 2);
  context.fill();
  context.stroke();
}

export const applyCarousel = () => {
  const containerRect = carouselEle.getBoundingClientRect();
  carouselCanvasEle.width = containerRect.width - 32;
  carouselCanvasEle.height = containerRect.height - 6;
  updateCarousel();
}

const onCarouselInteraction = event => {
  if (!event.touches) return;
  const touch = event.touches[0];
  const touchX = touch.clientX - carouselCanvasEle.offsetLeft;
  const scrollRatio = touchX / carouselCanvasEle.clientWidth;
  const newScroll = cardLibraryListEle.clientWidth * scrollRatio;
  scrollLibraryScroller(newScroll);
};

const getCardLibraryPlacementBeforeEle = (placeCard, nameList = false) => {
  const libraryCardEles = [...(nameList ? cardLibraryNameListEle.children : cardLibraryListEle.children)];
  const getCardSortWeighting = (cardEle) => {
    const cardUID = cardEle.getAttribute('uid');
    const cardStore = cardsStore[cardUID];

    if (!cardStore) return;
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
        if (isCampaign) return 'b';
        if (isAdvocate) {
          if (isLegend) return 6
          return 0;
        }
        if (isAdversary) {
          if (isLegend) return 7
          return 1;
        }
        if (isLegend) return 8
        return 2;
      }
      if (isUpgrade) {
        if (isCampaign) return 9;
        return 3;
      }
      if (isRelic) {
        if (isCampaign) return 'a';
        return 4;
      }
      return 5;
    })();
    return `${score}${cardSet}${cardStore.name}`
  }
  const placeCardWeighting = getCardSortWeighting(placeCard);
  for (const card of libraryCardEles) {
    const cardWeighting = getCardSortWeighting(card);
    if (placeCardWeighting < cardWeighting) return card;
  }
  return undefined;
};

export const loadCard = (card) => {
  if (!card) return;
  const existingCardEle = cardLibraryListEle.querySelector(`card[uid="${card.uid}"]`);
  if (existingCardEle) existingCardEle.remove();

  const cardStoreData = cardsStore[card.uid];

  // setup the card for the library(card)
  const cardEle = document.createElement('card');
  cardEle.setAttribute('uid', card.uid);
  cardEle.setAttribute('index', card.index);
  const beforeEle = getCardLibraryPlacementBeforeEle(cardEle);
  if (beforeEle) cardLibraryListEle.insertBefore(cardEle, beforeEle);
  else cardLibraryListEle.append(cardEle);
  cardEle.style.setProperty('background-image', `url('${card.image}')`);

  // setup the name card for the library(list)
  const nameCardEle = document.querySelector('templates nameCard').cloneNode(true);

  nameCardEle.setAttribute('uid', card.uid);
  nameCardEle.setAttribute('index', card.index);

  // check the type of card it is,
  const isCharacter = cardStoreData.types.match(/character/i);
  const isUpgrade = cardStoreData.types.match(/upgrade/i);
  const isRelic = cardStoreData.types.match(/relic/i);

  if (isCharacter) {
    nameCardEle.classList.add('character');
    const activationEle = nameCardEle.querySelector('activations');

    activationEle.innerText = cardStoreData?.activations ?? "2";
  }
  if (isUpgrade || isRelic) {
    nameCardEle.classList.add('upgrade');

    const upgradeType = cardStoreData.types.split(' ').filter(type => type !== 'upgrade')[0];
    nameCardEle.classList.add(upgradeType);
  }

  const nameEle = nameCardEle.querySelector('nameCardName');
  nameEle.innerText = cardStoreData.name;

  if (cardStoreData.name.length > 16) {
    nameEle.classList.add('long');
  }
  else if (cardStoreData.name.length < 7) {
    nameEle.classList.add('short');
  }

  const pointsEle = nameCardEle.querySelector('points');
  const adjustedName = cardStoreData?.cost === "0" ? '-' : cardStoreData?.cost ?? " ";
  pointsEle.innerText = adjustedName;

  const nameCardBeforeEle = getCardLibraryPlacementBeforeEle(nameCardEle, true);
  if (nameCardBeforeEle) cardLibraryNameListEle.insertBefore(nameCardEle, nameCardBeforeEle);
  else cardLibraryNameListEle.append(nameCardEle);
};

export const onShowLibrary = async (event) => {
  if (event) {
    setAttachCharacter(undefined);
  }

  document.body.className = '';
  setScrolledDeckCard(getCenterCardEle());
  if (document.body.getAttribute("showing") == 'library') return;

  document.body.setAttribute("showing", "library");
  applyCarousel();
};

export const initLibraryEvents = () => {
  showLibraryButton.addEventListener('click', onShowLibrary);

  searchButton.addEventListener('click', async () => {
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
  });

  gridButtonEle.addEventListener('click', () => {
    const currentDisplayType = document.body.getAttribute("displayType");
    const nextDisplayType = (() => {
      if (currentDisplayType == 'grid') return 'list';
      if (currentDisplayType == 'list') return '';
      return 'grid';
    })();
    document.body.setAttribute("displayType", nextDisplayType);
    storage.setStoredDisplayType(nextDisplayType);
    if (nextDisplayType == "") applyCarousel();
  });

  cardScrollerLibraryEle.addEventListener("scroll", event => {
    if (document.body.getAttribute("showing") != "library") return;
    if (document.body.getAttribute("displayType") == "grid") return;
    applyCarousel();
  });

  carouselEle.addEventListener("touchstart", onCarouselInteraction);
  carouselEle.addEventListener("touchmove", onCarouselInteraction);

  // LONG PRESS and CLICK
  cardScrollerLibraryEle.setAttribute("data-long-press-delay", 200);
  cardScrollerLibraryEle.addEventListener("long-press", async (event) => {
    var touchEndEvent = new Event("touchend");
    cardScrollerLibraryEle.dispatchEvent(touchEndEvent);
    event.preventDefault();

    const selectedCardEle = event.target;
    if (!selectedCardEle || selectedCardEle.tagName != "CARD") return;

    awaitTime(100).then(() => {
      selectedCardEle.classList.toggle("highlight", true);
    });

    if (document.body.getAttribute("showing") == "deck") return;

    // Library interactions
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
    const confirmResult = await showConfirm(`Do you want to add this character to your deck?`);
    hideInteractCard(!confirmResult);
    await awaitTime(200);
    await awaitScrollStop();

    if (confirmResult) {
      await addCharacter();
    }
    selectedCardEle.classList.toggle("highlight", false);
  });

  cardScrollerLibraryEle.addEventListener("click", async (event) => {
    const clickedCardEle = event?.target;
    if (!clickedCardEle || clickedCardEle.tagName != "CARD") return;

    if (document.body.getAttribute("showing") !== 'library') return;

    if (document.body.getAttribute("displayType") !== "grid") {
      const centerCard = getCenterCardEle();
      if (centerCard.getAttribute("index") !== clickedCardEle.getAttribute("index")) {
        const cardWidth = clickedCardEle.clientWidth;
        const cardsPerScreen = Math.floor(window.innerWidth / cardWidth);
        const offsetCenterLeft = cardsPerScreen * 0.5 * cardWidth;
        const timeToStop = await awaitScrollStop();
        if (timeToStop < 50) {
          const cardScrollX = clickedCardEle.offsetLeft || 0;
          scrollLibraryScroller(cardScrollX - offsetCenterLeft);
        }
        return;
      }
    }
    if (document.body.getAttribute("displayType") == "grid") {
      const timeToStop = await awaitScrollStop();
      const cardWidth = clickedCardEle.clientWidth;
      const cardsPerScreen = Math.floor(window.innerWidth / cardWidth);
      const offsetCenterLeft = cardsPerScreen * 0.5 * cardWidth;
      const cardScrollX = clickedCardEle.offsetLeft || 0;
      scrollLibraryScroller(cardScrollX - offsetCenterLeft);
      return;
    }
  });
};
