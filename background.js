

filters = {
       "parislib": new RegExp( "parislibrairies.fr/getshoplist_html.php\\?.*&?gencod=([0-9a-zA-Z]+)", "i" ),
    }

function url_catcher(details) {
    console.log("background url_catcher");
    console.log(details);
    let url = details.url;
    let regexp;
    for (const key of Object.keys(filters)) {
        matches = url.match( filters[key] )
        if (matches != null) {
            inject(key, matches[1], details.tabId);
            break;
        }
    };
}

const browser = window.browser || window.chrome;
browser.webRequest.onCompleted.addListener(
    url_catcher,
    {  // Filter
        urls: [
            "https://www.parislibrairies.fr/*",
        ]
    }
);


function on_result(result) {
    console.log(result);
}
function on_error(error) {
    console.log(error);
}

function inject(injector, gencod, tabId) {

    browser.tabs.executeScript(tabId, {
        code: 'var gencod = '+gencod+';'
    }, function() {
        browser.tabs.executeScript(tabId, {file: '/parislib.js',  runAt: "document_idle"});
    }).then(on_result, on_error);


}


let map_tabs_id = {};

function onCreated(tab) {
    map_tabs_id[tab.windowId] = tab.id;
}

function onError(error) {
    console.log(`Error: ${error}`);
}


function onUpdated(tab) {
}

function onUpdateError(error, parentid, url) {
    console.log(`Error: ${error}`);

    newMapTab(parentid, url);

}



function newMapTab(parentid, url) {
    browser.tabs.create({openerTabId: parentid, url: url}).then(onCreated, onError);
}

function handleMessage(request, sender, sendResponse) {

    if (!(sender.tab.windowId in map_tabs_id)) {
        return newMapTab(sender.tab.id, request);
    }

    browser.tabs.update(map_tabs_id[sender.tab.windowId], {url: request, openerTabId: sender.tab.id, active: true, loadReplace: true}).then(onUpdated, (error) => { onUpdateError(error, sender.tab.id, request) } );



}

browser.runtime.onMessage.addListener(handleMessage);
