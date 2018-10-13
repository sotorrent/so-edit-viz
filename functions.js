
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

function extractDateString(date) {
    return date.toISOString().split(".000Z")[0].split("T")[0];
}

function extractDateAndTimeString(date) {
    return date.toISOString().split(".000Z")[0].replace("T", " ");
}

