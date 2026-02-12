
import { getCardStore } from './store.web.js';
export const cardsStore = await getCardStore();

import { awaitFrame, clamp } from './utils.js';

export const getParentCardEleFromAny = (ele) => {
  if (ele.tagName === "NAMECARD") {
    const parentEle = ele.parentElement.closest("NAMECARD")

    return parentEle || ele;
  }

  // find the top level parent
  while (ele.parentElement && ["CARD"].includes(ele.parentElement.tagName)) {
    ele = ele.parentElement;
  }

  return ele;
};

export const showToast = (() => {
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

export const getCurrentCardScrollerEle = () => {
  return document.body.getAttribute("showing") == "library"
    ? document.querySelector('cardScroller.library')
    : document.querySelector('cardScroller.deck');
}

export const awaitScrollStop = async () => {
  const currentCardScrollerEle = getCurrentCardScrollerEle();
  const startTime = Date.now();

  var lastScrollLeft = currentCardScrollerEle.scrollLeft;
  var lastScrollTop = currentCardScrollerEle.scrollTop;

  await awaitFrame();

  while (lastScrollLeft != currentCardScrollerEle.scrollLeft || lastScrollTop != currentCardScrollerEle.scrollTop) {
    lastScrollLeft = currentCardScrollerEle.scrollLeft;
    lastScrollTop = currentCardScrollerEle.scrollTop;
    await awaitFrame();
  }
  return startTime - Date.now();
};

export const getUpgradeType = (upgrade) => {
  try {
    return /(tactic|item|potion|spell|weapon)/.exec(cardsStore[upgrade.uid].types)[0];
  }
  catch (e) {
    console.error(`unable to get upgrade type for ${upgrade.uid}`);
    console.error(e);
    return true;
  }
}

export const canCharacterEquipUpgrade = (attachCharacter, upgradeUid) => {
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
