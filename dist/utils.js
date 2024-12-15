export const getSId = (() => {
  var uid = 0;

  return () => {
    return uid++;
  }
})();

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const awaitFrame = () => new Promise(resolve => {
  window.requestAnimationFrame(resolve);
});

export const awaitTime = (time) => new Promise(resolve => {
  setTimeout(resolve, time);
});

export const getAllCardsIdsInDeck = (deck) => {
  return deck
    .map(card => {
      const upgrades = card.upgrades || [];

      return [{uid: card.uid}, ...upgrades];
    })
    .flat()
    .map(card => card.uid);
};

export const readFile = (file) => {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();  
    fr.onload = () => {
      resolve(fr.result )
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}