
var remaining  = 10;
var centerSpace = 70;
var dataStore;
var radii = [centerSpace];
var maximumHeight = 600;
var pointsData = [];
var linesData = [];
var pointRadius = 2;
var highlightedPointRadius = 6;
var highlightedSiblingPointRadius = 6;
var currentNofDays = 100;
var currentStartDate = moment("20-Mar-2017", ['DD-MMM-YYYY']);
var currentEndDate = moment("31-Mar-2017", ['DD-MMM-YYYY']);
var currentSector = 'financials';
var currentExchange = 'NYSE';
var currentPerformanceFloor = 0.00;
var dataUrl = generateDataUrl();

var colors = {
	BLUE: "blue",
	BLACK: "black",
	ORANGE: "orange",
	GRAY: "grey",
	circles: "gray",
	points: "slateblue",
	pointsHover: "orangered",
	lines: "slateblue",
	linesHover: "orangered"
};


var bbox, svg, target;

var lineFunction = d3.svg.line()
						.x(function (d) {return d.cx})
						.y(function (d) {return d.cy})
						.interpolate("linear");

var toolTipDiv = d3.select("body").append("div")	
    .attr("class", "tooltip")
    .attr("id", "global-tooltip")
    .style("opacity", 0);

$('document').ready(function (){
	currentExchange = getCurrentExchange();
	currentSector = getCurrentSector();
	setTitle();
	addAllInteractionHandlers();
	drawSpider();
});

// All visualization and d3 related functions

function drawSpider(dataUrl, numOfDays) {
	dataUrl = generateDataUrl();
	console.log(dataUrl);
	numOfDays = numOfDays == undefined ? currentNofDays : numOfDays;
	setTitle();
	d3.csv(dataUrl)
	.row(function (d) {
		return processEachStockRow(d);
	})
	.get(function (err, datum) {
		// clear all previous drawings
		wipeOutPreviousWork();

		// Group stocks by name
		dataStore = groupByProperty(datum, 'Stock');
		console.log("dataStore");
		console.log(dataStore);

		// Compute all angles for each stock
		computeAllAngles();
		// Compute radius of big circle for each day
		computeRadii();
		// Generate x, y coordinates for all points and line paths
		generateAllPointsAndLinesData();

		// Draw Everything
		svg = d3.select('svg');
		bbox = svg[0][0].getBoundingClientRect();

		
		target = svg.append('g')
		    .attr('transform', "translate(" + (bbox.width / 2) + "," + (bbox.height / 2) + ")");

		target.selectAll('circle')
		    .data(pointsData)
		  .enter().append('circle')
		    .attr('r', function(d) {return d.r;})
		    .attr('cx', function(d) {return d.cx;})
			.attr('cy', function(d) {return d.cy;})
			.attr('stock', function(d) {return d.stock;})
			.style('stroke', function (d) {return d.stroke})
			.style('stroke-dasharray', function (d) {return d.strokeArray})
			.style('fill', function(d) {return d.fill;})
			.on("mouseover", mouseOverPoint)
          	.on("mouseout", mouseOutPoint)
          	.on("click", function (d){
          		console.log(d.stock);
          		window.location.href = "/timeSeries/candle.html?stock="+d.stock;
          	});

		for (var i=0; i < 10; i++) {
			if (linesData[i] == undefined || linesData[i].length == 0) {
				continue;
			}
			target.append('path')
				.attr("d", lineFunction(linesData[i]))
				.attr("stroke", colors.lines)
				.attr("stroke-width", 1)
				.attr("fill", "none")
				.attr("id", function(d) {return linesData[i][0].id;})
		}

		target.append('circle')
			.attr('r', 60)
			.attr('cx', 0)
			.attr('cy', 0)
			.style('stroke', "#f5af95")
			.style('opacity', "0.2")
			.style('fill', "#f5af95");
		target.append('text')
			.attr('x', 0)
			.attr('y', 20)
			// .text('BAC')
			.attr('id', 'center-text-el')
			.attr("font-family", "Helvetica, Arial, sans-serif")
			.attr("font-size", "60px")
            .attr("fill", "black")
            .attr("text-anchor", "middle");
	});
}

function mouseOverPoint(d, i) {
	// If this is not points - do mouse hover events
	var elem = d3.select(this);
	if (elem.attr('cx') != 0 && elem.attr('cy') != 0) {
		d3.select(this).attr({
			r: highlightedPointRadius
		});
		d3.select(this).style({
			fill: colors.pointsHover,
			stroke: colors.pointsHover,
			cursor: "pointer"
		});
		toolTipDiv.transition()
				.duration(200)
				.style("opacity", "0.9");
		toolTipDiv.html(getToolTipHtml(d))
				.style("left", (d3.event.pageX + 15) + "px")
				.style("top", (d3.event.pageY - 10) + "px");
		setTimeout(function (){
			highlightPathGivenPoint(elem.attr('cx'), elem.attr('cy'));
			highlightSiblingPointsGivenPoint(elem.attr('stock'));
			promptCenterText(elem.attr('stock'));
		}, 100);
		
	}
}

function mouseOutPoint(d, i) {
	var elem = d3.select(this);
	if (elem.attr('cx') != 0 && elem.attr('cy') != 0) {
		d3.select(this).attr({
			r: pointRadius
		});
		d3.select(this).style({
			fill: colors.points,
			stroke: colors.points,
			cursor: "default"
		});
		toolTipDiv.transition()
				.duration(300)
				.style("opacity", 0);
		setTimeout(function (){
			unHighlightPathGivenPoint(elem.attr('cx'), elem.attr('cy'));
			unHighlightSiblingPointsGivenPoint(elem.attr('stock'));
			unPromptCenterText();
		}, 100);		

	}
}

function mouseOverPath(d, i) {
	d3.select(this)
			.attr("stroke-width", 5)
			.attr("stroke", colors.linesHover);
}

function mouseOutPath(d, i) {
	d3.select(this)
			.attr("stroke-width", 1)
			.attr("stroke", colors.lines);
}

function processEachStockRow(row) {
	row.Performace = Math.abs(parseFloat(row.High) - parseFloat(row.Low)) / parseFloat(row.Close);
	row.Date =  moment(row.Date, ['DD-MMM-YYYY']); //new Date(Date.parse(row.Date.replace(/-/gm, "/")));
	// leave the remaining fields as is
	return row;
}

function groupByProperty(dataArray, key) {

	return dataArray.reduce( function (rv, x) {
		if (x["Date"].isAfter(currentStartDate) && x["Date"].isBefore(currentEndDate)) {
			rv[x[key]] = rv[x[key]] || [];
			if ( rv[x[key]].length == currentNofDays ) {
				return rv;
			} else {
				(rv[x[key]] = rv[x[key]] || []).push(x);
			}
		}
		return rv;
	}, {});
};

function computeAllAngles() {
	var perfData = [];
	var denom = 0.0;
	var previousAngle;
	for (var item in dataStore) {
		if (dataStore.hasOwnProperty(item)) {
			perfData.push(dataStore[item].map(function (a) {return isNaN(a.Performace) ? 0 : a.Performace}));
		}
	}

	// Compute denominator
	var i = 0;
	for (var item in dataStore) {
		if (dataStore.hasOwnProperty(item)) {
			denom = denom + Math.sqrt( Math.pow(Math.max.apply(null, perfData[i]) - Math.min.apply(null, perfData[i]), 2) );
			i = i + 1;
		}
	}

	// Distribute all stocks among 360 degrees
	previousAngle = (Math.sqrt( Math.pow(Math.max.apply(null, perfData[0]) - Math.min.apply(null, perfData[0]), 2) ) / denom) * 360
	var i = 0;
	for (var item in dataStore) {
		if (dataStore.hasOwnProperty(item)) {
			var rawAngle = (Math.sqrt( Math.pow(Math.max.apply(null, perfData[i]) - Math.min.apply(null, perfData[i]), 2) ) / denom) * 360
			var itemData = dataStore[item];
			dataStore[item] = {};
			dataStore[item].data = itemData;
			dataStore[item].pieShare = rawAngle;
			dataStore[item].startAngle = previousAngle;
			dataStore[item].endAngle = previousAngle + rawAngle;

			previousAngle = previousAngle + rawAngle;
			i = i + 1;			
		}
	}

	// Compute angles for all stocks on all days
	var i = 0;
	for (var item in dataStore) {
		var startAngle = dataStore[item].startAngle;
		var endAngle = dataStore[item].endAngle;
		var denominator = Math.sqrt( Math.pow(Math.max.apply(null, perfData[i]) - Math.min.apply(null, perfData[i]), 2) );
		var numerator;
		var j = 0;
		dataStore[item].data.forEach(function (elem){
			numerator = Math.sqrt( Math.pow(perfData[i][j] - Math.min.apply(null, perfData[i]), 2) );
			angleJthDay = startAngle + (endAngle - startAngle) * (numerator / denominator);
			dataStore[item].data[j].Angle = angleJthDay;
			j = j + 1;
		});

	}

	console.log(dataStore);
}

function computeRadii() {
	// one radius to represent each day
	var tempkeys = Object.keys(dataStore)
	var Daylength = dataStore[tempkeys[0]].data.length;
	var numOfDays = dataStore[tempkeys[0]].data.length;
	var initialRadius = radii[0];
	for (var i=1; i< numOfDays; i++) {
		radii.push(initialRadius + (i) * ((maximumHeight - 2* initialRadius)  / (2 * numOfDays)) );
	}

	console.log(radii);
}

function generateAllPointsAndLinesData() {
	// Generate big circles
	for (var i=0; i< radii.length; i++) {
		pointsData.push({
			"cx": 0, "cy": 0, "stroke": colors.circles, "strokeArray": (7,2),
			"r": radii[i]
		});
	}

	// Generate data points
	var i=0;
	for (item in dataStore) {
		var j=0;
		linesData[i] = [];

		var sumOfPerformance = 0.0;
		dataStore[item].data.forEach(function (elem) {
			sumOfPerformance = sumOfPerformance + elem.Performace;
		});

		var avgPerformance = sumOfPerformance / dataStore[item].data.length;
		console.log(avgPerformance);

		if (avgPerformance >= currentPerformanceFloor) {
			dataStore[item].data.forEach(function (elem) {
				xcoord = radii[j] * Math.cos(toRadians(elem.Angle));
				ycoord = -1.0 * radii[j] * Math.sin(toRadians(elem.Angle)); //-1 coz, SVG coordinate system is reverse
				pointsData.push({
					"cx": xcoord, "cy": ycoord, "r": pointRadius, "fill": colors.points,
					"stock": elem.Stock.toUpperCase(), "date": elem.Date, "open": elem.Open, 
					"close": elem.Close, "high": elem.High, "low": elem.Low,
					"perf": elem.Performace, "vol": elem.Volume, "stroke": colors.points
				});
				linesData[i].push({
					"cx": xcoord, "cy": ycoord, "r": pointRadius, "fill": colors.lines, "id": "line"+i
				});
				j = j + 1;
			});
			i = i + 1;
		}

	}
	console.log(pointsData);
	console.log(linesData);
}

function toRadians(angle) {
	return angle * (Math.PI / 180);
}

function getToolTipHtml(element) {
	// var htmlString = "<table><tr><th>"+ stockSymbolNameMap[(element.stock).toLowerCase()] +"</th></tr>";
	var htmlString = "<p><strong>"+ stockSymbolNameMap[(element.stock).toLowerCase()] +"</strong></p>";
	htmlString = htmlString + "<p>"+ element.date.format('MMMM Do YYYY') +"</p><table>";
	htmlString = htmlString + "<tr><td><b>Stock : </b></td><td>" + element.stock + "</td></tr>";
	// htmlString = htmlString + "<tr><td><b>Date  : </b></td><td>" + element.date.toDateString() + "</td></tr>";
	htmlString = htmlString + "<tr><td><b>Open  : </b></td><td>" + element.open + "</td></tr>";
	htmlString = htmlString + "<tr><td><b>Close : </b></td><td>" + element.close + "</td></tr>";
	htmlString = htmlString + "<tr><td><b>Low   : </b></td><td>" + element.low + "</td></tr>";
	htmlString = htmlString + "<tr><td><b>Vol   : </b></td><td>" + element.vol + "</td></tr>";
	htmlString = htmlString + "<tr><td><b>Perf  : </b></td><td>" + (element.perf * 100).toFixed(3) + "% </td></tr>";
	var htmlString = htmlString + "</table>";
	

	return htmlString;
}

function highlightPathGivenPoint(x, y) {
	var i = getLineIndexFromPoint(x, y);

	if (i != linesData.length) {
		// Highlight this ith line
		d3.select("#line"+i)
				.attr("stroke-width", 5)
				.attr("stroke", colors.linesHover);
				// .attr("fill", "yes");
	}
}

function unHighlightPathGivenPoint(x, y) {
	var i = getLineIndexFromPoint(x, y);

	if (i != linesData.length) {
		// Highlight this ith line
		d3.select("#line"+i)
				.attr("stroke-width", 1)
				.attr("stroke", colors.lines);
				// .attr("fill", "none");
	}
}

function highlightSiblingPointsGivenPoint(stock) {
	d3.selectAll("circle[stock="+ stock + "]")
		.attr({
			r: highlightedSiblingPointRadius
		})
		.style({
			fill: colors.pointsHover,
			stroke: colors.pointsHover,
			cursor: "pointer"
		});
}

function unHighlightSiblingPointsGivenPoint(stock) {
	d3.selectAll("circle[stock="+ stock + "]")
		.attr({
			r: pointRadius
		})
		.style({
			fill: colors.points,
			stroke: colors.points,
			cursor: "default"
		});
}

function promptCenterText(stock) {
	var symbText = stock.toUpperCase();
	var fontSize = symbText.length <=2 ? "60px" : (symbText.length == 3 ? "40px" : "30px");
	var yCoord = symbText.length <=2 ? 20 : (symbText.length == 3 ? 15 : 10);
	d3.select("#center-text-el")
		.text(symbText)
		.attr("font-size", fontSize)
		.attr('y', yCoord);
}

function unPromptCenterText() {
	d3.select("#center-text-el")
		.text("");
}

function getLineIndexFromPoint(x, y) {
	var found = false;
	for (var i=0; i < linesData.length; i++) {
		for (var j=0; j<linesData[i].length; j++) {
			if (linesData[i][j].cx == x && linesData[i][j].cy == y) {
				found = true;
				break;
			}
		}
		if (found)
			break;
	}
	return i;
}

function wipeOutPreviousWork() {
	dataStore = undefined;
	pointsData = [];
	linesData = [];
	radii = [centerSpace];
	d3.select('svg').selectAll("*").remove();
}
// All interactions event handlers
function addAllInteractionHandlers() {
	$("#sector-select").on("change", function () {
		var sector = $(this).find("option:selected").val();
		currentSector = sector;
		var dataUrl = '/datum/nyse/'+ currentSector +'/all.txt';
		drawSpider(dataUrl, currentNofDays);
	});

	$("#time-select").on("change", function () {
		var days = $(this).find("option:selected").val();
		currentNofDays = parseInt(days);
		console.log(currentNofDays);
		var dataUrl = '/datum/nyse/'+ currentSector +'/all.txt';
		drawSpider(dataUrl, currentNofDays);
	});

	$('input[name="daterange"]').daterangepicker({
		locale: {
		  format: 'MM-DD-YYYY'
		},
		startDate: '04-01-2016',
		endDate: '03-31-2017'
	}, function(start, end, label) {
		console.log("A new date range was chosen: " + start.format('MM-DD-YYYY') + ' to ' + end.format('MM-DD-YYYY'));
		currentStartDate = moment(start.format('MM/DD/YYYY')); //new Date(start.format('MM-DD-YYYY'));
		currentEndDate = moment(end.format('MM/DD/YYYY')); //new Date(end.format('MM-DD-YYYY'));
		var dataUrl = '/datum/NYSE/'+ currentSector +'/all.txt';
		drawSpider(dataUrl, currentNofDays);
	});

	$("#perf-select").on("change", function () {
		var perfSelected = $(this).find("option:selected").val();
		currentPerformanceFloor = parseFloat(perfSelected);
		var dataUrl = '/datum/nyse/'+ currentSector +'/all.txt';
		drawSpider(dataUrl, currentNofDays);
	});

}

function getCurrentExchange() {
	var t = currentExchange;
	var queryString = window.location.search.substring(1);
	if (queryString.length == 0) {
		return t.toUpperCase();
	} else {
		var queryData = queryString.split("&");
		queryData.forEach(function(item) {
			if (item.split("=")[0] == "exch") {
				t = item.split("=")[1];
			}
		});
	}
	return t.toUpperCase();
}

function getCurrentSector() {
	var t = currentSector;
	var queryString = window.location.search.substring(1);
	if (queryString.length == 0) {
		return t;
	} else {
		var queryData = queryString.split("&");
		queryData.forEach(function(item) {
			if (item.split("=")[0] == "sector") {
				t = item.split("=")[1];
			}
		});
	}
	$("#sector-select").val(t.toLowerCase());
	return t;
}

function generateDataUrl() {
	return './datum/' + currentExchange + '/'+ currentSector + '/all.txt'
}

function setTitle() {
	var sectorNameMap = {
		"financials"	: "Financials",
        "consumer_goods": "Consumer Goods",
        "healthcare"	: "HealthCare",
        "utilities"		: "Utilities",
        "technology"	: "Technology",
        "services"		: "Services",
        "industrial_goods": "Industrial Goods",
        "basic_materials": "Basic Materials",
        "energy"		:"Energy",
        "real_estate"	: "Real Estate"
	}
	console.log(sectorNameMap);
	$('#viz-title').text(currentExchange + ": Volatility in the " + sectorNameMap[currentSector] + " sector");
}

var stockSymbolNameMap = {
	"aav":"Advantage Oil & Gas Ltd  Ordina",
	"abb":"ABB Ltd",
	"abbv":"AbbVie Inc.",
	"acc":"American Campus Communities Inc",
	"adc":"Agree Realty Corporation",
	"aep":"American Electric Power Company",
	"aht":"Ashford Hospitality Trust Inc",
	"aiv":"Apartment Investment and Manage",
	"akr":"Acadia Realty Trust",
	"alx":"Alexander's, Inc.",
	"apa":"Apache Corporation",
	"apc":"Anadarko Petroleum Corporation",
	"are":"Alexandria Real Estate Equities",
	"arl":"American Realty Investors, Inc.",
	"atw":"Atwood Oceanics, Inc.",
	"avb":"AvalonBay Communities, Inc.",
	"ba":"Boeing Company (The)",
	"baba":"Alibaba Group Holding Limited A",
	"bac":"Bank of America Corporation",
	"bbg":"Bill Barrett Corporation",
	"bbl":"BHP Billiton plc Sponsored ADR",
	"bch":"Banco De Chile Banco De Chile A",
	"bhi":"Baker Hughes Incorporated",
	"bhp":"BHP Billiton Limited",
	"bmy":"Bristol-Myers Squibb Company",
	"bp":"BP p.l.c.",
	"bpl":"Buckeye Partners L.P.",
	"bpt":"BP Prudhoe Bay Royalty Trust",
	"bsac":"Banco Santander - Chile ADS",
	"bud":"Anheuser-Busch Inbev SA Sponsor",
	"c":"Citigroup, Inc.",
	"cat":"Caterpillar, Inc.",
	"ccj":"Cameco Corporation",
	"ccl":"Carnival Corporation",
	"chl":"China Mobile Limited",
	"crm":"Salesforce.com Inc",
	"cvx":"Chevron Corporation",
	"d":"Dominion Resources, Inc.",
	"dhr":"Danaher Corporation",
	"dis":"Walt Disney Company (The)",
	"duk":"Duke Energy Corporation (Holdin",
	"ec":"Ecopetrol S.A. American Deposit",
	"exc":"Exelon Corporation",
	"fdx":"FedEx Corporation",
	"gd":"General Dynamics Corporation",
	"ge":"General Electric Company",
	"gsk":"GlaxoSmithKline PLC",
	"hd":"Home Depot, Inc. (The)",
	"hon":"Honeywell International Inc.",
	"hsbc":"HSBC Holdings, plc.",
	"ibm":"International Business Machines",
	"jnj":"Johnson & Johnson",
	"jpm":"JP Morgan Chase & Co.",
	"kep":"Korea Electric Power Corporatio",
	"ko":"Coca-Cola Company (The)",
	"lmt":"Lockheed Martin Corporation",
	"low":"Lowe's Companies, Inc.",
	"ma":"Mastercard Incorporated",
	"mcd":"McDonald's Corporation",
	"mdt":"Medtronic plc. Ordinary Shares",
	"mmm":"3M Company",
	"mrk":"Merck & Company, Inc.  (new)",
	"nee":"NextEra Energy, Inc.",
	"ngg":"National Grid Transco, PLC Nati",
	"nke":"Nike, Inc.",
	"nvs":"Novartis AG",
	"oran":"Orange",
	"orcl":"Oracle Corporation",
	"pcg":"Pacific Gas & Electric Co.",
	"pep":"Pepsico, Inc.",
	"pfe":"Pfizer, Inc.",
	"pg":"Procter & Gamble Company (The)",
	"pld":"ProLogis, Inc.",
	"pm":"Philip Morris International Inc",
	"ptr":"PetroChina Company Limited",
	"rai":"Reynolds American Inc",
	"ry":"Royal Bank Of Canada",
	"sap":"SAP  SE ADS",
	"slb":"Schlumberger N.V.",
	"snp":"China Petroleum & Chemical Corp",
	"sny":"Sanofi American Depositary Shar",
	"so":"Southern Company (The)",
	"sre":"Sempra Energy",
	"t":"AT&T Inc.",
	"td":"Toronto Dominion Bank (The)",
	"tef":"Telefonica SA",
	"tm":"Toyota Motor Corporation",
	"tot":"Total S.A.",
	"ul":"Unilever PLC",
	"un":"Unilever NV",
	"unh":"UnitedHealth Group Incorporated",
	"unp":"Union Pacific Corporation",
	"ups":"United Parcel Service, Inc.",
	"utx":"United Technologies Corporation",
	"v":"Visa Inc.",
	"vmw":"Vmware, Inc. Common stock, Clas",
	"vz":"Verizon Communications Inc.",
	"wmt":"Wal-Mart Stores, Inc.",
	"xom":"Exxon Mobil Corporation",
	"aal":"American Airlines Group, Inc.",
	"aame":"Atlantic American Corporation",
	"aaon":"AAON, Inc.",
	"aapl":"Apple Inc.",
	"abcb":"Ameris Bancorp",
	"abco":"The Advisory Board Company",
	"acfc":"Atlantic Coast Financial Corpor",
	"acgl":"Arch Capital Group Ltd.",
	"acnb":"ACNB Corporation",
	"adbe":"Adobe Systems Incorporated",
	"ades":"Advanced Emissions Solutions, I",
	"ainv":"Apollo Investment Corporation -",
	"alsk":"Alaska Communications Systems G",
	"alxn":"Alexion Pharmaceuticals, Inc.",
	"amgn":"Amgen Inc.",
	"amnb":"American National Bankshares, I",
	"amrb":"American River Bankshares",
	"amtd":"TD Ameritrade Holding Corporati",
	"amzn":"Amazon.com, Inc.",
	"arcb":"ArcBest Corporation",
	"arlp":"Alliance Resource Partners, L.P",
	"artna":"Artesian Resources Corporation ",
	"atni":"ATN International, Inc.",
	"axas":"Abraxas Petroleum Corporation",
	"bcpc":"Balchem Corporation",
	"bctf":"Bancorp 34, Inc.",
	"biib":"Biogen Inc.",
	"bmrn":"BioMarin Pharmaceutical Inc.",
	"bur":"Burcon NutraScience Corp - Ordi",
	"ccoi":"Cogent Communications Holdings,",
	"celg":"Celgene Corporation",
	"cenx":"Century Aluminum Company",
	"cern":"Cerner Corporation",
	"cetc":"Hongli Clean Energy Technologie",
	"chnr":"China Natural Resources, Inc.",
	"cigi":"Colliers International Group In",
	"cmcsa":"Comcast Corporation",
	"cresy":"Cresud S.A.C.I.F. y A. - Americ",
	"crzo":"Carrizo Oil & Gas, Inc.",
	"csco":"Cisco Systems, Inc.",
	"csx":"CSX Corporation",
	"ctas":"Cintas Corporation",
	"ctrp":"Ctrip.com International, Ltd. -",
	"ctws":"Connecticut Water Service, Inc.",
	"cwco":"Consolidated Water Co. Ltd. - O",
	"dgas":"Delta Natural Gas Company, Inc.",
	"dish":"DISH Network Corporation",
	"dltr":"Dollar Tree, Inc.",
	"dmlp":"Dorchester Minerals, L.P.  Repr",
	"emitf":"Elbit Imaging Ltd. - Ordinary S",
	"eng":"ENGlobal Corporation",
	"eqix":"Equinix, Inc.",
	"esrx":"Express Scripts Holding Company",
	"fast":"Fastenal Company",
	"fb":"Facebook, Inc.",
	"ftr":"Frontier Communications Corpora",
	"gifi":"Gulf Island Fabrication, Inc.",
	"gild":"Gilead Sciences, Inc.",
	"glng":"Golar LNG Limited",
	"gncma":"General Communication, Inc.",
	"gold":"Randgold Resources Limited - Am",
	"good":"Gladstone Commercial Corporatio",
	"googl":"Alphabet Inc.",
	"gpor":"Gulfport Energy Corporation",
	"grif":"Griffin Industrial Realty, Inc.",
	"gure":"Gulf Resources, Inc.",
	"gyro":"Gyrodyne , LLC",
	"has":"Hasbro, Inc.",
	"hayn":"Haynes International, Inc.",
	"holx":"Hologic, Inc.",
	"hpt":"Hospitality Properties Trust - ",
	"hsic":"Henry Schein, Inc.",
	"hwkn":"Hawkins, Inc.",
	"igld":"Internet Gold Golden Lines Ltd.",
	"iknx":"Ikonics Corporation",
	"ircp":"IRSA Propiedades Comerciales S.",
	"jbht":"J.B. Hunt Transport Services, I",
	"lbtya":"Liberty Global plc - Class A Or",
	"lone":"Lonestar Resources US Inc.",
	"mar":"Marriott International",
	"mat":"Mattel, Inc.",
	"mgee":"MGE Energy Inc.",
	"msex":"Middlesex Water Company",
	"msft":"Microsoft Corporation",
	"nflx":"Netflix, Inc.",
	"ottr":"Otter Tail Corporation",
	"pcar":"PACCAR Inc.",
	"pcyo":"Pure Cycle Corporation",
	"pntr":"Pointer Telocation Ltd. - Ordin",
	"pypl":"PayPal Holdings, Inc.",
	"qcom":"QUALCOMM Incorporated",
	"rgco":"RGC Resources Inc.",
	"self":"Global Self Storage, Inc.",
	"shen":"Shenandoah Telecommunications C",
	"sify":"Sify Technologies Limited - Ame",
	"spok":"Spok Holdings, Inc.",
	"txn":"Texas Instruments Incorporated",
	"vrsk":"Verisk Analytics, Inc.",
	"yhoo":"Yahoo! Inc.",
	"yorw":"The York Water Company"
}