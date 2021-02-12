const mongoose = require("mongoose")
const { Schema } = mongoose;

const Transaction = new Schema({
	sender: {
		type: String,
		required: true, 
	},
	recipient: {
		type: String,
		required: true,
	},
    timeSent: {
		type: Date,
        required: true,
	},
	amount: {
		type: Number,
		required: true,
	}
})

module.exports =
	mongoose.models.Transaction || mongoose.model('transactions', Transaction);