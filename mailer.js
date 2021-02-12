const nodemailer = require('nodemailer')

class Mailer {

    constructor(from) {
        this.from = from
        this.transport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'cowardly.cowboys@gmail.com',
                pass: process.env.GMAIL_PASSWORD
            }
        })
    }

    sendMail(to) {
        const email = {
            from: this.from,
            to: to,
            subject: "Friend request",
            html: `Hi there,<br/><br/>
                I would like to invite you to be my friend<br/><br/>
                <a style="text-decoration:none;padding:15px;background-color:green;color:white;border-radius:3px;" 
                href="${process.env.BASE_URL}/login">
                Accept Request</a>`,
            replyto: 'no-reply@banking-app.com'
        }

        this.transport.sendMail(email, (err, result) => {
            Mailer.sent.push(err || result)
        })
    }
}

module.exports = Mailer