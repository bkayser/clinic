/*
 * This is a data structure used to hold a data set that has been aggregated according
 * to a particular bucket size given by a "density" parameter.
 */

$data = {};
$data.file = "";
// General layout parameters to ensure the charts have roughly the same
// dimensions
$data.width = 500;
$data.height = 280;
$data.margin = {top: 8, right: 50, bottom: 30, left: 50}
$data.yMax = 5000;
$data.density = 50;
$data.apdex_t = 500;
// The json files have two different values that can be plotted, front end
// and back end.
$data.measure = "frontend";
$data.primary_dim = "transaction";
$data.dimensions = ["transaction"];
$data.dispatch = d3.dispatch("newTreemapData",    // new treemap data loaded
			     "newTimesliceData",  // new timeslice data loaded 
			     "newHorizonData",  // new timeslice data loaded 
			     "timerangeSelect",   // new timerange selection
			     "tick",              // advance an animation on the timeline, arg is time object
			     "reloadData",        // settings changed, go get new data
			     "bucketSelect",      // new value range selected
			     "quartileSelect",      // new value range selected
			     "plotSelect");       // selected or deselected a plot line

// The filter is a subset of values based on the label.  The filter can be "only" or "except"
$data.filter = ""
$data.only = "1"

// Transform the data into log space after loading the dataset
$data.logTransform = false;

$data.displayedPlots = ["mean"];

// The timeslice array contains objects with fields that correspond to the plot values for each timeslice
// like mean, median, apdex, etc.  There is also a hist field with an array of values for the distribution
// of values in that timeslice.  This array drives the histogram as well as the heatmap.
$data.timeslices = []

// The summary timeslice is a timeslice record with values and a histogram for the complete
// timerange of the dataset.      
$data.summaryTimeslice = {}

$data.treemapRoot = {}
$data.counts = []

// The maximum count across all the buckets in each timeslice's histogram, used to normalize
// the per-timeslice histogram display.
$data.bucketMax = 0;

// -1 means summary data is the initial selection, otherwise this is the
// index of data.timeslices
$data.selectedTimeslice = -1;

// -1 means entire timerange of data in scope, otherwise it's the bucket index into $data.timeslices[n].hist
$data.selectedBucket = -1;

// Selected quartile: arithmetic, geometric, actual or null
$data.selectedQuartile = null;

function togglePlotline(name) {
    var pos = $data.displayedPlots.indexOf(name);
    if (pos == -1)
        $data.displayedPlots.push(name)
    else
        $data.displayedPlots.splice(pos, 1);
    $data.dispatch.plotSelect(name);
}

/*
 * This supports a text area identified as #range that displays a
 * description of the current selected scope, as well as a reset
 * button #reset that appears and will reset the selection.
 */
function showSelection() {
    var xScale = d3.time.scale()
        .rangeRound([0, $data.timeslices.length])
        .domain([$data.timeslices[0].time, $data.timeslices[$data.timeslices.length-1].time])
    var yScale = d3.scale.linear()
        .rangeRound([0, $data.yMax])
        .domain([0, $data.summaryTimeslice.hist.length]);

    var format = d3.time.format("%H:%M:%S")
    var info = [];
    if ($data.selectedBucket != -1) {
        info.push(yScale($data.selectedBucket)+ " ms to "+ yScale($data.selectedBucket+1)+" ms");
    }
    if ($data.selectedTimeslice != -1) {
        info.push(format(xScale.invert($data.selectedTimeslice))+ " to "+ format(xScale.invert($data.selectedTimeslice+1)));
    }
    var desc = d3.select("#range");
    var resetLink = d3.select("#reset");
    if (info.length == 0) {
        desc.text("");
        resetLink.style("display", "none");
    } else {
        desc.text("Range: "+info.join(", "));
        resetLink.style("display","inline");
    }
}
function resetSelection() {
    $data.selectedBucket = -1;
    $data.selectedTimeslice = -1;
    showSelection();
    $data.dispatch.newTimesliceData();
    $data.dispatch.newTreemapData();
}

function refreshData() {
    form = d3.select("form")
    $data.yMax = d3.select("input#y_max").node().value;
    $data.density = d3.select("input#density").node().value;
    $data.apdex_t = d3.select("input#apdex_t").node().value;
    $data.filter = d3.select("select#filter").node().selectedOptions[0].value;
    var nextFile = d3.select("select#filename").node().selectedOptions[0].value;
    var nextAttr = d3.select("select#primary_dim").node().selectedOptions[0].value;
    var switchedFile = nextFile != $data.file || nextAttr != $data.primary_dim;
    if (switchedFile) {
        $data.primary_dim = nextAttr;
	$data.file = nextFile;
	$data.filter = "";
	$data.selectedBucket = -1;
	$data.selectedTimeslice = -1;
	showSelection();
    }
    $data.measure = d3.select("input#frontend").node().checked ? "frontend" : "backend";
    $data.only = d3.select("input#only").node().checked ? "1" : "0";
    $data.logTransform = d3.select("input#log_transform").node().checked ? "1" : "0";
    $data.dispatch.reloadData(switchedFile);
    return false;
}

function loadTimesliceData(switchedFile) {

    d3.selectAll("img.busy").style("display", "inline");
    d3.json("/data/aggregate/"+$data.file+"?" + 
            "measure=" + $data.measure + "&" +
            "apdex_t=" + $data.apdex_t + "&" +
            "buckets=" + ($data.density * $data.width / $data.height) + "&" +
            "filter=" + $data.filter + "&" +
            "density=" + $data.density + "&" +
            "primary_dim=" + $data.primary_dim + "&" +
            "value_index=" + $data.value_index + "&" +
            "y_max=" + $data.yMax + "&" +
            "log=" + $data.logTransform + "&" +
            "only=" + $data.only,

            function(error, data) {
		// calculate the maximum bucket for all the histograms.  This will help
		// us keep the y scale the same
		$data.bucketMax = 0;
		// The first bucket is the list of dimensions for the dataset
		$data.dimensions = data.shift();
		// The second bucket is the summary for the entire time range
		$data.summaryTimeslice = data.shift();
		$data.summaryTimeslice.time = new Date($data.summaryTimeslice.time);
		data.forEach(function(d) {
		    // translate the timestamp into a date for display on the x axis.
		    d.time = new Date(d.time);
		    $data.bucketMax = d3.max([$data.bucketMax, d.bucket_max]);
		});
		$data.timeslices = data;
		if (switchedFile) {
		    var scopes = d3.keys($data.summaryTimeslice.breakdown)
                .slice(0,20)
		        .filter(function(scope){ return scope != "" });
            scopes.unshift("");
		    var options = d3.select("select#filter").selectAll("option").data(scopes);
		    options.enter()
			.append("option")
		    options
			.attr("value",String)
			.attr("selected", function(m) { return (m == $data.filter) ? "true" : null; })
			.text(function(m) { return m == "" ? "All" : m });
		    options.exit().remove()
		    
		    // update the options menu for the dimension to view
		    options = d3.select("select#primary_dim").selectAll("option").data($data.dimensions);
		    options.enter()
		        .append("option")
		    options
			.attr("value",String)
			.attr("selected", function(m) { return (m == $data.primary_dim) ? "true" : null; })
			.text(String);
		    options.exit().remove()
		}
		$data.dispatch.newTimesliceData();
            });
    d3.select("input#frontend").attr("checked", $data.measure == "frontend" ? 'true' : null);
    d3.select("input#backend").attr("checked", $data.measure == "backend" ? 'true' : null);
    d3.select("input#only").attr("checked", $data.only == "1" ? 'true' : null);
    d3.select("input#except").attr("checked", $data.only == "0" ? 'true' : null);
}
function selectQuartile(button) {
    $data.selectedQuartile = button.value;
    $data.dispatch.quartileSelect(button.value);
}

$data.dispatch.on("reloadData.index", loadTimesliceData);
$data.dispatch.on("timerangeSelect.index", showSelection);
$data.dispatch.on("bucketSelect.index", showSelection);

/*
 * Z score for probability 75%.
 */
var z75 = 0.675 // z score for p - 0.75
