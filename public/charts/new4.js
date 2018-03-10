titles = {"epochtime":0,"timestamp":1,"duration":2,"name":3,"name.previous":4,"country":5,"city":6}
numRequests = 0

var displaySize = 700;
// Settings for svg/d3 stuff
var margin = $data.margin;
var width = displaySize - margin.left - margin.right;
var height = displaySize - margin.top - margin.bottom;
var padding = 20;

var diameter;


var index = 1; // start at the record after the header

var rootNode = circleNode("Application");

// Serial id assigned to each event
var serialId = 1000;

// Changed this so it's only called once.
function initTraffic(div, json) {
    buildView(div);
}

function addPage(page) {
    var pageNode = {
        id: String(serialId++),
        country: page[titles["country"]],
        city: page[titles["city"]],
        timestamp: page[titles["epochtime"]],
        duration: page[titles["duration"]]
    }

    cityNode = rootNode.child(pageNode.country).child(pageNode.city);
    // Not showing page level right now.
    //cityNode.children.unshift(pageNode);

}

function circleNode(name) {
    var n = {
        id: name,
        children: null
    };
    // Object method to add a child, creating it if it doesn't exist
    n.child = function(id){
        if (n.children == null) {
            n.children = [];
        }
        for (i = 0; i < n.children.length; i++) {
            if (n.children[i].id == id)
                return n.children[i];
        }
        var newNode = circleNode(id);
        n.children.unshift(newNode);
        return newNode;
    };
    return n;
}


/*
 * Build the viewport where the circles are packed.
 * This only gets called once.
 */
function buildView(div) {

    var viewport = d3.select("#display").node().getClientRects()[0];
    width = viewport.width;
    height = viewport.width;

    var svg = d3.select("#display").append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append("g")
        .attr("id", "top")
        .attr("transform", "translate(" + $data.margin.left + "," + $data.margin.top + ")");
}

function updateView() {

    // TODO these should be moved to initialization scope

    var color = d3.scale.linear()
        .domain([-1, 5])
        .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
        .interpolate(d3.interpolateHcl);

    var packCircles = d3.pack()
        .size([width - $data.margin.left - $data.margin.right, height - $data.margin.left - $data.margin.right])
        .padding(2);

    // Choose cityHierarchy as our source of data and make the circle sizes equal to request duration
    var root = d3.hierarchy(rootNode)
        .sum(function (d) {
            return d.duration ? d.duration : 1;
        })
        .sort(function (a, b) {
            return a.data.id == b.data.id ? 0 : (a.data.id < b.data.id ? 1 : -1)
        });

    var nodes = packCircles(root).descendants();


    /*
     * For now all this does is draw countries and cities that have requests.  It doesn't show pages,
     * and it doesn't remove anything.  I just wanted to see if I could get the animation working.
     *
     * To simplify things I also removed the zoom feature for now.
     */

    // This createa a G element that will have a single translation and contain the circle and text elements.
    // Mostly followed the circle packing example.
    // This also uses a stable ID which simplifies things.
    var nodesSelection = d3.select("g#top").selectAll("g.node").data(nodes, function (d) {
        return d.data.id;
    });

    // This updates existing nodes, moving them to a new location
    nodesSelection
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

    // This updates the radius of existing nodes
    nodesSelection.select("circle").attr("r", function (d) {
        return d.r;
    });

    // This is the enter selection which is the code to add new g elements
    var newNodes = nodesSelection.enter()
        .append("g")
        .attr("class", function (d) {
            return d.children ? "node" : "node leaf";
        })
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
    newNodes.append("circle").attr("r", function (d) {
        return d.r;
    });
    newNodes.append("text").text(function (d) {
        if (d.r > 25) return d.data.id;
    });

    // We aren't removing anything from the hierarchy yet so this has no effect.
    nodesSelection.exit().remove();

}


// This adds a chunk of pages to the hierarchy and then updates the view.  Meant to
// be called on a timer.
function updateTraffic(json) {
    lim = Math.min(index + 50, json.length - 1)
    while (index < lim) {
        addPage(json[index++])
    }
    if (lim < json.length -1) updateView();
}

