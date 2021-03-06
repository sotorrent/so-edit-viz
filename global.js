var margin = {top: 40, right: 40, bottom: 40, left: 100};
var circleRadius = 16;
var circleStroke = 3;
var lineStroke = 3;
var gridStroke = 1;
var gridAxisWidth = 85;
var gridHeight = (2 * circleRadius) + 10;
var horizontalGridShift = 40;
var verticalGridPadding = 35;
var overlapShift = 4;

function errorMessage(errorMessage) {
    alert(errorMessage);
    throw new Error(errorMessage);
}

function readCSV(postId,  callback) {
    d3.csv("data/" + postId + ".csv", function (row) {
        return {
            PostId: parseInt(row.PostId),
            PostTypeId: parseInt(row.PostTypeId),
            EventId: parseInt(row.EventId),
            Event: row.Event,
            UserId: parseInt(row.UserId),
            CreationDateString: row.CreationDate.replace(" ", "T") + "Z", // make date ISO-8601-compatible
            CreationDate: new Date(row.CreationDate.replace(" ", "T") + "Z")
        }
    }).then(function (data) {
        data = data
            .filter(function (row) { return row.Event !== "InitialTitle"; }) // ignore initial title events
            .sort(function(row1, row2) { return row1.CreationDate - row2.CreationDate; });
        callback(data);
    });
}

function retrieveQuestionId(data) {
    return data.find(function(row) {return row.PostTypeId === 1;}).PostId;
}

function getISOString(dateString) {
    var ISOString;
    try {
        ISOString = new Date(dateString).toISOString();

    }
    catch(err) {
        try {
            // "yyyy-MM-dd" is not supported in iOS (https://stackoverflow.com/a/4310986/1974143)
            ISOString = new Date(dateString.replace(new RegExp("-", "g"), "/")).toISOString();
        }
        catch(err) { }
    }

    return ISOString;
}

function extractDateAndTimeString(dateString) {
    var ISOString = getISOString(dateString);
    if (ISOString) {
        return ISOString.split(".000Z")[0].replace("T", " ");
    } else {
        return "";
    }
}

function extractDateString(dateString) {
    var ISOString = getISOString(dateString);
    if (ISOString) {
        return ISOString.split(".000Z")[0].split("T")[0];
    } else {
        return "";
    }
}

function getTimestampsDate(dateString) {
    return new Date(dateString).toISOString().split("T")[0];
}

function retrieveTimestampsDate(data) {
    return data.map(function(row) { return getTimestampsDate(row.CreationDateString); });
}

function getTimestampsDateAndTime(dateString) {
    var ISOString = getISOString(dateString);
    if (ISOString) {
        var timestamp = ISOString.split("T");
        var time = timestamp[1].split(".")[0].split(":");
        return timestamp[0] + " " + time[0] + ":" + time[1];
    } else {
        return "";
    }
}

function retrieveTimestampsDateAndTime(data) {
    return data.map(function(row) { return getTimestampsDateAndTime(row.CreationDateString); });
}

function getBeginningOfPreviousDay(dateString) {
    var previousDay = extractDateString(dateString) + "T12:00:00Z";
    previousDay.setDate(previousDay.getDate()-1); // see https://stackoverflow.com/a/5960713
    previousDay.setUTCHours(0, 0, 1);
    return previousDay;
}

function getMiddleOfDay(dateString) {
    return extractDateString(dateString) + "T12:00:00Z";
}

function getEndOfNextDay(dateString) {
    var nextDay = extractDateString(dateString) + "T12:00:00Z";
    nextDay.setDate(nextDay.getDate()+1); // see https://stackoverflow.com/a/5960713
    nextDay.setUTCHours(23, 59, 59);
    return nextDay;
}

// see https://stackoverflow.com/a/14438954
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function getCommentUrl(questionId, commentId, postId) {
    return "https://stackoverflow.com/q/" + questionId + "#comment" + commentId + "_" + postId;
}

function getRevisonsUrl(postId) {
    return "https://stackoverflow.com/posts/" + postId + "/revisions";
}

function getFocusLink(questionId, eventId) {
    return "focus-view.html?postId=" + questionId  + "&eventId=" + eventId;
}

function retrievePosts(data) {
    var posts = {};
    data
        .filter(function(row) {return row.Event === "InitialBody";})
        .map(function(row) {return {
            PostId: row.PostId,
            PostTypeId: row.PostTypeId,
            OwnerId: row.UserId,
            CreationDateString: row.CreationDateString,
            CreationDate: row.CreationDate
        }})
        .forEach(function(post, index) {
            post["Index"] = index;

            if (post.PostTypeId === 1) {
                post["SOId"] = "q/" + post.PostId;
            } else if (post.PostTypeId === 2) {
                post["SOId"] = "a/" + post.PostId;
            }

            posts[post.PostId] = post;
        });
    return posts;
}

function configureSVG(maxX, maxY) {
    var svg = d3.select("svg")
        .attr("width", maxX + margin.left + margin.right)
        .attr("height", maxY + gridHeight + margin.top + margin.bottom);
    // group for drawing area
    svg.append("g")
        .attr("id", "mainGroup")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

function clearSVG() {
    d3.select("svg").selectAll("*").remove();
}

function getCoordinatesDiscrete(data, posts) {
    var coordinates = [];
    data.forEach(function(row, index) {
        var xPos = index;
        var yPos = posts[row.PostId].Index;
        coordinates.push([xPos, yPos, row]);
    });
    return coordinates;
}

function getCoordinatesContinuous(data, posts, timestamps) {
    var coordinates = [];
    data.forEach(function(row) {
        var timestamp = getTimestampsDateAndTime(row.CreationDateString);
        var xPos = timestamps.indexOf(timestamp);
        if (xPos === -1) {
            errorMessage("Date not found.");
        }
        var yPos = posts[row.PostId].Index;
        coordinates.push([xPos, yPos, row]);
    });

    var updatedEvents = [];
    var i, j;
    for (i=0; i<coordinates.length; i++) {
        var collisions = [];
        for (j=i+1; j<coordinates.length; j++) {
            if (!updatedEvents.includes(coordinates[j][2].EventId)
                && Math.abs(coordinates[i][0] - coordinates[j][0]) < overlapShift) {
                collisions.push(coordinates[j]);
            }
        }
        if (collisions.length > 0) {
            var offset = overlapShift/collisions.length;
            collisions.forEach(function(collision) {
                collision[0] = collision[0] + offset; // shift x coordinate
                updatedEvents.push(collision[2].EventId);
            });
            updatedEvents.push(coordinates[i][2].EventId);
        }
    }

    return coordinates;
}

function getPixelCoordinateX(coordinate, gridWidth) {
    return gridAxisWidth + coordinate * gridWidth;
}
function getPixelCoordinateY(coordinate) {
    return  (coordinate + 1) * gridHeight;
}

function drawGrid(group, timestamps, maxY, gridWidth, step) {
    var grid = group
        .append("g")
        .attr("id", "grid");
    grid.selectAll("line")
        .data(timestamps)
        .enter()
        .append("line")
        .attr("x1", function(timestamp, index) {
            return gridAxisWidth + index * gridWidth - horizontalGridShift;
        })
        .attr("y1", gridHeight - verticalGridPadding)
        .attr("x2", function(timestamp, index) {
            return gridAxisWidth + index * gridWidth - horizontalGridShift;
        })
        .attr("y2", maxY + verticalGridPadding)
        .attr("stroke", function(timestamp, index) {
            if (step != null) {
                if (index === 0 || index%step === 0) {
                    return "lightgray";
                }
            } else {
                if (index === 0 || timestamps[index] !== timestamps[index-1]) {
                    return "lightgray";
                }
            }
            return "white";
        })
        .attr("stroke-width", gridStroke)
        .attr("stroke-dasharray", "8 8");
}

function drawXAxis(group, timestamps, maxY, gridWidth, step) {
    function getTextString(timestamp, index) {
        if (step != null) {
            if (index === 0 || index%step === 0) {
                return timestamp;
            }
        } else {
            if (index === 0 || timestamps[index] !== timestamps[index-1]) {
                return timestamp;
            }
        }
        return "";
    }

    var xAxisTop = group
        .append("g")
        .attr("id", "xAxisTop");
    xAxisTop.selectAll("text")
        .data(timestamps)
        .enter()
        .append("text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central") // Chrome
        .attr("dominant-baseline", "central") // Firefox
        .attr("x", function(timestamp, index) {
            return gridAxisWidth + index * gridWidth - horizontalGridShift;
        })
        .attr("y", 0)
        .text(getTextString);

    var xAxisBottom = group
        .append("g")
        .attr("id", "xAxisBottom");
    xAxisBottom.selectAll("text")
        .data(timestamps)
        .enter()
        .append("text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central") // Chrome
        .attr("dominant-baseline", "central") // Firefox
        .attr("x", function(timestamp, index) {
            return gridAxisWidth + index * gridWidth - horizontalGridShift;
        })
        .attr("y", maxY + gridHeight)
        .text(getTextString);
}

function drawYAxis(group, posts, filteredPostIds) {
    var yAxis = group
        .append("g")
        .attr("id", "yAxis");
    yAxis.selectAll("a")
        .data(Object.keys(posts))
        .enter()
        .append("a")
        .attr("xlink:href",  function(postId) {
            return "https://stackoverflow.com/" + posts[postId].SOId;
        })
        .attr("target", "_blank")
        .append("text")
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "central") // Chrome
        .attr("dominant-baseline", "central") // Firefox
        .style("font-weight", function(postId) {
            if (filteredPostIds != null &&  filteredPostIds.includes(parseInt(postId))) {
                return "bold";
            } else {
                return "normal";
            }
        })
        .style("fill", function(postId) {
            if (filteredPostIds != null && !filteredPostIds.includes(parseInt(postId))) {
                return "lightgray";
            } else {
                return "black";
            }
        })
        .attr("x", 0)
        .attr("y", function(postId) {
            return (posts[postId].Index+1) * gridHeight;
        })
        .text(function(postId) {
            return posts[postId].SOId;
        });
}

function drawPolyLine(group, coordinates, gridWidth) {
    var polyLine = group
        .append("g")
        .attr("id", "polyLine");
    var polyLineCoordinates = "";
    coordinates.forEach(function(coordinate, index) {
        if (index > 0) {
            polyLineCoordinates += " ";
        }
        polyLineCoordinates += getPixelCoordinateX(coordinate[0], gridWidth) + "," + getPixelCoordinateY(coordinate[1]);
    });
    polyLine
        .append("polyline")
        .attr("points", polyLineCoordinates)
        .attr("fill", "none")
        .attr("stroke", "lightgray")
        .attr("stroke-width", lineStroke);
}

function drawDataPoints(group, coordinates, posts, questionId, gridWidth, linkFocusView, eventIdTarget, highlightOnClick) {
    // append the tooltip div
    var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // add data
    var dataPoints = group
        .append("g")
        .attr("id", "dataPoints");

    // helper functions
    function getSOLink(element, questionId) {
        if (element.Event === "Comment") {
            return getCommentUrl(questionId, element.EventId, element.PostId);
        } else {
            return getRevisonsUrl(element.PostId);
        }
    }

    function onClickEventHandler(coordinate) {
        if (highlightOnClick) {
            highlightEvent(coordinate[2].EventId);
        }

        if (d3.event.altKey) {
            window.open(getSOLink(coordinate[2], questionId), '_blank');
            d3.event.preventDefault();
            d3.event.stopPropagation();
        }
    }

    // add circles
    dataPoints.selectAll("a")
        .data(coordinates)
        .enter()
        .append("a")
        .attr("id", function(coordinate) {
            return "a" + coordinate[2].EventId;
        })
        .attr("xlink:href",  function(coordinate) {
            var row = coordinate[2];
            if (linkFocusView) {
                return getFocusLink(questionId, row.EventId);
            } else {
                return getSOLink(row, questionId);
            }
        })
        .attr("target", "_blank")
        .on("click", onClickEventHandler)
        .append("circle")
        .attr("id", function(coordinate) {
            return "circle" + coordinate[2].EventId;
        })
        .attr("cx", function(coordinate) {
            return getPixelCoordinateX(coordinate[0], gridWidth);
        })
        .attr("cy", function(coordinate) {
            return getPixelCoordinateY(coordinate[1]);
        })
        .attr("r", circleRadius)
        .attr("fill", function(coordinate) {
            var row = coordinate[2];
            if (row.Event === "Comment") {
                return "mediumaquamarine ";
            } else {
                return "skyblue";
            }
        })
        .attr("stroke", function(coordinate) {
            var row = coordinate[2];
            if (row.UserId === posts[row.PostId].OwnerId) {
                if (row.Event === "Comment") {
                    return "#078C5F";
                } else {
                    return "#0F5A78";
                }
            } else {
                return "tomato";
            }
        })
        .attr("stroke-width", circleStroke)
        .on("mouseover", function(coordinate) {
            if (eventIdTarget != null) {
                eventIdTarget.value = coordinate[2].EventId;
            }
            tooltip
                .transition()
                .duration(50)
                .style("opacity", 0.9);
            tooltip
                .html(extractDateAndTimeString(coordinate[2].CreationDate))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 18) + "px");
        })
        .on("mouseout", function() {
            tooltip
                .transition()
                .duration(50)
                .style("opacity", 0.0);
        })
        .on("click", onClickEventHandler);

    dataPoints.selectAll("a")
        .data(coordinates)
        .append("text")
        .attr("id", function(coordinate) {
            return "text" + coordinate[2].EventId;
        })
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central") // Chrome
        .attr("dominant-baseline", "central") // Firefox
        .attr("class", "event")
        .attr("x", function(coordinate) {
            return getPixelCoordinateX(coordinate[0], gridWidth);
        })
        .attr("y", function(coordinate) {
            return getPixelCoordinateY(coordinate[1]);
        })
        .text(function(coordinate) {
            var row = coordinate[2];

            if (row.Event === "InitialBody") { // includes "InitialTitle", which is ignored (see readCSV())
                return "I";
            } else if (row.Event === "BodyEdit") {
                return "E";
            } else if (row.Event === "TitleEdit") {
                return "TE";
            } else if (row.Event === "Comment") {
                return "C";
            } else {
                return "X";
            }
        })
        .on("click", onClickEventHandler);
}

function highlightEvent(eventId) {
    var circle = d3.select("#circle" + eventId);
    if (circle.empty()) {
        errorMessage("Event not found.")
    }
    d3.select("#highlight-circle").remove();
    d3.select("#a" + eventId)
        .append("circle")
        .attr("id", "highlight-circle")
        .attr("cx", circle.attr("cx"))
        .attr("cy", circle.attr("cy"))
        .attr("r", circleRadius + circleStroke)
        .attr("fill", "none")
        .attr("stroke", "yellow")
        .attr("stroke-width", circleStroke);
}
