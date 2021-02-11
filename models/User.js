const mongoose = require("mongoose")
const { Schema } = mongoose;

const User = new Schema({
	name: {
		type: String,
		required: true, 
	},
	email: {
		type: String,
		required: true,
		unique: true 
	},
    balance: {
		type: Number,
        required: true,
	},
	friends: [
        {
		    email: {
				type: String,
			},
	    },
    ]
})

module.exports =
	mongoose.models.User || mongoose.model('bankusers', User);