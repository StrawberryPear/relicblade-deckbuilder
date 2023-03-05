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

const filterShopEle = document.querySelector('cardControl.filterShop');

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
  },
  shop: {
    ele: filterShopEle,
    filter: /purchase/i,
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

  applyFilters();
}

const applyFilters = () => {
  const allFalse = !Object.values(filters).find(o => o.active);

  const libraryCardEles = [...cardLibraryListEle.children];

  for (const cardEle of libraryCardEles) {
    const uid = cardEle.getAttribute('uid');
    const cardStore = store[uid];

    if (!cardStore) {
      cardEle.classList.toggle('inactive', subFilter || !allFalse || !!searchText.trim());

      continue;
    }

    const filterShow = Object.values(filters).find(o => {
      return o.active && cardStore.base.match(o.filter);
    });

    const searchShow = cardStore.base.toLowerCase().includes(searchText.toLowerCase());

    const subFilterShow = !subFilter || (() => {
      if (subFilter == 'upgrade') {  
        return cardStore.types.match(/(upgrade|relic)/i);
      } 
      if (subFilter == 'character') {
        return cardStore.types.match(/(character|summon)/i);
      }
    })();

    const specifiedFiltersShow = !!specifiedFilters && (() => {
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

  // check purchases
  for (const purchaseEle of [...libraryCardEles.filter(ele => ele.tagName == "PURCHASE")]) {
    const uid = purchaseEle.getAttribute("uid").toLowerCase();

    const hasCardsMatching = libraryCardEles
      .filter(ele => ele.tagName == "CARD")
      .map(ele => ele.getAttribute("uid").toLowerCase())
      .filter(cardUid => !baseCards.findIndex(baseCard => baseCard.uid.toLowerCase == cardUid))
      .find(cardUid => (cardUid || "").includes(uid));

    purchaseEle.classList.toggle("bought", !!hasCardsMatching);
  }
}
