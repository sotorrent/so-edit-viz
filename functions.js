
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
