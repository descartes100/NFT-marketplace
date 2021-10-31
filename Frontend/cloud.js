Moralis.Cloud.beforeSave("ItemsForSale", async(request) => {
    const query = new Moralis.Query("EthNFTOwners");
    query.equalTo("token_address",request.object.get('tokenAddress'));
    query.equalTo("token_id",request.object.get('tokenId'));
    const object = await query.first();
    if (object) {
        const owner = object.attributes.owner_of;
        const userQuery = new Moralis.Query(Moralis.User);
        userQuery.equalTo("accounts",owner);
        const userObject = await query.first({userMasterKey:true});
        if (userObject) {
            request.object.set('user',userObject);
        }
    }
});

Moralis.Cloud.beforeSave("SoldItems", async(request) => {
    const query = new Moralis.Query("ItemsForSale");
    query.equalTo("uid",request.object.get('uid'));
    const item = await query.first();
    if (item) {
        request.object.set('item', item);
        item.set('isSold',true);
        await item.save();

        const userQuery = new Moralis.Query(Moralis.User);
        userQuery.equalTo("accounts", request.object.get("buyer"));
        const userObject = await userQuery.first({userMasterKey:true});
        if (userObject) {
            request.object.set('user',userObject);
        }
    }
});

Moralis.Cloud.define("getItems", async (request) => {
    const query = new Moralis.Query("ItemsForSale");
    query.notEqualTo( "isSold",true);

   
    query.select("uid","tokenAddress","token.id","tokenId","askingPrice","token.token_uri","token..symbol","token.owner_of","user.username","user.avatar")
    const queryResults = await query.find({userMasterKey:true});
    const results = [];
    for (let i=0; i< queryResults.length; ++i) {
      if (!queryResults[i].attributes.token || !queryResults[i].attributes.user) continue;
      results.push({
        "uid":queryResults[i].attributes.objectId,
        "tokenId":queryResults[i].attributes.token_id,
        "tokenAddress":queryResults[i].attributes.token_address,
        "askingPrice":queryResults[i].attributes.askingPrice,
        "symbol":queryResults[i].attributes.token.attributes.symbol,

        "tokenObjectId":queryResults[i].attributes.token.id,
        "tokenuri":queryResults[i].attributes.token_uri,
        "ownerOf":queryResults[i].attributes.token.attributes.owner_of,
        "sellerusername":queryResults[i].attributes.user.attributes.username,
        "sellerAvatar":queryResults[i].attributes.user.attributes.avatar,
       });
    }
    return results;
  });

Moralis.Cloud.define("getItem", async (request) => {
    const query = new Moralis.Query("ItemsForSale");
    query.equalTo("uid", request.params.uid);

   
    query.select("uid","tokenAddress","token.id","tokenId","askingPrice","token.token_uri","token..symbol","token.owner_of","user.username","user.avatar")
    const queryResult = await query.find({userMasterKey:true});
    if (!queryResult) return;
    return{
        "uid":queryResult.attributes.objectId,
        "tokenId":queryResult.attributes.token_id,
        "tokenAddress":queryResult.attributes.token_address,
        "askingPrice":queryResult.attributes.askingPrice,
        "symbol":queryResult.attributes.token.attributes.symbol,

        "tokenObjectId":queryResult.attributes.token.id,
        "tokenuri":queryResult.attributes.token_uri,
        "ownerOf":queryResult.attributes.token.attributes.owner_of,
        "sellerusername":queryResult.attributes.user.attributes.username,
        "sellerAvatar":queryResult.attributes.user.attributes.avatar,
       }
    
});

Moralis.Cloud.define("getUserItems", async (request) => {
    const query = new Moralis.Query("EthNFTOwners");
    query.equalTo( "contract_type","ERC721");
    query.containedIn("owner_of", request.user.attributes.accounts);
    const queryResults = await query.find();
    const results = [];
    for (let i=0; i< queryResults.length; ++i) {
      results.push({
        "tokenObjectId":queryResults[i].id,
        "tokenId":queryResults[i].attributes.token_id,
        "tokenAddress":queryResults[i].attributes.token_address,
        "symbol":queryResults[i].attributes.symbol,
        "tokenuri":queryResults[i].attributes.token_uri,
       });
    }
    return results;
  });