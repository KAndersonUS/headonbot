var mongoose = require("mongoose");
var Schema = mongoose.Schema;

commentSchema = new Schema ({
    _id : {type: String, unique: true},
    body : {type: String, text: true},
    captureDate : {type: Date, default: Date.now},
    replied : {type: Boolean, default: false},
    repliedDate: {type: Date}
});
commentSchema.index({replied: -1, captureDate:-1});

mongoose.model('Comment', commentSchema);