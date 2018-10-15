var margin = {top: 40, right: 40, bottom: 40, left: 100};
var circleRadius = 16;
var circleStroke = 3;
var lineStroke = 3;
var gridStroke = 1;
var gridAxisWidth = 85;
var gridHeight = (2 * circleRadius) + 10;
var horizontalGridShift = 40;
var verticalGridPadding = 35;

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
            CreationDate: new Date(row.CreationDate.replace(" ", "T") + "Z") // make date ISO-8601-compatible
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

function extractDateAndTimeString(date) {
    return date.toISOString().split(".000Z")[0].replace("T", " ");
}

function extractDateString(date) {
    return date.toISOString().split(".000Z")[0].split("T")[0];
}

function getBeginningOfPreviousDay(date) {
    var previousDay = new Date(extractDateString(date) + "T12:00:00Z");
    previousDay.setDate(previousDay.getDate()-1); // see https://stackoverflow.com/a/5960713
    previousDay.setUTCHours(0, 0, 1);
    return previousDay;
}

function getMiddleOfDay(date) {
    return new Date(extractDateString(date) + "T12:00:00Z");
}

function getEndOfNextDay(date) {
    var nextDay = new Date(extractDateString(date) + "T12:00:00Z");
    nextDay.setDate(nextDay.getDate()+1); // see https://stackoverflow.com/a/5960713
    nextDay.setUTCHours(23, 59, 59);
    return nextDay;
}

// see https://stackoverflow.com/a/14438954
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function getTimestampsDate(date) {
    return date.toISOString().split("T")[0];
}

function retrieveTimestampsDate(data) {
    return data.map(function(row) { return getTimestampsDate(row.CreationDate); });
}

function getTimestampsDateAndTime(date) {
    var timestamp = date.toISOString().split("T");
    var time = timestamp[1].split(".")[0].split(":");
    return timestamp[0] + " " + time[0] + ":" + time[1];
}

function retrieveTimestampsDateAndTime(data) {
    return data.map(function(row) { return getTimestampsDateAndTime(row.CreationDate); });
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
        var timestamp = getTimestampsDateAndTime(row.CreationDate);
        var xPos = timestamps.indexOf(timestamp);
        if (xPos === -1) {
            errorMessage("Date not found.");
        }
        var yPos = posts[row.PostId].Index;
        coordinates.push([xPos, yPos, row]);
    });

    var updatedEvents = [];
    coordinates.forEach(function(coordinate) {
        var collisions = coordinates.filter(
            function(otherCoordinate) {
                return coordinate !== otherCoordinate
                    && !updatedEvents.includes(otherCoordinate[2].EventId)
                    && Math.abs(coordinate[0]-otherCoordinate[0]) <= 5;
            });
        if (collisions.length > 0) {
            collisions.push(coordinate);
            collisions.sort(function(collision1, collision2) {
                return collision1[2].CreationDate - collision2[2].CreationDate;
            });
            var offset = gridWidth/(collisions.length-1);
            var i;
            updatedEvents.push(collisions[0][2].EventId);
            for (i=1; i<collisions.length; i++) {
                collisions[i][0] = collisions[i][0] + offset;
                updatedEvents.push(collisions[i][2].EventId);
            }
        }
    });

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

function drawDataPoints(group, coordinates, posts, questionId, gridWidth, linkFocusView) {
    // append the tooltip div
    var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // add data
    var dataPoints = group
        .append("g")
        .attr("id", "dataPoints");

    // add circles
    dataPoints.selectAll("circle")
        .data(coordinates)
        .enter()
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
        });

    // add text labels
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
                if (row.Event === "Comment") {
                    return getCommentUrl(questionId, row.EventId, row.PostId);
                } else {
                    return getRevisonsUrl(row.PostId);
                }
            }
        })
        .attr("target", "_blank")
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
        });
}
