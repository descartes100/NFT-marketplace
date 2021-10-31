/** Connect to Moralis server */
const serverUrl = "https://kup0cjpunwuk.usemoralis.com:2053/server";
const appId = "tb6ODBFEVE7n4OaN47cTvZDlcbuzwzIWb3nLIhc7";
const TOKEN_CONTRACT_ADDRESS = "0xf404870339BA722e095daCEDB291a7488d928D6b";
const MARKET_CONTRACT_ADDRESS = "0xced0f7CA0B556B596722CEF0F993646Cb6d615a3";
Moralis.start({ serverUrl, appId });

init = async () => {
    hideElement(userItemsSection);
    window.web3 = await Moralis.Web3.enableWeb3();
    window.tokenContract = new web3.eth.Contract(TokenContractAbi, TOKEN_CONTRACT_ADDRESS);
    window.marketplaceContract = new web3.eth.Contract(MarketPlaceContractAbi, MARKET_CONTRACT_ADDRESS);
    initUser();
    loadItems();

    const soldItemsQuery = new Moralis.Query('SoldItems');
    const soldItemsSubscription = await soldItemsQuery.subscribe();
    soldItemsSubscription.on("create", onItemSold);

    const itemsAddedQuery = new Moralis.Query('ItemsForSale');
    const itemsAddedSubscription = await itemsAddedQuery.subscribe();
    itemsAddedSubscription.on("create", onItemAdded);
}

onItemSold = async (item) => {
    const listing = document.getElementById(`item-${item.attributes.uid}`);
    if (listing){
        listing.parentNode.removeChild(listing);
    }
    
    user = await Moralis.User.current();
    if (user){
        const params = {uid: `${item.attributes.uid}`};
        const soldItem = await Moralis.Cloud.run('getItem', params);
        if (soldItem){
            if (user.get('accounts').includes(item.attributes.buyer)){
                getAndRenderItemData(soldItem, renderUserItem);
            }

            const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
            if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
          
        }
   
    }
}

onItemAdded = async (item) => {
    const params = {uid: `${item.attributes.uid}`};
    const addedItem = await Moralis.Cloud.run('getItem', params);
    if (addedItem){
        user = await Moralis.User.current();
        if (user){
            if (user.get('accounts').includes(addedItem.ownerOf)){
                const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
                if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);

                getAndRenderItemData(addedItem, renderUserItem);
                return;
            }
        }
        getAndRenderItemData(addedItem, renderItem);
    }

}


initUser = async () => {
    if (await Moralis.User.current()){
        hideElement(userConnectButton);
        showElement(userProfileButton);
        showElement(openCreateItemButton);
        showElement(openUserItemButton);
        loadUserItems();
    }
    else{
        showElement(userConnectButton);
        hideElement(userProfileButton);
        hideElement(openCreateItemButton);
        hideElement(openUserItemButton);
    }
}

login = async () => {
    try {
        await Moralis.Web3.authenticate();
        initUser();
    } catch(error) {
        alert(error)
    }
}

logout = async () => {
    await Moralis.User.logOut();
    hideElement(userInfo);
    initUser();
}

loadItems = async () => {
    const items = await Moralis.Cloud.run("getItems");
    console.log(items);
    user = await Moralis.User.current();
    items.forEach(item => {
        if (user){
            if (user.attributes.accounts.includes(item.ownerOf)){
                const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
                if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
                getAndRenderItemData(item, renderUserItem);
                return;
            }
        }
        getAndRenderItemData(item, renderItem);
    });
}

loadUserItems = async () => {
    const ownedItems = await Moralis.Cloud.run("getUserItems");
    ownedItems.forEach(item => {
        const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
        if (userItemListing) return;
        getAndRenderItemData(item, renderUserItem);
    });
}

initTemplate = (id) => {
    const template = document.getElementById(id);
    template.id = "";
    template.parentNode.removeChild(template);
    return template;
}

renderUserItem = async (item) => {
    const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
    if (userItemListing) return;

    const userItem = userItemTemplate.cloneNode(true);
    userItem.getElementsByTagName("img")[0].src = item.image;
    userItem.getElementsByTagName("img")[0].alt = item.name;
    userItem.getElementsByTagName("h5")[0].innerText = item.name;
    userItem.getElementsByTagName("p")[0].innerText = item.description;

    userItem.getElementsByTagName("input")[0].value = item.askingPrice ?? 1;
    userItem.getElementsByTagName("input")[0].disabled = item.askingPrice > 0;
    userItem.getElementsByTagName("button")[0].disabled = item.askingPrice > 0;
    userItem.getElementsByTagName("button")[0].onclick = async () => {
        user = await Moralis.User.current();
        if (!user){
            login();
            return;
        }
        await ensureMarketplaceIsApproved(item.tokenId, item.tokenAddress);
        await marketplaceContract.methods.addItemToMarket(item.tokenId, item.tokenAddress, userItem.getElementsByTagName("input")[0].value).send({from: user.get('ethAddress') });
    };

    userItem.id = `user-item-${item.tokenObjectId}`
    userItems.appendChild(userItem);
}

renderItem = (item) => {
    const itemForSale = marketplaceItemTemplate.cloneNode(true);
    if (item.sellerAvatar){
        itemForSale.getElementsByTagName("img")[0].src = item.sellerAvatar.url();
        itemForSale.getElementsByTagName("img")[0].alt = item.sellerUsername;
    }

    itemForSale.getElementsByTagName("img")[1].src = item.image;
    itemForSale.getElementsByTagName("img")[1].alt = item.name;
    itemForSale.getElementsByTagName("h5")[0].innerText = item.name;
    itemForSale.getElementsByTagName("p")[0].innerText = item.description;

    itemForSale.getElementsByTagName("button")[0].innerText = `Buy for ${item.askingPrice}`;
    itemForSale.getElementsByTagName("button")[0].onclick = () => buyItem(item);
    itemForSale.id = `item-${item.uid}`;
    itemsForSale.appendChild(itemForSale);
}

getAndRenderItemData = (item, renderFunction) =>{
    fetch(item.tokenuri)
    .then(response => response.json())
    .then(data => {
        item.name = data.name;
        item.description = data.description;
        item.image = data.image;
        renderFunction(item);
    })
}

ensureMarketplaceIsApproved = async (tokenId, tokenAddress) => {
    user = await Moralis.User.current();
    const userAddress = user.get('ethAddress');
    const contract = new web3.eth.Contract(TokenContractAbi, tokenAddress);
    const approvedAddress = await contract.methods.getApproved(tokenId).call({from: userAddress});
    if (approvedAddress != MARKET_CONTRACT_ADDRESS){
        await contract.methods.approve(MARKET_CONTRACT_ADDRESS,tokenId).send({from: userAddress});
    }
}

buyItem = async (item) => {
    user = await Moralis.User.current();
    if (!user){
        login();
        return;
    } 
    await marketplaceContract.methods.buyItem(item.uid).send({from: user.get('ethAddress'), value: item.askingPrice});
}

openUserInfo = async () => {
    user = await Moralis.User.current();
    if (user) {
        const email = user.get("email");
        if (email){
            userEmailField.value = email;
        } else {
            userEmailField.value = "";
        }
        userNameField.value = user.get("username");
        const userAvatar = user.get("avatar");
        if (userAvatar) {
            userAvatarImg.src = userAvatar.url();
            showElement(userAvatarImg);
        } else {
            hideElement(userAvatarImg);
        }

        $('#userInfo').modal('show');
    }
    else{
        login();
    }
}

saveUserInfo = async () => {
    user.set("email", userEmailField.value);
    user.set("username", userNameField.value);

    if (userAvatarFile.files.length > 0) {
        const avatar = new Moralis.File("avatar.jpg", userAvatarFile.files[0]);
        user.set("avatar",avatar);
      }

    await user.save();
    alert("User info saved successfully!");
    openUserInfo();
}

openUserItems = async () => {
    user = await Moralis.User.current();
    if (user) {
        
        $('#userItems').modal('show');
    }
    else{
        login();
    }
}


createItem = async () => {

    if (createItemFile.files.length == 0){
        alert("Please select a file!");
        return;
    } else if (createItemNameField.value.length == 0){
        alert("Please give the item a name!");
        return;
    }

    const nftFile = new Moralis.File("nftFile.jpg",createItemFile.files[0]);
    await nftFile.saveIPFS();

    const nftFilePath = nftFile.ipfs();

    const metadata = {
        name: createItemNameField.value,
        description: createItemDescriptionField.value,
        image: nftFilePath,
    };

    const nftFileMetadataFile = new Moralis.File("metadata.json", {base64 : btoa(JSON.stringify(metadata))});
    await nftFileMetadataFile.saveIPFS();

    const nftFileMetadataFilePath = nftFileMetadataFile.ipfs();

    const nftId = await mintNft(nftFileMetadataFilePath);

    user = await Moralis.User.current();
    const userAddress = user.get('ethAddress');
    console.log(userAddress)

    switch(createItemStatusField.value){
        case "0":
            return;
        case "1":
            await ensureMarketplaceIsApproved(nftId, TOKEN_CONTRACT_ADDRESS);
            await marketplaceContract.methods.addItemToMarket(nftId, TOKEN_CONTRACT_ADDRESS, createItemPriceField.value).send({from: userAddress });
            break;
        case "2":
            alert("Not yet supported!");
            return;
    }
}

mintNft = async (metadataUrl) => {
    const receipt = await tokenContract.methods.createItem(metadataUrl).send({from: ethereum.selectedAddress});
    console.log(receipt);
    return receipt.events.Transfer.returnValues.tokenId;
}

hideElement = (element) => element.style.display = "none";
showElement = (element) => element.style.display = "block";


// Navbar
const userConnectButton = document.getElementById("btnConnect");
userConnectButton.onclick = login;
const userProfileButton = document.getElementById("btnUserInfo");
userProfileButton.onclick = openUserInfo;
const openCreateItemButton = document.getElementById("btnOpenCreateItem");
openCreateItemButton.onclick = () => $('#createItem').modal('show');

// User profile
const userInfo = document.getElementById("userInfo");
const userNameField = document.getElementById("txtUsername");
const userEmailField = document.getElementById("txtEmail");
const userAvatarImg = document.getElementById("imgAvatar");
const userAvatarFile = document.getElementById("fileAvatar");

document.getElementById("btnCloseUserInfo").onclick = () => hideElement(userInfo);
document.getElementById("btnLogout").onclick = logout;
document.getElementById("btnSaveUserInfo").onclick = saveUserInfo;

// item creation
const createItemForm = document.getElementById("createItem");
const createItemNameField = document.getElementById("txtCreateItemName");
const createItemDescriptionField= document.getElementById("txtCreateItemDescription");
const createItemPriceField = document.getElementById("numCreateItemPrice");
const createItemStatusField = document.getElementById("selectCreateItemStatus");
const createItemFile = document.getElementById("fileCreateItemFile");

document.getElementById("btnCloseCreateItem").onclick = () => hideElement(createItemForm);
document.getElementById("btnCreateItem").onclick = () => createItem();

//User items
const userItemsSection = document.getElementById("userItems");
const userItems = document.getElementById("userItemsList");
document.getElementById("btnCloseUserItems").onclick = () => hideElement(userItemsSection);
const openUserItemButton = document.getElementById("btnMyItems");
openUserItemButton.onclick = openUserItems;

const userItemTemplate = initTemplate("itemTemplate");
const marketplaceItemTemplate = initTemplate("marketplaceItemTemplate");

// Items for sale
const itemsForSale = document.getElementById("itemsForSale");

init();