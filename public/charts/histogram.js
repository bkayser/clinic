function histogram(div) {

    var svg = div.append("svg")
        .attr("id", "histogram")
        .attr("width", $data.width + $data.margin.left + $data.margin.right)
        .attr("height", $data.height + $data.margin.top + $data.margin.bottom + 30);

    var chart = svg.append("g")
        .attr("transform", "translate(" + $data.margin.left + ","+ $data.margin.top + ")");

    var bars = d3.scale.linear().range([0, $data.width]);
    var y = d3.scale.linear().nice().range([$data.height, 0]);
    var x = d3.scale.linear().range([0,$data.width]);

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + $data.height + ")");

    chart.append("g")
        .attr("class", "y axis")
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("count");
    chart.append("g")
        .attr("class", "bars");
    chart.append("g")
        .attr("class", "plots");

    // These should be divs probably.
    var legend = chart.append("g").selectAll("g").data([{ "label": "apdex S", "class": "apdex_s"},
                                                        { "label": "apdex T", "class": "apdex_t"}, 
                                                        { "label": "apdex F", "class": "apdex_f"},
                                                        { "label": "actual quartile", "class": "actual" },
                                                        { "label": "geom. quartile", "class": "geometric" },
                                                        { "label": "arith. quartile", "class": "arithmetic" }])
        .enter()
        .append("g").attr("transform", function(d,i) { 
            return "translate("+(i*120)+","+(30 + $data.margin.top + $data.height)+")" 
        });

    legend.append("text")
        .text(function(v) { return v.label});
    legend.append("rect")
        .attr("y", 8)
        .attr("width", 90)
        .attr("height", 8)
        .attr("class", function(v) { return v.class });

    // outlier text box
    div.append("div")
        .style("position", "relative")
        .style("bottom", "120px")
        .style("left", $data.width + "px")
        .append("span")
        .style("font-size", "18px")
        .style("padding", "8px")
        .attr("class", "outliers label");

    $data.dispatch.on("plotSelect.histogram", function(name) {
        updateLines();
    });
    $data.dispatch.on("quartileSelect.histogram", function(name) {
        updateLines();
    })
    $data.dispatch.on("timerangeSelect.histogram", function() {
        var col;
        if ($data.selectedTimeslice == -1)
            col = $data.summaryTimeslice;
        else
            col = $data.timeslices[$data.selectedTimeslice];
        update(col);
        d3.select("img.histogram.busy").style("display", "none");
    });

    $data.dispatch.on("newTimesliceData", function() {
        update($data.summaryTimeslice);
        d3.select("img.histogram.busy").style("display", "none");
    });

    div.enableBucketSelection = function() {

        function dragmove() {
            var xPos = d3.event.x;
            console.info(xPos);
            var col = Math.floor(bars.invert(xPos));
            if (col != $data.selectedBucket) {
                $data.selectedBucket = col;
                $data.dispatch.bucketSelect(col); 
            }
        };
        var drag = d3.behavior.drag().on("drag", dragmove);

        chart.append("rect")
            .attr("class", "clickrect")
            .attr("opacity", 1e-6)
            .style("fill", "#EEE")
            .attr("width", $data.width)
            .attr("height", $data.height)
            .on("click", dragmove)
            .call(drag);
    }

    function update(bucket) {
        var counts = bucket.hist;

        x.domain([0, $data.yMax]);
        y.domain([0, Math.max($data.bucketMax, bucket.bucket_max)]);

        bars.domain([0, counts.length]);

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left");
        svg.select("g.y.axis").transition().duration(250).call(yAxis);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");
        svg.select("g.x.axis")
            .call(xAxis);

        var bar = svg.select("g.bars").selectAll("rect").data(counts);
        bar.enter().append("rect");
        bar
            .attr("width", bars(1))
            .attr("x", function(d, i) { return bars(i); })
            .transition().duration(250)
            .attr("y", function(d) {return y(d.count);})
            .attr("height", function(d) { 
                return $data.height - y(d.count); 
            });
        bar.exit().remove();
        updateLines();
        // Update the outliers text
        div.select("span.outliers")
            .text(Math.round(1000 * bucket.outliers.count / bucket.count)/10.0 + "% > "+ $data.yMax);
    }

    function updateLines() {
        var dataset;
        if ($data.selectedTimeslice == -1)
            dataset = $data.summaryTimeslice;
        else
            dataset = $data.timeslices[$data.selectedTimeslice];

        // remove apdex and rpm since they aren't response times
        var plots = $data.displayedPlots.concat([]);
        var index = plots.indexOf("apdex");
        if (index >= 0) plots.splice(index, 1);    
        index = plots.indexOf("rpm");
        if (index >= 0) plots.splice(index, 1);

        var plots = svg.select("g.plots").selectAll("line").data(plots, String);

        plots
            .attr("y1", 0)
            .attr("y2", $data.height)
            .transition()
            .attr("x1", function(d) { return x(dataset[d]); })
            .attr("x2", function(d) { return x(dataset[d]); })
        
        plots.enter()
            .append("line")
            .attr("class", function(d) { return "series "+d;})
            .attr("x1", function(d) { return x(dataset[d]); })
            .attr("x2", function(d) { return x(dataset[d]); })
            .attr("y1", 0)
            .attr("y2", $data.height)
            .style("stroke-width", 20)
            .style("opacity", 1e-06)
            .transition().duration(500)
            .style("stroke-width", 4)
            .style("opacity", 1);

        plots.exit()
            .transition()
            .style("opacity", 1e-06)
            .remove();

        svg.select("g.bars").selectAll("rect")
            .attr("class", function(d, i) { 
                var upperQuartile, lowerQuartile;
                var timeslice = $data.selectedTimeslice == -1 ? $data.summaryTimeslice : $data.timeslices[$data.selectedTimeslice];
                if ($data.selectedQuartile == "arithmetic") {
                    lowerQuartile = timeslice.mean - ( z75 * timeslice.stddev );
                    upperQuartile = timeslice.mean + ( z75 * timeslice.stddev );
                } else if ($data.selectedQuartile == "geometric") {
                    lowerQuartile = timeslice.g_mean / Math.pow(timeslice.g_stddev, z75);
                    upperQuartile = timeslice.g_mean * Math.pow(timeslice.g_stddev, z75);
                } else if ($data.selectedQuartile == "actual") {
                    lowerQuartile = timeslice.pct_25;
                    upperQuartile = timeslice.pct_75;
                }
                var lowerBound = x.invert(bars(i));
                var upperBound = x.invert(bars(i+1));
                if ($data.selectedQuartile) {
                    if (upperBound >= lowerQuartile && lowerBound <= upperQuartile)
                        return $data.selectedQuartile;
                    else
                        return "bar apdex_s";
                }
                else if ($data.displayedPlots.indexOf("apdex") == -1 || lowerBound < $data.apdex_t) 
                    return "bar apdex_s";
                else if (upperBound >= 4 * $data.apdex_t)
                    return "bar apdex_f";
                else 
                    return "bar apdex_t";
            })

    };
    return div;
}



