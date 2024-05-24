export const getCardFromPoint = (x, y, {canBePurchase, canBeChild} = {}) => {
  const pointEles = document.elementsFromPoint(x, y);
  const isLibrary = document.body.getAttribute("showing") == "library";

  const cardEles = pointEles
    // get the card that's in the right bucket, ie library when viewing library, deck when viewing deck
    .filter(ele => ele.parentElement && ["CARD", "PURCHASE", "IMPORT"].includes(ele.tagName))
    // sort by the closest to the top
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();

      return aRect.top - bRect.top;
    })
    .map(ele => {
      if (canBeChild) return ele;
      if (ele.parentElement.tagName == "CARD") {
        return ele.parentElement;
      }
      return ele;
    })
    .filter(ele => {
      const closestCardScroller = ele.closest("cardScroller");

      if (!closestCardScroller) return false;

      return closestCardScroller.classList.contains("library") == isLibrary;
    });
    const cardEle = cardEles[0];

  if (cardEle?.tagName == 'CARD' || (canBePurchase && ["PURCHASE", "IMPORT"].includes(cardEle?.tagName))) {
    return cardEle;
  }
}

export const getPointerCardEle = (touch, options) => {
  const x = touch.pageX;
  const y = touch.pageY;

  return getCardFromPoint(x, y, options);
};

export const getCenterCardEle = (options) => {
  return getCardFromPoint(window.innerWidth * 0.5, window.innerHeight * 0.5, options);
};