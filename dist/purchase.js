const relicbladeProductEles = [...document.querySelectorAll('purchase')];
let relicbladeProducts = [
  {
      id: "relicblade.templeofjustice",
      alias: "Temple of Justice",
      type: "non consumable"
  },
  {
      id: "relicblade.battlepigs",
      alias: "Battle Pigs",
      type: "non consumable"
  },
  {
      id: "relicblade.adventuregear",
      alias: "Adventure Gear",
      type: "non consumable"
  },
  {
      id: "relicblade.theloneguard",
      alias: "The Lone Guard",
      type: "non consumable"
  },
  {
      id: "relicblade.boneanddarkness",
      alias: "Bone and Darkness",
      type: "non consumable"
  },
  {
      id: "relicblade.thewilderkin",
      alias: "The Wilderkin",
      type: "non consumable"
  },
  {
      id: "relicblade.wretchedhive",
      alias: "Wretched Hive",
      type: "non consumable"
  },
  {
      id: "relicblade.lostwoodenclave",
      alias: "Lostwood Enclave",
      type: "non consumable"
  },
  {
      id: "relicblade.moldorfexpedition",
      alias: "Moldorf Expedition",
      type: "non consumable"
  },
  {
      id: "relicblade.apostlesofthedeep",
      alias: "Apostles of the Deep",
      type: "non consumable"
  },
  {
      id: "relicblade.kingdomsofakadh",
      alias: "Kingdoms of Akadh",
      type: "non consumable"
  },
  {
      id: "relicblade.singularchampions1",
      alias: "Singular Champions 1",
      type: "non consumable"
  },
  {
      id: "relicblade.singularchampions2",
      alias: "Singular Champions 2",
      type: "non consumable"
  },
  {
      id: "relicblade.singularchampions3",
      alias: "Singular Champions 3",
      type: "non consumable"
  },
  {
      id: "relicblade.singularchampions4",
      alias: "Singular Champions 4",
      type: "non consumable"
  },
  {
      id: "relicblade.relicsofthevolge",
      alias: "Relics of the Volge",
      type: "non consumable"
  },
  {
      id: "relicblade.stormsofkural",
      alias: "Storms of Kural",
      type: "non consumable"
  }
];

const buyProduct = async (productUid) => {
  window.open("https://relicblade.com/shop?category=Cards");
  // const { store } = CdvPurchase;

  // // if we own the product just download the thing
  // const product = relicbladeProducts.find(product => product.alias == productUid);
  // if (!product) throw new Error("No Product");

  // const storeProduct = store.get(product.id);
  // if (!storeProduct) throw new Error("No Product");

  // // if product already owned, just pop the cards there.
  // if (storeProduct.owned) return true;

  // const order = await storeProduct.getOffer().order();
  // if (order?.error) {
  //   throw new Error("Unexpected");
  // }

  // const afterStoreProduct = store.get(product.id);
  // if (afterStoreProduct.owned) return true;

  // return order;
};

const installProduct = async (productUid) => {
  document.body.className = 'loading';

  const url = `./assets/cardpacks/${productUid}.pdf`;

  try {
    await loadCardsFromUrl(url);

    applyFilters();
    applyCarousel();
  } finally {
    document.body.className = '';
  }
};

const initStore = async () => {
  const {store, Platform} = CdvPurchase;

  const updateProducts = () => {
    relicbladeProducts.forEach((product) => {
      const storeProduct = store.get(product.id);
      const owned = store.owned(storeProduct);

      product.owned = owned;

      const ele = relicbladeProductEles.find(ele => ele.getAttribute("uid") == product.alias);

      ele.classList.toggle("bought", !!owned);
    });
  }

  const currentPlatform = Capacitor.getPlatform();
  const platform = currentPlatform == "ios" ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;

  relicbladeProducts.forEach(product => {
    store.register([{ ...product, platform }]);
  })

  store.error(e => {
    console.log('error', e);
  });

  store.when()
    .productUpdated((value) => {
      console.log('product updated', value);
      updateProducts();
    })
    .approved(value => {
      console.log('approved', value);
      updateProducts();
    })
    .verified(value => {
      console.log('verified', value);
      updateProducts();
    })
    .finished(value => {
      console.log('finished', value);
      updateProducts();
    });

  store.ready(() => {
    console.log("ready");
    // show the purchaseable elements
    updateProducts();
  });
  
  store.initialize([Platform.APPLE_APPSTORE])
    .then(() => {
      console.log("initialized");
      updateProducts();
    });
};

// document.addEventListener('deviceready', initStore);