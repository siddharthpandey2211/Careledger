const axios = require('axios');
const {config} = require('dotenv');
config();

const sendMail = async (data) => {
    try {
        const response = await axios.post('https://tanishparekh.app.n8n.cloud/webhook-test/ea5fc651-fb76-4bce-a883-59a419f68277', data , {
      headers: {
        'Content-Type': 'application/json',
        "x-api-key" : process.env["n8n-api-key"]
      }
    });
    return response.status
    } catch (error) {
        console.error('Email sending failed:', error.message);
        throw error;
    }
}


module.exports = sendMail;