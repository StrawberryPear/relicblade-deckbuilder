import { getCardFromPoint } from "./dom.js";

export const initTokens = () => {
  var dragToken;
  
  const tokenOverlayEle = document.querySelector('tokenOverlay');
  const tokenContainerEle = document.querySelector('tokenContainer');
  const tokenButtonEle = document.querySelector('tokenButton');

  const baseTokens = document.querySelectorAll('token');

  const toggleTokenOverlay = (isShown) => {
    tokenOverlayEle.classList.toggle("hidden", !isShown);
    tokenButtonEle.classList.toggle("active", isShown);

    // if we're opening, make sure the tokens aren't hidden
    if (isShown) {
      [...tokenOverlayEle.querySelectorAll("token")]
        .forEach(tokenEle => {
          const tokenOpacity = tokenEle.style.getPropertyValue("opacity");

          if (!tokenOpacity) {
            tokenEle.style.setProperty("opacity", "");
          }
        });
    }
  }
  // token handling
  tokenButtonEle.addEventListener("click", async (event) => {
    const isTokenOverlayHidden = tokenOverlayEle.classList.contains("hidden");

    toggleTokenOverlay(isTokenOverlayHidden);
  });

  tokenOverlayEle.addEventListener("click", (event) => {
    if (event.target !== tokenOverlayEle) return;

    toggleTokenOverlay(false);
  });

  // on each token, enable them to be click and dragged kinda stuff

  const onTokenTouchStart = (event) => {
    // check if we're in the overlay
    var targetEle = event.target;

    if (targetEle.closest("tokenOverlay")) {
      toggleTokenOverlay(false);

      // spawn a new token
      const newTokenEle = document.createElement("token");
      const tokenType = targetEle.getAttribute("type");

      newTokenEle.setAttribute("type", tokenType);

      // add the token to the token container

      // add events to it
      newTokenEle.addEventListener("touchstart", onTokenTouchStart);
      newTokenEle.addEventListener("touchmove", onTokenTouchMove);
      newTokenEle.addEventListener("touchend", onTokenTouchEnd);

      targetEle = newTokenEle;
    }
    // remove the token from it's parent
    targetEle.remove();

    tokenContainerEle.appendChild(targetEle);

    dragToken = targetEle;

    // do a dragMove with this stuff.

    dragToken.touchStart = Date.now();

    onTokenTouchMove({...event, touches: [{ clientX: event.touches[0].clientX, clientY: event.touches[0].clientY}]});

    // make the tokenButton show bad stuff
    tokenButtonEle.classList.toggle("active", true);

    event.preventDefault();
    return false;
  };

  const onTokenTouchMove = (event) => {
    // move to token to this x, y coordinate
    if (!dragToken) return;

    const touch = event.touches[0];

    dragToken.style.setProperty("transform", `translate(-50%, -50%) translate(${touch.clientX}px, ${touch.clientY}px)`);

    // todo: check if we're ontop of a card?

    event.preventDefault && event.preventDefault();
  };

  const onTokenTouchEnd = async (event) => {
    tokenButtonEle.classList.toggle("active", false);
    // if we're over a card, pop it there
    if (!dragToken) return;

    // get the x and y coordinate
    const touch = event.changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    var cardEle = getCardFromPoint(x, y, {canBePurchase: false, canBeChild: true});

    // check if the card is a child
    if (cardEle && cardEle.parentElement.tagName == "CARD") {
      cardEle = undefined;
    }

    if (cardEle) {
      // add it to the card ele, and adjust position
      const cardBounds = cardEle.getBoundingClientRect();

      const tokenX = x - cardBounds.left;
      const tokenY = y - cardBounds.top;

      // remove the token from it's parent
      dragToken.remove();

      // add it to the card
      cardEle.appendChild(dragToken);

      dragToken.style.setProperty("transform", `translate(-50%, -50%) translate(${tokenX}px, ${tokenY}px)`);

      return;
    }

    const destroyToken = dragToken;
    
    dragToken = undefined;

    destroyToken.classList.add("destroy");

    await awaitTime(500);

    destroyToken.remove();
  };

  [...tokenOverlayEle.querySelectorAll("token")].forEach(tokenEle => {
    tokenEle.addEventListener("touchstart", onTokenTouchStart);
    tokenEle.addEventListener("touchmove", onTokenTouchMove);
    tokenEle.addEventListener("touchend", onTokenTouchEnd);
  });
};