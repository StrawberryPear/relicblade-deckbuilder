Sharing

how to get it to work -- The database stores a copy of every card, when a share request goes through, you ask the database for copies of all your missing cards, then it stores it 
into a separate table, called 'shared'?

API: /storeList, PUSH, stores a list in the backend -- will be used purely for me to look at other people's lists.

API: /sharedList, PUSH, stores the list in it's current state into the backend, and gets a code
API: /sharedList, GET, gets the list in it's current state

API: /requestSharedCards, GET, gets the missing shared cards from your collection, you supply, the shared list code, and the cards you want.

  In the backend, it makes a set of the cards, and will only supply you the ones from the sharedList that are from the list.

  cards: []

So we need a template that is going to provision an api with those endpoints, and will spin up a lambda that has those endpoints.