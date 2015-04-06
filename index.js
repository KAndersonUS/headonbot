var config = require("./config.js");
var mongoose = require("mongoose");
require("./schema.js");
var Comment = mongoose.model('Comment');
mongoose.connect(config.mongoConnectionUri);
var db = mongoose.connection;

db.on("open", function () {
    var Snoocore = require("snoocore");
    var reddit = new Snoocore({
        userAgent: 'snoocore:headonbot:v0.1.0 by /u/ki85squared',
        login: { username: config.reddit.username, password: config.reddit.password },
        oauth: {
            type: 'script',
            consumerKey: config.reddit.consumerKey,
            consumerSecret: config.reddit.consumerSecret,
            scope: [ 'flair', 'identity', 'read', 'submit', 'history' ]
        }
    });

    var message = "[Apply directly to the forehead!](https://www.youtube.com/watch?v=f_SwD7RveNE)";
    var regex = /(?:headon|head[\s|-]on)[^a-zA-Z0-9\s\:]*$/i;

    // Grab comments here //
    reddit.auth().then(function() {
        setInterval(function () {
            reddit('/r/all/comments.json').get().then(function(result) {
                //console.log("Scanned " + result.data.children.length + " comments");
                if (result.hasOwnProperty("data") && result.data.hasOwnProperty("children")) {
                    var comments = result.data.children;
                    for (var i=0; i<comments.length; i++) {
                        if (!comments[i].hasOwnProperty("data") || !comments[i]["data"].hasOwnProperty("body")) {
                            // skip if the required data isn't there
                            continue;
                        }
                        var cBody = comments[i]["data"]["body"];
                        if (cBody && cBody.match(regex)) {
                            var comment = result.data.children[i].data;
                            (function (comment) {
                                Comment.findOne({_id:comment.name}, function (err, doc) {
                                    if (doc) {
                                        Comment.update({_id : comment.name}, {$set:{body : comment.body}}, {upsert:true}, function (err) {
                                            if (err) {console.log(err);}
                                        });
                                    } else {
                                        new Comment({
                                            _id : comment.name,
                                            body : comment.body
                                        }).save();
                                    }
                                });
                            })(comment);
                        }
                    }
                }
            });
        },5000); // Grab new comments every 5 seconds
    });

    var throttle = 0; // throttle is used to churn through queue.
    var throttleInterval = 10000; // check queue every ten seconds
    // Counts down the throttle //
    setInterval(function () {
        switch (throttle) {
            case (throttle > throttleInterval):
                throttle -= throttleInterval;
                break;
            default:
                throttle = 0;
                // time to post, if there are any in the queue
                Comment.find({replied:false}).sort({capturedDate:-1}).limit(1).exec(function (err, result) {
                    if (err) { console.log(err); }
                    else {
                        if (result.length > 0) {
                            postComment(result[0]._id, function (err) {
                                if (err) { console.dir(err); }
                            });
                            throttle = 300000; // reset to 5 mins after each comment posting attempt
                        }
                    }
                });
        }
    }, throttleInterval);

    // Posts the comment //
    function postComment (commentId, cb) {
        reddit('/api/comment').post({
            api_type : "json",
            text : message,
            thing_id : commentId
        }).then(function(data) {
            console.log(data); // Log the response
            if (data.errors && data.errors.length > 0) {
                cb(data.errors);
            } else {
                Comment.update({_id:commentId}, {$set:{replied:true, repliedDate: new Date()}}, function (err) {
                    if (err) {cb(err);} else { console.log("replied!"); cb(null);}
                });
            }
        });
    }
});