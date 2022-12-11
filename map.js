
var map = null;
var book_layer_control = null;
var inter_layer = null;

var all_libraries = {};
var all_books = null;

let angle = null;


function init_map() {
    if (map)
        map.remove();

    map = L.map('map').setView([48.856578,2.351828], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    book_layer_control = L.control.layers(null, null, {'collapsed': false, 'autoZIndex': false}).addTo(map);
    inter_layer = null;

    angle = 43;

}



function build_lib_popup(libname) {
    return function() {

        let lib = all_libraries[libname]['lib'];

        let res = "<a href='https://www.parislibrairies.fr"+lib['lib_url']+"' target='_blank' ><b>" + libname + "</b></a><br /><br />\n";

        let books = all_libraries[libname]['books'];
        for (let book of books) {
            res += `<a target="_blank" href="https://www.parislibrairies.fr${book['url']}"><img class='book_thumb' src="${book['thumb']}" title="${book['title']}" /></a>&nbsp;`;
        }

        res += "<br /><br />" + lib['addr'].replaceAll("\n\n", "<br />");

        res += "&nbsp;<a href='" + lib['map_url'] + "' target='_blank'>Plan</a>";

        res += "<br /><pre style='white-space: pre-wrap;'>" + lib['hours'].trim().replaceAll("  ", "") + "</pre>" ;

        return res;
    }

}



var stylesheet = document.getElementById("mapcss").sheet;

var lf_book_marker_css = null;

for(let i = 0; i < stylesheet.cssRules.length; i++) {
    if(stylesheet.cssRules[i].selectorText === '.lf-book-marker-opacity') {
        lf_book_marker_css = stylesheet.cssRules[i];
    }
  }



function add_color_class() {
    let classname = "filter-color-" + angle;
    stylesheet.addRule("." + classname, "filter: hue-rotate("+angle+"deg);");
    angle += 67; // module 360?
    return classname;
}




function delete_book(gencod) {

    if (gencod in all_books) {
        delete all_books[gencod];
    }

    browser.storage.local.set( { 'books': all_books } ).finally(load_from_storage);


}

function book_in_list(gencod, books) {
    for (let book of books) {
        if (book.gencod == gencod)
            return true;
    }
    return false;
}

function add_intersection() {

    let should_be_created = !inter_layer;

    if (should_be_created)
        inter_layer = L.featureGroup().addTo(map);

    inter_layer.clearLayers();

    let inter_icon = L.divIcon({className: 'lf-book-marker' , iconSize: [36, 36]});

    let books_in_inter = [];
    for (let gencod in all_books) {
        if (all_books[gencod].in_inter)
            books_in_inter.push(gencod);
    }


    for (let libname in all_libraries) {
        let lib = all_libraries[libname];
        let books = lib['books'];

        let has_all_books_in_inter = (books_in_inter.length>0);

        for (let intercod of books_in_inter) {
            if ( !book_in_list(intercod, books) ) {
                has_all_books_in_inter = false;
                break;
            }
        }

        if (has_all_books_in_inter) {
            var marker = L.marker( [ parseFloat(lib['lib']['lat']), parseFloat(lib['lib']['long']) ], {icon: inter_icon}).addTo(map).bindPopup( build_lib_popup(libname) );
            inter_layer.addLayer(marker);
        }
    }


    if (should_be_created) {

        var mymarker = document.createElement("div")
        mymarker.classList.add("lf-book-marker");
        mymarker.classList.add("book_marker");

        let inter_legend = "<div class='legend_row'>" + mymarker.outerHTML + "<img class='book_thumb' src='' />&nbsp;<b>" + "Intersection" + "</b></div>" ;

        book_layer_control.addOverlay(inter_layer, inter_legend);

    }

}

function on_got_books_from_storage(item) {

    all_books = item['books'];
    all_libraries = {};

    let books = JSON.parse(JSON.stringify(all_books)); // force copy

    var i = 0;

    for (var gencod in books) {
        let book = books[gencod];

        if ( !("in_inter" in all_books[gencod]) ) {
            book.in_inter = true;
            all_books[gencod].in_inter =  true;
        }

        let book_layer = L.layerGroup().addTo(map);

        let book_class = add_color_class();

        var mymarker = document.createElement("div")
        mymarker.classList.add("lf-book-marker");
        mymarker.classList.add("lf-book-marker-opacity");
        mymarker.classList.add("book_marker");
        mymarker.classList.add(book_class);

        let book_icon = L.divIcon({className: 'lf-book-marker lf-book-marker-opacity ' + book_class, iconSize: [36, 36]});

        book['legend'] = "<div class='legend_row'>" + mymarker.outerHTML + "<img class='book_thumb' src='"+book['thumb']+"' />&nbsp;<b>" + book['title'] + "</b><span class='actions_span'><input class='inter_checkbox' "+(book.in_inter?"checked":"")+" type='checkbox' id='chk-"+gencod+"' data-gencod='"+gencod+"' title='Include dans l&apos;intersection ?' ><img src='static/images/delete.png' title='Retirer de la liste' class='del_btn' data-gencod='"+gencod+"'></img></span></div>" ;

        let libs = book['avail'];

        for (var lib of libs) {

            let libname = lib['name'];

            var marker = L.marker( [ parseFloat(lib['lat']), parseFloat(lib['long']) ], {icon: book_icon}).addTo(map).bindPopup( build_lib_popup(libname) );

            lib['marker'] = marker;
            book_layer.addLayer(marker);

            if (!(libname in all_libraries)) {
                all_libraries[libname] = {
                    'lib': lib,
                    'books': []
                };
            }
            all_libraries[libname]['books'].push(book);
        }

        i++;

        book_layer_control.addOverlay(book_layer, book['legend']);

    }

    lf_book_marker_css.style.opacity = 0.15 + (1-0.15)/i ;

    browser.storage.local.set( { 'books': all_books } );


    add_intersection();

    map.on("overlayadd", function (event) {

        inter_layer.eachLayer(function (layer) {
            layer.setZIndexOffset(1000);
          });


    });


    let html_control = book_layer_control.getContainer();


    function setParent(el, newParent) {
       newParent.appendChild(el);
    }
    setParent(html_control, document.getElementById("leftmenu"));



    document.querySelectorAll(".leaflet-control-layers-selector").forEach( box => {

        box.addEventListener('change', function(event) {

            let marker = box.parentNode.getElementsByClassName("book_marker")[0];
            let thumb = box.parentNode.getElementsByClassName("book_thumb")[0];

            marker.style.opacity = box.checked ? 1 : 0.2 ;
            thumb.style.opacity = box.checked ? 1 : 0.5 ;

        });

    });

    document.querySelectorAll(".del_btn").forEach( box => {

        box.addEventListener('click', function(event) {

            let gencod = box.dataset.gencod;

            delete_book(gencod);

        });

    });

    document.querySelectorAll(".inter_checkbox").forEach( box => {

        box.addEventListener('change', function(event) {

            let gencod = box.dataset.gencod;

            all_books[gencod].in_inter = box.checked;

            browser.storage.local.set( { 'books': all_books } );

            add_intersection();

        });

    });


}

function onError(error) {
    console.log(`Error: ${error}`);
}


function load_from_storage() {

    init_map();

    let gettingItem = browser.storage.local.get("books").then();
    gettingItem.then(on_got_books_from_storage, onError);

}



load_from_storage();
