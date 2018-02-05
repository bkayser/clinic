var allPages = []
var svgs = [];
var nodesByPage = []

function initTraffic(div) {}

function formatData(newData) {
    // Empty out the dictionary
    nodesByPage = [];

    // Re-populate the dictionary with page as key
    for (i = 0; i < newData.length; i++) {
        if (nodesByPage[newData[i][dimensionIndex]] == null) {
            nodesByPage[newData[i][dimensionIndex]] = [];
            nodesByPage[newData[i][dimensionIndex]].push(newData[i]);
        } else {
            nodesByPage[newData[i][dimensionIndex]].push(newData[i]);
        }
    }
}

function getAllPages(json, dimensionIndex) {
    // Empty the dictionary
    allPages = [];

    // Re-populate the dictionary
    for (i = 0; i < json.length; i++) {
        if (allPages.indexOf(json[i][dimensionIndex]) <= -1) {
            allPages.push(json[i][dimensionIndex]);
        }
    }
}


function updateTraffic(error, json, div, dimensionIndex) {
    if(error) {
        readout(error);
    } else {
        var now = new Date().getTime();
        div.node().stream = {dimension: dimensionIndex, start: now, wall: now, sleep: 0, first: json[0][0], last: json[json.length-1][0], index: 0, data: json};

        
        d3.selectAll("svg").remove();
        svgs = [];

        getAllPages(json, dimensionIndex);
        formatData(json);


        // To access nodes from one page:
        // nodesByPage[allPages[i]]
        /**************************************************/

        var margin = $data.margin;
        width = 900 - margin.left - margin.right,
        height = 100 - margin.top - margin.bottom;

        var padding = 6,
        radius = d3.scale.sqrt().domain([0,5000]).range([5, 15]),
        color = d3.scale.category10();

        function readout(text) {
            d3.select("#readout").text(text);
        }

        for (i = 0; i < 4; i++) {
            var force = d3.layout.force()
                //.nodes(nodes)
                .nodes(nodesByPage[allPages[i]])
                .size([width, height])
                .gravity(0)
                .friction(.6)
                .charge(0)
                .on("tick", tick)
                .start();

            var svg = div.append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
            svgs.push(svg);

            var circle = svgs[i].selectAll("circle")
                .data(nodesByPage[allPages[i]], function(d) { return d.id;})
                .enter().append("circle")
                .attr("r", function(d) { return d.radius; })
                .style("fill", function(d) { return d.color; })
                .call(force.drag);
        }

        var id = 0;
        function tick(e) {
            
            for (var i = 4 - 1; i >= 0; i--) {
                var now = new Date().getTime();

                // Remove old nodes
                for (var j = nodesByPage[allPages[i]].length - 1; j >= 0; j--) {
                    if (finished(nodesByPage[allPages[i]][j], now)) {
                        nodesByPage[allPages[i]].splice(j,1);
                        console.log("nodesByPage: ", nodesByPage);

                    }
                }

                // Add new nodes
                playnext(function(arrival){
                    readout(new Date(arrival.time).toTimeString().split(" ")[0]+" "+arrival.request);
                    arrival.id = id++;
                    arrival.radius = radius(transaction.server);
                    arrival.color = color(transaction.request);
                    arrival.cx = arrival.x = 10;
                    arrival.cy = arrival.y = height / 2 + Math.random()*10;
                    arrival.start = now;
                    //nodes.push(arrival);
                    nodesByPage[transaction.request].push(arrival);

                });
            
                var circle = svgs[i].selectAll("circle")
                    .data(nodesByPage[allPages[i]], function(d) { return d.id; });

                circle
                    .enter().append("circle")
                    .attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; })
                    .attr("r", function(d) { return d.radius; })
                    .style("fill", function(d) { return d.color; });

                circle
                    .exit().remove();

                circle
                    .each(gravity(.2 * e.alpha))
                        .each(collide(.5))
                            .attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; });
                force.start();
            }
        }

        // Move nodes toward cluster focus.
        function gravity(alpha) {
            return function(d) {
                d.y += (d.cy - d.y) * alpha;
                var now = new Date().getTime(); 
                // Add a 200ms to ensure the circle makes it all the way across
                var pos = width * Math.min(1, (now + 200 - d.start)/d.client);
                d.x += (pos - d.x) * alpha;
            };
        }

        // Resolve collisions between nodes.
        function collide(alpha) {
            for (var i = 0; i < 4; i++) {
                var quadtree = d3.geom.quadtree(nodesByPage[allPages[i]]);
                return function(d) {
                    var r = d.radius + radius.domain()[1] + padding,
                    nx1 = d.x - r,
                    nx2 = d.x + r,
                    ny1 = d.y - r,
                    ny2 = d.y + r;
                    quadtree.visit(function(quad, x1, y1, x2, y2) {
                        if (quad.point && (quad.point !== d)) {
                            var x = d.x - quad.point.x,
                            y = d.y - quad.point.y,
                            l = Math.sqrt(x * x + y * y),
                            r = d.radius + quad.point.radius + (d.color !== quad.point.color) * padding;
                            if (l < r) {
                                l = (l - r) / l * alpha;
                                d.x -= x *= l;
                                d.y -= y *= l;
                                quad.point.x += x;
                                quad.point.y += y;
                            }
                        }
                        return x1 > nx2
                            || x2 < nx1
                            || y1 > ny2
                            || y2 < ny1;
                    });
                };
            }
        }

        // Stream over transaction dataset delivering entry events by callback

        function finished (transaction, now) {
            return transaction.start + (transaction.client||3000) + div.node().stream.sleep < now 
        }

        function playnext (callback) {
            var stream = div.node().stream;
            if (stream == null) {
                return;
            }
            var dimensionIndex = stream['dimension'];
            var now = new Date().getTime();
            var delay = now - stream.wall;
            if (t = stream.data[stream.index]) {
               $data.dispatch.tick(t[0]);
            }
            stream.wall = now;
            if (delay > 1000) {
                // must have been sleeping without timer events
                stream.sleep += delay;
            }
            var want = now - stream.start + stream.first - stream.sleep;
            while ((at = stream.data[stream.index]) && at[0] < want) {
                transaction = {time:at[0], request:at[dimensionIndex], client:at[1], server:at[2]}
                callback(transaction);
                stream.index += 1;
            }
            var sumLengths = 0;
            for (i = 0; i < 4; i++) {
                sumLengths = sumLengths + nodesByPage[allPages[i]].length;
            }
            if (sumLengths == 0 && want > stream.last) {
                stream.wall = stream.start = now;
                stream.sleep = stream.index = 0;
            }
        }

        
        /**************************************************/
    }
}

